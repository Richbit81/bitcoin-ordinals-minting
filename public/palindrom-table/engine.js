// PalindromTable Engine — Aural Disk meets Palindromes
// Each palindrome digit (0-9) maps to an instrument placed on a circular disk.
// A sweep arm triggers modules as it rotates.

const CV = document.getElementById('cv'), G = CV.getContext('2d');
let W, H, cx, cy, tR;
let playing = false, muted = false, bpm = 110, swing = 0;
let sweepAngle = -Math.PI / 2, lastFrame = 0, gTime = 0;
let modules = [], particles = [], ripples = [], shockwaves = [];
let dragging = null, dragOff = { x: 0, y: 0 }, hovered = null;
let killedZones = new Set(), filling = false;

const STEPS = 16;
const ZI = 0.33, ZM = 0.66, ZO = 1.0;
const ZC = { outer: '#ff7733', mid: '#b266ff', inner: '#00e5ff' };

// ─── DIGIT-TO-INSTRUMENT MAP ───
const DIGIT_DEFS = [
  { digit: 0, type: 'kick',  label: 'Kick',  sym: 'K',  color: '#ff6a00', zone: 'outer' },
  { digit: 1, type: 'snare', label: 'Snare', sym: 'S',  color: '#ff4da6', zone: 'outer' },
  { digit: 2, type: 'hihat', label: 'HiHat', sym: 'H',  color: '#ffe600', zone: 'outer' },
  { digit: 3, type: 'bass',  label: 'Bass',  sym: 'Ba', color: '#00e5ff', zone: 'inner' },
  { digit: 4, type: 'lead',  label: 'Lead',  sym: 'L',  color: '#b266ff', zone: 'mid' },
  { digit: 5, type: 'pad',   label: 'Pad',   sym: 'Pd', color: '#00cc88', zone: 'inner' },
  { digit: 6, type: 'arp',   label: 'Arp',   sym: 'A',  color: '#dd44ff', zone: 'mid' },
  { digit: 7, type: 'bell',  label: 'Bell',  sym: 'B',  color: '#8888ff', zone: 'mid' },
  { digit: 8, type: 'acid',  label: 'Acid',  sym: 'Ac', color: '#ff44aa', zone: 'mid' },
  { digit: 9, type: 'clap',  label: 'Clap',  sym: 'C',  color: '#ff8866', zone: 'outer' },
];

// ─── MUSICAL KEYS (pentatonic minor) ───
const KEY_DATA = {
  'C min': { base: 130.81, p: [1, 1.189, 1.335, 1.498, 1.782] },
  'D min': { base: 146.83, p: [1, 1.189, 1.335, 1.498, 1.782] },
  'E min': { base: 164.81, p: [1, 1.189, 1.335, 1.498, 1.782] },
  'F min': { base: 174.61, p: [1, 1.189, 1.335, 1.498, 1.782] },
  'G min': { base: 196.00, p: [1, 1.189, 1.335, 1.498, 1.782] },
  'A min': { base: 220.00, p: [1, 1.189, 1.335, 1.498, 1.782] },
};
let curKey = 'C min';
function fr(deg, oct) {
  const k = KEY_DATA[curKey];
  return k.base * k.p[((deg % 5) + 5) % 5] * Math.pow(2, oct);
}

// ─── AUDIO ENGINE ───
let ac = null, masterGain, comp, analyser, anaData, waveData;
let delaySend, delayNode, delayFb, delayWet;
let reverbSend, reverbConv, reverbWet;
let chorusSend, chorusDelay, chorusLFO, chorusLFOGain, chorusWet;

function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5;
  comp.attack.value = 0.003; comp.release.value = 0.12;
  masterGain = ac.createGain(); masterGain.gain.value = 0.5;
  analyser = ac.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.72;
  anaData = new Uint8Array(analyser.frequencyBinCount);
  waveData = new Uint8Array(analyser.fftSize);
  masterGain.connect(comp); comp.connect(analyser); analyser.connect(ac.destination);

  // Chorus
  chorusSend = ac.createGain(); chorusSend.gain.value = 0.3;
  chorusDelay = ac.createDelay(0.05); chorusDelay.delayTime.value = 0.012;
  chorusLFO = ac.createOscillator(); chorusLFO.type = 'sine'; chorusLFO.frequency.value = 1.5;
  chorusLFOGain = ac.createGain(); chorusLFOGain.gain.value = 0.003;
  chorusLFO.connect(chorusLFOGain); chorusLFOGain.connect(chorusDelay.delayTime); chorusLFO.start();
  chorusWet = ac.createGain(); chorusWet.gain.value = 0.35;
  chorusSend.connect(chorusDelay); chorusDelay.connect(chorusWet); chorusWet.connect(masterGain);

  // Delay
  delaySend = ac.createGain(); delaySend.gain.value = 0.25;
  delayNode = ac.createDelay(2); delayNode.delayTime.value = 60 / bpm * 0.75;
  delayFb = ac.createGain(); delayFb.gain.value = 0.3;
  delayWet = ac.createGain(); delayWet.gain.value = 0.35;
  delaySend.connect(delayNode); delayNode.connect(delayFb); delayFb.connect(delayNode);
  delayNode.connect(delayWet); delayWet.connect(masterGain);

  // Reverb
  reverbSend = ac.createGain(); reverbSend.gain.value = 0.3;
  const len = ac.sampleRate * 2.5, buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2) * 0.6;
  }
  reverbConv = ac.createConvolver(); reverbConv.buffer = buf;
  reverbWet = ac.createGain(); reverbWet.gain.value = 0.35;
  reverbSend.connect(reverbConv); reverbConv.connect(reverbWet); reverbWet.connect(masterGain);
}

