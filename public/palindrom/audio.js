// Audio System für Palindrom Sound Box
// Web Audio API - Überarbeitete Version mit fester Signalkette
// Alle Effekte bleiben, aber mit sicheren Bereichen und korrekter Implementierung
// Master-Limiter verhindert JEGLICHES Clipping

class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.masterLimiter = null;
        this.analyser = null;
        this.frequencyData = null;
        
        // Feste Signalkette Nodes (werden EINMAL erstellt, nie pro Ton!)
        this.instrumentBus = null;
        this.filterNode = null;
        this.distortionNode = null;
        this.tremoloModGain = null;
        this.mainBus = null;
        
        // Send-Effekte
        this.delayNode = null;
        this.delayFeedback = null;
        this.delayWetGain = null;
        this.reverbConvolver = null;
        this.reverbWetGain = null;
        this.chorusDelay = null;
        this.chorusWetGain = null;
        this.phaserFilter1 = null;
        this.phaserFilter2 = null;
        this.phaserWetGain = null;
        
        // LFOs (laufen permanent)
        this.vibratoLFO = null;
        this.vibratoLFOGain = null;
        this.tremoloLFO = null;
        this.tremoloLFOGain = null;
        this.chorusLFO = null;
        this.phaserLFO = null;
        
        // Dynamics
        this.userCompressor = null;
        
        // EQ
        this.eqLowFilter = null;
        this.eqMidFilter = null;
        this.eqHighFilter = null;
        
        // Beat-System
        this.beatInterval = null;
        this.beatStyle = 'none';
        this.bpm = 120;
        this.beatVolume = 0.5;
        this.sequenceTempo = 1;
        this.beatGain = null;
        
        // Aktive Oszillatoren (für Cleanup)
        this.activeOscillators = [];
        
        // Einstellungen (alle 0-100, sichere Bereiche)
        this.instrument = 'piano';
        this.key = 'C';
        this.speed = 5;
        this.volume = 0.5;
        this.vibrato = 0;
        this.delay = 0;
        this.filter = 0;
        this.distortion = 0;
        this.reverb = 0;
        this.sustain = 50;
        this.smoothness = 50;
        this.chorus = 0;
        this.phaser = 0;
        this.tremolo = 0;
        this.compression = 0;
        
        // EQ (±12dB max, nicht mehr ±20dB)
        this.eqLow = 0;
        this.eqMid = 0;
        this.eqHigh = 0;
        
        // Frequenzen
        this.baseFreq = 261.63; // C4
        this.octaveShift = 0; // -2 to +2
        this.frequencies = {};
        this.scale = 'major';
        this.scaleIntervals = {
            major:      [0, 2, 4, 5, 7, 9, 11, 12, 14, 16],
            minor:      [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],
            pentatonic: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
            blues:      [0, 3, 5, 6, 7, 10, 12, 15, 17, 18],
            dorian:     [0, 2, 3, 5, 7, 9, 10, 12, 14, 15],
            mixolydian: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16],
            chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            japanese:   [0, 1, 5, 7, 8, 12, 13, 17, 19, 20],
        };
        this.updateFrequenciesForKey();
        
        // Beat-Patterns (16 Schritte)
        this.beatPatterns = {
            house:   { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] },
            hiphop:  { kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1] },
            techno:  { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hihat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] },
            trap:    { kick: [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0] },
            rock:    { kick: [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hihat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
            dubstep: { kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], hihat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0] }
        };
        this.beatStep = 0;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // ================================================================
            // FESTE SIGNALKETTE (von Ausgang nach Eingang aufgebaut)
            // ================================================================
            
            // --- STUFE 1: Ausgang mit Safety-Limiter ---
            this.masterLimiter = this.audioContext.createDynamicsCompressor();
            this.masterLimiter.threshold.value = -2;    // Greift kurz vor Clipping
            this.masterLimiter.knee.value = 3;           // Schneller Übergang
            this.masterLimiter.ratio.value = 20;         // Harte Begrenzung
            this.masterLimiter.attack.value = 0.001;     // Ultra-schnell
            this.masterLimiter.release.value = 0.05;     // Schnelles Release
            this.masterLimiter.connect(this.audioContext.destination);
            
            // --- STUFE 2: User-Compression (optional) ---
            this.userCompressor = this.audioContext.createDynamicsCompressor();
            this.userCompressor.threshold.value = 0;     // Aus bei 0 (greift nie)
            this.userCompressor.knee.value = 30;
            this.userCompressor.ratio.value = 1;         // 1:1 = kein Effekt
            this.userCompressor.attack.value = 0.01;
            this.userCompressor.release.value = 0.15;
            this.userCompressor.connect(this.masterLimiter);
            
            // --- STUFE 3: Master Gain ---
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.userCompressor);
            
            // --- STUFE 4: Analyser (abgezweigt für Visualisierung) ---
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.masterGain.connect(this.analyser);
            
            // --- STUFE 5: EQ-Kette → masterGain ---
            this.eqLowFilter = this.audioContext.createBiquadFilter();
            this.eqLowFilter.type = 'lowshelf';
            this.eqLowFilter.frequency.value = 200;
            this.eqLowFilter.gain.value = 0;
            
            this.eqMidFilter = this.audioContext.createBiquadFilter();
            this.eqMidFilter.type = 'peaking';
            this.eqMidFilter.frequency.value = 1000;
            this.eqMidFilter.Q.value = 1;
            this.eqMidFilter.gain.value = 0;
            
            this.eqHighFilter = this.audioContext.createBiquadFilter();
            this.eqHighFilter.type = 'highshelf';
            this.eqHighFilter.frequency.value = 5000;
            this.eqHighFilter.gain.value = 0;
            
            this.eqLowFilter.connect(this.eqMidFilter);
            this.eqMidFilter.connect(this.eqHighFilter);
            this.eqHighFilter.connect(this.masterGain);
            
            // --- STUFE 6: Main Bus (Sammelpunkt: Dry + alle Effekt-Returns) ---
            // Alles geht durch die EQ-Kette
            this.mainBus = this.audioContext.createGain();
            this.mainBus.gain.value = 1.0;
            this.mainBus.connect(this.eqLowFilter); // Dry-Pfad
            
            // --- STUFE 7: Send-Effekte (parallel zum Dry-Signal) ---
            
            // 7a: Delay (Send/Return)
            this.delayNode = this.audioContext.createDelay(1.0);
            this.delayNode.delayTime.value = 0.3;
            this.delayFeedback = this.audioContext.createGain();
            this.delayFeedback.gain.value = 0; // 0 = aus
            this.delayWetGain = this.audioContext.createGain();
            this.delayWetGain.gain.value = 0; // 0 = aus
            
            this.delayNode.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delayNode);  // Feedback-Loop
            this.delayNode.connect(this.delayWetGain);
            this.delayWetGain.connect(this.eqLowFilter);  // Return → EQ → Master
            this.mainBus.connect(this.delayNode);          // Send
            
            // 7b: Reverb (Send/Return)
            this._createReverbImpulse();
            // reverbConvolver → reverbWetGain → EQ wird in _createReverbImpulse verbunden
            this.mainBus.connect(this.reverbConvolver);    // Send
            
            // 7c: Chorus (Send/Return)
            this.chorusDelay = this.audioContext.createDelay(0.05);
            this.chorusDelay.delayTime.value = 0.005;
            this.chorusLFO = this.audioContext.createOscillator();
            this.chorusLFO.type = 'sine';
            this.chorusLFO.frequency.value = 1.5;
            this.chorusLFOGain = this.audioContext.createGain();
            this.chorusLFOGain.gain.value = 0.002; // Subtile Delay-Modulation
            this.chorusLFO.connect(this.chorusLFOGain);
            this.chorusLFOGain.connect(this.chorusDelay.delayTime);
            this.chorusLFO.start();
            
            this.chorusWetGain = this.audioContext.createGain();
            this.chorusWetGain.gain.value = 0; // 0 = aus
            this.chorusDelay.connect(this.chorusWetGain);
            this.chorusWetGain.connect(this.eqLowFilter);  // Return → EQ
            this.mainBus.connect(this.chorusDelay);         // Send
            
            // 7d: Phaser (Send/Return)
            this.phaserFilter1 = this.audioContext.createBiquadFilter();
            this.phaserFilter1.type = 'allpass';
            this.phaserFilter1.frequency.value = 350;
            this.phaserFilter1.Q.value = 0.7;
            this.phaserFilter2 = this.audioContext.createBiquadFilter();
            this.phaserFilter2.type = 'allpass';
            this.phaserFilter2.frequency.value = 1000;
            this.phaserFilter2.Q.value = 0.7;
            this.phaserLFO = this.audioContext.createOscillator();
            this.phaserLFO.type = 'sine';
            this.phaserLFO.frequency.value = 0.4;
            this.phaserLFOGain = this.audioContext.createGain();
            this.phaserLFOGain.gain.value = 0; // 0 = aus
            this.phaserLFO.connect(this.phaserLFOGain);
            this.phaserLFOGain.connect(this.phaserFilter1.frequency);
            this.phaserLFOGain.connect(this.phaserFilter2.frequency);
            this.phaserLFO.start();
            
            this.phaserWetGain = this.audioContext.createGain();
            this.phaserWetGain.gain.value = 0; // 0 = aus
            this.phaserFilter1.connect(this.phaserFilter2);
            this.phaserFilter2.connect(this.phaserWetGain);
            this.phaserWetGain.connect(this.eqLowFilter);  // Return → EQ
            this.mainBus.connect(this.phaserFilter1);       // Send
            
            // --- STUFE 8: Insert-Effekte (in Serie) ---
            
            // 8a: Tremolo (Amplitude-Modulation, in der Kette)
            this.tremoloModGain = this.audioContext.createGain();
            this.tremoloModGain.gain.value = 1.0; // Neutral
            this.tremoloLFO = this.audioContext.createOscillator();
            this.tremoloLFO.type = 'sine';
            this.tremoloLFO.frequency.value = 5;
            this.tremoloLFOGain = this.audioContext.createGain();
            this.tremoloLFOGain.gain.value = 0; // 0 = kein Tremolo
            this.tremoloLFO.connect(this.tremoloLFOGain);
            this.tremoloLFOGain.connect(this.tremoloModGain.gain); // Moduliert den Gain
            this.tremoloLFO.start();
            this.tremoloModGain.connect(this.mainBus);
            
            // 8b: Distortion (Waveshaper, in der Kette)
            this.distortionNode = this.audioContext.createWaveShaper();
            this.distortionNode.curve = this._makeDistortionCurve(0); // Linear = aus
            this.distortionNode.oversample = '4x';
            this.distortionNode.connect(this.tremoloModGain);
            
            // 8c: Filter (Lowpass, in der Kette)
            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 20000; // Offen = aus
            this.filterNode.Q.value = 0.7; // Sanft, KEIN Resonanzpeak!
            this.filterNode.connect(this.distortionNode);
            
            // --- STUFE 9: Instrument-Eingang ---
            this.instrumentBus = this.audioContext.createGain();
            this.instrumentBus.gain.value = 1.0;
            this.instrumentBus.connect(this.filterNode); // → Filter → Distortion → Tremolo → MainBus → ...
            
            // --- STUFE 10: Vibrato LFO (moduliert Oszillator-Frequenz, NICHT Amplitude!) ---
            this.vibratoLFO = this.audioContext.createOscillator();
            this.vibratoLFO.type = 'sine';
            this.vibratoLFO.frequency.value = 5.5; // 5.5 Hz Vibrato-Rate
            this.vibratoLFOGain = this.audioContext.createGain();
            this.vibratoLFOGain.gain.value = 0; // 0 cents = aus
            this.vibratoLFO.connect(this.vibratoLFOGain);
            this.vibratoLFO.start();
            // vibratoLFOGain wird in createTone() an jede osc.detune verbunden
            
            // --- STUFE 11: Beat-System (eigener Bus, ohne Effekte) ---
            this.beatGain = this.audioContext.createGain();
            this.beatGain.gain.value = this.beatVolume;
            this.beatGain.connect(this.masterGain);
            
            console.log('Audio system initialized (with limiter + fixed signal chain)');
        } catch (error) {
            console.error('Error initializing audio system:', error);
            throw error;
        }
    }

    // ================================================================
    // REVERB IMPULSE RESPONSE
    // ================================================================
    
    _createReverbImpulse() {
        const sr = this.audioContext.sampleRate;
        const length = sr * 2.5;
        const impulse = this.audioContext.createBuffer(2, length, sr);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            
            // Early reflections (first 80ms) - gives space and depth
            const earlyEnd = Math.floor(sr * 0.08);
            const reflections = [
                { time: 0.012, gain: 0.6 }, { time: 0.019, gain: 0.45 },
                { time: 0.028, gain: 0.35 }, { time: 0.037, gain: 0.28 },
                { time: 0.048, gain: 0.2 },  { time: 0.062, gain: 0.15 },
                { time: 0.074, gain: 0.1 }
            ];
            for (const ref of reflections) {
                const idx = Math.floor(ref.time * sr);
                const spread = 4;
                for (let j = -spread; j <= spread; j++) {
                    const k = idx + j + (channel * 3);
                    if (k >= 0 && k < earlyEnd) {
                        data[k] += ref.gain * (1 - Math.abs(j) / (spread + 1))
                            * (0.8 + Math.random() * 0.4);
                    }
                }
            }
            
            // Late diffuse tail with frequency-dependent decay
            for (let i = earlyEnd; i < length; i++) {
                const t = i / length;
                const decay = Math.exp(-3.5 * t) * (1 - t);
                const hfDamping = Math.exp(-6 * t);
                const lf = (Math.random() * 2 - 1) * decay;
                const hf = (Math.random() * 2 - 1) * decay * hfDamping * 0.6;
                data[i] = lf * 0.7 + hf * 0.3;
            }
        }
        
        this.reverbConvolver = this.audioContext.createConvolver();
        this.reverbConvolver.buffer = impulse;
        this.reverbWetGain = this.audioContext.createGain();
        this.reverbWetGain.gain.value = 0;
        this.reverbConvolver.connect(this.reverbWetGain);
        this.reverbWetGain.connect(this.eqLowFilter);
    }

    // ================================================================
    // DISTORTION KURVE (sanfte tanh-Sättigung, KANN NICHT über ±1.0!)
    // ================================================================

    _makeDistortionCurve(amount) {
        // amount: 0-100
        // 0 = linear (kein Effekt), 100 = starke Sättigung (aber immer ≤ ±1.0)
        const samples = 8192;
        const curve = new Float32Array(samples);
        
        if (amount <= 0) {
            // Linear: Signal unverändert
            for (let i = 0; i < samples; i++) {
                curve[i] = (i * 2) / samples - 1;
            }
        } else {
            // Tanh Soft-Clipping: Drive-Faktor 1-8
            const drive = 1 + (amount / 100) * 7;
            const tanhDrive = Math.tanh(drive);
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                curve[i] = Math.tanh(x * drive) / tanhDrive; // Normalisiert auf [-1, +1]
            }
        }
        
        return curve;
    }

    // ================================================================
    // FREQUENZ-MAPPING (Dur-Tonleiter für harmonischen Klang)
    // ================================================================

    updateFrequenciesForKey() {
        const semitones = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        const offset = semitones[this.key] || 0;
        const intervals = this.scaleIntervals[this.scale] || this.scaleIntervals.major;
        const octaveOffset = this.octaveShift * 12;
        
        for (let i = 0; i < 10; i++) {
            const semitone = offset + intervals[i] + octaveOffset;
            this.frequencies[i] = this.baseFreq * Math.pow(2, semitone / 12);
        }
    }

    setScale(scale) {
        this.scale = scale;
        this.updateFrequenciesForKey();
    }

    setOctave(shift) {
        this.octaveShift = Math.max(-2, Math.min(2, shift));
        this.updateFrequenciesForKey();
    }

    getFrequency(number) {
        return this.frequencies[number] || this.baseFreq;
    }

    // ================================================================
    // TON-ERZEUGUNG (saubere Oszillatoren → instrumentBus)
    // ================================================================

    playTone(number, duration, startTime = null, beatSync = false) {
        if (!this.audioContext || !this.instrumentBus) return;
        
        const frequency = this.getFrequency(number);
        const now = startTime || this.audioContext.currentTime;
        
        let actualDuration = duration;
        if (!beatSync && duration > 0.8) {
            actualDuration = Math.min(duration, 0.8);
        }
        
        return this._createTone(frequency, actualDuration, now, beatSync);
    }

    _createTone(frequency, duration, now, beatSync) {
        const configs = {
            piano: {
                oscs: [
                    { type: 'sine', gain: 0.13, detune: 0, cents: -4 },
                    { type: 'sine', gain: 0.13, detune: 0, cents: 4 },
                    { type: 'sine', gain: 0.04, freqRatio: 2.0 },
                    { type: 'sine', gain: 0.02, freqRatio: 3.0 },
                    { type: 'sine', gain: 0.01, freqRatio: 4.0 },
                ],
                attack: 0.005, decay: 0.25, sustainLevel: 0.25, release: 0.3,
                filterEnv: { start: 5000, end: 1200, time: 0.4 },
                noise: { level: 0.06, duration: 0.015, filter: 4000 }
            },
            strings: {
                oscs: [
                    { type: 'sawtooth', gain: 0.07, cents: -12 },
                    { type: 'sawtooth', gain: 0.07, cents: 12 },
                    { type: 'sawtooth', gain: 0.05, cents: -7, detune: -12 },
                    { type: 'sawtooth', gain: 0.05, cents: 7, detune: -12 },
                    { type: 'sawtooth', gain: 0.03, cents: 3 },
                ],
                attack: 0.18, decay: 0.3, sustainLevel: 0.6, release: 0.4,
                filterEnv: { start: 2500, end: 3500, time: 0.6 }
            },
            brass: {
                oscs: [
                    { type: 'sawtooth', gain: 0.11, cents: -6 },
                    { type: 'sawtooth', gain: 0.11, cents: 6 },
                    { type: 'square', gain: 0.04, cents: 0 }
                ],
                attack: 0.06, decay: 0.15, sustainLevel: 0.5, release: 0.12,
                filterEnv: { start: 600, end: 3000, time: 0.12 },
                noise: { level: 0.03, duration: 0.04, filter: 2000 }
            },
            flute: {
                oscs: [
                    { type: 'sine', gain: 0.16, cents: 0 },
                    { type: 'sine', gain: 0.04, freqRatio: 2.0 },
                    { type: 'triangle', gain: 0.03, cents: 3 }
                ],
                attack: 0.12, decay: 0.1, sustainLevel: 0.6, release: 0.25,
                filterEnv: { start: 3000, end: 2000, time: 0.3 },
                noise: { level: 0.04, duration: 0.08, filter: 3000, sustained: true }
            },
            organ: {
                oscs: [
                    { type: 'sine', gain: 0.09, freqRatio: 0.5 },
                    { type: 'sine', gain: 0.10, freqRatio: 1.0 },
                    { type: 'sine', gain: 0.06, freqRatio: 2.0 },
                    { type: 'sine', gain: 0.04, freqRatio: 3.0 },
                    { type: 'sine', gain: 0.02, freqRatio: 4.0 },
                    { type: 'sine', gain: 0.015, freqRatio: 6.0 }
                ],
                attack: 0.008, decay: 0.03, sustainLevel: 0.8, release: 0.06
            },
            bell: {
                oscs: [
                    { type: 'sine', gain: 0.10, freqRatio: 1.0 },
                    { type: 'sine', gain: 0.07, freqRatio: 2.76 },
                    { type: 'sine', gain: 0.05, freqRatio: 5.04 },
                    { type: 'sine', gain: 0.03, freqRatio: 7.28 },
                    { type: 'sine', gain: 0.02, freqRatio: 10.56 }
                ],
                attack: 0.001, decay: 0.6, sustainLevel: 0.05, release: 0.5,
                filterEnv: { start: 8000, end: 1500, time: 0.8 }
            },
            synth: {
                oscs: [
                    { type: 'sawtooth', gain: 0.09, cents: -10 },
                    { type: 'sawtooth', gain: 0.09, cents: 10 },
                    { type: 'square', gain: 0.05, cents: -15, detune: -12 },
                    { type: 'square', gain: 0.05, cents: 15 }
                ],
                attack: 0.01, decay: 0.15, sustainLevel: 0.45, release: 0.15,
                filterEnv: { start: 6000, end: 1800, time: 0.25 }
            },
            guitar: {
                oscs: [
                    { type: 'triangle', gain: 0.12, cents: -3 },
                    { type: 'triangle', gain: 0.12, cents: 3 },
                    { type: 'sine', gain: 0.04, freqRatio: 2.0 },
                    { type: 'sine', gain: 0.02, freqRatio: 3.0 }
                ],
                attack: 0.002, decay: 0.3, sustainLevel: 0.2, release: 0.25,
                filterEnv: { start: 5000, end: 900, time: 0.35 },
                noise: { level: 0.08, duration: 0.01, filter: 6000 }
            }
        };
        
        const config = configs[this.instrument] || configs.piano;
        
        const sustainFactor = this.sustain / 100;
        const smoothFactor = this.smoothness / 100;
        
        const attack = config.attack * (1 + smoothFactor * 1.5);
        const decay = config.decay;
        const sustainLevel = config.sustainLevel * (0.3 + sustainFactor * 0.7);
        const release = config.release * (1 + smoothFactor * 2);
        
        const envGain = this.audioContext.createGain();
        let totalDuration;
        
        if (beatSync) {
            const legato = Math.min(0.25, duration * 0.7);
            totalDuration = duration + legato;
            const beatAttack = 0.012;
            const beatSustain = Math.max(sustainLevel, 0.5);
            const holdEnd = now + duration - 0.01;
            envGain.gain.setValueAtTime(0.001, now);
            envGain.gain.linearRampToValueAtTime(1.0, now + beatAttack);
            if (duration > beatAttack + 0.03) {
                envGain.gain.linearRampToValueAtTime(beatSustain, now + beatAttack + 0.03);
                envGain.gain.setValueAtTime(beatSustain, holdEnd);
            }
            envGain.gain.exponentialRampToValueAtTime(0.005, now + totalDuration);
        } else {
            const normalLegato = Math.min(0.15, duration * 0.5);
            totalDuration = duration + normalLegato;
            const safeAttack = Math.min(attack, totalDuration * 0.2);
            const holdEnd = now + duration - 0.005;
            envGain.gain.setValueAtTime(0.001, now);
            envGain.gain.linearRampToValueAtTime(1.0, now + safeAttack);
            envGain.gain.linearRampToValueAtTime(sustainLevel, now + safeAttack + decay);
            if (duration > safeAttack + decay + 0.02) {
                envGain.gain.setValueAtTime(sustainLevel, holdEnd);
            }
            envGain.gain.exponentialRampToValueAtTime(0.003, now + totalDuration);
        }
        
        // Per-note filter envelope for natural timbral movement
        let noteFilter = null;
        if (config.filterEnv) {
            noteFilter = this.audioContext.createBiquadFilter();
            noteFilter.type = 'lowpass';
            noteFilter.Q.value = 1.2;
            const fe = config.filterEnv;
            noteFilter.frequency.setValueAtTime(fe.start, now);
            noteFilter.frequency.exponentialRampToValueAtTime(
                Math.max(fe.end, 20), now + fe.time
            );
        }
        
        // Build oscillators
        const oscillators = [];
        for (const oc of config.oscs) {
            const osc = this.audioContext.createOscillator();
            osc.type = oc.type;
            
            let freq = frequency;
            if (oc.freqRatio !== undefined) {
                freq = frequency * oc.freqRatio;
            } else if (oc.detune) {
                freq = frequency * Math.pow(2, oc.detune / 12);
            }
            osc.frequency.value = freq;
            
            if (oc.cents) osc.detune.value = oc.cents;
            
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = oc.gain;
            
            osc.connect(oscGain);
            if (noteFilter) {
                oscGain.connect(noteFilter);
            } else {
                oscGain.connect(envGain);
            }
            
            this.vibratoLFOGain.connect(osc.detune);
            osc.start(now);
            osc.stop(now + totalDuration + 0.1);
            oscillators.push(osc);
        }
        
        if (noteFilter) {
            noteFilter.connect(envGain);
        }
        
        // Noise transient layer for realistic attacks
        if (config.noise && config.noise.level > 0) {
            const noiseDur = config.noise.sustained
                ? totalDuration : config.noise.duration;
            const bufSize = Math.max(128,
                Math.floor(this.audioContext.sampleRate * noiseDur));
            const buf = this.audioContext.createBuffer(
                1, bufSize, this.audioContext.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
            
            const noiseSrc = this.audioContext.createBufferSource();
            noiseSrc.buffer = buf;
            const nf = this.audioContext.createBiquadFilter();
            nf.type = 'bandpass';
            nf.frequency.value = config.noise.filter;
            nf.Q.value = 0.8;
            const ng = this.audioContext.createGain();
            
            if (config.noise.sustained) {
                ng.gain.setValueAtTime(config.noise.level * 0.5, now);
                ng.gain.linearRampToValueAtTime(config.noise.level, now + attack);
                ng.gain.setValueAtTime(config.noise.level * sustainLevel, now + attack + 0.05);
                ng.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);
            } else {
                ng.gain.setValueAtTime(config.noise.level, now);
                ng.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
            }
            
            noiseSrc.connect(nf);
            nf.connect(ng);
            ng.connect(envGain);
            noiseSrc.start(now);
            noiseSrc.stop(now + noiseDur + 0.01);
        }
        
        envGain.connect(this.instrumentBus);
        
        this.activeOscillators.push({
            oscillators, envGain,
            stopTime: now + totalDuration + 0.1
        });
        this._cleanupFinished();
        
        return { oscillators, envGain };
    }

    // ================================================================
    // BEAT-SYSTEM
    // ================================================================

    playKick(time) {
        // Sub body oscillator
        const sub = this.audioContext.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(150, time);
        sub.frequency.exponentialRampToValueAtTime(35, time + 0.08);
        sub.frequency.exponentialRampToValueAtTime(28, time + 0.2);
        const subGain = this.audioContext.createGain();
        subGain.gain.setValueAtTime(0.5, time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        sub.connect(subGain);
        subGain.connect(this.beatGain);
        sub.start(time);
        sub.stop(time + 0.35);
        
        // Click transient
        const click = this.audioContext.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(800, time);
        click.frequency.exponentialRampToValueAtTime(200, time + 0.02);
        const clickGain = this.audioContext.createGain();
        clickGain.gain.setValueAtTime(0.25, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        click.connect(clickGain);
        clickGain.connect(this.beatGain);
        click.start(time);
        click.stop(time + 0.05);
        
        // Punch noise burst
        const punchBuf = this.audioContext.createBuffer(
            1, Math.floor(this.audioContext.sampleRate * 0.02), this.audioContext.sampleRate);
        const pd = punchBuf.getChannelData(0);
        for (let i = 0; i < pd.length; i++) pd[i] = Math.random() * 2 - 1;
        const punchSrc = this.audioContext.createBufferSource();
        punchSrc.buffer = punchBuf;
        const punchFilt = this.audioContext.createBiquadFilter();
        punchFilt.type = 'lowpass';
        punchFilt.frequency.value = 600;
        const punchGain = this.audioContext.createGain();
        punchGain.gain.setValueAtTime(0.12, time);
        punchGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
        punchSrc.connect(punchFilt);
        punchFilt.connect(punchGain);
        punchGain.connect(this.beatGain);
        punchSrc.start(time);
        punchSrc.stop(time + 0.03);
    }

    playSnare(time) {
        // Tonal body
        const body = this.audioContext.createOscillator();
        body.type = 'triangle';
        body.frequency.setValueAtTime(220, time);
        body.frequency.exponentialRampToValueAtTime(120, time + 0.05);
        const bodyGain = this.audioContext.createGain();
        bodyGain.gain.setValueAtTime(0.28, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        body.connect(bodyGain);
        bodyGain.connect(this.beatGain);
        body.start(time);
        body.stop(time + 0.12);
        
        // Wire/snare noise
        const bufSize = Math.floor(this.audioContext.sampleRate * 0.18);
        const buf = this.audioContext.createBuffer(1, bufSize, this.audioContext.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buf;
        const hp = this.audioContext.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2000;
        const bp = this.audioContext.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.value = 4500;
        bp.gain.value = 6;
        bp.Q.value = 1.5;
        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.25, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
        noise.connect(hp);
        hp.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(this.beatGain);
        noise.start(time);
        noise.stop(time + 0.18);
    }

    playHiHat(time) {
        // Metallic oscillators (square waves at inharmonic ratios)
        const ratios = [1, 1.34, 1.61, 1.88];
        const baseFreq = 6200;
        for (const ratio of ratios) {
            const osc = this.audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.value = baseFreq * ratio;
            const g = this.audioContext.createGain();
            g.gain.setValueAtTime(0.03, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
            osc.connect(g);
            g.connect(this.beatGain);
            osc.start(time);
            osc.stop(time + 0.06);
        }
        
        // Noise layer
        const bufSize = Math.floor(this.audioContext.sampleRate * 0.05);
        const buf = this.audioContext.createBuffer(1, bufSize, this.audioContext.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buf;
        const hp = this.audioContext.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 9000;
        const ng = this.audioContext.createGain();
        ng.gain.setValueAtTime(0.14, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        noise.connect(hp);
        hp.connect(ng);
        ng.connect(this.beatGain);
        noise.start(time);
        noise.stop(time + 0.06);
    }

    startBeats() {
        if (this.beatStyle === 'none') {
            this.stopBeats();
            return;
        }
        if (this.beatInterval) {
            this.stopBeats();
        }
        
        const pattern = this.beatPatterns[this.beatStyle];
        if (!pattern) return;
        
        this._beatNextStepTime = this.audioContext.currentTime;
        this._beatPattern = pattern;
        this._beatRunning = true;
        
        // Lookahead scheduler: schedules beats 150ms ahead, wakes every 25ms
        const LOOKAHEAD_SEC = 0.15;
        const INTERVAL_MS = 25;
        
        const scheduler = () => {
            if (!this._beatRunning) return;
            const stepDuration = 60 / (this.bpm * 4);
            const horizon = this.audioContext.currentTime + LOOKAHEAD_SEC;
            
            while (this._beatNextStepTime < horizon) {
                const step = this.beatStep % 16;
                const p = this._beatPattern;
                if (p.kick  && p.kick[step])  this.playKick(this._beatNextStepTime);
                if (p.snare && p.snare[step]) this.playSnare(this._beatNextStepTime);
                if (p.hihat && p.hihat[step]) this.playHiHat(this._beatNextStepTime);
                if (p.clap  && p.clap[step])  this.playClap?.(this._beatNextStepTime);
                if (p.openHat && p.openHat[step]) this.playOpenHiHat?.(this._beatNextStepTime);
                if (p.rim   && p.rim[step])   this.playRim?.(this._beatNextStepTime);
                if (p.tom   && p.tom[step])   this.playTom?.(this._beatNextStepTime);
                if (p.crash && p.crash[step]) this.playCrash?.(this._beatNextStepTime);
                this.beatStep++;
                this._beatNextStepTime += stepDuration;
            }
        };
        
        scheduler();
        this.beatInterval = setInterval(scheduler, INTERVAL_MS);
    }

    stopBeats() {
        this._beatRunning = false;
        if (this.beatInterval) {
            clearInterval(this.beatInterval);
            this.beatInterval = null;
        }
        this.beatStep = 0;
    }

    // ================================================================
    // CLEANUP
    // ================================================================

    _cleanupFinished() {
        const now = this.audioContext.currentTime;
        this.activeOscillators = this.activeOscillators.filter(item => item.stopTime > now);
    }

    cleanupAllOscillators() {
        const now = this.audioContext.currentTime;
        for (const item of this.activeOscillators) {
            if (item.stopTime > now) {
                try {
                    item.envGain.gain.cancelScheduledValues(now);
                    item.envGain.gain.setValueAtTime(item.envGain.gain.value, now);
                    item.envGain.gain.linearRampToValueAtTime(0, now + 0.05);
                } catch (e) { /* ignore */ }
            }
        }
        this.activeOscillators = [];
    }

    // ================================================================
    // SETTER (aktualisieren die feste Signalkette live)
    // Alle Effekte bleiben, aber mit SICHEREN Maximalwerten!
    // ================================================================

    setInstrument(instrument) { this.instrument = instrument; }
    
    setKey(key) {
        this.key = key;
        this.updateFrequenciesForKey();
    }
    
    setSpeed(speed) { this.speed = speed; }

    setVolume(volume) {
        this.volume = volume / 100;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.volume, this.audioContext.currentTime, 0.02);
        }
    }

    // --- VIBRATO: Pitch-Modulation, max ±30 Cents (subtil) ---
    setVibrato(value) {
        this.vibrato = value;
        if (this.vibratoLFOGain) {
            // 0% = 0 Cents, 100% = 30 Cents Pitch-Wobble (subtil und angenehm)
            this.vibratoLFOGain.gain.setTargetAtTime(
                (value / 100) * 30,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- DELAY: Wet max 35%, Feedback max 25% (kein Aufschaukeln) ---
    setDelay(value) {
        this.delay = value;
        if (this.delayWetGain) {
            this.delayWetGain.gain.setTargetAtTime(
                (value / 100) * 0.35,
                this.audioContext.currentTime, 0.02
            );
        }
        if (this.delayFeedback) {
            this.delayFeedback.gain.setTargetAtTime(
                (value / 100) * 0.25,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- FILTER: Lowpass, 20kHz (offen) bis 300Hz (stark gefiltert) ---
    setFilter(value) {
        this.filter = value;
        if (this.filterNode) {
            // Logarithmische Skala: 0%=20kHz, 50%≈2kHz, 100%=300Hz
            const freq = 20000 * Math.pow(0.015, value / 100);
            this.filterNode.frequency.setTargetAtTime(
                Math.max(freq, 300),
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- DISTORTION: Sanfte tanh-Sättigung (kann NIE über ±1.0!) ---
    setDistortion(value) {
        this.distortion = value;
        if (this.distortionNode) {
            this.distortionNode.curve = this._makeDistortionCurve(value);
        }
    }

    // --- REVERB: Wet max 40% ---
    setReverb(value) {
        this.reverb = value;
        if (this.reverbWetGain) {
            this.reverbWetGain.gain.setTargetAtTime(
                (value / 100) * 0.4,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- SUSTAIN: Beeinflusst Envelope (kein Clipping-Risiko) ---
    setSustain(value) { this.sustain = value; }

    // --- SMOOTHNESS: Beeinflusst Attack/Release (kein Clipping-Risiko) ---
    setSmoothness(value) { this.smoothness = value; }

    // --- CHORUS: Wet max 30% ---
    setChorus(value) {
        this.chorus = value;
        if (this.chorusWetGain) {
            this.chorusWetGain.gain.setTargetAtTime(
                (value / 100) * 0.3,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- PHASER: LFO-Tiefe max 300Hz (nicht 1000!) ---
    setPhaser(value) {
        this.phaser = value;
        if (this.phaserLFOGain) {
            // Max 300Hz Sweep-Tiefe (statt 1000Hz!)
            this.phaserLFOGain.gain.setTargetAtTime(
                (value / 100) * 300,
                this.audioContext.currentTime, 0.02
            );
        }
        if (this.phaserWetGain) {
            this.phaserWetGain.gain.setTargetAtTime(
                (value / 100) * 0.35,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- TREMOLO: Amplitude-Modulation, Tiefe max ±0.2 (sanft) ---
    setTremolo(value) {
        this.tremolo = value;
        if (this.tremoloLFOGain) {
            // Max ±0.2 → Gain schwingt zwischen 0.8 und 1.2 → subtil
            this.tremoloLFOGain.gain.setTargetAtTime(
                (value / 100) * 0.2,
                this.audioContext.currentTime, 0.02
            );
        }
    }

    // --- COMPRESSION: Threshold -2dB bis -30dB ---
    setCompression(value) {
        this.compression = value;
        if (this.userCompressor) {
            if (value <= 0) {
                // Aus: Threshold auf 0 (greift nie), Ratio 1:1
                this.userCompressor.threshold.setTargetAtTime(0, this.audioContext.currentTime, 0.02);
                this.userCompressor.ratio.setTargetAtTime(1, this.audioContext.currentTime, 0.02);
            } else {
                // An: Threshold sinkt von -2 bis -30, Ratio steigt von 2 bis 8
                const threshold = -2 - (value / 100) * 28;
                const ratio = 2 + (value / 100) * 6;
                this.userCompressor.threshold.setTargetAtTime(threshold, this.audioContext.currentTime, 0.02);
                this.userCompressor.ratio.setTargetAtTime(ratio, this.audioContext.currentTime, 0.02);
            }
        }
    }

    // --- EQ: Begrenzt auf ±12dB (nicht mehr ±20dB!) ---
    setEQLow(value) {
        this.eqLow = Math.max(-12, Math.min(12, value));
        if (this.eqLowFilter) {
            this.eqLowFilter.gain.setTargetAtTime(this.eqLow, this.audioContext.currentTime, 0.02);
        }
    }

    setEQMid(value) {
        this.eqMid = Math.max(-12, Math.min(12, value));
        if (this.eqMidFilter) {
            this.eqMidFilter.gain.setTargetAtTime(this.eqMid, this.audioContext.currentTime, 0.02);
        }
    }

    setEQHigh(value) {
        this.eqHigh = Math.max(-12, Math.min(12, value));
        if (this.eqHighFilter) {
            this.eqHighFilter.gain.setTargetAtTime(this.eqHigh, this.audioContext.currentTime, 0.02);
        }
    }

    // --- Beat-System ---
    setBeatStyle(style) {
        this.beatStyle = style;
        this.stopBeats();
        if (style !== 'none') this.startBeats();
    }

    setBPM(bpm) {
        this.bpm = bpm;
        this.stopBeats();
        if (this.beatStyle !== 'none') this.startBeats();
    }

    setBeatVolume(volume) {
        this.beatVolume = volume / 100;
        if (this.beatGain) {
            this.beatGain.gain.setTargetAtTime(this.beatVolume, this.audioContext.currentTime, 0.02);
        }
    }

    setSequenceTempo(tempo) {
        this.sequenceTempo = parseFloat(tempo);
    }

    // ================================================================
    // RECORDING (MediaRecorder → WAV download)
    // ================================================================

    startRecording() {
        if (!this.audioContext || this.isRecording) return false;
        const dest = this.audioContext.createMediaStreamDestination();
        this.masterLimiter.connect(dest);
        this._recordDest = dest;
        this._mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
        this._recordChunks = [];
        this._mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this._recordChunks.push(e.data); };
        this._mediaRecorder.start();
        this.isRecording = true;
        return true;
    }

    stopRecording() {
        if (!this._mediaRecorder || !this.isRecording) return null;
        return new Promise((resolve) => {
            this._mediaRecorder.onstop = () => {
                const blob = new Blob(this._recordChunks, { type: 'audio/webm' });
                if (this._recordDest) {
                    try { this.masterLimiter.disconnect(this._recordDest); } catch(e) {}
                }
                this._recordDest = null;
                this._mediaRecorder = null;
                this._recordChunks = [];
                this.isRecording = false;
                resolve(blob);
            };
            this._mediaRecorder.stop();
        });
    }

    // ================================================================
    // ANALYSER (für Visualisierung)
    // ================================================================

    getFrequencyData() {
        if (this.analyser && this.frequencyData) {
            this.analyser.getByteFrequencyData(this.frequencyData);
            return this.frequencyData;
        }
        return null;
    }

    getVolumeLevel() {
        if (this.analyser && this.frequencyData) {
            this.analyser.getByteFrequencyData(this.frequencyData);
            const sum = this.frequencyData.reduce((a, b) => a + b, 0);
            return sum / (this.frequencyData.length * 255);
        }
        return 0;
    }
}

// Globale Instanz
const audioSystem = new AudioSystem();
