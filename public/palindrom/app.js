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
        this.isStarting = false; // Schutz gegen mehrfache Start-Aufrufe
        
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

            if (status.mempool === 'online' && status.ordinals === 'online') {
                if (ordIcon) ordIcon.className = 'online';
                if (ordText) ordText.textContent = 'APIs: mempool.space ✓ | ordinals.com ✓';
            } else if (status.mempool === 'online') {
                if (ordIcon) ordIcon.className = 'checking';
                if (ordText) ordText.textContent = 'APIs: mempool.space ✓ | ordinals.com ✕';
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
    // Palindrom Scan
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
        // Berechnet für jede Ziffer die Anzahl Beat-Steps (ganzzahlig!)
        // KEINE Wiederholung von Ziffern – nur längere Notendauer!
        // Verteilung symmetrisch von der Mitte nach außen
        // → Melodie bleibt 1:1 erhalten, passt perfekt in den 16-Step-Takt
        
        const TARGET = 16;
        const n = sequence.length;
        
        // Edge Cases
        if (n === 0) return [TARGET];
        
        // Zu lang (>16): Jede Note bekommt 1 Step, überzählige werden übersprungen
        if (n > TARGET) {
            // Gleichmäßig auswählen welche Noten gespielt werden
            const selectedIndices = [];
            for (let step = 0; step < TARGET; step++) {
                selectedIndices.push(Math.round(step * (n - 1) / (TARGET - 1)));
            }
            return { steps: new Array(TARGET).fill(1), indices: selectedIndices };
        }
        
        // Jede Note bekommt mindestens 1 Beat-Step
        const steps = new Array(n).fill(1);
        let remaining = TARGET - n;
        
        // Wenn nichts zu verteilen ist, fertig
        if (remaining === 0) {
            console.log(`[NoteSteps] "${sequence}" (${n}) → Steps: [${steps.join(',')}] = ${TARGET}`);
            return { steps, indices: null };
        }
        
        const mid = Math.floor((n - 1) / 2);
        
        // Symmetrische Paare bilden (Mitte zuerst, dann nach außen)
        const priorityPairs = [];
        
        if (n % 2 === 1) {
            // Ungerade Länge: Mitte ist einzeln, dann Paare
            priorityPairs.push([mid]);
            for (let d = 1; d <= mid; d++) {
                priorityPairs.push([mid - d, mid + d]);
            }
        } else {
            // Gerade Länge: nur Paare
            for (let d = 0; d < n / 2; d++) {
                priorityPairs.push([mid - d, mid + 1 + d]);
            }
        }
        
        // Extra-Steps symmetrisch verteilen (Round-Robin)
        let pairIdx = 0;
        while (remaining > 0) {
            const pair = priorityPairs[pairIdx % priorityPairs.length];
            
            if (pair.length === 2) {
                if (remaining >= 2) {
                    steps[pair[0]]++;
                    steps[pair[1]]++;
                    remaining -= 2;
                } else {
                    // Nur 1 übrig: Mitte bekommt es
                    steps[mid]++;
                    remaining--;
                }
            } else {
                steps[pair[0]]++;
                remaining--;
            }
            pairIdx++;
        }
        
        console.log(`[NoteSteps] "${sequence}" (${n}) → Steps: [${steps.join(',')}] = ${steps.reduce((a,b) => a+b, 0)}`);
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
        
        // Wiedergabe starten
        if (this.beatSync && audioSystem.audioContext) {
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
            // Leere Sequenz überspringen (per setTimeout, um Endlosrekursion zu vermeiden)
            this.currentSequenceIndex++;
            if (this.beatStepDuration > 0) {
                this.nextBeatTime += this.beatStepDuration * 16;
            }
            this.playTimeout = setTimeout(() => {
                if (this.isPlaying) {
                    this.playSequenceBeatSync(sequences);
                }
            }, 0);
            return;
        }
        
        // Ganzzahlige Beat-Steps pro Note berechnen (KEINE Wiederholung!)
        // Jede Note bekommt 1, 2 oder mehr Steps → Melodie bleibt original
        const { steps, indices } = this.calculateNoteSteps(sequence);
        this.playSequenceNumbersBeatSync(sequence, sequences, steps, indices);
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
        
        const currentNumberEl = document.getElementById('currentNumber');
        if (currentNumberEl) {
            currentNumberEl.textContent = number;
        }
        
        // Ton spielen - kürzere Dauer (in Millisekunden für Timeout, in Sekunden für Audio)
        const durationMs = (11 - audioSystem.speed) * 50; // Kürzere Dauer: 50-500ms
        const durationSec = durationMs / 1000; // Für Audio in Sekunden
        
        if (audioSystem.audioContext) {
            audioSystem.playTone(number, durationSec);
        }
        
        // Palindrom aktualisieren
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

    playSequenceNumbersBeatSync(sequence, allSequences, noteSteps, selectedIndices) {
        if (!this.isPlaying) return;
        
        // Alle Töne der Sequenz auf einmal planen (nicht rekursiv!)
        const now = audioSystem.audioContext.currentTime;
        let currentTime = this.nextBeatTime;
        
        // Stelle sicher, dass wir nicht in der Vergangenheit planen
        if (currentTime < now) {
            currentTime = now;
        }
        
        const patternStartTime = currentTime;
        
        // Gesamte Pattern-Dauer (immer exakt 16 Beat-Steps = 1 Takt)
        const totalPatternTime = this.beatStepDuration * 16;
        
        // Bestimme welche Ziffern gespielt werden und wie lange
        const playSequence = selectedIndices 
            ? selectedIndices.map(idx => sequence[idx])  // Bei >16 Ziffern: ausgewählte
            : sequence.split('');                         // Normal: alle Ziffern
        
        for (let i = 0; i < playSequence.length; i++) {
            const number = parseInt(playSequence[i]);
            if (isNaN(number)) continue;
            
            // Notenlänge = Beat-Step-Dauer × Anzahl Steps für diese Note
            const noteDuration = this.beatStepDuration * noteSteps[i];
            
            // Ton zum geplanten Beat-Zeitpunkt spielen
            audioSystem.playTone(number, noteDuration, currentTime, true);
            
            // UI aktualisieren für ersten Ton
            if (i === 0) {
                const currentNumberEl = document.getElementById('currentNumber');
                if (currentNumberEl) {
                    currentNumberEl.textContent = number;
                }
            }
            
            currentTime += noteDuration;
        }
        
        // Palindrom aktualisieren
        this.updatePalindrom();
        
        // Sequenz beendet, zur nächsten Sequenz
        this.currentNumberIndex = 0;
        this.currentSequenceIndex++;
        
        // Nächster Pattern-Start = Start dieses Patterns + 1 Takt
        const nextPatternStart = patternStartTime + totalPatternTime;
        // Wie lange müssen wir real warten? (Millisekunden ab jetzt)
        const delayMs = Math.max(10, (nextPatternStart - now) * 1000);
        
        if (this.currentSequenceIndex >= allSequences.length) {
            if (this.isLooping) {
                // Loop: nächste Iteration nach diesem Takt
                this.currentSequenceIndex = 0;
                this.currentNumberIndex = 0;
                this.nextBeatTime = nextPatternStart;
                this.playTimeout = setTimeout(() => {
                    if (this.isPlaying) {
                        this.playSequenceBeatSync(allSequences);
                    }
                }, delayMs);
            } else {
                // Stoppen nach letzter Sequenz
                this.playTimeout = setTimeout(() => {
                    this.stop();
                }, delayMs);
            }
        } else {
            // Nächste Sequenz nach diesem Takt
            this.nextBeatTime = nextPatternStart;
            this.playTimeout = setTimeout(() => {
                if (this.isPlaying) {
                    this.playSequenceBeatSync(allSequences);
                }
            }, delayMs);
        }
    }

    updateUI() {
        // Initiale UI-Werte setzen
        // (wird bereits durch Event-Handler gemacht)
    }
}

// App initialisieren wenn DOM geladen ist
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PalindromSoundBox();
});

