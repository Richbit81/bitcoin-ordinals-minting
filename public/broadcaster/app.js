import { joinRoom } from 'https://esm.sh/trystero@0.20.0/torrent';

const APP_ID = 'ordinal-stream-v1';
// MUST match the trackers bundled inside the viewer inscriptions, otherwise
// broadcaster and viewer connect to different tracker pools and never see
// each other. Old viewer inscriptions (e.g. ...bee5i0) ship with this exact
// list (minus tracker.files.fm:7073, which is permanently down and only
// causes connection errors in the log).
const RELAY_URLS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
];
const log = (msg, type = 'info') => {
  const el = document.getElementById('log');
  const line = document.createElement('div');
  line.className = 'line ' + type;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
};

let room = null;
let currentStream = null;
let bytesSent = 0;
let startTime = null;
let viewerCount = 0;
const viewers = new Set();
let lastSource = null;
let wakeLock = null;
let refreshInterval = null;
let lastRefreshAt = 0;
const REFRESH_WHEN_EMPTY_MS = 30 * 1000;
const MIN_REFRESH_GAP_MS = 15 * 1000;

function getOrCreateRoomId() {
  let id = localStorage.getItem('ordinal-stream-room-id');
  if (!id) {
    id = 'stream-' + crypto.randomUUID();
    localStorage.setItem('ordinal-stream-room-id', id);
  }
  return id;
}

function setRoomId(id) {
  document.getElementById('room-id').value = id;
}

function getRoomId() {
  return document.getElementById('room-id').value.trim();
}

function updateStatus() {
  document.getElementById('stat-viewers').textContent = viewerCount;
  document.getElementById('stat-bytes').textContent = (bytesSent / 1024 / 1024).toFixed(2) + ' MB';
  if (startTime) {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    document.getElementById('stat-uptime').textContent = `${h}:${m}:${s}`;
  }
}
setInterval(updateStatus, 1000);

function joinRoomWithStream(reason) {
  const roomId = getRoomId();
  if (!roomId) {
    log('Stream-ID fehlt! Bitte oben eingeben oder generieren.', 'err');
    return false;
  }
  log(`Trete Room bei (${reason})...`, 'info');
  room = joinRoom({ appId: APP_ID, relayUrls: RELAY_URLS }, roomId);

  room.onPeerJoin(peerId => {
    viewers.add(peerId);
    viewerCount = viewers.size;
    log(`Viewer beigetreten: ${peerId.slice(0, 8)}...`, 'ok');
    try { room.addStream(currentStream, peerId); } catch (e) { log('addStream fehlgeschlagen: ' + e.message, 'err'); }
  });

  room.onPeerLeave(peerId => {
    viewers.delete(peerId);
    viewerCount = viewers.size;
    log(`Viewer verlassen: ${peerId.slice(0, 8)}...`, 'info');
  });

  try { room.addStream(currentStream); } catch (e) { log('addStream global fehlgeschlagen: ' + e.message, 'err'); }
  return true;
}

async function reconnectRoom(reason, opts = {}) {
  if (!currentStream) {
    log('Kein aktiver Stream — Reconnect übersprungen', 'info');
    return;
  }
  if (!opts.force && viewers.size > 0) {
    return;
  }
  const since = Date.now() - lastRefreshAt;
  if (since < MIN_REFRESH_GAP_MS) {
    return;
  }
  lastRefreshAt = Date.now();
  log(`Verbindung wird erneuert (${reason})`, 'info');
  if (room) {
    try { room.leave(); } catch (e) {}
    room = null;
  }
  viewers.clear();
  viewerCount = 0;
  joinRoomWithStream(reason);
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    log('Wake-Lock aktiv (Tab wird nicht gedrosselt)', 'info');
    wakeLock.addEventListener('release', () => { log('Wake-Lock freigegeben', 'info'); });
  } catch (e) {
    log('Wake-Lock nicht verfügbar: ' + e.message, 'info');
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
}

function startAutoRefresh() {}
function stopAutoRefresh() {}

async function startBroadcast(stream) {
  if (room) {
    log('Stream wird neu gestartet...', 'info');
    stopBroadcast();
  }

  currentStream = stream;
  document.getElementById('preview').srcObject = stream;
  log('Verbinde mit BitTorrent-Trackern...', 'info');

  if (!joinRoomWithStream('Start')) return;

  startTime = Date.now();
  document.getElementById('status-live').innerHTML = '<span class="status live">● LIVE</span>';
  document.getElementById('btn-stop').disabled = false;
  document.getElementById('btn-restart').disabled = false;
  document.getElementById('btn-reconnect').disabled = false;
  log('Stream ist LIVE!', 'ok');

  await requestWakeLock();
  startAutoRefresh();
}