function sidechain(t) {
  if (!masterGain) return;
  masterGain.gain.setValueAtTime(0.15, t);
  masterGain.gain.linearRampToValueAtTime(0.5, t + 0.08);
}

// ─── MODULE CLASS ───
class Mod {
  constructor(def, x, y, digitIndex, palindromeId) {
    this.id = Date.now() + Math.random();
    this.type = def.type; this.label = def.label; this.sym = def.sym;
    this.color = def.color; this.zone = def.zone; this.digit = def.digit;
    this.digitIndex = digitIndex; this.palindromeId = palindromeId;
    this.x = x; this.y = y; this.r = 26;
    this.param = 0.5; this.variation = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.nodes = null; this.pulse = 0; this.lastBeat = -1;
    this.wH = new Float32Array(24); this.wI = 0;
  }

  get angle() { return Math.atan2(this.y - cy, this.x - cx); }
  get dist() { return Math.hypot(this.x - cx, this.y - cy) / tR; }
  get zp() {
    const d = this.dist;
    if (d < ZI) return d / ZI;
    if (d < ZM) return (d - ZI) / (ZM - ZI);
    return (d - ZM) / (ZO - ZM);
  }

  hit(px, py) { return Math.hypot(px - this.x, py - this.y) <= this.r; }

  initAudio() {
    if (!ac) return; this.destroyAudio(); const n = {};
    const t = this.type;
    if (t === 'bass') {
      n.osc = ac.createOscillator(); n.flt = ac.createBiquadFilter(); n.g = ac.createGain();
      n.osc.type = 'sawtooth'; n.osc.frequency.value = fr(0, -1);
      n.flt.type = 'lowpass'; n.flt.frequency.value = 300; n.flt.Q.value = 3; n.g.gain.value = 0;
      n.osc.connect(n.flt); n.flt.connect(n.g); n.g.connect(masterGain); n.g.connect(reverbSend); n.osc.start();
    } else if (t === 'pad') {
      n.o1 = ac.createOscillator(); n.o2 = ac.createOscillator(); n.g = ac.createGain();
      n.o1.type = 'sine'; n.o2.type = 'triangle';
      n.o1.frequency.value = fr(0, 0); n.o2.frequency.value = fr(0, 0) * 1.004; n.g.gain.value = 0;
      n.o1.connect(n.g); n.o2.connect(n.g); n.g.connect(masterGain); n.g.connect(reverbSend);
      n.o1.start(); n.o2.start();
    } else if (t === 'lead') {
      n.osc = ac.createOscillator(); n.flt = ac.createBiquadFilter(); n.g = ac.createGain();
      n.osc.type = 'square'; n.osc.frequency.value = fr(0, 1);
      n.flt.type = 'lowpass'; n.flt.frequency.value = 2500; n.flt.Q.value = 2; n.g.gain.value = 0;
      n.osc.connect(n.flt); n.flt.connect(n.g); n.g.connect(masterGain); n.g.connect(delaySend); n.osc.start();
    } else if (t === 'arp') {
      n.osc = ac.createOscillator(); n.flt = ac.createBiquadFilter(); n.g = ac.createGain();
      n.osc.type = 'sawtooth'; n.osc.frequency.value = fr(0, 1);
      n.flt.type = 'lowpass'; n.flt.frequency.value = 3500; n.flt.Q.value = 4; n.g.gain.value = 0;
      n.osc.connect(n.flt); n.flt.connect(n.g); n.g.connect(masterGain); n.g.connect(delaySend); n.osc.start();
      n.step = 0;
    } else if (t === 'bell') {
      n.car = ac.createOscillator(); n.mod = ac.createOscillator(); n.mG = ac.createGain(); n.g = ac.createGain();
      n.car.type = 'sine'; n.mod.type = 'sine';
      n.car.frequency.value = fr(0, 2); n.mod.frequency.value = fr(0, 2) * 3.5;
      n.mG.gain.value = 200; n.g.gain.value = 0;
      n.mod.connect(n.mG); n.mG.connect(n.car.frequency);
      n.car.connect(n.g); n.g.connect(masterGain); n.g.connect(delaySend);
      n.car.start(); n.mod.start();
    } else if (t === 'acid') {
      n.osc = ac.createOscillator(); n.flt = ac.createBiquadFilter(); n.g = ac.createGain();
      n.osc.type = 'sawtooth'; n.osc.frequency.value = fr(0, 0);
      n.flt.type = 'lowpass'; n.flt.frequency.value = 400; n.flt.Q.value = 12; n.g.gain.value = 0;
      n.osc.connect(n.flt); n.flt.connect(n.g); n.g.connect(masterGain); n.g.connect(delaySend); n.osc.start();
      n.step = 0;
    }
    this.nodes = n;
  }

