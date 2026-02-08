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
        this.frequencies = {};
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
        const length = this.audioContext.sampleRate * 1.5; // 1.5s (kürzer, natürlicher)
        const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }
        
        this.reverbConvolver = this.audioContext.createConvolver();
        this.reverbConvolver.buffer = impulse;
        this.reverbWetGain = this.audioContext.createGain();
        this.reverbWetGain.gain.value = 0; // 0 = aus
        this.reverbConvolver.connect(this.reverbWetGain);
        this.reverbWetGain.connect(this.eqLowFilter); // Return → EQ → Master
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
        
        // Dur-Tonleiter: Ziffern 0-9 → harmonische Intervalle
        // 0=Grundton, 1=Sekunde, 2=Terz, 3=Quarte, 4=Quinte,
        // 5=Sexte, 6=Septime, 7=Oktave, 8=None, 9=Dezime
        const scaleIntervals = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
        
        for (let i = 0; i < 10; i++) {
            const semitone = offset + scaleIntervals[i];
            this.frequencies[i] = this.baseFreq * Math.pow(2, semitone / 12);
        }
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
        // Instrument-Konfigurationen
        // WICHTIG: Alle Gains sind niedrig, Summe pro Instrument ≤ 0.35
        const configs = {
            piano: {
                oscs: [
                    { type: 'sine', gain: 0.18, detune: 0 },
                    { type: 'sine', gain: 0.10, detune: 12 },
                    { type: 'sine', gain: 0.05, detune: 24 }
                ],
                attack: 0.008, decay: 0.12, sustainLevel: 0.35, release: 0.15
            },
            strings: {
                oscs: [
                    { type: 'sawtooth', gain: 0.12, detune: 0 },
                    { type: 'sawtooth', gain: 0.08, detune: -5 },
                    { type: 'sawtooth', gain: 0.05, detune: 5 }
                ],
                attack: 0.15, decay: 0.2, sustainLevel: 0.55, release: 0.25
            },
            brass: {
                oscs: [
                    { type: 'sawtooth', gain: 0.15, detune: 0 },
                    { type: 'square', gain: 0.08, detune: 0 }
                ],
                attack: 0.08, decay: 0.1, sustainLevel: 0.5, release: 0.15
            },
            flute: {
                oscs: [
                    { type: 'sine', gain: 0.22, detune: 0 },
                    { type: 'sine', gain: 0.06, detune: 12 }
                ],
                attack: 0.1, decay: 0.1, sustainLevel: 0.65, release: 0.2
            },
            organ: {
                oscs: [
                    { type: 'sine', gain: 0.13, detune: 0 },
                    { type: 'sine', gain: 0.09, detune: 12 },
                    { type: 'sine', gain: 0.05, detune: 24 }
                ],
                attack: 0.01, decay: 0.05, sustainLevel: 0.75, release: 0.08
            },
            bell: {
                oscs: [
                    { type: 'sine', gain: 0.14, detune: 0 },
                    { type: 'sine', gain: 0.09, detune: 12 },
                    { type: 'sine', gain: 0.06, detune: 19 },
                    { type: 'sine', gain: 0.04, detune: 24 }
                ],
                attack: 0.003, decay: 0.35, sustainLevel: 0.12, release: 0.3
            },
            synth: {
                oscs: [
                    { type: 'sawtooth', gain: 0.14, detune: 0 },
                    { type: 'square', gain: 0.08, detune: 7 }
                ],
                attack: 0.02, decay: 0.1, sustainLevel: 0.5, release: 0.12
            },
            guitar: {
                oscs: [
                    { type: 'triangle', gain: 0.18, detune: 0 },
                    { type: 'sine', gain: 0.08, detune: 12 }
                ],
                attack: 0.003, decay: 0.2, sustainLevel: 0.3, release: 0.2
            }
        };
        
        const config = configs[this.instrument] || configs.piano;
        
        // Sustain + Smoothness beeinflussen ADSR
        const sustainFactor = this.sustain / 100;       // 0-1
        const smoothFactor = this.smoothness / 100;     // 0-1
        
        const attack = config.attack * (1 + smoothFactor * 1.5);
        const decay = config.decay;
        const sustainLevel = config.sustainLevel * (0.3 + sustainFactor * 0.7);
        const release = config.release * (1 + smoothFactor * 2);
        
        // Envelope GainNode
        const envGain = this.audioContext.createGain();
        
        let totalDuration;
        
        if (beatSync) {
            // ============================================================
            // BEAT-SYNC: Spezielle "Legato" Envelope für flüssige Übergänge
            // ============================================================
            // Problem: Normale ADSR fällt auf ~0 → Stille zwischen Tönen = abgehackt
            // Lösung: Großer Overlap (70%) + schneller Attack + langer sanfter Release
            // → Vorheriger Ton klingt noch nach während neuer Ton bereits voll da ist
            
            const legato = Math.min(0.25, duration * 0.7);  // Bis 250ms oder 70% Overlap
            totalDuration = duration + legato;
            
            const beatAttack = 0.012;                        // 12ms — sehr schnell hörbar
            const beatSustain = Math.max(sustainLevel, 0.5); // Mindestens 50% Sustain
            const holdEnd = now + duration - 0.01;           // Sustain halten bis fast zum Beat-Ende
            
            envGain.gain.setValueAtTime(0.001, now);
            envGain.gain.linearRampToValueAtTime(1.0, now + beatAttack);
            
            // Kurzer Decay zum Sustain-Level
            if (duration > beatAttack + 0.03) {
                envGain.gain.linearRampToValueAtTime(beatSustain, now + beatAttack + 0.03);
                // Sustain halten bis knapp vor dem Beat-Ende
                envGain.gain.setValueAtTime(beatSustain, holdEnd);
            }
            
            // Sanfter Release über die gesamte Overlap-Zone
            // Endet bei 0.005 (nicht 0.0001!) → noch hörbar wenn nächster Ton startet
            envGain.gain.exponentialRampToValueAtTime(0.005, now + totalDuration);
            
        } else {
            // ============================================================
            // NORMAL: Legato ADSR Envelope (auch ohne Beat flüssig!)
            // ============================================================
            // Auch im Normal-Modus: Overlap hinzufügen damit der Release
            // eines Tons mit dem Attack des nächsten überlappt
            const normalLegato = Math.min(0.15, duration * 0.5);
            totalDuration = duration + normalLegato;
            
            const safeAttack = Math.min(attack, totalDuration * 0.2);
            const safeRelease = Math.min(release, normalLegato + 0.05, 0.3);
            const holdEnd = now + duration - 0.005;
            
            envGain.gain.setValueAtTime(0.001, now);
            envGain.gain.linearRampToValueAtTime(1.0, now + safeAttack);
            envGain.gain.linearRampToValueAtTime(sustainLevel, now + safeAttack + decay);
            
            if (duration > safeAttack + decay + 0.02) {
                // Sustain halten bis kurz vor dem nächsten Ton
                envGain.gain.setValueAtTime(sustainLevel, holdEnd);
            }
            
            // Sanfter Release über die Overlap-Zone
            envGain.gain.exponentialRampToValueAtTime(0.003, now + totalDuration);
        }
        
        // Oszillatoren erstellen
        const oscillators = [];
        for (const oscConfig of config.oscs) {
            const osc = this.audioContext.createOscillator();
            osc.type = oscConfig.type;
            osc.frequency.value = frequency * Math.pow(2, oscConfig.detune / 12);
            
            const oscGain = this.audioContext.createGain();
            oscGain.gain.value = oscConfig.gain;
            
            osc.connect(oscGain);
            oscGain.connect(envGain);
            
            // Vibrato: LFO moduliert die TONHÖHE (detune in Cents) - KORREKT!
            this.vibratoLFOGain.connect(osc.detune);
            
            osc.start(now);
            osc.stop(now + totalDuration + 0.1);
            
            oscillators.push(osc);
        }
        
        // An den instrumentBus → feste Effektkette
        envGain.connect(this.instrumentBus);
        
        // Tracking für Cleanup
        this.activeOscillators.push({
            oscillators,
            envGain,
            stopTime: now + totalDuration + 0.1
        });
        
        // Abgelaufene Oszillatoren aufräumen
        this._cleanupFinished();
        
        return { oscillators, envGain };
    }

    // ================================================================
    // BEAT-SYSTEM
    // ================================================================

    playKick(time) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.frequency.setValueAtTime(55, time);
        osc.frequency.exponentialRampToValueAtTime(28, time + 0.12);
        
        gain.gain.setValueAtTime(0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.connect(gain);
        gain.connect(this.beatGain);
        
        osc.start(time);
        osc.stop(time + 0.25);
    }

    playSnare(time) {
        const bufferSize = Math.floor(this.audioContext.sampleRate * 0.15);
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.7;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1500;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.beatGain);
        
        noise.start(time);
        noise.stop(time + 0.15);
    }

    playHiHat(time) {
        const bufferSize = Math.floor(this.audioContext.sampleRate * 0.04);
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.4;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 9000;
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.beatGain);
        
        noise.start(time);
        noise.stop(time + 0.05);
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
        
        const stepDuration = 60 / (this.bpm * 4);
        let nextBeatTime = this.audioContext.currentTime;
        
        const scheduleBeats = () => {
            const step = this.beatStep % 16;
            if (pattern.kick[step])  this.playKick(nextBeatTime);
            if (pattern.snare[step]) this.playSnare(nextBeatTime);
            if (pattern.hihat[step]) this.playHiHat(nextBeatTime);
            this.beatStep++;
            nextBeatTime += stepDuration;
        };
        
        for (let i = 0; i < 32; i++) scheduleBeats();
        
        this.beatInterval = setInterval(() => {
            scheduleBeats();
        }, stepDuration * 1000);
    }

    stopBeats() {
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
