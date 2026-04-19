import { joinRoom } from 'https://esm.sh/trystero@0.20.0/torrent';

const APP_ID = 'ordinal-stream-game-v1';

const $ = (id) => document.getElementById(id);
const log = (msg, type = 'info') => {
  const el = $('log');
  if (!el) return console.log(msg);
  const line = document.createElement('div');
  line.className = 'line ' + type;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
};

let room = null;
let videoStream = null;
let audioStream = null;
let combinedStream = null;
let canvasEl = null;
let frameEl = null;
let docEl = null;
let startTime = null;
let viewers = new Set();
let inputCounter = 0;
let frameCounter = 0;
let frameRafId = null;
let wakeLock = null;
let sendStats = null;
let sendBack = null;

function getOrCreateRoomId() {
  let id = localStorage.getItem('game-bridge-room-id');
  if (!id) {
    id = 'game-' + crypto.randomUUID().split('-')[0];
    localStorage.setItem('game-bridge-room-id', id);
  }
  return id;
}
const setRoomId = (v) => { $('room-id').value = v; };
const getRoomId = () => $('room-id').value.trim();

function updateStatus() {
  $('stat-viewers').textContent = viewers.size;
  if (startTime) {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    $('stat-uptime').textContent = `${h}:${m}:${s}`;
  } else {
    $('stat-uptime').textContent = '00:00:00';
  }
}
setInterval(updateStatus, 1000);

setInterval(() => {
  $('stat-ips').textContent = inputCounter;
  $('stat-fps').textContent = frameCounter;
  inputCounter = 0;
  frameCounter = 0;
}, 1000);

async function loadGame() {
  const rawUrl = ($('game-url').value || '/catwar-game/').trim();
  if (!rawUrl.startsWith('/')) {
    log('Game-URL muss mit "/" beginnen (same-origin auf richart.app erforderlich)', 'err');
    return;
  }
  // We always load the game through the host wrapper (host.html). The wrapper
  // forces preserveDrawingBuffer:true on every WebGL context so canvas.captureStream()
  // produces real frames instead of black ones (Unity defaults to false for perf).
  const url = '/broadcaster/game/host.html?game=' + encodeURIComponent(rawUrl);
  log(`Lade Game über Host-Wrapper: ${rawUrl}`, 'info');
  $('placeholder').style.display = 'flex';
  $('placeholder').innerHTML = '<div>Lade…</div>';

  frameEl = $('game-frame');
  frameEl.src = url;

  await new Promise((resolve, reject) => {
    let timeout = setTimeout(() => reject(new Error('Iframe load timeout (15s)')), 15000);
    frameEl.onload = () => { clearTimeout(timeout); resolve(); };
    frameEl.onerror = () => { clearTimeout(timeout); reject(new Error('Iframe load error')); };
  }).catch(e => {
    log('Fehler beim Laden: ' + e.message, 'err');
    $('placeholder').innerHTML = '<div style="color:#f87171">Fehler: ' + e.message + '</div>';
    return null;
  });

  try {
    docEl = frameEl.contentDocument;
    if (!docEl) throw new Error('Kein Iframe-Document (Cross-Origin?)');
  } catch (e) {
    log('Cross-Origin-Iframe — Inputs unmöglich. Game muss auf richart.app liegen!', 'err');
    $('placeholder').innerHTML = '<div style="color:#f87171">Cross-Origin – kann nicht steuern</div>';
    return;
  }

  log('Iframe geladen, warte auf Unity-Canvas…', 'info');
  $('placeholder').innerHTML = '<div>Warte auf Unity-Canvas…</div>';

  canvasEl = await waitForCanvas(docEl, 30000);
  if (!canvasEl) {
    log('Canvas nicht gefunden (30s timeout)', 'err');
    $('placeholder').innerHTML = '<div style="color:#fbbf24">Kein Canvas gefunden</div>';
    return;
  }

  log(`Canvas gefunden: ${canvasEl.width}x${canvasEl.height}`, 'ok');
  $('placeholder').style.display = 'none';
  $('btn-start').disabled = false;
}