  destroyAudio() {
    if (!this.nodes) return;
    Object.values(this.nodes).forEach(nd => {
      if (Array.isArray(nd)) nd.forEach(n => { try { n.stop?.() } catch (e) {} try { n.disconnect?.() } catch (e) {} });
      else { try { nd.stop?.() } catch (e) {} try { nd.disconnect?.() } catch (e) {} }
    });
    this.nodes = null;
  }

  trigger(bn) {
    if (this.lastBeat === bn) return; this.lastBeat = bn; this.pulse = 1;
    if (killedZones.has(this.zone)) { this.pulse = 0.2; return; }
    const zp = this.zp;
    if (this.zone === 'outer') this.tDrum(zp, bn);
    else if (this.zone === 'mid') this.tMel(bn, zp);
    else if (this.zone === 'inner') this.tBass(bn, zp);
    ripples.push({ x: this.x, y: this.y, r: this.r, mr: this.r + 50 + zp * 40, c: this.color, t: 0 });
  }

  tDrum(zp, bn) {
    if (!ac || muted) return; const t = ac.currentTime;
    if (this.type === 'kick') {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(120 + zp * 80, t);
      o.frequency.exponentialRampToValueAtTime(25, t + 0.12 + zp * 0.15);
      g.gain.setValueAtTime(0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3 + zp * 0.2);
      o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.6);
      sidechain(t); shockwaves.push({ t: 0, x: this.x, y: this.y });
    } else if (this.type === 'snare') {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle';
      o.frequency.setValueAtTime(200 + zp * 60, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + zp * 0.08);
      o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.3);
      const bz = ac.sampleRate * (0.08 + zp * 0.06), bf = ac.createBuffer(1, bz, ac.sampleRate), d = bf.getChannelData(0);
      for (let i = 0; i < bz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bz, 1.3);
      const s = ac.createBufferSource(), ng = ac.createGain(); s.buffer = bf;
      ng.gain.setValueAtTime(0.4, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      s.connect(ng); ng.connect(masterGain); ng.connect(reverbSend); s.start(t);
    } else if (this.type === 'hihat') {
      const dur = 0.02 + zp * 0.08, bz = ac.sampleRate * dur, bf = ac.createBuffer(1, bz, ac.sampleRate), d = bf.getChannelData(0);
      for (let i = 0; i < bz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bz, 1.5 + (1 - zp) * 2);
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = bf; fl.type = 'highpass'; fl.frequency.value = 6000 + (1 - zp) * 4000;
      g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(masterGain); s.start(t);
    } else if (this.type === 'clap') {
      for (let c = 0; c < 3; c++) {
        const off = c * 0.012, bz = ac.sampleRate * 0.03, bf = ac.createBuffer(1, bz, ac.sampleRate), d = bf.getChannelData(0);
        for (let i = 0; i < bz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bz, 2);
        const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = bf;
        g.gain.setValueAtTime((0.3 - c * 0.08) * (0.6 + zp * 0.4), t + off);
        g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.06 + zp * 0.1);
        s.connect(g); g.connect(masterGain); g.connect(reverbSend); s.start(t + off);
      }
    }
    this.pW(this.type === 'kick' ? 0.9 : 0.5);
  }

  tMel(beat, zp) {
    if (!ac || muted || !this.nodes) return;
    const t = ac.currentTime, oct = zp > 0.5 ? 2 : 1, v = this.variation;
    if (this.type === 'lead') {
      const M = [[0, 2, 4, 3, 2, 0, 1, 3], [4, 3, 2, 0, 2, 4, 3, 1], [0, 1, 2, 4, 3, 2, 1, 0]];
      const mel = M[v % 3], ni = mel[beat % 8], f = fr(ni, oct);
      this.nodes.osc.frequency.setTargetAtTime(f, t, 0.008);
      this.nodes.flt.frequency.setValueAtTime(800 + zp * 5000, t);
      this.nodes.flt.frequency.setTargetAtTime(500 + zp * 1000, t + 0.01, 0.08);
      this.nodes.g.gain.setValueAtTime(0.13, t); this.nodes.g.gain.setTargetAtTime(0.04, t + 0.06, 0.06);
    } else if (this.type === 'arp') {
      const P = [[0, 2, 4, 2], [0, 4, 2, 4], [4, 2, 0, 2]];
      const pat = P[v % 3]; this.nodes.step = (this.nodes.step || 0) + 1;
      const stepT = 60 / bpm / 8;
      for (let i = 0; i < 4; i++) {
        const ni = pat[(this.nodes.step + i) % pat.length], f = fr(ni, oct + (i > 1 ? 1 : 0));
        const at = t + i * stepT;
        this.nodes.osc.frequency.setValueAtTime(f, at);
        this.nodes.flt.frequency.setValueAtTime(2000 + zp * 6000, at);
        this.nodes.flt.frequency.setTargetAtTime(600, at + 0.005, 0.02);
        this.nodes.g.gain.setValueAtTime(0.1 * (1 - i * 0.15), at);
        this.nodes.g.gain.setTargetAtTime(0.001, at + 0.005, 0.015 + zp * 0.02);
      }
    } else if (this.type === 'bell') {
      const N = [[0, 4, 2, 3, 4, 0, 2, 1], [4, 0, 3, 2, 1, 4, 0, 3]];
      const notes = N[v % 2], ni = notes[beat % notes.length], f = fr(ni, oct + 1);
      this.nodes.car.frequency.setTargetAtTime(f, t, 0.002);
      this.nodes.mod.frequency.setTargetAtTime(f * (2.5 + zp * 3), t, 0.01);
      this.nodes.mG.gain.setTargetAtTime(100 + zp * 400, t, 0.01);
      this.nodes.g.gain.setValueAtTime(0.08, t);
      this.nodes.g.gain.setTargetAtTime(0.001, t + 0.005, 0.08 + zp * 0.2);
    } else if (this.type === 'acid') {
      const P = [[0, 0, 3, 0, 2, 0, 4, 0], [0, 3, 0, 4, 0, 2, 3, 0]];
      const pat = P[v % 2]; this.nodes.step = (this.nodes.step || 0) + 1;
      const ni = pat[this.nodes.step % pat.length], f = fr(ni, 0);
      const accent = ni > 0;
      this.nodes.osc.frequency.setTargetAtTime(f > 0 ? f : fr(0, 0), t, 0.003);
      this.nodes.flt.frequency.setValueAtTime(accent ? 800 + zp * 8000 : 400, t);
      this.nodes.flt.frequency.exponentialRampToValueAtTime(200 + zp * 200, t + 0.08);
      this.nodes.flt.Q.setValueAtTime(8 + zp * 14, t);
      this.nodes.g.gain.setValueAtTime(accent ? 0.16 : 0.08, t);
      this.nodes.g.gain.setTargetAtTime(0.02, t + 0.02, 0.04);
    }
    this.pW(0.35);
  }

  tBass(beat, zp) {
    if (!ac || muted || !this.nodes) return; const t = ac.currentTime;
    if (this.type === 'bass') {
      const P = [[0, 0, 2, 2, 3, 3, 0, 0], [0, 2, 0, 3, 0, 4, 0, 2], [0, 0, 0, 2, 3, 3, 4, 0]];
      const pat = P[this.variation % 3], ni = pat[((beat % 8) + 8) % 8], f = fr(ni, -1);
      this.nodes.osc.frequency.setTargetAtTime(f, t, 0.04);
      this.nodes.flt.frequency.setTargetAtTime(150 + zp * 600, t, 0.06);
      this.nodes.g.gain.setTargetAtTime(0.18, t, 0.03);
    } else if (this.type === 'pad') {
      const C = [[0, 2], [0, 3], [2, 4], [3, 0]];
      const ci = ((Math.floor(beat / 8) % C.length) + C.length) % C.length, ch = C[ci];
      this.nodes.o1.frequency.setTargetAtTime(fr(ch[0], 0), t, 0.4);
      this.nodes.o2.frequency.setTargetAtTime(fr(ch[1], 0) * (1 + zp * 0.006), t, 0.4);
      this.nodes.g.gain.setTargetAtTime(0.06 + zp * 0.04, t, 0.3);
    }
    this.pW(0.5);
  }

  silence() {
    if (!this.nodes || !ac) return;
    if (this.nodes.g) this.nodes.g.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  }
  pW(v) { this.wH[this.wI % this.wH.length] = v; this.wI++; }
}

