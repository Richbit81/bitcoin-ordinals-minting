// Haupt-Applikation: Palindrom Sound Box
// Verbindet alle Komponenten und verwaltet UI-Events

class PalindromSoundBox {
    constructor() {
        this.sequences = ['', '', '', '', ''];
        this.activeSequences = [false, false, false, false, false];
        this.isPlaying = false;
        this.isLooping = false;
        this.currentSequenceIndex = 0;
        this.currentNumberIndex = 0;
        this.playTimeout = null;
        this.selectedPalindroms = [];
        this.isStarting = false;
        this.polyphony = false;
        this.isRecording = false;
        
        // Beat-Synchronisation
        this.beatSync = false;
        this.sequenceTempo = 1;
        this.beatStepDuration = 0;
        this.nextBeatTime = 0;
        
        this.init();
    }

    async init() {
        // Visualisierung initialisieren (funktioniert ohne Audio)
        const canvas = document.getElementById('butterflyCanvas');
        if (canvas) {
            butterflyViz.init(canvas);
            butterflyViz.start();
        }
        
        // UI-Event-Handler einrichten
        this.setupUIHandlers();
        
        // Initiale UI-Updates
        this.updateUI();
        
        // Initialen State des Play-Buttons setzen
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.dataset.state = 'stopped';
        }
        
        // Audio-System initialisieren (wird beim ersten Click gestartet)
        this.initAudioOnInteraction();
        