function stopBroadcast() {
  stopAutoRefresh();
  releaseWakeLock();
  if (room) {
    try { room.leave(); } catch (e) {}
    room = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
  document.getElementById('preview').srcObject = null;
  document.getElementById('status-live').innerHTML = '<span class="status idle">OFFLINE</span>';
  document.getElementById('btn-stop').disabled = true;
  document.getElementById('btn-reconnect').disabled = true;
  viewers.clear();
  viewerCount = 0;
  startTime = null;
  log('Stream gestoppt' + (lastSource ? ' (Klick "Stream neu starten" für Restart)' : ''), 'info');
}

async function startScreen() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    log('Bildschirm-Capture gestartet', 'ok');
    lastSource = { type: 'screen' };
    await startBroadcast(stream);
  } catch (e) {
    log('Bildschirm-Capture fehlgeschlagen: ' + e.message, 'err');
  }
}

async function startFile(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.loop = true;
  video.muted = false;
  video.crossOrigin = 'anonymous';
  await video.play();
  const stream = video.captureStream();
  log(`Datei geladen: ${file.name}`, 'ok');
  lastSource = { type: 'file', file, video };
  await startBroadcast(stream);
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    log('Kamera + Mikro aktiviert', 'ok');
    lastSource = { type: 'camera' };
    await startBroadcast(stream);
  } catch (e) {
    log('Kamera-Zugriff fehlgeschlagen: ' + e.message, 'err');
  }
}

document.getElementById('btn-screen').addEventListener('click', startScreen);

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await startFile(file);
});

document.getElementById('btn-camera').addEventListener('click', startCamera);

document.getElementById('btn-stop').addEventListener('click', stopBroadcast);

document.getElementById('btn-reconnect').addEventListener('click', () => reconnectRoom('manuell', { force: true }));

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && currentStream && !wakeLock) {
    await requestWakeLock();
  }
});

document.getElementById('btn-restart').addEventListener('click', async () => {
  if (!lastSource) {
    log('Keine Quelle bekannt – bitte oben neu wählen', 'err');
    return;
  }
  log('Neustart mit letzter Quelle (' + lastSource.type + ')', 'info');
  if (lastSource.type === 'screen') {
    await startScreen();
  } else if (lastSource.type === 'file') {
    await startFile(lastSource.file);
  } else if (lastSource.type === 'camera') {
    await startCamera();
  }
});

document.getElementById('btn-copy-id').addEventListener('click', () => {
  navigator.clipboard.writeText(getRoomId());
  log('Stream-ID kopiert', 'ok');
});

document.getElementById('btn-new-id').addEventListener('click', () => {
  if (!confirm('Neue Stream-ID generieren? Alle bestehenden Viewer-Inscriptions verlieren den Zugang!')) return;
  localStorage.removeItem('ordinal-stream-room-id');
  setRoomId(getOrCreateRoomId());
  log('Neue Stream-ID generiert', 'info');
});

document.getElementById('btn-save-id').addEventListener('click', () => {
  const id = getRoomId();
  if (!id) { log('Stream-ID darf nicht leer sein', 'err'); return; }
  if (!id.startsWith('stream-')) {
    if (!confirm('Die ID beginnt nicht mit "stream-". Trotzdem speichern? (Achtung: muss exakt mit der ID in der Inscription übereinstimmen!)')) return;
  }
  localStorage.setItem('ordinal-stream-room-id', id);
  log('Stream-ID gespeichert: ' + id, 'ok');
  if (room) {
    log('Stream läuft mit alter ID weiter. Bitte stoppen und neu starten, um die neue ID zu nutzen.', 'info');
  }
});

document.getElementById('room-id').addEventListener('blur', () => {
  const stored = localStorage.getItem('ordinal-stream-room-id');
  if (getRoomId() !== stored) {
    log('Achtung: ID geändert aber nicht gespeichert! Klick "Speichern".', 'info');
  }
});

document.querySelectorAll('.source-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.source-tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.source-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.source-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
  });
});

setRoomId(getOrCreateRoomId());
log('Broadcaster bereit', 'ok');
log('Wähle eine Stream-Quelle, um zu starten', 'info');