// ─── PALINDROME LOGIC ───
let palindromeCounter = 0;

function isPalindrome(s) {
  const cleaned = s.replace(/\D/g, '');
  if (cleaned.length < 2) return false;
  return cleaned === cleaned.split('').reverse().join('');
}

function loadPalindrome() {
  const input = document.getElementById('palindromeInput');
  const val = input.value.replace(/\D/g, '');
  if (!val || !isPalindrome(val)) {
    input.classList.add('invalid');
    document.getElementById('palHint').textContent = 'Kein gültiges Palindrom!';
    setTimeout(() => input.classList.remove('invalid'), 1000);
    return;
  }
  input.classList.remove('invalid');
  document.getElementById('palHint').textContent = 'Palindrom geladen!';
  initAudio();
  placePalindromeOnDisk(val);
  if (!playing) togglePlay();
}

function placePalindromeOnDisk(palStr) {
  const pid = ++palindromeCounter;
  const digits = palStr.split('').map(Number);
  const n = digits.length;

  // distribute digits evenly around the disk
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const def = DIGIT_DEFS[digits[i]];

    // place in appropriate zone based on instrument type
    let radialDist;
    if (def.zone === 'inner') radialDist = ZI * 0.6 + Math.random() * ZI * 0.3;
    else if (def.zone === 'mid') radialDist = ZI + (ZM - ZI) * 0.3 + Math.random() * (ZM - ZI) * 0.4;
    else radialDist = ZM + (ZO - ZM) * 0.3 + Math.random() * (ZO - ZM) * 0.4;

    const x = cx + Math.cos(angle) * radialDist * tR;
    const y = cy + Math.sin(angle) * radialDist * tR;

    const m = new Mod(def, x, y, i, pid);
    m.variation = digits[i] % 3;
    m.initAudio();
    modules.push(m);
  }
}

