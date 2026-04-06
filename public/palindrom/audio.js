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
        this._periodicWaves = {};
        this.warmthNode = null;
        
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
            
            // --- Warmth: subtle always-on saturation for analog character ---
            this.warmthNode = this.audioContext.createWaveShaper();
            this.warmthNode.curve = this._makeWarmthCurve();
            this.warmthNode.oversample = '2x';
            this.warmthNode.connect(this.masterGain);
            
            // --- STUFE 5: EQ-Kette → warmthNode → masterGain ---
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
            this.eqHighFilter.connect(this.warmthNode);
            
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
            
            this._initPeriodicWaves();
            console.log('Audio system initialized (with warmth + stereo + periodic waves)');
        } catch (error) {
            console.error('Error initializing audio system:', error);
            throw error;
        }
    }

    // ================================================================
    // PERIODIC WAVES (richer timbres than standard oscillator types)
    // ================================================================

    _initPeriodicWaves() {
        // Warm Sine: fundamental with subtle even harmonics for body
        const wSineR = new Float32Array(12);
        const wSineI = new Float32Array(12);
        wSineI[1] = 1.0; wSineI[2] = 0.06; wSineI[3] = 0.025;
        wSineI[4] = 0.015; wSineI[5] = 0.008; wSineI[6] = 0.004;
        this._periodicWaves.warmSine = this.audioContext.createPeriodicWave(wSineR, wSineI);

        // Rich Saw: sawtooth-like with natural rolloff and formant emphasis around harmonics 3-6
        const rSawR = new Float32Array(40);
        const rSawI = new Float32Array(40);
        for (let k = 1; k < 40; k++) {
            rSawI[k] = (k % 2 === 0 ? 1 : -1) * (1.0 / k) * Math.exp(-k * 0.035);
            if (k >= 3 && k <= 6) rSawI[k] *= 1.25;
        }
        this._periodicWaves.richSaw = this.audioContext.createPeriodicWave(rSawR, rSawI);

        // Soft Square: odd harmonics only with gentle high-end rolloff
        const sSqR = new Float32Array(28);
        const sSqI = new Float32Array(28);
        for (let k = 1; k < 28; k += 2) {
            sSqI[k] = (1.0 / k) * Math.exp(-k * 0.025);
        }
        this._periodicWaves.softSquare = this.audioContext.createPeriodicWave(sSqR, sSqI);

        // Warm Triangle: triangle base with slight upper harmonic color
        const wTriR = new Float32Array(20);
        const wTriI = new Float32Array(20);
        for (let k = 1; k < 20; k += 2) {
            const sign = ((k - 1) / 2) % 2 === 0 ? 1 : -1;
            wTriI[k] = sign * (1.0 / (k * k));
            if (k <= 5) wTriI[k] *= 1.15;
        }
        wTriI[2] = 0.04; wTriI[4] = 0.02;
        this._periodicWaves.warmTriangle = this.audioContext.createPeriodicWave(wTriR, wTriI);

        // Organ: classic drawbar-style with specific harmonic emphasis
        const orgR = new Float32Array(18);
        const orgI = new Float32Array(18);
        orgI[1] = 1.0; orgI[2] = 0.75; orgI[3] = 0.55; orgI[4] = 0.4;
        orgI[5] = 0.3; orgI[6] = 0.22; orgI[8] = 0.18; orgI[10] = 0.08;
        orgI[12] = 0.05; orgI[16] = 0.03;
        this._periodicWaves.organWave = this.audioContext.createPeriodicWave(orgR, orgI);

        // Bell: emphasis on odd partials with slow decay weighting
        const bellR = new Float32Array(18);
        const bellI = new Float32Array(18);
        bellI[1] = 1.0; bellI[2] = 0.15; bellI[3] = 0.55;
        bellI[5] = 0.35; bellI[7] = 0.2; bellI[9] = 0.12;
        bellI[11] = 0.08; bellI[13] = 0.05; bellI[15] = 0.03;
        this._periodicWaves.bellWave = this.audioContext.createPeriodicWave(bellR, bellI);
    }

    // ================================================================
    // WARMTH CURVE (subtle analog saturation, always active)
    // ================================================================

    _makeWarmthCurve() {
        const samples = 8192;
        const curve = new Float32Array(samples);
        const drive = 1.15;
        const normFactor = Math.tanh(drive);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = Math.tanh(x * drive) / normFactor;
        }
        return curve;
    }

    // ================================================================
    // REVERB IMPULSE RESPONSE
    // ================================================================
    
    _createReverbImpulse() {
        const sr = this.audioContext.sampleRate;
        const length = sr * 3.0;
        const impulse = this.audioContext.createBuffer(2, length, sr);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            
            // Pre-delay: 15ms silence for clarity
            const preDelay = Math.floor(sr * 0.015);
            
            // Early reflections (15-100ms) modeled after medium concert hall
            const earlyEnd = Math.floor(sr * 0.1);
            const reflections = [
                { time: 0.008, gain: 0.72 }, { time: 0.013, gain: 0.58 },
                { time: 0.017, gain: 0.52 }, { time: 0.022, gain: 0.45 },
                { time: 0.028, gain: 0.40 }, { time: 0.033, gain: 0.35 },
                { time: 0.039, gain: 0.30 }, { time: 0.044, gain: 0.26 },
                { time: 0.050, gain: 0.22 }, { time: 0.057, gain: 0.19 },
                { time: 0.063, gain: 0.16 }, { time: 0.069, gain: 0.13 },
                { time: 0.076, gain: 0.11 }, { time: 0.083, gain: 0.09 },
                { time: 0.091, gain: 0.07 },
            ];
            for (const ref of reflections) {
                // Stereo offset per channel for width
                const chOffset = channel * Math.floor(Math.random() * 8 + 2);
                const idx = Math.floor((ref.time + 0.015) * sr) + chOffset;
                const spread = 6;
                for (let j = -spread; j <= spread; j++) {
                    const k = idx + j;
                    if (k >= preDelay && k < earlyEnd) {
                        data[k] += ref.gain * (1 - Math.abs(j) / (spread + 1))
                            * (0.85 + Math.random() * 0.3);
                    }
                }
            }
            
            // Transition zone (100-200ms): crossfade from discrete to diffuse
            const transEnd = Math.floor(sr * 0.2);
            for (let i = earlyEnd; i < transEnd; i++) {
                const t = (i - earlyEnd) / (transEnd - earlyEnd);
                const density = 0.5 + t * 0.5;
                const decay = Math.exp(-2.5 * t) * 0.25;
                data[i] += (Math.random() * 2 - 1) * decay * density;
            }
            
            // Late diffuse tail with 3-band frequency-dependent decay
            for (let i = transEnd; i < length; i++) {
                const t = i / length;
                // Low: slow decay (~2.8s RT60)
                const lfDecay = Math.exp(-2.2 * t);
                // Mid: medium decay (~2.0s RT60)
                const mfDecay = Math.exp(-3.2 * t);
                // High: fast decay (~0.8s RT60) simulating air absorption
                const hfDecay = Math.exp(-7.5 * t);
                
                const lf = (Math.random() * 2 - 1) * lfDecay * 0.45;
                const mf = (Math.random() * 2 - 1) * mfDecay * 0.35;
                const hf = (Math.random() * 2 - 1) * hfDecay * 0.2;
                
                // Density builds up over first 30% of tail
                const densityEnv = 1 - Math.exp(-10 * t);
                data[i] = (lf + mf + hf) * densityEnv * (1 - t * 0.25);
            }
            
            // Diffusion passes: smooth the tail for less grainy texture
            for (let pass = 0; pass < 3; pass++) {
                for (let i = transEnd + 1; i < length - 1; i++) {
                    data[i] = data[i - 1] * 0.25 + data[i] * 0.5 + data[i + 1] * 0.25;
                }
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
        const pw = this._periodicWaves;
        const configs = {
            piano: {
                oscs: [
                    { wave: 'warmSine', gain: 0.13, cents: -4, pan: -0.25 },
                    { wave: 'warmSine', gain: 0.13, cents: 4, pan: 0.25 },
                    { wave: 'warmSine', gain: 0.04, freqRatio: 2.0, pan: -0.12 },
                    { wave: 'warmSine', gain: 0.02, freqRatio: 3.0, pan: 0.12 },
                    { wave: 'warmSine', gain: 0.01, freqRatio: 4.0, pan: 0 },
                ],
                attack: 0.005, decay: 0.25, sustainLevel: 0.25, release: 0.3,
                useExpAttack: false,
                filterEnv: { start: 5000, end: 1200, time: 0.4 },
                noise: { level: 0.06, duration: 0.015, filter: 4000 }
            },
            strings: {
                oscs: [
                    { wave: 'richSaw', gain: 0.07, cents: -12, pan: -0.35 },
                    { wave: 'richSaw', gain: 0.07, cents: 12, pan: 0.35 },
                    { wave: 'richSaw', gain: 0.05, cents: -7, detune: -12, pan: -0.15 },
                    { wave: 'richSaw', gain: 0.05, cents: 7, detune: -12, pan: 0.15 },
                    { wave: 'richSaw', gain: 0.03, cents: 3, pan: 0 },
                ],
                attack: 0.18, decay: 0.3, sustainLevel: 0.6, release: 0.4,
                useExpAttack: true,
                filterEnv: { start: 2500, end: 3500, time: 0.6 }
            },
            brass: {
                oscs: [
                    { wave: 'richSaw', gain: 0.11, cents: -6, pan: -0.2 },
                    { wave: 'richSaw', gain: 0.11, cents: 6, pan: 0.2 },
                    { wave: 'softSquare', gain: 0.04, cents: 0, pan: 0 }
                ],
                attack: 0.06, decay: 0.15, sustainLevel: 0.5, release: 0.12,
                useExpAttack: false,
                filterEnv: { start: 600, end: 3000, time: 0.12 },
                noise: { level: 0.03, duration: 0.04, filter: 2000 }
            },
            flute: {
                oscs: [
                    { wave: 'warmSine', gain: 0.16, cents: 0, pan: 0 },
                    { wave: 'warmSine', gain: 0.04, freqRatio: 2.0, pan: -0.15 },
                    { wave: 'warmTriangle', gain: 0.03, cents: 3, pan: 0.15 }
                ],
                attack: 0.12, decay: 0.1, sustainLevel: 0.6, release: 0.25,
                useExpAttack: true,
                filterEnv: { start: 3000, end: 2000, time: 0.3 },
                noise: { level: 0.04, duration: 0.08, filter: 3000, sustained: true }
            },
            organ: {
                oscs: [
                    { wave: 'organWave', gain: 0.09, freqRatio: 0.5, pan: -0.2 },
                    { wave: 'organWave', gain: 0.10, freqRatio: 1.0, pan: 0 },
                    { wave: 'organWave', gain: 0.06, freqRatio: 2.0, pan: 0.15 },
                    { wave: 'organWave', gain: 0.04, freqRatio: 3.0, pan: -0.1 },
                    { wave: 'organWave', gain: 0.02, freqRatio: 4.0, pan: 0.1 },
                    { wave: 'organWave', gain: 0.015, freqRatio: 6.0, pan: -0.05 }
                ],
                attack: 0.008, decay: 0.03, sustainLevel: 0.8, release: 0.06,
                useExpAttack: false
            },
            bell: {
                oscs: [
                    { wave: 'bellWave', gain: 0.10, freqRatio: 1.0, pan: 0 },
                    { wave: 'warmSine', gain: 0.07, freqRatio: 2.76, pan: -0.3 },
                    { wave: 'warmSine', gain: 0.05, freqRatio: 5.04, pan: 0.3 },
                    { wave: 'warmSine', gain: 0.03, freqRatio: 7.28, pan: -0.2 },
                    { wave: 'warmSine', gain: 0.02, freqRatio: 10.56, pan: 0.2 }
                ],
                attack: 0.001, decay: 0.6, sustainLevel: 0.05, release: 0.5,
                useExpAttack: false,
                filterEnv: { start: 8000, end: 1500, time: 0.8 }
            },
            synth: {
                oscs: [
                    { wave: 'richSaw', gain: 0.09, cents: -10, pan: -0.3 },
                    { wave: 'richSaw', gain: 0.09, cents: 10, pan: 0.3 },
                    { wave: 'softSquare', gain: 0.05, cents: -15, detune: -12, pan: -0.15 },
                    { wave: 'softSquare', gain: 0.05, cents: 15, pan: 0.15 }
                ],
                attack: 0.01, decay: 0.15, sustainLevel: 0.45, release: 0.15,
                useExpAttack: false,
                filterEnv: { start: 6000, end: 1800, time: 0.25 }
            },
            guitar: {
                oscs: [
                    { wave: 'warmTriangle', gain: 0.12, cents: -3, pan: -0.2 },
                    { wave: 'warmTriangle', gain: 0.12, cents: 3, pan: 0.2 },
                    { wave: 'warmSine', gain: 0.04, freqRatio: 2.0, pan: -0.1 },
                    { wave: 'warmSine', gain: 0.02, freqRatio: 3.0, pan: 0.1 }
                ],
                attack: 0.002, decay: 0.3, sustainLevel: 0.2, release: 0.25,
                useExpAttack: false,
                filterEnv: { start: 5000, end: 900, time: 0.35 },
                noise: { level: 0.08, duration: 0.01, filter: 6000 }
            }
        };
        
        const config = configs[this.instrument] || configs.piano;
        
        const sustainFactor = this.sustain / 100;
        const smoothFactor = this.smoothness / 100;
        
        // Randomized micro-timing for natural feel (±1.5ms)
        const microTiming = (Math.random() - 0.5) * 0.003;
        const attack = config.attack * (1 + smoothFactor * 1.5) + Math.abs(microTiming);
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
            if (config.useExpAttack) {
                envGain.gain.exponentialRampToValueAtTime(1.0, now + safeAttack);
            } else {
                envGain.gain.linearRampToValueAtTime(1.0, now + safeAttack);
            }
            envGain.gain.exponentialRampToValueAtTime(
                Math.max(sustainLevel, 0.003), now + safeAttack + decay
            );
            if (duration > safeAttack + decay + 0.02) {
                envGain.gain.setValueAtTime(sustainLevel, holdEnd);
            }
            envGain.gain.exponentialRampToValueAtTime(0.003, now + totalDuration);
        }
        
        // Per-note filter envelope with velocity-dependent brightness
        let noteFilter = null;
        if (config.filterEnv) {
            noteFilter = this.audioContext.createBiquadFilter();
            noteFilter.type = 'lowpass';
            noteFilter.Q.value = 1.2;
            const fe = config.filterEnv;
            // Brighter at higher volume (velocity-dependent filter)
            const velBrightness = 0.7 + this.volume * 0.6;
            const envStart = Math.min(fe.start * velBrightness, 18000);
            noteFilter.frequency.setValueAtTime(envStart, now);
            noteFilter.frequency.exponentialRampToValueAtTime(
                Math.max(fe.end, 20), now + fe.time
            );
        }
        
        // Build oscillators with stereo spread and periodic waves
        const oscillators = [];
        for (const oc of config.oscs) {
            const osc = this.audioContext.createOscillator();
            
            // Use PeriodicWave for richer timbre, fall back to standard type
            if (oc.wave && pw[oc.wave]) {
                osc.setPeriodicWave(pw[oc.wave]);
            } else {
                osc.type = oc.type || 'sine';
            }
            
            let freq = frequency;
            if (oc.freqRatio !== undefined) {
                freq = frequency * oc.freqRatio;
            } else if (oc.detune) {
                freq = frequency * Math.pow(2, oc.detune / 12);
            }
            osc.frequency.value = freq;
            
            // Micro-random detune (±2 cents) for natural imperfection
            const microDetune = (Math.random() - 0.5) * 4;
            osc.detune.value = (oc.cents || 0) + microDetune;
            
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = oc.gain;
            
            // Stereo panning per oscillator
            const panner = this.audioContext.createStereoPanner();
            panner.pan.value = oc.pan || 0;
            
            osc.connect(oscGain);
            oscGain.connect(panner);
            if (noteFilter) {
                panner.connect(noteFilter);
            } else {
                panner.connect(envGain);
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
            const noisePan = this.audioContext.createStereoPanner();
            noisePan.pan.value = (Math.random() - 0.5) * 0.3;
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
            ng.connect(noisePan);
            noisePan.connect(envGain);
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
        // Sub body: deep sine sweep for weight
        const sub = this.audioContext.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(160, time);
        sub.frequency.exponentialRampToValueAtTime(42, time + 0.06);
        sub.frequency.exponentialRampToValueAtTime(30, time + 0.25);
        const subGain = this.audioContext.createGain();
        subGain.gain.setValueAtTime(0.55, time);
        subGain.gain.setValueAtTime(0.45, time + 0.04);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        sub.connect(subGain);
        subGain.connect(this.beatGain);
        sub.start(time);
        sub.stop(time + 0.45);
        
        // Mid-punch: 80-120Hz body for presence
        const punch = this.audioContext.createOscillator();
        punch.type = 'sine';
        punch.frequency.setValueAtTime(120, time);
        punch.frequency.exponentialRampToValueAtTime(65, time + 0.04);
        const punchGain = this.audioContext.createGain();
        punchGain.gain.setValueAtTime(0.35, time);
        punchGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        punch.connect(punchGain);
        punchGain.connect(this.beatGain);
        punch.start(time);
        punch.stop(time + 0.15);
        
        // Click transient: sharper attack
        const click = this.audioContext.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(1200, time);
        click.frequency.exponentialRampToValueAtTime(250, time + 0.015);
        const clickGain = this.audioContext.createGain();
        clickGain.gain.setValueAtTime(0.22, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        click.connect(clickGain);
        clickGain.connect(this.beatGain);
        click.start(time);
        click.stop(time + 0.04);
        
        // Noise burst filtered low for thud
        const nBuf = this.audioContext.createBuffer(
            1, Math.floor(this.audioContext.sampleRate * 0.03), this.audioContext.sampleRate);
        const nd = nBuf.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const nSrc = this.audioContext.createBufferSource();
        nSrc.buffer = nBuf;
        const nFilt = this.audioContext.createBiquadFilter();
        nFilt.type = 'lowpass';
        nFilt.frequency.setValueAtTime(800, time);
        nFilt.frequency.exponentialRampToValueAtTime(200, time + 0.02);
        const nGain = this.audioContext.createGain();
        nGain.gain.setValueAtTime(0.15, time);
        nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        nSrc.connect(nFilt);
        nFilt.connect(nGain);
        nGain.connect(this.beatGain);
        nSrc.start(time);
        nSrc.stop(time + 0.04);
    }

    playSnare(time) {
        // Body oscillator 1: main tone
        const body1 = this.audioContext.createOscillator();
        body1.type = 'triangle';
        body1.frequency.setValueAtTime(240, time);
        body1.frequency.exponentialRampToValueAtTime(130, time + 0.04);
        const body1Gain = this.audioContext.createGain();
        body1Gain.gain.setValueAtTime(0.25, time);
        body1Gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        body1.connect(body1Gain);
        body1Gain.connect(this.beatGain);
        body1.start(time);
        body1.stop(time + 0.12);
        
        // Body oscillator 2: resonance/overtone for fullness
        const body2 = this.audioContext.createOscillator();
        body2.type = 'sine';
        body2.frequency.setValueAtTime(180, time);
        body2.frequency.exponentialRampToValueAtTime(100, time + 0.05);
        const body2Gain = this.audioContext.createGain();
        body2Gain.gain.setValueAtTime(0.15, time);
        body2Gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        body2.connect(body2Gain);
        body2Gain.connect(this.beatGain);
        body2.start(time);
        body2.stop(time + 0.1);
        
        // Snare wire noise: shaped with two filter stages
        const bufSize = Math.floor(this.audioContext.sampleRate * 0.22);
        const buf = this.audioContext.createBuffer(1, bufSize, this.audioContext.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buf;
        const hp = this.audioContext.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const bp = this.audioContext.createBiquadFilter();
        bp.type = 'peaking';
        bp.frequency.value = 4200;
        bp.gain.value = 5;
        bp.Q.value = 1.2;
        const shimmer = this.audioContext.createBiquadFilter();
        shimmer.type = 'peaking';
        shimmer.frequency.value = 7500;
        shimmer.gain.value = 3;
        shimmer.Q.value = 2;
        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.28, time);
        noiseGain.gain.setValueAtTime(0.22, time + 0.02);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        noise.connect(hp);
        hp.connect(bp);
        bp.connect(shimmer);
        shimmer.connect(noiseGain);
        noiseGain.connect(this.beatGain);
        noise.start(time);
        noise.stop(time + 0.22);
        
        // Bright transient click
        const transient = this.audioContext.createOscillator();
        transient.type = 'square';
        transient.frequency.setValueAtTime(600, time);
        const transGain = this.audioContext.createGain();
        transGain.gain.setValueAtTime(0.08, time);
        transGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
        transient.connect(transGain);
        transGain.connect(this.beatGain);
        transient.start(time);
        transient.stop(time + 0.015);
    }

    playHiHat(time) {
        // Metallic oscillators: more partials for richer metallic tone
        const ratios = [1, 1.34, 1.61, 1.88, 2.14, 2.55];
        const baseFreq = 5800;
        const metalBus = this.audioContext.createGain();
        metalBus.gain.value = 1.0;
        const metalHP = this.audioContext.createBiquadFilter();
        metalHP.type = 'highpass';
        metalHP.frequency.value = 6000;
        metalBus.connect(metalHP);
        metalHP.connect(this.beatGain);
        
        for (const ratio of ratios) {
            const osc = this.audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.value = baseFreq * ratio;
            const g = this.audioContext.createGain();
            g.gain.setValueAtTime(0.025, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
            osc.connect(g);
            g.connect(metalBus);
            osc.start(time);
            osc.stop(time + 0.065);
        }
        
        // Shaped noise layer with band emphasis
        const bufSize = Math.floor(this.audioContext.sampleRate * 0.06);
        const buf = this.audioContext.createBuffer(1, bufSize, this.audioContext.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buf;
        const hp = this.audioContext.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 8500;
        const peak = this.audioContext.createBiquadFilter();
        peak.type = 'peaking';
        peak.frequency.value = 10500;
        peak.gain.value = 4;
        peak.Q.value = 1.5;
        const ng = this.audioContext.createGain();
        ng.gain.setValueAtTime(0.16, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
        noise.connect(hp);
        hp.connect(peak);
        peak.connect(ng);
        ng.connect(this.beatGain);
        noise.start(time);
        noise.stop(time + 0.065);
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