function waitForCanvas(doc, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const c = doc.querySelector('#unity-canvas, canvas');
      if (c && c.width > 0 && c.height > 0) return resolve(c);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function startStream() {
  if (!canvasEl) { log('Kein Canvas — erst Game laden', 'err'); return; }
  const roomId = getRoomId();
  if (!roomId) { log('Stream-ID fehlt', 'err'); return; }

  log('Starte Capture vom Game-Canvas…', 'info');
  videoStream = canvasEl.captureStream(60);
  log(`Video-Track: ${videoStream.getVideoTracks()[0].label || 'canvas'}`, 'ok');

  if ($('opt-audio').checked) {
    try {
      log('Bitte Game-Tab im Picker wählen + "Tab-Audio teilen"', 'info');
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const audioTrack = display.getAudioTracks()[0];
      display.getVideoTracks().forEach(t => t.stop());
      if (audioTrack) {
        audioStream = new MediaStream([audioTrack]);
        log('Audio-Track aktiv', 'ok');
      } else {
        log('Kein Audio-Track (Tab-Audio nicht aktiviert?)', 'warn');
      }
    } catch (e) {
      log('Audio übersprungen: ' + e.message, 'warn');
    }
  }

  combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...(audioStream ? audioStream.getAudioTracks() : []),
  ]);

  trackFrames();

  log('Verbinde mit BitTorrent-Trackern…', 'info');
  room = joinRoom({ appId: APP_ID }, roomId);

  const [sBack, gBack] = room.makeAction('sb');
  sendBack = sBack;
  const [sStat, gStat] = room.makeAction('st');
  sendStats = sStat;
  const [, getInput] = room.makeAction('in');

  getInput((data, peerId) => {
    if (!$('opt-allow-input').checked) return;
    inputCounter++;
    dispatchInput(data);
  });

  room.onPeerJoin(async (peerId) => {
    viewers.add(peerId);
    log(`Viewer joined: ${peerId.slice(0, 8)}…`, 'ok');
    try {
      await room.addStream(combinedStream, peerId);
      sendBack({ type: 'hello', canvas: { w: canvasEl.width, h: canvasEl.height } }, peerId);
    } catch (e) {
      log('addStream(peer) fehlgeschlagen: ' + e.message, 'err');
    }
  });

  room.onPeerLeave((peerId) => {
    viewers.delete(peerId);
    log(`Viewer left: ${peerId.slice(0, 8)}…`, 'info');
  });

  try { await room.addStream(combinedStream); } catch (e) { log('addStream(global) fehlgeschlagen: ' + e.message, 'err'); }

  startTime = Date.now();
  $('status-live').innerHTML = '<span class="status live">● LIVE</span>';
  $('btn-start').disabled = true;
  $('btn-stop').disabled = false;
  log('Stream LIVE — Stream-ID: ' + roomId, 'ok');

  if ($('opt-keep-awake').checked) requestWakeLock();
}

function trackFrames() {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
    setInterval(() => { frameCounter += 60; }, 1000);
    return;
  }
  const tmp = document.createElement('video');
  tmp.muted = true; tmp.srcObject = videoStream;
  tmp.play().catch(() => {});
  const cb = () => { frameCounter++; if (videoStream && videoStream.active) tmp.requestVideoFrameCallback(cb); };
  tmp.requestVideoFrameCallback(cb);
}

function stopStream() {
  if (room) { try { room.leave(); } catch {} room = null; }
  if (combinedStream) { combinedStream.getTracks().forEach(t => t.stop()); combinedStream = null; }
  if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
  videoStream = null;
  startTime = null;
  viewers.clear();
  $('status-live').innerHTML = '<span class="status idle">OFFLINE</span>';
  $('btn-start').disabled = false;
  $('btn-stop').disabled = true;
  releaseWakeLock();
  log('Stream gestoppt', 'info');
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    log('Wake-Lock aktiv', 'info');
  } catch (e) { log('Wake-Lock nicht verfügbar: ' + e.message, 'warn'); }
}
async function releaseWakeLock() {
  if (wakeLock) { try { await wakeLock.release(); } catch {} wakeLock = null; }
}