function randomPalindrome() {
  const lengths = [5, 7, 9, 11];
  const len = lengths[Math.floor(Math.random() * lengths.length)];
  const half = Math.ceil(len / 2);
  let digits = [];
  for (let i = 0; i < half; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  const full = [...digits];
  const mirror = [...digits].reverse();
  if (len % 2 === 1) mirror.shift();
  full.push(...mirror);

  const palStr = full.join('');
  document.getElementById('palindromeInput').value = palStr;
  document.getElementById('palHint').textContent = 'Random: ' + palStr;
  initAudio();
  clearAll();
  placePalindromeOnDisk(palStr);
  if (!playing) togglePlay();
}

function clearAll() {
  modules.forEach(m => { m.silence(); m.destroyAudio(); });
  modules = []; ripples = []; shockwaves = []; particles = [];
}

// ─── SYMMETRY CONNECTIONS ───
function getSymmetryPairs() {
  const pairs = [];
  const grouped = {};
  modules.forEach(m => {
    if (!grouped[m.palindromeId]) grouped[m.palindromeId] = [];
    grouped[m.palindromeId].push(m);
  });
  Object.values(grouped).forEach(group => {
    const n = group.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      pairs.push([group[i], group[n - 1 - i]]);
    }
  });
  return pairs;
}

// ─── PRESETS ───
const PRESETS = [
  { name: 'Minimal Beat', desc: '10201', bpm: 100, key: 'C min', pal: '10201' },
  { name: 'Deep Groove', desc: '3040403', bpm: 122, key: 'G min', pal: '3040403' },
  { name: 'Acid Mirror', desc: '80208', bpm: 135, key: 'F min', pal: '80208' },
  { name: 'Bell Pad', desc: '5374735', bpm: 90, key: 'E min', pal: '5374735' },
  { name: 'Full Spectrum', desc: '12345654321', bpm: 110, key: 'D min', pal: '12345654321' },
  { name: 'Drum Circle', desc: '0912190', bpm: 128, key: 'A min', pal: '0912190' },
  { name: 'Arp Dreams', desc: '6474746', bpm: 118, key: 'G min', pal: '6474746' },
  { name: 'Bass Heavy', desc: '30503', bpm: 140, key: 'D min', pal: '30503' },
  { name: 'Ambient Flow', desc: '57475', bpm: 85, key: 'E min', pal: '57475' },
  { name: 'Big Palindrome', desc: '9876543210123456789', bpm: 115, key: 'A min', pal: '9876543210123456789' },
];

function buildPresetUI() {
  const c = document.getElementById('presetList');
  PRESETS.forEach(pr => {
    const b = document.createElement('button'); b.className = 'pre';
    b.innerHTML = `${pr.name}<span>${pr.desc}</span>`;
    b.addEventListener('click', () => {
      clearAll(); initAudio();
      bpm = pr.bpm; curKey = pr.key;
      document.getElementById('bb').textContent = '\u2669 ' + bpm;
      document.getElementById('bk').textContent = curKey;
      document.getElementById('palindromeInput').value = pr.pal;
      if (delayNode) delayNode.delayTime.setTargetAtTime(60 / bpm * 0.75, ac.currentTime, 0.1);
      placePalindromeOnDisk(pr.pal);
      if (!playing) togglePlay();
    });
    c.appendChild(b);
  });
}

function buildDigitLegend() {
  const c = document.getElementById('digitLegend');
  DIGIT_DEFS.forEach(d => {
    const el = document.createElement('div'); el.className = 'dl-item';
    el.innerHTML = `<div class="dl-dot" style="background:${d.color}"></div><span>${d.digit} = ${d.label}</span>`;
    c.appendChild(el);
  });
}

// ─── CONTROLS ───
function togglePlay() {
  initAudio();
  playing = !playing;
  document.getElementById('bp').innerHTML = playing ? '&#9646;&#9646; Pause' : '&#9654; Play';
  if (playing) { lastFrame = performance.now(); requestAnimationFrame(loop); }
}

const BPM_LIST = [80, 85, 90, 100, 110, 118, 122, 128, 135, 140, 150];
function cycleBPM() {
  let idx = BPM_LIST.indexOf(bpm);
  idx = (idx + 1) % BPM_LIST.length;
  bpm = BPM_LIST[idx];
  document.getElementById('bb').textContent = '\u2669 ' + bpm;
  if (ac && delayNode) delayNode.delayTime.setTargetAtTime(60 / bpm * 0.75, ac.currentTime, 0.1);
}

const KEYS = Object.keys(KEY_DATA);
function nextKey() {
  let idx = KEYS.indexOf(curKey);
  idx = (idx + 1) % KEYS.length;
  curKey = KEYS[idx];
  document.getElementById('bk').textContent = curKey;
}

function nextSwing() {
  const vals = [0, 0.15, 0.3, 0.5];
  let idx = vals.indexOf(swing);
  idx = (idx + 1) % vals.length;
  swing = vals[idx];
  document.getElementById('bsw').textContent = 'Sw ' + Math.round(swing * 100) + '%';
}

function toggleMute() {
  muted = !muted;
  document.getElementById('bm').innerHTML = muted ? '&#128263;' : '&#128266;';
  if (muted) modules.forEach(m => m.silence());
}