        console.log('Palindrom Sound Box initialized');
    }
    
    initAudioOnInteraction() {
        // AudioContext muss nach Benutzerinteraktion gestartet werden
        const startAudio = async () => {
            try {
                if (!audioSystem.audioContext) {
                    await audioSystem.init();
                } else if (audioSystem.audioContext.state === 'suspended') {
                    await audioSystem.audioContext.resume();
                }
                console.log('Audio system started');
            } catch (error) {
                console.error('Error starting audio system:', error);
            }
        };
        
        // Starte Audio beim ersten Click/Touch
        const events = ['click', 'touchstart', 'keydown'];
        const handler = () => {
            startAudio();
            events.forEach(e => document.removeEventListener(e, handler));
        };
        events.forEach(e => document.addEventListener(e, handler, { once: true }));
    }

    setupUIHandlers() {
        // UI Toggle
        const uiToggle = document.getElementById('uiToggle');
        const mainUI = document.getElementById('mainUI');
        if (uiToggle && mainUI) {
            uiToggle.addEventListener('click', () => {
                mainUI.classList.toggle('hidden');
            });
        }
        
        // Collapsible sections
        document.querySelectorAll('.collapsible .section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });
        
        // Wallet-Verbindung
        const connectWalletBtn = document.getElementById('connectWallet');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', () => this.handleWalletConnect());
        }

        // Wallet-Trennung
        const disconnectWalletBtn = document.getElementById('disconnectWallet');
        if (disconnectWalletBtn) {
            disconnectWalletBtn.addEventListener('click', () => this.handleWalletDisconnect());
        }

        // Palindrom Scan
        const scanBtn = document.getElementById('scanBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.handleScanPalindromes());
        }

        // Ausgewählte Palindrome laden
        const loadSelectedBtn = document.getElementById('loadSelectedBtn');
        if (loadSelectedBtn) {
            loadSelectedBtn.addEventListener('click', () => this.loadPalindromSequences());
        }
        
        // Sequenz-Eingaben
        for (let i = 0; i < 5; i++) {
            const checkbox = document.querySelector(`.seq-checkbox[data-seq="${i}"]`);
            const input = document.querySelector(`.seq-input[data-seq="${i}"]`);
            
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.activeSequences[i] = e.target.checked;
                    this.updatePalindrom();
                });
            }
            
            // Inputs are readonly - palindromes can only be loaded from wallet
        }
        
        // Playback-Controls
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const loopCheckbox = document.getElementById('loopCheckbox');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prüfe ob bereits am Spielen
                if (playBtn.dataset.state === 'playing') {
                    // Wenn am Spielen, pausieren
                    this.pause();
                } else {
                    // Sonst spielen
                    this.play();
                }
            });
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stop();
            });
        }
        if (loopCheckbox) {
            loopCheckbox.addEventListener('change', (e) => {
                this.isLooping = e.target.checked;
            });
        }
        
        // Randomize Button
        const randomizeBtn = document.getElementById('randomizeBtn');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeSound());
        }

        // Reset Button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSound());
        }

        // Polyphony toggle
        const polyphonyCheckbox = document.getElementById('polyphonyCheckbox');
        if (polyphonyCheckbox) {
            polyphonyCheckbox.addEventListener('change', (e) => { this.polyphony = e.target.checked; });
        }

        // Record button
        const recordBtn = document.getElementById('recordBtn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording());
        }

        // Preset controls
        const savePresetBtn = document.getElementById('savePresetBtn');
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', () => this.savePreset());
        }
        this.loadPresetList();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space': e.preventDefault(); this.isPlaying ? this.pause() : this.play(); break;
                case 'Escape': e.preventDefault(); this.stop(); break;
                case 'KeyR': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); this.randomizeSound(); } break;
                case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
                    const idx = parseInt(e.code.slice(-1)) - 1;
                    const cb = document.querySelector(`.seq-checkbox[data-seq="${idx}"]`);
                    if (cb) { cb.checked = !cb.checked; this.activeSequences[idx] = cb.checked; this.updatePalindrom(); this.updateStepDisplay(); }
                    break;
                }
            }
        });

        // Audio-Einstellungen
        const instrumentSelect = document.getElementById('instrumentSelect');
        const keySelect = document.getElementById('keySelect');
        const speedSlider = document.getElementById('speedSlider');
        const volumeSlider = document.getElementById('volumeSlider');
        
        if (instrumentSelect) {
            instrumentSelect.addEventListener('change', (e) => {
                audioSystem.setInstrument(e.target.value);
            });
        }
        if (keySelect) {
            keySelect.addEventListener('change', (e) => {
                audioSystem.setKey(e.target.value);
            });
        }
        const scaleSelect = document.getElementById('scaleSelect');
        if (scaleSelect) {
            scaleSelect.addEventListener('change', (e) => { audioSystem.setScale(e.target.value); });
        }
        const octaveSlider = document.getElementById('octaveSlider');
        if (octaveSlider) {
            octaveSlider.addEventListener('input', (e) => {
                const v = parseInt(e.target.value);
                document.getElementById('octaveValue').textContent = v > 0 ? `+${v}` : v;
                audioSystem.setOctave(v);
            });
        }
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('speedValue').textContent = value;
                audioSystem.setSpeed(parseInt(value));
            });
        }
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('volumeValue').textContent = value;
                audioSystem.setVolume(parseInt(value));
            });
        }
        
        // Audio-Effekte
        const vibratoSlider = document.getElementById('vibratoSlider');
        const delaySlider = document.getElementById('delaySlider');
        const filterSlider = document.getElementById('filterSlider');
        const distortionSlider = document.getElementById('distortionSlider');
        const reverbSlider = document.getElementById('reverbSlider');
        
        if (vibratoSlider) {
            vibratoSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('vibratoValue').textContent = value;
                audioSystem.setVibrato(parseInt(value));
            });
        }
        if (delaySlider) {
            delaySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('delayValue').textContent = value;
                audioSystem.setDelay(parseInt(value));
            });
        }
        if (filterSlider) {
            filterSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('filterValue').textContent = value;
                audioSystem.setFilter(parseInt(value));
            });
        }
        if (distortionSlider) {
            distortionSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('distortionValue').textContent = value;
                audioSystem.setDistortion(parseInt(value));
            });
        }
        if (reverbSlider) {
            reverbSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('reverbValue').textContent = value;
                audioSystem.setReverb(parseInt(value));
            });
        }
        
        // Neue Effekte
        const sustainSlider = document.getElementById('sustainSlider');
        if (sustainSlider) {
            sustainSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('sustainValue').textContent = value;
                audioSystem.setSustain(parseInt(value));
            });
        }
        
        const smoothnessSlider = document.getElementById('smoothnessSlider');
        if (smoothnessSlider) {
            smoothnessSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('smoothnessValue').textContent = value;
                audioSystem.setSmoothness(parseInt(value));
            });
        }
        
        const chorusSlider = document.getElementById('chorusSlider');
        if (chorusSlider) {
            chorusSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('chorusValue').textContent = value;
                audioSystem.setChorus(parseInt(value));
            });
        }
        
        const phaserSlider = document.getElementById('phaserSlider');
        if (phaserSlider) {
            phaserSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('phaserValue').textContent = value;
                audioSystem.setPhaser(parseInt(value));
            });
        }
        
        const tremoloSlider = document.getElementById('tremoloSlider');
        if (tremoloSlider) {
            tremoloSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('tremoloValue').textContent = value;
                audioSystem.setTremolo(parseInt(value));
            });
        }
        
        const compressionSlider = document.getElementById('compressionSlider');
        if (compressionSlider) {
            compressionSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('compressionValue').textContent = value;
                audioSystem.setCompression(parseInt(value));
            });
        }
        
        const portamentoSlider = document.getElementById('portamentoSlider');
        if (portamentoSlider) {
            portamentoSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('portamentoValue').textContent = value;
                audioSystem.setPortamento(parseInt(value));
            });
        }
        
        const subBassSlider = document.getElementById('subBassSlider');
        if (subBassSlider) {
            subBassSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('subBassValue').textContent = value;
                audioSystem.setSubBass(parseInt(value));
            });
        }
        
        // EQ
        const eqLowSlider = document.getElementById('eqLowSlider');
        if (eqLowSlider) {
            eqLowSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('eqLowValue').textContent = value;
                audioSystem.setEQLow(parseFloat(value));
            });
        }
        
        const eqMidSlider = document.getElementById('eqMidSlider');
        if (eqMidSlider) {
            eqMidSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('eqMidValue').textContent = value;
                audioSystem.setEQMid(parseFloat(value));
            });
        }
        
        const eqHighSlider = document.getElementById('eqHighSlider');
        if (eqHighSlider) {
            eqHighSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('eqHighValue').textContent = value;
                audioSystem.setEQHigh(parseFloat(value));
            });
        }
        
        // Beat-System
        const beatStyleSelect = document.getElementById('beatStyleSelect');
        const bpmSlider = document.getElementById('bpmSlider');
        const beatVolumeSlider = document.getElementById('beatVolumeSlider');
        const sequenceTempoSelect = document.getElementById('sequenceTempoSelect');
        
        if (beatStyleSelect) {
            beatStyleSelect.addEventListener('change', (e) => {
                audioSystem.setBeatStyle(e.target.value);
                this.beatSync = e.target.value !== 'none';
                this.updateBeatTiming();
            });
        }
        if (bpmSlider) {
            bpmSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('bpmValue').textContent = value;
                audioSystem.setBPM(parseInt(value));
                this.updateBeatTiming();
            });
        }
        if (beatVolumeSlider) {
            beatVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('beatVolumeValue').textContent = value;
                audioSystem.setBeatVolume(parseInt(value));
            });
        }
        const swingSlider = document.getElementById('swingSlider');
        if (swingSlider) {
            swingSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('swingValue').textContent = value;
                audioSystem.setSwing(parseInt(value));
            });
        }
        const humanizeSlider = document.getElementById('humanizeSlider');
        if (humanizeSlider) {
            humanizeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('humanizeValue').textContent = value;
                audioSystem.setHumanize(parseInt(value));
            });
        }
        if (sequenceTempoSelect) {
            sequenceTempoSelect.addEventListener('change', (e) => {
                this.sequenceTempo = parseFloat(e.target.value);
                audioSystem.setSequenceTempo(e.target.value);
                this.updateBeatTiming();
            });
        }
        
        // Visualisierung
        const patternModeSelect = document.getElementById('patternModeSelect');
        const colorModeSelect = document.getElementById('colorModeSelect');
        const particleSlider = document.getElementById('particleSlider');
        
        if (patternModeSelect) {
            patternModeSelect.addEventListener('change', (e) => {
                butterflyViz.setPatternMode(e.target.value);
            });
        }
        if (colorModeSelect) {
            colorModeSelect.addEventListener('change', (e) => {
                butterflyViz.setColorMode(e.target.value);
            });
        }
        if (particleSlider) {
            particleSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                document.getElementById('particleValue').textContent = value;
                butterflyViz.setParticleCount(value);
            });
        }
    }

    // ========================================
    // Wallet Connection Handler
    // ========================================

    async handleWalletConnect() {
        const walletTypeSelect = document.getElementById('walletType');
        const walletStatus = document.getElementById('walletStatus');
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        const scanSection = document.getElementById('scanSection');

        if (!walletTypeSelect || !walletStatus) return;

        const walletType = walletTypeSelect.value;

        try {
            walletStatus.textContent = 'Connecting...';
            walletStatus.className = 'wallet-status';
            if (connectBtn) connectBtn.disabled = true;

            const result = await walletManager.connectWallet(walletType);

            if (result.success) {
                // Adresse kürzen für Anzeige
                const addr = result.address;
                const shortAddr = addr.substring(0, 8) + '...' + addr.substring(addr.length - 6);

                walletStatus.textContent = `✓ ${shortAddr}`;
                walletStatus.className = 'wallet-status connected';

                // Buttons umschalten
                if (connectBtn) connectBtn.style.display = 'none';
                if (walletTypeSelect) walletTypeSelect.disabled = true;
                if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';

                // Scan-Sektion anzeigen
                if (scanSection) scanSection.style.display = 'block';

                // Ord Server Status prüfen
                this.checkOrdServerStatus();

                // AUTO-SCAN: Sofort im Hintergrund starten!
                // Ergebnisse sind fertig wenn User "Scan" klickt
                this.backgroundScan();
            }

        } catch (error) {
            walletStatus.textContent = `✕ ${error.message}`;
            walletStatus.className = 'wallet-status error';
            console.error('Wallet connection error:', error);
        } finally {
            if (connectBtn) connectBtn.disabled = false;
        }
    }

    handleWalletDisconnect() {
        walletManager.disconnect();

        const walletStatus = document.getElementById('walletStatus');
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        const walletTypeSelect = document.getElementById('walletType');
        const scanSection = document.getElementById('scanSection');
        const palindromResults = document.getElementById('palindromResults');
        const selectedSection = document.getElementById('selectedSection');
        const ordServerStatus = document.getElementById('ordServerStatus');

        if (walletStatus) {
            walletStatus.textContent = 'Not connected';
            walletStatus.className = 'wallet-status';
        }
        if (connectBtn) connectBtn.style.display = 'inline-flex';
        if (walletTypeSelect) walletTypeSelect.disabled = false;
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        if (scanSection) scanSection.style.display = 'none';
        if (palindromResults) palindromResults.style.display = 'none';
        if (selectedSection) selectedSection.style.display = 'none';
        if (ordServerStatus) ordServerStatus.style.display = 'none';

        // Sequenzen zurücksetzen
        for (let i = 0; i < 5; i++) {
            const input = document.querySelector(`.seq-input[data-seq="${i}"]`);
            const checkbox = document.querySelector(`.seq-checkbox[data-seq="${i}"]`);
            if (input) input.value = '';
            if (checkbox) checkbox.checked = false;
            this.sequences[i] = '';
            this.activeSequences[i] = false;
        }
        this.updatePalindrom();
    }

    // ========================================
    // Ord Server Status
    // ========================================

    async checkOrdServerStatus() {
        const ordStatus = document.getElementById('ordServerStatus');
        const ordIcon = document.getElementById('ordStatusIcon');
        const ordText = document.getElementById('ordStatusText');

        if (!ordStatus) return;

        ordStatus.style.display = 'flex';
        if (ordIcon) ordIcon.className = 'checking';
        if (ordText) ordText.textContent = 'APIs: Checking connection...';

        try {
            const status = await palindromScanner.checkApiStatus();
            const apiLabel = !status.apiBase || status.apiBase === ''
                ? 'richart.app (proxy)'
                : status.apiBase && status.apiBase.includes('railway.app')
                    ? 'railway fallback'
                    : 'palindrom api';

            if (status.mempool === 'online' && status.ordinals === 'online') {
                if (ordIcon) ordIcon.className = 'online';
                if (ordText) ordText.textContent = `APIs: mempool.space ✓ | ${apiLabel} ✓`;
            } else if (status.mempool === 'online') {
                if (ordIcon) ordIcon.className = 'checking';
                if (ordText) ordText.textContent = `APIs: mempool.space ✓ | ${apiLabel} ✕`;
            } else {
                if (ordIcon) ordIcon.className = 'offline';
                if (ordText) ordText.textContent = 'APIs: Unreachable';
            }
        } catch (error) {
            if (ordIcon) ordIcon.className = 'offline';
            if (ordText) ordText.textContent = 'APIs: Connection error';
        }
    }

    // ========================================
    // Randomize Sound Settings
    // ========================================

    randomizeSound() {
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Instrument
        const instruments = ['piano', 'strings', 'brass', 'flute', 'organ', 'bell', 'synth', 'guitar'];
        const instrument = pickRandom(instruments);
        const instrumentEl = document.getElementById('instrumentSelect');
        if (instrumentEl) { instrumentEl.value = instrument; audioSystem.setInstrument(instrument); }

        // Key
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const key = pickRandom(keys);
        const keyEl = document.getElementById('keySelect');
        if (keyEl) { keyEl.value = key; audioSystem.setKey(key); }

        // Scale
        const scales = ['major', 'minor', 'pentatonic', 'blues', 'dorian', 'mixolydian', 'japanese'];
        const scale = pickRandom(scales);
        const scaleEl = document.getElementById('scaleSelect');
        if (scaleEl) { scaleEl.value = scale; audioSystem.setScale(scale); }

        // Octave (-1 to +1)
        const octave = rand(-1, 1);
        const octaveEl = document.getElementById('octaveSlider');
        if (octaveEl) { octaveEl.value = octave; document.getElementById('octaveValue').textContent = octave > 0 ? `+${octave}` : octave; audioSystem.setOctave(octave); }

        // Speed (2-9)
        const speed = rand(2, 9);
        const speedEl = document.getElementById('speedSlider');
        if (speedEl) { speedEl.value = speed; document.getElementById('speedValue').textContent = speed; audioSystem.setSpeed(speed); }

        // Volume (30-80)
        const volume = rand(30, 80);
        const volEl = document.getElementById('volumeSlider');
        if (volEl) { volEl.value = volume; document.getElementById('volumeValue').textContent = volume; audioSystem.setVolume(volume); }

        // Effekte (mit Wahrscheinlichkeit – nicht alle auf einmal)
        const effects = [
            { id: 'vibrato', label: 'vibratoValue', fn: 'setVibrato', max: 80 },
            { id: 'delay', label: 'delayValue', fn: 'setDelay', max: 70 },
            { id: 'filter', label: 'filterValue', fn: 'setFilter', max: 90 },
            { id: 'distortion', label: 'distortionValue', fn: 'setDistortion', max: 50 },
            { id: 'reverb', label: 'reverbValue', fn: 'setReverb', max: 80 },
            { id: 'sustain', label: 'sustainValue', fn: 'setSustain', max: 100 },
            { id: 'smoothness', label: 'smoothnessValue', fn: 'setSmoothness', max: 100 },
            { id: 'chorus', label: 'chorusValue', fn: 'setChorus', max: 60 },
            { id: 'phaser', label: 'phaserValue', fn: 'setPhaser', max: 60 },
            { id: 'tremolo', label: 'tremoloValue', fn: 'setTremolo', max: 60 },
            { id: 'compression', label: 'compressionValue', fn: 'setCompression', max: 70 },
            { id: 'portamento', label: 'portamentoValue', fn: 'setPortamento', max: 80 },
            { id: 'subBass', label: 'subBassValue', fn: 'setSubBass', max: 70 },
        ];

        for (const effect of effects) {
            // 60% Chance dass ein Effekt aktiv wird
            const value = Math.random() < 0.6 ? rand(5, effect.max) : 0;
            const slider = document.getElementById(effect.id + 'Slider');
            const label = document.getElementById(effect.label);
            if (slider) slider.value = value;
            if (label) label.textContent = value;
            if (audioSystem[effect.fn]) audioSystem[effect.fn](value);
        }

        // EQ (-8 bis +8)
        const eqBands = [
            { id: 'eqLow', label: 'eqLowValue', fn: 'setEQLow' },
            { id: 'eqMid', label: 'eqMidValue', fn: 'setEQMid' },
            { id: 'eqHigh', label: 'eqHighValue', fn: 'setEQHigh' },
        ];
        for (const eq of eqBands) {
            const value = rand(-8, 8);
            const slider = document.getElementById(eq.id + 'Slider');
            const label = document.getElementById(eq.label);
            if (slider) slider.value = value;
            if (label) label.textContent = value;
            if (audioSystem[eq.fn]) audioSystem[eq.fn](value);
        }

        // Swing & Humanize
        const swingVal = Math.random() < 0.5 ? rand(10, 60) : 0;
        const swEl = document.getElementById('swingSlider');
        if (swEl) { swEl.value = swingVal; document.getElementById('swingValue').textContent = swingVal; audioSystem.setSwing(swingVal); }
        const humVal = Math.random() < 0.5 ? rand(10, 50) : 0;
        const humEl = document.getElementById('humanizeSlider');
        if (humEl) { humEl.value = humVal; document.getElementById('humanizeValue').textContent = humVal; audioSystem.setHumanize(humVal); }

        // Beat System: Bei Randomize immer AUS lassen
        const beatEl = document.getElementById('beatStyleSelect');
        if (beatEl) { beatEl.value = 'none'; audioSystem.setBeatStyle('none'); }

        // Melody Tempo
        const tempos = ['0.25', '0.5', '1', '2'];
        const tempo = pickRandom(tempos);
        const tempoEl = document.getElementById('sequenceTempoSelect');
        if (tempoEl) { tempoEl.value = tempo; audioSystem.setSequenceTempo(parseFloat(tempo)); }

        console.log(`[App] 🎲 Randomized: ${instrument} in ${key}, speed ${speed}, volume ${volume}`);
    }

    // ========================================
    // Reset Sound Settings (Standardwerte)
    // ========================================

    resetSound() {
        const setSlider = (id, labelId, value) => {
            const slider = document.getElementById(id);
            const label = document.getElementById(labelId);
            if (slider) slider.value = value;
            if (label) label.textContent = value;
        };

        // Instrument: Piano
        const instrumentEl = document.getElementById('instrumentSelect');
        if (instrumentEl) { instrumentEl.value = 'piano'; audioSystem.setInstrument('piano'); }

        // Key: C
        const keyEl = document.getElementById('keySelect');
        if (keyEl) { keyEl.value = 'C'; audioSystem.setKey('C'); }

        // Scale: Major
        const scaleEl = document.getElementById('scaleSelect');
        if (scaleEl) { scaleEl.value = 'major'; audioSystem.setScale('major'); }

        // Octave: 0
        const octaveEl = document.getElementById('octaveSlider');
        if (octaveEl) { octaveEl.value = 0; document.getElementById('octaveValue').textContent = '0'; audioSystem.setOctave(0); }

        // Speed: 5
        setSlider('speedSlider', 'speedValue', 5); audioSystem.setSpeed(5);

        // Volume: 50
        setSlider('volumeSlider', 'volumeValue', 50); audioSystem.setVolume(50);

        // Alle Effekte auf 0 (außer Sustain & Smoothness auf 50)
        const defaults = [
            ['vibratoSlider', 'vibratoValue', 0, 'setVibrato'],
            ['delaySlider', 'delayValue', 0, 'setDelay'],
            ['filterSlider', 'filterValue', 0, 'setFilter'],
            ['distortionSlider', 'distortionValue', 0, 'setDistortion'],
            ['reverbSlider', 'reverbValue', 0, 'setReverb'],
            ['sustainSlider', 'sustainValue', 50, 'setSustain'],
            ['smoothnessSlider', 'smoothnessValue', 50, 'setSmoothness'],
            ['chorusSlider', 'chorusValue', 0, 'setChorus'],
            ['phaserSlider', 'phaserValue', 0, 'setPhaser'],
            ['tremoloSlider', 'tremoloValue', 0, 'setTremolo'],
            ['compressionSlider', 'compressionValue', 0, 'setCompression'],
            ['portamentoSlider', 'portamentoValue', 0, 'setPortamento'],
            ['subBassSlider', 'subBassValue', 0, 'setSubBass'],
        ];
        for (const [sliderId, labelId, val, fn] of defaults) {
            setSlider(sliderId, labelId, val);
            if (audioSystem[fn]) audioSystem[fn](val);
        }

        // EQ: alles auf 0
        setSlider('eqLowSlider', 'eqLowValue', 0); audioSystem.setEQLow(0);
        setSlider('eqMidSlider', 'eqMidValue', 0); audioSystem.setEQMid(0);
        setSlider('eqHighSlider', 'eqHighValue', 0); audioSystem.setEQHigh(0);

        // Beat: None
        const beatEl = document.getElementById('beatStyleSelect');
        if (beatEl) { beatEl.value = 'none'; audioSystem.setBeatStyle('none'); }
        setSlider('bpmSlider', 'bpmValue', 120); audioSystem.setBPM(120);
        setSlider('beatVolumeSlider', 'beatVolumeValue', 50); audioSystem.setBeatVolume(50);
        setSlider('swingSlider', 'swingValue', 0); audioSystem.setSwing(0);
        setSlider('humanizeSlider', 'humanizeValue', 0); audioSystem.setHumanize(0);

        // Melody Tempo: 1x
        const tempoEl = document.getElementById('sequenceTempoSelect');
        if (tempoEl) { tempoEl.value = '1'; audioSystem.setSequenceTempo(1); }

        console.log('[App] ↺ Reset to defaults');
    }

    // ========================================
    // Background Pre-Scan (startet sofort nach Wallet-Connect)
    // ========================================

    async backgroundScan() {
        if (!walletManager.isConnected) return;
        console.log('[App] Background scan starting...');
        try {
            this._backgroundScanPromise = walletManager.scanForPalindromSATs((progress) => {
                console.log(`[App] Background scan: ${progress.status}`);
            });
            const results = await this._backgroundScanPromise;
            this._backgroundScanResults = results;
            console.log(`[App] Background scan complete: ${results.length} palindromes ready!`);
            
            // Scan-Button Text aktualisieren
            const scanBtn = document.getElementById('scanBtn');
            if (scanBtn && !scanBtn.disabled) {
                scanBtn.textContent = `🔍 Show ${results.length} Palindromes`;
            }
        } catch (e) {
            console.warn('[App] Background scan failed:', e.message);
            this._backgroundScanResults = null;
        }
        this._backgroundScanPromise = null;
    }

    // ========================================
    // Palindrom Scan (nutzt Background-Ergebnisse wenn verfügbar)
    // ========================================

    async handleScanPalindromes() {
        const scanBtn = document.getElementById('scanBtn');
        const scanProgress = document.getElementById('scanProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const palindromResults = document.getElementById('palindromResults');
        const scanOverlay = document.getElementById('scanOverlay');
        const scanOverlayStatus = document.getElementById('scanOverlayStatus');

        if (!walletManager.isConnected) {
            alert('Please connect your wallet first!');
            return;
        }

        // FAST PATH: Background-Scan ist bereits fertig → sofort anzeigen!
        if (this._backgroundScanResults) {
            console.log('[App] Using pre-cached background scan results!');
            if (progressFill) progressFill.style.width = '100%';
            this.displayPalindroms(this._backgroundScanResults);
            this._backgroundScanResults = null; // Einmal verwenden
            return;
        }

        // Background-Scan läuft noch → darauf warten
        if (this._backgroundScanPromise) {
            console.log('[App] Waiting for background scan to finish...');
            if (scanOverlay) scanOverlay.classList.add('active');
            if (scanOverlayStatus) scanOverlayStatus.textContent = 'Almost ready...';
            try {
                const results = await this._backgroundScanPromise;
                if (scanOverlay) scanOverlay.classList.remove('active');
                if (progressFill) progressFill.style.width = '100%';
                this.displayPalindroms(results);
                this._backgroundScanResults = null;
                return;
            } catch (e) { /* fall through to normal scan */ }
            if (scanOverlay) scanOverlay.classList.remove('active');
        }

        // NORMAL PATH: Kein Background-Scan → normaler Scan mit Overlay
        try {
            if (scanBtn) scanBtn.disabled = true;
            if (scanProgress) scanProgress.style.display = 'block';
            
            // Overlay mit drehendem Schmetterling anzeigen
            if (scanOverlay) scanOverlay.classList.add('active');
            if (scanOverlayStatus) scanOverlayStatus.textContent = '';

            // Scan starten mit Progress-Callback
            const palindromes = await walletManager.scanForPalindromSATs((progress) => {
                // Progress-UI aktualisieren
                if (progressText) progressText.textContent = progress.status;
                if (scanOverlayStatus) scanOverlayStatus.textContent = progress.status;
                if (progressFill && progress.total > 0) {
                    const percent = (progress.current / progress.total) * 100;
                    progressFill.style.width = percent + '%';
                }
            });

            // Ergebnisse anzeigen
            if (progressFill) progressFill.style.width = '100%';
            this.displayPalindroms(palindromes);

        } catch (error) {
            if (progressText) progressText.textContent = `Error: ${error.message}`;
            if (scanOverlayStatus) scanOverlayStatus.textContent = `Error: ${error.message}`;
            console.error('Scan-Fehler:', error);
        } finally {
            if (scanBtn) scanBtn.disabled = false;
            // Overlay ausblenden
            if (scanOverlay) scanOverlay.classList.remove('active');
        }
    }

    // ========================================
    // Palindrom-Anzeige
    // ========================================

    displayPalindroms(palindromes) {
        const palindromResults = document.getElementById('palindromResults');
        const palindromList = document.getElementById('palindromList');
        const palindromCount = document.getElementById('palindromCount');

        if (!palindromList) return;

        palindromList.innerHTML = '';

        if (!palindromes || palindromes.length === 0) {
            palindromList.innerHTML = '<div class="progress-text">No Palindrom SATs found</div>';
            if (palindromResults) palindromResults.style.display = 'block';
            if (palindromCount) palindromCount.textContent = '(0)';
            return;
        }

        if (palindromCount) palindromCount.textContent = `(${palindromes.length})`;

        palindromes.forEach(palindrom => {
            const rarity = PalindromScanner.getRarity(palindrom);
            const formattedSat = PalindromScanner.formatSatNumber(palindrom.sat);

            const item = document.createElement('div');
            item.className = 'palindrom-item';
            item.dataset.sat = palindrom.sat;

            item.innerHTML = `
                <input type="checkbox" class="pal-checkbox" data-sat="${palindrom.sat}">
                <div class="pal-info">
                    <span class="pal-sequence">${palindrom.sequence}</span>
                    <span class="pal-sat">SAT #${formattedSat}</span>
                </div>
                <span class="pal-rarity" style="background: ${rarity.color}22; color: ${rarity.color}; border: 1px solid ${rarity.color}44;">
                    ${rarity.label}
                </span>
            `;

            // Click auf das ganze Item oder die Checkbox
            const checkbox = item.querySelector('.pal-checkbox');

            const toggleSelect = (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }

                if (checkbox.checked) {
                    try {
                        walletManager.selectPalindrom(palindrom);
                        item.classList.add('selected');
                    } catch (error) {
                        checkbox.checked = false;
                        alert(error.message);
                        return;
                    }
                } else {
                    walletManager.deselectPalindrom(palindrom.sat);
                    item.classList.remove('selected');
                }

                this.updateSelectedDisplay();
            };

            item.addEventListener('click', toggleSelect);

            palindromList.appendChild(item);
        });

        if (palindromResults) palindromResults.style.display = 'block';
    }

    // ========================================
    // Auswahl-Anzeige
    // ========================================

    updateSelectedDisplay() {
        const selectedSection = document.getElementById('selectedSection');
        const selectedList = document.getElementById('selectedList');
        const selectedCount = document.getElementById('selectedCount');

        const selected = walletManager.selectedPalindroms;

        if (selectedCount) selectedCount.textContent = selected.length;

        if (selected.length > 0) {
            if (selectedSection) selectedSection.style.display = 'block';

            if (selectedList) {
                selectedList.innerHTML = '';

                selected.forEach(pal => {
                    const tag = document.createElement('div');
                    tag.className = 'selected-tag';
                    tag.innerHTML = `
                        <span>${pal.sequence}</span>
                        <span class="remove-tag" data-sat="${pal.sat}">✕</span>
                    `;

                    tag.querySelector('.remove-tag').addEventListener('click', (e) => {
                        e.stopPropagation();
                        walletManager.deselectPalindrom(pal.sat);

                        // Checkbox in der Liste deselektieren
                        const listCheckbox = document.querySelector(`.pal-checkbox[data-sat="${pal.sat}"]`);
                        if (listCheckbox) {
                            listCheckbox.checked = false;
                            listCheckbox.closest('.palindrom-item').classList.remove('selected');
                        }

                        this.updateSelectedDisplay();
                    });

                    selectedList.appendChild(tag);
                });
            }
        } else {
            if (selectedSection) selectedSection.style.display = 'none';
        }
    }

    // ========================================
    // Ausgewählte Palindrome in Sequenzen laden
    // ========================================

    loadPalindromSequences() {
        const sequences = walletManager.getSelectedSequences();

        // Alle Sequenz-Felder zurücksetzen
        for (let i = 0; i < 5; i++) {
            const input = document.querySelector(`.seq-input[data-seq="${i}"]`);
            const checkbox = document.querySelector(`.seq-checkbox[data-seq="${i}"]`);

            if (i < sequences.length) {
                if (input) input.value = sequences[i];
                if (checkbox) checkbox.checked = true;
                this.sequences[i] = sequences[i];
                this.activeSequences[i] = true;
            } else {
                if (input) input.value = '';
                if (checkbox) checkbox.checked = false;
                this.sequences[i] = '';
                this.activeSequences[i] = false;
            }
        }

        this.updatePalindrom();
        this.updateStepDisplay();
    }

    updatePalindrom() {
        const activeSeqs = this.getActiveSequences();
        const palindrom = butterflyViz.getCurrentPalindrom(activeSeqs);
        butterflyViz.updateButterflyParams(palindrom);
    }

    getActiveSequences() {
        // Sequenzen immer frisch aus den Input-Feldern lesen
        const active = [];
        for (let i = 0; i < 5; i++) {
            const checkbox = document.querySelector(`.seq-checkbox[data-seq="${i}"]`);
            const input = document.querySelector(`.seq-input[data-seq="${i}"]`);
            
            if (checkbox && input && checkbox.checked && input.value.trim()) {
                const sequence = input.value.trim();
                if (sequence.length > 0) {
                    active.push(sequence);
                }
            }
        }
        return active;
    }

    updateBeatTiming() {
        const beatStyle = document.getElementById('beatStyleSelect')?.value || 'none';
        if (beatStyle !== 'none' && audioSystem.bpm > 0) {
            // 16 Schritte pro Takt (= 4 Beats = 1 Bar)
            // Muss mit audio.js übereinstimmen: stepDuration = 60 / (bpm * 4)
            this.beatStepDuration = 60 / (audioSystem.bpm * 4);
            this.beatStepDuration /= this.sequenceTempo; // Tempo-Anpassung
        } else {
            this.beatStepDuration = 0;
        }
    }

    calculateNoteSteps(sequence) {
        const TARGET = 16;
        const n = sequence.length;
        
        if (n === 0) return { steps: [TARGET], indices: null };
        
        // More than 16 digits: pick 16 evenly spaced notes
        if (n > TARGET) {
            const selectedIndices = [];
            for (let step = 0; step < TARGET; step++) {
                selectedIndices.push(Math.round(step * (n - 1) / (TARGET - 1)));
            }
            return { steps: new Array(TARGET).fill(1), indices: selectedIndices };
        }
        
        // Each note gets a base number of steps; extras distributed evenly
        const base = Math.floor(TARGET / n);
        const extra = TARGET % n;
        const steps = new Array(n).fill(base);
        
        if (extra > 0) {
            // Distribute extra steps as evenly spaced as possible
            // e.g. n=5, extra=1 → middle gets +1; n=7, extra=2 → positions 2,4 get +1
            for (let i = 0; i < extra; i++) {
                const pos = Math.round((i + 0.5) * n / extra - 0.5);
                steps[Math.min(pos, n - 1)]++;
            }
        }
        
        return { steps, indices: null };
    }

    play() {
        // Schutz gegen mehrfache Aufrufe
        if (this.isStarting) {
            console.log('Start bereits in Progress, ignoriere Aufruf');
            return;
        }
        
        // Wenn bereits am Spielen, nichts tun (verhindert mehrfache Aufrufe)
        if (this.isPlaying) {
            console.log('Bereits am Spielen, ignoriere Aufruf');
            return;
        }
        
        this.isStarting = true;
        
        // Sicherstellen, dass alle Timeouts gestoppt sind
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }
        
        // Sicherstellen, dass isPlaying false ist
        this.isPlaying = false;
        
        // Sequenzen neu laden beim Start
        const activeSeqs = this.getActiveSequences();
        if (activeSeqs.length === 0) {
            this.isStarting = false;
            alert('Please activate at least one sequence!');
            return;
        }
        
        // Sicherstellen, dass alles zurückgesetzt ist
        this.currentSequenceIndex = 0;
        this.currentNumberIndex = 0;
        this.nextBeatTime = 0;
        
        // Beat-Sync nur aktivieren, wenn Beat wirklich aktiv ist
        const beatStyle = document.getElementById('beatStyleSelect')?.value || 'none';
        this.beatSync = beatStyle !== 'none';
        
        // Beat-Timing aktualisieren nur wenn Beat aktiv
        if (this.beatSync) {
            this.updateBeatTiming();
            // Beat-System starten
            if (audioSystem.audioContext) {
                audioSystem.startBeats();
                this.nextBeatTime = audioSystem.audioContext.currentTime;
            }
        }
        
        // Jetzt erst isPlaying auf true setzen
        this.isPlaying = true;
        this.isStarting = false; // Start abgeschlossen
        
        this.updateStepDisplay();
        
        // Wiedergabe starten
        if (this.polyphony) {
            this.playPolyphonic(activeSeqs);
        } else if (this.beatSync && audioSystem.audioContext) {
            this.playSequenceBeatSync(activeSeqs);
        } else {
            this.playSequence(activeSeqs);
        }
        
        // UI aktualisieren
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '⏸ Pause';
            playBtn.dataset.state = 'playing';
        }
    }

    pause() {
        this.isPlaying = false;
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }
        
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶ Play';
            playBtn.dataset.state = 'paused';
        }
    }

    stop() {
        // Start-Flag zurücksetzen
        this.isStarting = false;
        
        // Zuerst isPlaying auf false setzen, damit alle Timeouts abgebrochen werden
        this.isPlaying = false;
        
        // Alle Timeouts stoppen
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }
        
        // Indizes zurücksetzen
        this.currentSequenceIndex = 0;
        this.currentNumberIndex = 0;
        this.nextBeatTime = 0;
        this.beatSync = false;
        
        if (audioSystem.audioContext) {
            audioSystem.cleanupAllOscillators();
            audioSystem.stopBeats();
        }
        
        this.clearAllHighlights();
        
        const currentNumber = document.getElementById('currentNumber');
        if (currentNumber) {
            currentNumber.textContent = '-';
        }
        
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶ Play';
            playBtn.dataset.state = 'stopped';
        }
        
        butterflyViz.resetButterfly(true);
    }

    playSequence(sequences) {
        if (!this.isPlaying) return;
        
        // Prüfe ob alle Sequenzen durchgespielt wurden
        if (this.currentSequenceIndex >= sequences.length) {
            if (this.isLooping) {
                // Loop aktiviert: von vorne beginnen
                this.currentSequenceIndex = 0;
                this.currentNumberIndex = 0;
            } else {
                // Kein Loop: stoppen
                this.stop();
                return;
            }
        }
        
        const sequence = sequences[this.currentSequenceIndex];
        if (!sequence || sequence.length === 0) {
            // Leere Sequenz überspringen
            this.currentSequenceIndex++;
            // Nächste Sequenz prüfen
            if (this.currentSequenceIndex >= sequences.length) {
                if (this.isLooping) {
                    this.currentSequenceIndex = 0;
                    this.currentNumberIndex = 0;
                } else {
                    this.stop();
                    return;
                }
            }
            // Rekursiv nächste Sequenz starten
            this.playSequence(sequences);
            return;
        }
        
        this.playSequenceNumbers(sequence, sequences);
    }

    playSequenceBeatSync(sequences) {
        if (!this.isPlaying) return;
        
        if (this.currentSequenceIndex >= sequences.length) {
            if (this.isLooping) {
                this.currentSequenceIndex = 0;
                this.currentNumberIndex = 0;
            } else {
                this.stop();
                return;
            }
        }
        
        const sequence = sequences[this.currentSequenceIndex];
        if (!sequence || sequence.length === 0) {
            this.currentSequenceIndex++;
            if (this.beatStepDuration > 0) {
                this.nextBeatTime += this.beatStepDuration * 16;
            }
            this.playTimeout = setTimeout(() => {
                if (this.isPlaying) this.playSequenceBeatSync(sequences);
            }, 0);
            return;
        }
        
        const { steps, indices } = this.calculateNoteSteps(sequence);
        this._scheduleBeatSyncBar(sequence, sequences, steps, indices);
    }

    _scheduleBeatSyncBar(sequence, allSequences, noteSteps, selectedIndices) {
        if (!this.isPlaying) return;
        
        const now = audioSystem.audioContext.currentTime;
        let currentTime = Math.max(this.nextBeatTime, now);
        const patternStartTime = currentTime;
        const totalPatternTime = this.beatStepDuration * 16;
        
        const digits = selectedIndices
            ? selectedIndices.map(idx => sequence[idx])
            : sequence.split('');
        
        // Schedule all notes via Web Audio (sample-accurate)
        const noteTimings = [];
        for (let i = 0; i < digits.length; i++) {
            const number = parseInt(digits[i]);
            if (isNaN(number)) continue;
            const noteDuration = this.beatStepDuration * noteSteps[i];
            audioSystem.playTone(number, noteDuration, currentTime, true);
            noteTimings.push({
                time: currentTime, number, duration: noteDuration,
                seqIdx: this.currentSequenceIndex,
                noteIdx: selectedIndices ? selectedIndices[i] : i
            });
            currentTime += noteDuration;
        }
        
        // Schedule UI updates to match audio (setTimeout-based, close enough for visuals)
        for (const nt of noteTimings) {
            const delayFromNow = Math.max(0, (nt.time - now) * 1000);
            setTimeout(() => {
                if (!this.isPlaying) return;
                const el = document.getElementById('currentNumber');
                if (el) el.textContent = nt.number;
                this.highlightStep(nt.seqIdx, nt.noteIdx);
                this.updatePalindrom();
            }, delayFromNow);
        }
        
        // Advance to next sequence/loop
        this.currentNumberIndex = 0;
        this.currentSequenceIndex++;
        const nextPatternStart = patternStartTime + totalPatternTime;
        this.nextBeatTime = nextPatternStart;
        const delayMs = Math.max(10, (nextPatternStart - now) * 1000);
        
        if (this.currentSequenceIndex >= allSequences.length) {
            if (this.isLooping) {
                this.currentSequenceIndex = 0;
                this.currentNumberIndex = 0;
                this.playTimeout = setTimeout(() => {
                    if (this.isPlaying) this.playSequenceBeatSync(allSequences);
                }, delayMs);
            } else {
                this.playTimeout = setTimeout(() => this.stop(), delayMs);
            }
        } else {
            this.playTimeout = setTimeout(() => {
                if (this.isPlaying) this.playSequenceBeatSync(allSequences);
            }, delayMs);
        }
    }

    // ========================================
    // Polyphonic Playback (all sequences simultaneously)
    // ========================================

    playPolyphonic(sequences) {
        if (!this.isPlaying) return;
        const maxLen = Math.max(...sequences.map(s => s.length));
        if (maxLen === 0) { this.stop(); return; }
        this.currentNumberIndex = 0;
        
        if (this.beatSync && audioSystem.audioContext) {
            this._polyBeatSync(sequences, maxLen);
        } else {
            this._polyStep(sequences, maxLen);
        }
    }

    _polyBeatSync(sequences, maxLen) {
        if (!this.isPlaying) return;
        
        const now = audioSystem.audioContext.currentTime;
        let currentTime = Math.max(this.nextBeatTime, now);
        const patternStartTime = currentTime;
        const totalPatternTime = this.beatStepDuration * 16;
        const TARGET = 16;
        
        // Determine how many positions to play and step durations
        let playCount, stepDurations, selectedPositions;
        
        if (maxLen > TARGET) {
            playCount = TARGET;
            stepDurations = new Array(TARGET).fill(1);
            selectedPositions = [];
            for (let i = 0; i < TARGET; i++) {
                selectedPositions.push(Math.round(i * (maxLen - 1) / (TARGET - 1)));
            }
        } else {
            playCount = maxLen;
            const base = Math.floor(TARGET / maxLen);
            const extra = TARGET % maxLen;
            stepDurations = new Array(maxLen).fill(base);
            for (let i = 0; i < extra; i++) {
                const pos = Math.round((i + 0.5) * maxLen / extra - 0.5);
                stepDurations[Math.min(pos, maxLen - 1)]++;
            }
            selectedPositions = null;
        }
        
        const noteTimings = [];
        for (let i = 0; i < playCount; i++) {
            const srcIdx = selectedPositions ? selectedPositions[i] : i;
            const noteDuration = this.beatStepDuration * stepDurations[i];
            
            for (let s = 0; s < sequences.length; s++) {
                const seq = sequences[s];
                if (srcIdx >= seq.length) continue;
                const num = parseInt(seq[srcIdx]);
                if (isNaN(num)) continue;
                audioSystem.playTone(num, noteDuration, currentTime, true);
            }
            
            noteTimings.push({ time: currentTime, srcIdx, duration: noteDuration });
            currentTime += noteDuration;
        }
        
        for (const nt of noteTimings) {
            const delayFromNow = Math.max(0, (nt.time - now) * 1000);
            setTimeout(() => {
                if (!this.isPlaying) return;
                for (let s = 0; s < sequences.length; s++) {
                    if (nt.srcIdx < sequences[s].length) {
                        this.highlightStep(s, nt.srcIdx);
                    }
                }
                this.updatePalindrom();
            }, delayFromNow);
        }
        
        const nextPatternStart = patternStartTime + totalPatternTime;
        this.nextBeatTime = nextPatternStart;
        const delayMs = Math.max(10, (nextPatternStart - now) * 1000);
        
        if (this.isLooping) {
            this.playTimeout = setTimeout(() => {
                if (this.isPlaying) this._polyBeatSync(sequences, maxLen);
            }, delayMs);
        } else {
            this.playTimeout = setTimeout(() => this.stop(), delayMs);
        }
    }

    _polyStep(sequences, maxLen) {
        if (!this.isPlaying || this.currentNumberIndex >= maxLen) {
            if (this.isLooping && this.isPlaying) {
                this.currentNumberIndex = 0;
                this._polyStep(sequences, maxLen);
            } else {
                this.stop();
            }
            return;
        }
        const idx = this.currentNumberIndex;
        for (let s = 0; s < sequences.length; s++) {
            const seq = sequences[s];
            if (idx < seq.length) {
                const num = parseInt(seq[idx]);
                if (!isNaN(num)) {
                    const durationMs = (11 - audioSystem.speed) * 50;
                    if (audioSystem.audioContext) audioSystem.playTone(num, durationMs / 1000);
                }
                this.highlightStep(s, idx);
            }
        }
        this.updatePalindrom();
        const durationMs = (11 - audioSystem.speed) * 50;
        const ci = this.currentNumberIndex;
        this.playTimeout = setTimeout(() => {
            if (!this.isPlaying || this.currentNumberIndex !== ci) return;
            this.currentNumberIndex++;
            this._polyStep(sequences, maxLen);
        }, durationMs);
    }

    playSequenceNumbers(sequence, allSequences) {
        if (!this.isPlaying) return;
        
        if (this.currentNumberIndex >= sequence.length) {
            // Sequenz beendet, nächste Sequenz
            this.currentNumberIndex = 0;
            this.currentSequenceIndex++;
            
            // Prüfe ob Loop aktiviert ist
            if (this.currentSequenceIndex >= allSequences.length && this.isLooping) {
                // Loop: sofort ohne Pause von vorne beginnen
                this.currentSequenceIndex = 0;
                this.currentNumberIndex = 0;
                this.playSequence(allSequences);
            } else if (this.currentSequenceIndex >= allSequences.length) {
                // Kein Loop: stoppen
                this.stop();
                return;
            } else {
                // Pause zwischen Sequenzen nur wenn nicht am Ende
                const pauseDuration = (11 - audioSystem.speed) * 50;
                this.playTimeout = setTimeout(() => {
                    if (this.isPlaying) {
                        this.playSequence(allSequences);
                    }
                }, pauseDuration);
            }
            return;
        }
        
        const number = parseInt(sequence[this.currentNumberIndex]);
        
        if (isNaN(number)) {
            // Ungültige Zahl, überspringen
            this.playTimeout = setTimeout(() => {
                if (!this.isPlaying) return;
                this.currentNumberIndex++;
                this.playSequenceNumbers(sequence, allSequences);
            }, 50);
            return;
        }
        
        this.highlightStep(this.currentSequenceIndex, this.currentNumberIndex);
        
        const el = document.getElementById('currentNumber');
        if (el) el.textContent = number;
        
        const durationMs = (11 - audioSystem.speed) * 50;
        const durationSec = durationMs / 1000;
        
        if (audioSystem.audioContext) {
            audioSystem.playTone(number, durationSec);
        }
        
        this.updatePalindrom();
        
        // Nächste Zahl NACH dem Timeout setzen (im Timeout selbst)
        // Nächsten Ton planen
        const currentIndex = this.currentNumberIndex; // Aktuellen Index speichern
        this.playTimeout = setTimeout(() => {
            // Prüfe ob noch am Spielen und ob der Index noch aktuell ist
            if (!this.isPlaying) return;
            // Prüfe ob der Index noch der gleiche ist (verhindert Race Conditions)
            if (this.currentNumberIndex !== currentIndex) return;
            this.currentNumberIndex++; // Index erst hier erhöhen
            this.playSequenceNumbers(sequence, allSequences);
        }, durationMs);
    }

    // (Beat-sync scheduling handled by _scheduleBeatSyncBar above)

    updateUI() {}

    // ========================================
    // Step Sequencer Display
    // ========================================

    updateStepDisplay() {
        const grid = document.getElementById('stepGrid');
        const label = document.getElementById('stepLabel');
        if (!grid) return;
        const seqs = this.getActiveSequences();
        if (seqs.length === 0) {
            grid.innerHTML = '';
            if (label) label.textContent = 'Load palindromes to begin';
            return;
        }
        if (label) label.textContent = `${seqs.length} sequence${seqs.length > 1 ? 's' : ''} active`;
        let html = '';
        seqs.forEach((seq, si) => {
            html += `<div class="step-row" data-seq-idx="${si}">`;
            for (let i = 0; i < seq.length; i++) {
                html += `<div class="step-cell" data-seq="${si}" data-idx="${i}">${seq[i]}</div>`;
            }
            html += '</div>';
        });
        grid.innerHTML = html;
    }

    highlightStep(seqIdx, charIdx) {
        // Only clear this row's highlights (not all rows, so polyphonic works)
        document.querySelectorAll(`.step-cell[data-seq="${seqIdx}"].active`)
            .forEach(el => el.classList.remove('active'));
        const cell = document.querySelector(`.step-cell[data-seq="${seqIdx}"][data-idx="${charIdx}"]`);
        if (cell) cell.classList.add('active');
    }

    clearAllHighlights() {
        document.querySelectorAll('.step-cell.active').forEach(el => el.classList.remove('active'));
    }

    // ========================================
    // Recording
    // ========================================

    async toggleRecording() {
        const btn = document.getElementById('recordBtn');
        if (this.isRecording) {
            const blob = await audioSystem.stopRecording();
            this.isRecording = false;
            if (btn) { btn.textContent = '● Rec'; btn.classList.remove('recording'); }
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `palindrom-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            if (audioSystem.startRecording()) {
                this.isRecording = true;
                if (btn) { btn.textContent = '■ Stop Rec'; btn.classList.add('recording'); }
            }
        }
    }

    // ========================================
    // Preset System
    // ========================================

    getPresetData() {
        const getVal = (id) => document.getElementById(id)?.value;
        return {
            instrument: getVal('instrumentSelect'), key: getVal('keySelect'), scale: getVal('scaleSelect'),
            speed: getVal('speedSlider'), volume: getVal('volumeSlider'), octave: getVal('octaveSlider'),
            vibrato: getVal('vibratoSlider'), delay: getVal('delaySlider'), filter: getVal('filterSlider'),
            distortion: getVal('distortionSlider'), reverb: getVal('reverbSlider'), sustain: getVal('sustainSlider'),
            smoothness: getVal('smoothnessSlider'), chorus: getVal('chorusSlider'), phaser: getVal('phaserSlider'),
            tremolo: getVal('tremoloSlider'), compression: getVal('compressionSlider'),
            eqLow: getVal('eqLowSlider'), eqMid: getVal('eqMidSlider'), eqHigh: getVal('eqHighSlider'),
            portamento: getVal('portamentoSlider'), subBass: getVal('subBassSlider'),
            beatStyle: getVal('beatStyleSelect'), bpm: getVal('bpmSlider'), beatVolume: getVal('beatVolumeSlider'),
            swing: getVal('swingSlider'), humanize: getVal('humanizeSlider'),
            sequenceTempo: getVal('sequenceTempoSelect'),
        };
    }

    applyPresetData(p) {
        const set = (id, val, labelId, fn) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) { el.value = val; if (labelId) { const lb = document.getElementById(labelId); if (lb) lb.textContent = val; } if (fn && audioSystem[fn]) audioSystem[fn](parseFloat(val)); }
        };
        set('instrumentSelect', p.instrument, null, 'setInstrument');
        set('keySelect', p.key, null, 'setKey');
        set('scaleSelect', p.scale, null, 'setScale');
        set('speedSlider', p.speed, 'speedValue', 'setSpeed');
        set('volumeSlider', p.volume, 'volumeValue', 'setVolume');
        set('octaveSlider', p.octave, 'octaveValue', 'setOctave');
        set('vibratoSlider', p.vibrato, 'vibratoValue', 'setVibrato');
        set('delaySlider', p.delay, 'delayValue', 'setDelay');
        set('filterSlider', p.filter, 'filterValue', 'setFilter');
        set('distortionSlider', p.distortion, 'distortionValue', 'setDistortion');
        set('reverbSlider', p.reverb, 'reverbValue', 'setReverb');
        set('sustainSlider', p.sustain, 'sustainValue', 'setSustain');
        set('smoothnessSlider', p.smoothness, 'smoothnessValue', 'setSmoothness');
        set('chorusSlider', p.chorus, 'chorusValue', 'setChorus');
        set('phaserSlider', p.phaser, 'phaserValue', 'setPhaser');
        set('tremoloSlider', p.tremolo, 'tremoloValue', 'setTremolo');
        set('compressionSlider', p.compression, 'compressionValue', 'setCompression');
        set('portamentoSlider', p.portamento, 'portamentoValue', 'setPortamento');
        set('subBassSlider', p.subBass, 'subBassValue', 'setSubBass');
        set('eqLowSlider', p.eqLow, 'eqLowValue', 'setEQLow');
        set('eqMidSlider', p.eqMid, 'eqMidValue', 'setEQMid');
        set('eqHighSlider', p.eqHigh, 'eqHighValue', 'setEQHigh');
        set('beatStyleSelect', p.beatStyle, null, 'setBeatStyle');
        set('bpmSlider', p.bpm, 'bpmValue', 'setBPM');
        set('beatVolumeSlider', p.beatVolume, 'beatVolumeValue', 'setBeatVolume');
        set('swingSlider', p.swing, 'swingValue', 'setSwing');
        set('humanizeSlider', p.humanize, 'humanizeValue', 'setHumanize');
        set('sequenceTempoSelect', p.sequenceTempo, null, 'setSequenceTempo');
    }

    savePreset() {
        const nameEl = document.getElementById('presetName');
        const name = (nameEl?.value || '').trim();
        if (!name) { alert('Enter a preset name'); return; }
        const presets = JSON.parse(localStorage.getItem('psb_presets') || '{}');
        presets[name] = this.getPresetData();
        localStorage.setItem('psb_presets', JSON.stringify(presets));
        nameEl.value = '';
        this.loadPresetList();
    }

    loadPresetList() {
        const list = document.getElementById('presetList');
        if (!list) return;
        const presets = JSON.parse(localStorage.getItem('psb_presets') || '{}');
        const names = Object.keys(presets);
        if (names.length === 0) { list.innerHTML = '<div class="progress-text">No saved presets</div>'; return; }
        list.innerHTML = '';
        names.forEach(name => {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `<span class="preset-name">${name}</span><span class="preset-actions"><button class="preset-load" data-name="${name}">Load</button><button class="preset-delete" data-name="${name}">✕</button></span>`;
            item.querySelector('.preset-load').addEventListener('click', () => { this.applyPresetData(presets[name]); });
            item.querySelector('.preset-delete').addEventListener('click', () => {
                delete presets[name]; localStorage.setItem('psb_presets', JSON.stringify(presets)); this.loadPresetList();
            });
            list.appendChild(item);
        });
    }
}

// App initialisieren wenn DOM geladen ist
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PalindromSoundBox();
});