function dispatchInput(d) {
  if (!canvasEl || !docEl) return;
  const win = frameEl.contentWindow;
  try {
    switch (d.t) {
      case 'kd':
      case 'ku': {
        const ev = new win.KeyboardEvent(d.t === 'kd' ? 'keydown' : 'keyup', {
          key: d.k, code: d.c || d.k, keyCode: d.kc || 0, which: d.kc || 0,
          bubbles: true, cancelable: true,
          ctrlKey: !!d.ctrl, shiftKey: !!d.shift, altKey: !!d.alt, metaKey: !!d.meta,
        });
        canvasEl.dispatchEvent(ev);
        docEl.dispatchEvent(ev);
        break;
      }
      case 'mm': {
        const r = canvasEl.getBoundingClientRect();
        const x = r.left + d.x * r.width;
        const y = r.top + d.y * r.height;
        const ev = new win.MouseEvent('mousemove', {
          clientX: x, clientY: y, screenX: x, screenY: y,
          movementX: d.dx || 0, movementY: d.dy || 0,
          bubbles: true, cancelable: true, view: win,
        });
        canvasEl.dispatchEvent(ev);
        break;
      }
      case 'md':
      case 'mu': {
        const r = canvasEl.getBoundingClientRect();
        const x = r.left + (d.x ?? 0.5) * r.width;
        const y = r.top + (d.y ?? 0.5) * r.height;
        const type = d.t === 'md' ? 'mousedown' : 'mouseup';
        const ev = new win.MouseEvent(type, {
          clientX: x, clientY: y, button: d.b || 0,
          bubbles: true, cancelable: true, view: win,
        });
        canvasEl.dispatchEvent(ev);
        if (d.t === 'mu') {
          const click = new win.MouseEvent('click', {
            clientX: x, clientY: y, button: d.b || 0,
            bubbles: true, cancelable: true, view: win,
          });
          canvasEl.dispatchEvent(click);
        }
        break;
      }
      case 'wh': {
        const ev = new win.WheelEvent('wheel', {
          deltaX: d.dx || 0, deltaY: d.dy || 0,
          bubbles: true, cancelable: true,
        });
        canvasEl.dispatchEvent(ev);
        break;
      }
      case 'ts':
      case 'te':
      case 'tm': {
        const r = canvasEl.getBoundingClientRect();
        const type = { ts: 'touchstart', te: 'touchend', tm: 'touchmove' }[d.t];
        const touches = (d.touches || []).map((p, i) => new win.Touch({
          identifier: i,
          target: canvasEl,
          clientX: r.left + p.x * r.width,
          clientY: r.top + p.y * r.height,
          radiusX: 1, radiusY: 1, force: 1,
        }));
        const ev = new win.TouchEvent(type, {
          touches: type === 'touchend' ? [] : touches,
          targetTouches: type === 'touchend' ? [] : touches,
          changedTouches: touches,
          bubbles: true, cancelable: true,
        });
        canvasEl.dispatchEvent(ev);
        break;
      }
    }
  } catch (e) {
    if (Math.random() < 0.01) log('dispatch error: ' + e.message, 'err');
  }
}

$('btn-load').addEventListener('click', loadGame);
$('btn-start').addEventListener('click', startStream);
$('btn-stop').addEventListener('click', stopStream);

$('btn-copy-id').addEventListener('click', () => {
  navigator.clipboard.writeText(getRoomId());
  log('Stream-ID kopiert', 'ok');
});
$('btn-new-id').addEventListener('click', () => {
  if (!confirm('Neue Stream-ID? Bestehende Viewer-Inscriptions verlieren den Zugang!')) return;
  localStorage.removeItem('game-bridge-room-id');
  setRoomId(getOrCreateRoomId());
  log('Neue ID generiert', 'info');
});
$('btn-save-id').addEventListener('click', () => {
  const id = getRoomId();
  if (!id) { log('ID darf nicht leer sein', 'err'); return; }
  localStorage.setItem('game-bridge-room-id', id);
  log('ID gespeichert: ' + id, 'ok');
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && combinedStream && !wakeLock && $('opt-keep-awake').checked) {
    await requestWakeLock();
  }
});

setRoomId(getOrCreateRoomId());
log('Game-Bridge bereit', 'ok');
log('Game-URL prüfen → "Game laden" → "Stream starten"', 'info');