function toggleKill(zone) {
  if (killedZones.has(zone)) killedZones.delete(zone); else killedZones.add(zone);
  const ids = { outer: 'kd', mid: 'km', inner: 'kb' };
  document.getElementById(ids[zone]).classList.toggle('on');
  if (killedZones.has(zone)) modules.filter(m => m.zone === zone).forEach(m => m.silence());
}

function startFill() { filling = true; document.getElementById('bfill').classList.add('on'); }
function stopFill() { filling = false; document.getElementById('bfill').classList.remove('on'); }

function doDrop() {
  killedZones.clear();
  ['kd', 'km', 'kb'].forEach(id => document.getElementById(id).classList.remove('on'));
  if (ac) {
    const t = ac.currentTime;
    masterGain.gain.setValueAtTime(0.1, t);
    masterGain.gain.linearRampToValueAtTime(0.5, t + 0.06);
  }
  shockwaves.push({ t: 0, x: cx, y: cy });
}

function toggleSidebar() {
  document.getElementById('side').classList.toggle('open');
  document.getElementById('side-bg').classList.toggle('open');
}

// ─── CANVAS RESIZE ───
function resize() {
  const cw = document.getElementById('cw');
  W = cw.clientWidth; H = cw.clientHeight;
  CV.width = W * devicePixelRatio; CV.height = H * devicePixelRatio;
  CV.style.width = W + 'px'; CV.style.height = H + 'px';
  G.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  cx = W / 2; cy = H / 2;
  tR = Math.min(W, H) * 0.42;
}
window.addEventListener('resize', resize);

// ─── INTERACTION ───
function getPos(e) {
  const r = CV.getBoundingClientRect();
  const ev = e.touches ? e.touches[0] : e;
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

CV.addEventListener('mousedown', e => {
  const p = getPos(e);
  for (let i = modules.length - 1; i >= 0; i--) {
    if (modules[i].hit(p.x, p.y)) {
      dragging = modules[i];
      dragOff = { x: p.x - modules[i].x, y: p.y - modules[i].y };
      return;
    }
  }
});

CV.addEventListener('mousemove', e => {
  const p = getPos(e);
  if (dragging) {
    dragging.x = p.x - dragOff.x;
    dragging.y = p.y - dragOff.y;
    return;
  }
  hovered = null;
  for (let i = modules.length - 1; i >= 0; i--) {
    if (modules[i].hit(p.x, p.y)) { hovered = modules[i]; break; }
  }
  CV.style.cursor = hovered ? 'grab' : 'default';
});

CV.addEventListener('mouseup', () => { dragging = null; });

CV.addEventListener('contextmenu', e => {
  e.preventDefault();
  const p = getPos(e);
  for (let i = modules.length - 1; i >= 0; i--) {
    if (modules[i].hit(p.x, p.y)) {
      modules[i].silence(); modules[i].destroyAudio();
      modules.splice(i, 1); return;
    }
  }
});

CV.addEventListener('wheel', e => {
  e.preventDefault();
  const p = getPos(e);
  for (let i = modules.length - 1; i >= 0; i--) {
    if (modules[i].hit(p.x, p.y)) {
      if (e.shiftKey) {
        modules[i].variation = (modules[i].variation + (e.deltaY > 0 ? 1 : -1) + 6) % 6;
      } else {
        modules[i].param = Math.max(0, Math.min(1, modules[i].param + (e.deltaY > 0 ? -0.05 : 0.05)));
      }
      return;
    }
  }
}, { passive: false });

// Touch
CV.addEventListener('touchstart', e => {
  e.preventDefault();
  const p = getPos(e);
  for (let i = modules.length - 1; i >= 0; i--) {
    if (modules[i].hit(p.x, p.y)) {
      dragging = modules[i];
      dragOff = { x: p.x - modules[i].x, y: p.y - modules[i].y };
      return;
    }
  }
}, { passive: false });

CV.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!dragging) return;
  const p = getPos(e);
  dragging.x = p.x - dragOff.x;
  dragging.y = p.y - dragOff.y;
}, { passive: false });

CV.addEventListener('touchend', () => { dragging = null; });

// Keyboard
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
});

// ─── RENDER ───
function drawDisk() {
  // Background glow
  const bgGrad = G.createRadialGradient(cx, cy, 0, cx, cy, tR * 1.2);
  bgGrad.addColorStop(0, 'rgba(0,229,255,0.03)');
  bgGrad.addColorStop(0.5, 'rgba(178,102,255,0.02)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
  G.fillStyle = bgGrad; G.fillRect(0, 0, W, H);

  // Zone rings
  const zones = [
    { r: ZO, c: ZC.outer, label: 'DRUMS' },
    { r: ZM, c: ZC.mid, label: 'MELODY' },
    { r: ZI, c: ZC.inner, label: 'BASS' },
  ];
  zones.forEach(z => {
    G.beginPath(); G.arc(cx, cy, z.r * tR, 0, Math.PI * 2);
    G.strokeStyle = z.c + '22'; G.lineWidth = 1; G.stroke();

    // Zone fill
    G.beginPath(); G.arc(cx, cy, z.r * tR, 0, Math.PI * 2);
    G.fillStyle = z.c + '06'; G.fill();
  });

  // Grid lines (16 steps)
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
    G.beginPath();
    G.moveTo(cx, cy);
    G.lineTo(cx + Math.cos(a) * tR, cy + Math.sin(a) * tR);
    G.strokeStyle = 'rgba(255,255,255,0.04)';
    G.lineWidth = 1; G.stroke();

    // Step numbers
    const lx = cx + Math.cos(a) * (tR + 14);
    const ly = cy + Math.sin(a) * (tR + 14);
    G.fillStyle = 'rgba(255,255,255,0.15)';
    G.font = '8px sans-serif'; G.textAlign = 'center'; G.textBaseline = 'middle';
    G.fillText(i.toString(), lx, ly);
  }

  // Center dot
  G.beginPath(); G.arc(cx, cy, 4, 0, Math.PI * 2);
  G.fillStyle = '#fff'; G.fill();
}

