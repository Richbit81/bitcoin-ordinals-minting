type CardType = 'animal' | 'action' | 'status' | string;
export type SoundCategory = 'master' | 'animal' | 'action' | 'ui';

const SOUND_BASE = '/sounds/blackwild';
const MAX_PLAY_MS = 3000;
const FADE_OUT_MS = 400;
const TARGET_RMS = 0.16;
const BASE_VOLUME = 0.85;
const VOLUME_STORAGE_KEY = 'bw_sound_volumes_v1';
const MUTE_STORAGE_KEY = 'bw_sound_muted_v1';

const ANIMAL_SOUND_BY_NAME: Record<string, string> = {
  grasshopper: 'grasshopper.mp3',
  ant: 'ant.mp3',
  bee: 'bee.mp3',
  chicken: 'chicken.mp3',
  worm: 'worm.mp3',
  spider: 'spider.mp3',
  butterfly: 'butterfly.mp3',
  bird: 'bird.mp3',
  cow: 'cow.mp3',
  tiger: 'tiger.mp3',
  rabbit: 'rabbit.mp3',
  duck: 'duck.mp3',
  crow: 'crow.mp3',
  cat: 'cat.mp3',
  gecko: 'gecko.mp3',
  zebra: 'zebra.mp3',
  sheep: 'sheep.mp3',
  turtle: 'turtle.mp3',
  penguin: 'penguin.mp3',
  koala: 'koala.mp3',
  fox: 'fox.mp3',
  octopus: 'octopus.mp3',
  ape: 'ape.mp3',
};

type CachedAudio = {
  buffer: AudioBuffer;
  normalizedGain: number;
};

type SoundVolumes = Record<SoundCategory, number>;

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let currentPriority = 0;
const audioCache = new Map<string, CachedAudio>();
let muted = false;
let volumes: SoundVolumes = {
  master: 0.85,
  animal: 0.95,
  action: 0.9,
  ui: 0.75,
};

const readVolumes = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SoundVolumes>;
    volumes = {
      master: Math.max(0, Math.min(1, Number(parsed.master ?? volumes.master))),
      animal: Math.max(0, Math.min(1, Number(parsed.animal ?? volumes.animal))),
      action: Math.max(0, Math.min(1, Number(parsed.action ?? volumes.action))),
      ui: Math.max(0, Math.min(1, Number(parsed.ui ?? volumes.ui))),
    };
  } catch {}
};

const writeVolumes = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(volumes));
  } catch {}
};

readVolumes();

const readMuted = () => {
  if (typeof window === 'undefined') return;
  try {
    muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {}
};

const writeMuted = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {}
};

readMuted();

const ensureAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  audioContext = new Ctx();
  return audioContext;
};

const analyzeBuffer = (buffer: AudioBuffer): { rms: number; peak: number } => {
  const channels = buffer.numberOfChannels;
  const step = Math.max(1, Math.floor(buffer.sampleRate / 120));
  let sumSquares = 0;
  let samples = 0;
  let peak = 0;

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += step) {
      const v = data[i] || 0;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sumSquares += v * v;
      samples++;
    }
  }

  const rms = samples > 0 ? Math.sqrt(sumSquares / samples) : 0;
  return { rms, peak };
};

const buildNormalizedGain = (rms: number, peak: number): number => {
  if (!Number.isFinite(rms) || rms <= 0.00001) return 1;
  let gain = TARGET_RMS / rms;
  gain = Math.max(0.35, Math.min(2.2, gain));

  // Avoid clipping for very loud sources.
  if (Number.isFinite(peak) && peak > 0) {
    const maxSafeGain = 0.98 / peak;
    gain = Math.min(gain, Math.max(0.35, maxSafeGain));
  }
  return gain;
};