function drawSweepArm(beat) {
  const a = sweepAngle;
  const grad = G.createLinearGradient(cx, cy, cx + Math.cos(a) * tR, cy + Math.sin(a) * tR);
  grad.addColorStop(0, 'rgba(0,229,255,0.7)');
  grad.addColorStop(1, 'rgba(0,229,255,0.0)');
  G.beginPath();
  G.moveTo(cx, cy);
  G.lineTo(cx + Math.cos(a) * tR * 1.05, cy + Math.sin(a) * tR * 1.05);
  G.strokeStyle = grad; G.lineWidth = 2; G.stroke();

  // Sweep glow
  G.beginPath(); G.arc(cx, cy, tR, a - 0.08, a + 0.08);
  G.strokeStyle = 'rgba(0,229,255,0.3)'; G.lineWidth = tR * 0.03; G.stroke();
}

function drawSymmetryLines() {
  const pairs = getSymmetryPairs();
  pairs.forEach(([a, b]) => {
    const grad = G.createLinearGradient(a.x, a.y, b.x, b.y);
    const pulse = Math.max(a.pulse, b.pulse);
    const alpha = 0.08 + pulse * 0.25;
    grad.addColorStop(0, a.color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    grad.addColorStop(0.5, '#ffffff' + Math.round(alpha * 0.5 * 255).toString(16).padStart(2, '0'));
    grad.addColorStop(1, b.color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    G.beginPath(); G.moveTo(a.x, a.y); G.lineTo(b.x, b.y);
    G.strokeStyle = grad; G.lineWidth = 1 + pulse * 2; G.stroke();
  });
}

function drawModule(m) {
  const p = m.pulse;
  const glowR = m.r + p * 12;

  // Glow
  if (p > 0.05) {
    const glow = G.createRadialGradient(m.x, m.y, m.r * 0.5, m.x, m.y, glowR);
    glow.addColorStop(0, m.color + Math.round(p * 80).toString(16).padStart(2, '0'));
    glow.addColorStop(1, m.color + '00');
    G.beginPath(); G.arc(m.x, m.y, glowR, 0, Math.PI * 2);
    G.fillStyle = glow; G.fill();
  }

  // Body
  G.beginPath(); G.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  G.fillStyle = m.color + '18';
  G.fill();
  G.strokeStyle = m.color + (hovered === m ? 'cc' : '66');
  G.lineWidth = hovered === m ? 2 : 1.5;
  G.stroke();

  // Waveform mini ring
  const wLen = m.wH.length;
  G.beginPath();
  for (let i = 0; i < wLen; i++) {
    const a = (i / wLen) * Math.PI * 2 - Math.PI / 2;
    const wr = m.r * 0.5 + m.wH[(m.wI + i) % wLen] * m.r * 0.4;
    const wx = m.x + Math.cos(a) * wr;
    const wy = m.y + Math.sin(a) * wr;
    if (i === 0) G.moveTo(wx, wy); else G.lineTo(wx, wy);
  }
  G.closePath();
  G.strokeStyle = m.color + '44'; G.lineWidth = 0.8; G.stroke();

  // Symbol + digit
  G.fillStyle = m.color;
  G.font = 'bold 11px sans-serif'; G.textAlign = 'center'; G.textBaseline = 'middle';
  G.fillText(m.sym, m.x, m.y - 3);
  G.font = '8px sans-serif'; G.fillStyle = m.color + '99';
  G.fillText(m.digit.toString(), m.x, m.y + 9);

  // Param indicator arc
  G.beginPath();
  G.arc(m.x, m.y, m.r + 3, -Math.PI / 2, -Math.PI / 2 + m.param * Math.PI * 2);
  G.strokeStyle = m.color + '55'; G.lineWidth = 2; G.stroke();

  // Decay pulse
  m.pulse *= 0.92;
}

function drawRipples(dt) {
  ripples = ripples.filter(rp => {
    rp.t += dt * 3;
    if (rp.t > 1) return false;
    const cr = rp.r + (rp.mr - rp.r) * rp.t;
    G.beginPath(); G.arc(rp.x, rp.y, cr, 0, Math.PI * 2);
    G.strokeStyle = rp.c + Math.round((1 - rp.t) * 60).toString(16).padStart(2, '0');
    G.lineWidth = 2 * (1 - rp.t); G.stroke();
    return true;
  });
}

function drawShockwaves(dt) {
  shockwaves = shockwaves.filter(sw => {
    sw.t += dt * 2;
    if (sw.t > 1) return false;
    const r = sw.t * tR * 1.2;
    G.beginPath(); G.arc(sw.x, sw.y, r, 0, Math.PI * 2);
    G.strokeStyle = `rgba(0,229,255,${(1 - sw.t) * 0.3})`;
    G.lineWidth = 3 * (1 - sw.t); G.stroke();
    return true;
  });
}

function drawSpectrum() {
  if (!analyser) return;
  analyser.getByteFrequencyData(anaData);
  const bars = anaData.length;
  const step = Math.PI * 2 / bars;
  const baseR = tR * 1.04;

  G.beginPath();
  for (let i = 0; i < bars; i++) {
    const a = i * step - Math.PI / 2;
    const h = (anaData[i] / 255) * tR * 0.15;
    const x1 = cx + Math.cos(a) * baseR;
    const y1 = cy + Math.sin(a) * baseR;
    const x2 = cx + Math.cos(a) * (baseR + h);
    const y2 = cy + Math.sin(a) * (baseR + h);
    G.moveTo(x1, y1); G.lineTo(x2, y2);
  }
  G.strokeStyle = 'rgba(0,229,255,0.15)'; G.lineWidth = 1.5; G.stroke();
}

function drawParticles(dt) {
  if (Math.random() < 0.3 && modules.length > 0) {
    const m = modules[Math.floor(Math.random() * modules.length)];
    if (m.pulse > 0.2) {
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x: m.x + Math.cos(a) * m.r,
        y: m.y + Math.sin(a) * m.r,
        vx: Math.cos(a) * (20 + Math.random() * 30),
        vy: Math.sin(a) * (20 + Math.random() * 30),
        life: 1, c: m.color,
      });
    }
  }
  particles = particles.filter(pt => {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.97; pt.vy *= 0.97; pt.life -= dt * 1.5;
    if (pt.life <= 0) return false;
    G.beginPath(); G.arc(pt.x, pt.y, 2 * pt.life, 0, Math.PI * 2);
    G.fillStyle = pt.c + Math.round(pt.life * 100).toString(16).padStart(2, '0');
    G.fill();
    return true;
  });
}

// ─── MAIN LOOP ───
let currentBeat = -1;

function loop(ts) {
  if (!playing) return;
  const dt = Math.min((ts - lastFrame) / 1000, 0.05);
  lastFrame = ts; gTime += dt;

  // Sweep arm rotation
  const beatsPerSec = bpm / 60;
  const stepsPerSec = beatsPerSec * (STEPS / 4);
  sweepAngle += (stepsPerSec / STEPS) * Math.PI * 2 * dt;
  if (sweepAngle > Math.PI * 2 - Math.PI / 2) sweepAngle -= Math.PI * 2;

  // Calculate current beat (0..15)
  const rawBeat = ((sweepAngle + Math.PI / 2) / (Math.PI * 2)) * STEPS;
  const beat = Math.floor(((rawBeat % STEPS) + STEPS) % STEPS);

  if (beat !== currentBeat) {
    currentBeat = beat;

    // Apply swing to odd beats
    const isOdd = beat % 2 === 1;
    const swingDelay = isOdd ? (60 / bpm / 4) * swing : 0;

    // Trigger modules near this beat position
    const beatAngle = (beat / STEPS) * Math.PI * 2 - Math.PI / 2;
    const triggerThreshold = Math.PI / STEPS * 1.2;

    modules.forEach(m => {
      let mAngle = m.angle;
      // Normalize to same range
      let diff = mAngle - beatAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < triggerThreshold) {
        if (swingDelay > 0 && ac) {
          setTimeout(() => m.trigger(beat), swingDelay * 1000);
        } else {
          m.trigger(beat);
        }
      }
    });

    // Fill: trigger random drums
    if (filling) {
      const drums = modules.filter(m => m.zone === 'outer');
      if (drums.length > 0) {
        const rd = drums[Math.floor(Math.random() * drums.length)];
        rd.trigger(beat);
      }
    }
  }

  // ─── DRAW ───
  G.clearRect(0, 0, W, H);
  drawDisk();
  drawSymmetryLines();
  drawSweepArm(beat);
  modules.forEach(m => drawModule(m));
  drawRipples(dt);
  drawShockwaves(dt);
  drawSpectrum();
  drawParticles(dt);

  requestAnimationFrame(loop);
}

// ─── INIT ───
resize();
buildDigitLegend();
buildPresetUI();

// Validate palindrome input in real-time
document.getElementById('palindromeInput').addEventListener('input', e => {
  const val = e.target.value.replace(/\D/g, '');
  e.target.value = val;
  const hint = document.getElementById('palHint');
  if (!val) { hint.textContent = 'Zahlen-Palindrom eingeben'; e.target.classList.remove('invalid'); return; }
  if (isPalindrome(val)) {
    hint.textContent = '\u2713 Palindrom! (' + val.length + ' Ziffern)';
    e.target.classList.remove('invalid');
  } else {
    hint.textContent = 'Noch kein Palindrom...';
    e.target.classList.remove('invalid');
  }
});

document.getElementById('palindromeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadPalindrome();
});