const loadAudio = async (url: string): Promise<CachedAudio | null> => {
  const cached = audioCache.get(url);
  if (cached) return cached;

  const ctx = ensureAudioContext();
  if (!ctx) return null;

  const res = await fetch(url);
  if (!res.ok) return null;

  const arr = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arr.slice(0));
  const { rms, peak } = analyzeBuffer(buffer);
  const normalizedGain = buildNormalizedGain(rms, peak);
  const payload = { buffer, normalizedGain };
  audioCache.set(url, payload);
  return payload;
};

const stopCurrent = () => {
  try {
    currentSource?.stop();
  } catch {}
  try {
    currentSource?.disconnect();
  } catch {}
  try {
    currentGain?.disconnect();
  } catch {}
  currentSource = null;
  currentGain = null;
  currentPriority = 0;
};

const playUrl = async (url: string, category: Exclude<SoundCategory, 'master'>, priority: number) => {
  if (muted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }

  const data = await loadAudio(url);
  if (!data) return;

  if (currentSource && currentPriority > priority) {
    return;
  }

  stopCurrent();

  const source = ctx.createBufferSource();
  source.buffer = data.buffer;

  const gainNode = ctx.createGain();
  const categoryVolume = category === 'animal' ? volumes.animal : category === 'action' ? volumes.action : volumes.ui;
  const targetVolume = data.normalizedGain * BASE_VOLUME * volumes.master * categoryVolume;
  gainNode.gain.setValueAtTime(targetVolume, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();

  currentSource = source;
  currentGain = gainNode;
  currentPriority = priority;

  const fadeStartSec = Math.max(0.2, (MAX_PLAY_MS - FADE_OUT_MS) / 1000);
  const stopAtSec = MAX_PLAY_MS / 1000;
  const now = ctx.currentTime;
  const currentValue = gainNode.gain.value;
  gainNode.gain.setValueAtTime(currentValue, now + fadeStartSec);
  gainNode.gain.linearRampToValueAtTime(0.0001, now + stopAtSec);

  window.setTimeout(() => {
    if (currentSource === source) {
      stopCurrent();
    }
  }, MAX_PLAY_MS + 80);
};

const getSoundUrlForCard = (cardName: string, cardType: CardType): { url: string; category: Exclude<SoundCategory, 'master'>; priority: number } => {
  const key = String(cardName || '').trim().toLowerCase();
  if (cardType === 'animal') {
    const file = ANIMAL_SOUND_BY_NAME[key] || 'ui_card_play.mp3';
    return { url: `${SOUND_BASE}/${file}`, category: 'animal', priority: 3 };
  }
  if (cardType === 'action' || cardType === 'status') {
    return { url: `${SOUND_BASE}/ui_action.mp3`, category: 'action', priority: 2 };
  }
  return { url: `${SOUND_BASE}/ui_card_play.mp3`, category: 'ui', priority: 1 };
};

export const playGameCardSound = async (cardName: string, cardType: CardType) => {
  const { url, category, priority } = getSoundUrlForCard(cardName, cardType);
  try {
    await playUrl(url, category, priority);
  } catch {
    // Audio failure should never break gameplay actions.
  }
};

export const playGameUiSound = async (kind: 'play' | 'action' | 'impact' = 'action') => {
  const file = kind === 'play' ? 'ui_card_play.mp3' : kind === 'impact' ? 'ui_action.mp3' : 'ui_action.mp3';
  try {
    await playUrl(`${SOUND_BASE}/${file}`, 'ui', 1);
  } catch {}
};

export const getGameSoundVolumes = (): SoundVolumes => ({ ...volumes });

export const setGameSoundVolume = (category: SoundCategory, value: number) => {
  volumes = {
    ...volumes,
    [category]: Math.max(0, Math.min(1, Number(value || 0))),
  };
  writeVolumes();
};

export const isGameSoundMuted = () => muted;

export const setGameSoundMuted = (value: boolean) => {
  muted = !!value;
  writeMuted();
  if (muted) {
    stopCurrent();
  }
};

