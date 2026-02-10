// Butterfly Visualization System
// Attraktor-basierte Visualisierung mit Audio-Reaktivität

class ButterflyVisualization {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.imageData = null;
        this.pixels = null;
        
        // Partikel-System
        this.particles = [];
        this.particleCount = 25000;
        this.maxParticleAge = 5000;
        this.fadeFactor = 0.996; // Weniger Fade für stärkere Visualisierung
        this.particleIntensity = 2.5; // Erhöhte Intensität
        this.particleSize = 2; // Größere Partikel (2x2 Pixel)
        
        // Attraktor-Parameter (5 Parameter wie in Referenz)
        this.a = 1.2;
        this.b = 1.6;
        this.c = 1.8;
        this.d = 1.4;
        this.k = 0.9;
        this.targetA = 1.2;
        this.targetB = 1.6;
        this.targetC = 1.8;
        this.targetD = 1.4;
        this.targetK = 0.9;
        
        // Cached Parameter für Performance
        this.cachedParams = { a: 1.2, b: 1.6, c: 1.8, d: 1.4, k: 0.9 };
        this.lastParamUpdate = -1;
        
        // Palindrom-spezifische Visuell-Parameter
        // Jedes Palindrom bekommt einzigartige Farbe, Form und Muster
        this.palindromHue = 0;         // Einzigartiger Farbton pro Palindrom (0-360)
        this.wingRatio = 1.3;          // Flügel-Seitenverhältnis (1.0 = rund, 1.8 = breit)
        this.patternScale = 1.0;       // Mustergröße basierend auf Palindrom-Länge
        this.palindromSeed = 0;        // Seed für deterministisches Partikel-Seeding
        this.palindromStr = '';        // Aktuelles Palindrom als String
        
        // Pattern-Modus (Mustergenerator)
        this.patternMode = 'butterfly';
        
        // Visualisierungs-Parameter
        this.colorMode = 'butterfly';
        this.scale = 1.0;
        this.audioScale = 0.0;
        this.breathingPhase = 0;
        this.frameSkip = 0;
        
        // Audio-Reaktivität (erweitert)
        this.audioReactivity = {
            volume: 0,
            smoothVolume: 0,        // Geglätteter Volume-Wert
            beat: 0,
            beatDecay: 0,           // Langsam abklingender Beat-Impuls
            prevVolume: 0,          // Für Beat-Detection
            beatThreshold: 0.15,    // Schwellwert für Beat-Erkennung
            distortion: 0,
            bassEnergy: 0,          // Tiefe Frequenzen (20-200Hz)
            midEnergy: 0,           // Mittlere Frequenzen (200-2kHz)
            highEnergy: 0,          // Hohe Frequenzen (2k-20kHz)
            frequency: new Array(32).fill(0)
        };
        
        // Audio-reactive Visualisierungs-Multiplikatoren
        this.audioScalePulse = 0;       // Pulsieren mit Volume
        this.audioWingFlap = 0;         // Flügelschlag mit Beat
        this.audioParticleSize = 0;     // Partikelgröße mit Frequenzen
        this.audioRotation = 0;         // Leichte Rotation
        
        this.animationId = null;
        this.isRunning = false;
    }

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        
        // Event Listener für Resize
        window.addEventListener('resize', () => this.resize());
        
        // Event Listener für UI-Toggle (Visualisierung neu berechnen)
        const uiPanel = document.getElementById('mainUI');
        if (uiPanel) {
            const observer = new MutationObserver(() => {
                this.resize();
            });
            observer.observe(uiPanel, { attributes: true, attributeFilter: ['class'] });
        }
        
        // Partikel initialisieren
        this.initParticles();
        
        // Initiales Palindrom setzen für sofortige Visualisierung
        this.updateButterflyParams('123454321');
        
        console.log('Butterfly visualization initialized');
    }

    resize() {
        // Verfügbarer Platz berechnen (UI berücksichtigen)
        const uiPanel = document.getElementById('mainUI');
        let availableWidth = window.innerWidth;
        let availableHeight = window.innerHeight;
        let offsetX = 0;
        let offsetY = 0;
        
        if (uiPanel && !uiPanel.classList.contains('hidden')) {
            // UI ist sichtbar - Platz berechnen
            const uiRect = uiPanel.getBoundingClientRect();
            const uiWidth = uiRect.width;
            
            // Desktop: UI links, Visualisierung rechts
            if (window.innerWidth > 768) {
                availableWidth = window.innerWidth - uiWidth;
                offsetX = uiWidth;
            } else {
                // Mobile: UI unten, Visualisierung oben
                const uiHeight = uiRect.height;
                availableHeight = window.innerHeight - uiHeight;
                offsetY = 0;
            }
        }
        
        // Canvas auf volle Fenstergröße setzen
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Verfügbare Dimensionen speichern
        this.availableWidth = availableWidth;
        this.availableHeight = availableHeight;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        
        // Hintergrund initialisieren
        this.ctx.fillStyle = 'rgba(10, 10, 10, 1)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // ImageData für Pixel-Manipulation
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.pixels = this.imageData.data;
        
        // ImageData mit Hintergrund initialisieren
        for (let i = 0; i < this.pixels.length; i += 4) {
            this.pixels[i] = 10;     // R
            this.pixels[i + 1] = 10;  // G
            this.pixels[i + 2] = 10;  // B
            this.pixels[i + 3] = 255; // A
        }
        this.ctx.putImageData(this.imageData, 0, 0);
        
        // Partikel neu positionieren
        this.initParticles();
    }

    initParticles() {
        this.particles = [];
        
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                age: (i / this.particleCount) * this.maxParticleAge * 0.3
            });
        }
    }

    // Deterministisches Partikel-Seeding: Gleiches Palindrom → gleiche Startpositionen
    initParticlesSeeded(seed) {
        this.particles = [];
        const isLorenz = this.patternMode === 'lorenz';
        
        for (let i = 0; i < this.particleCount; i++) {
            const p = {
                x: (this._seededRandom(seed + i * 2) - 0.5) * 0.3,
                y: (this._seededRandom(seed + i * 2 + 1) - 0.5) * 0.3,
                age: Math.floor((i / this.particleCount) * this.maxParticleAge * 0.3)
            };
            if (isLorenz) {
                p.z = 20 + this._seededRandom(seed + i * 2 + 2) * 5;
            }
            this.particles.push(p);
        }
    }

    // ================================================================
    // HELPER: Deterministischer Zufallsgenerator (Mulberry32)
    // ================================================================
    _seededRandom(seed) {
        let t = (seed + 0x6D2B79F5) | 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Hash: Palindrom-String → eindeutige Zahl
    _hashPalindrom(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }

    // ================================================================
    // PALINDROM → ATTRAKTOR-PARAMETER
    // ================================================================

    getCurrentPalindrom(sequences) {
        if (!sequences || sequences.length === 0) return '';
        
        const activeSequences = sequences.filter(s => s && s.length > 0);
        if (activeSequences.length === 0) return '';
        
        const combined = activeSequences.join('');
        const reversed = combined.split('').reverse().join('');
        
        if (combined.length % 2 === 1) {
            const mid = Math.floor(combined.length / 2);
            return combined + combined[mid] + reversed;
        }
        
        return combined + reversed;
    }

    paramsFromPalindrom(palindrom) {
        // Jedes Palindrom bekommt EINZIGARTIGE Parameter:
        // - Attraktor-Form (a, b, c, d, k) → einzigartiges Muster
        // - Farbton (hue) → einzigartige Farbe
        // - Flügelform (wingRatio) → einzigartige Proportionen
        // - Mustergröße (patternScale) → basierend auf Palindrom-Länge
        // - Seed → deterministisches Rendering
        
        if (!palindrom || palindrom.length === 0) {
            return { a: 1.2, b: 1.6, c: 1.8, d: 1.4, k: 0.9, 
                     hue: 0, wingRatio: 1.3, patternScale: 1.0, seed: 0 };
        }
        
        const digits = palindrom.split('').map(Number);
        const n = digits.length;
        const hash = this._hashPalindrom(palindrom);
        
        // Seeded Random für reproduzierbare aber gut verteilte Werte
        const r = (idx) => this._seededRandom(hash + idx * 7919);
        
        // Ziffern normalisiert (0-1)
        const d0 = digits[0] / 9;
        const d1 = digits[1 % n] / 9;
        const d2 = digits[2 % n] / 9;
        const d3 = digits[3 % n] / 9;
        const dMid = digits[Math.floor(n / 2)] / 9;
        
        // Attraktor-Parameter: Ziffern + Hash-Variation
        // Breite Ranges (1.0 - 2.6) für maximal unterschiedliche Formen
        const a = 1.0 + d0 * 0.6 + r(0) * 1.0;
        const b = 1.0 + d1 * 0.6 + r(1) * 1.0;
        const c = 1.0 + d2 * 0.6 + r(2) * 1.0;
        const d = 1.0 + d3 * 0.6 + r(3) * 1.0;
        const k = 0.2 + dMid * 0.5 + r(4) * 0.6;
        
        // Visuelle Eigenschaften
        const hue = hash % 360;                                     // Einzigartiger Farbton
        const wingRatio = 1.0 + r(5) * 0.6 + (dMid * 0.2);        // 1.0 bis 1.8
        const patternScale = 0.85 + (n / 20) * 0.35;               // Längere = größer
        
        return { a, b, c, d, k, hue, wingRatio, patternScale, seed: hash };
    }

    updateButterflyParams(palindrom) {
        const params = this.paramsFromPalindrom(palindrom);
        this.targetA = params.a;
        this.targetB = params.b;
        this.targetC = params.c;
        this.targetD = params.d;
        this.targetK = params.k;
        
        // Palindrom-spezifische Visuell-Parameter
        this.palindromHue = params.hue;
        this.wingRatio = params.wingRatio;
        this.patternScale = params.patternScale;
        this.palindromStr = palindrom || '';
        
        // Neues Palindrom → Partikel deterministisch neu seeden
        // So sieht dasselbe Palindrom immer gleich aus
        if (params.seed !== this.palindromSeed && params.seed !== 0) {
            this.palindromSeed = params.seed;
            this.initParticlesSeeded(params.seed);
        }
    }

    resetButterfly(smoothTransition = true) {
        if (smoothTransition) {
            // Sanfte Übergänge
            this.targetA = 1.2;
            this.targetB = 1.6;
            this.targetC = 1.8;
            this.targetD = 1.4;
            this.targetK = 0.9;
        } else {
            this.a = 1.2;
            this.b = 1.6;
            this.c = 1.8;
            this.d = 1.4;
            this.k = 0.9;
            this.targetA = 1.2;
            this.targetB = 1.6;
            this.targetC = 1.8;
            this.targetD = 1.4;
            this.targetK = 0.9;
        }
    }
    
    updateParams() {
        // Sanfte Zeit-Variation + Audio-Wobble
        // Basis: ±0.03 (subtiler Atem), Audio: bis ±0.15 zusätzlich bei Bass!
        const t = this.breathingPhase;
        const wobble = this.audioAttrWobble || 0;
        
        if (!this.cachedParams) {
            this.cachedParams = { a: this.a, b: this.b, c: this.c, d: this.d, k: this.k };
        }
        this.cachedParams.a = this.a + Math.sin(t) * 0.03 + Math.sin(t * 2.3) * wobble;
        this.cachedParams.b = this.b + Math.cos(t * 0.7) * 0.025 + Math.cos(t * 1.7) * wobble;
        this.cachedParams.c = this.c + Math.sin(t * 1.3) * 0.025 + Math.sin(t * 3.1) * wobble;
        this.cachedParams.d = this.d + Math.cos(t * 0.9) * 0.03 + Math.cos(t * 2.7) * wobble;
        this.cachedParams.k = this.k + Math.sin(t * 0.5) * 0.015 + Math.sin(t * 1.9) * wobble * 0.5;
    }

    particleStep(particle) {
        const x = particle.x;
        const y = particle.y;
        const { a, b, c, d, k } = this.cachedParams;
        let nx, ny;
        
        switch (this.patternMode) {
            case 'butterfly':
            default:
                // Butterfly Attractor - Original
                nx = Math.sin(a * y) - Math.cos(b * x) + k * Math.sin(y);
                ny = Math.sin(c * x) - Math.cos(d * y) - k * Math.sin(x);
                break;
                
            case 'clifford':
                // Clifford Attractor - Elegante Schleifen
                nx = Math.sin(a * y) + c * Math.cos(a * x);
                ny = Math.sin(b * x) + d * Math.cos(b * y);
                break;
                
            case 'dejong':
                // Peter de Jong Attractor - Chaotische Wirbel
                nx = Math.sin(a * y) - Math.cos(b * x);
                ny = Math.sin(c * x) - Math.cos(d * y);
                break;
                
            case 'lorenz':
                // Lorenz-Projektion (2D) - Doppelschleife
                const sigma = a * 5 + 5;   // ~5-15
                const rho = b * 10 + 20;   // ~20-30
                const beta = k + 1.5;      // ~1.5-3
                const dt = 0.005;
                const z = particle.z || 20;
                const dxL = sigma * (y - x);
                const dyL = x * (rho - z) - y;
                const dzL = x * y - beta * z;
                nx = x + dxL * dt;
                ny = y + dyL * dt;
                particle.z = z + dzL * dt;
                break;
                
            case 'spiral':
                // Spiral Galaxy - Spiralarme mit Attraktor
                const r = Math.sqrt(x * x + y * y);
                const theta = Math.atan2(y, x);
                const newTheta = theta + 0.02 + k * 0.01 / (r + 0.5);
                const newR = r + Math.sin(a * theta + b * r) * 0.01 - 0.002;
                nx = newR * Math.cos(newTheta) + Math.sin(c * y) * 0.02;
                ny = newR * Math.sin(newTheta) + Math.cos(d * x) * 0.02;
                // Reset wenn zu weit weg
                if (Math.abs(nx) > 4 || Math.abs(ny) > 4) {
                    nx = (Math.random() - 0.5) * 0.5;
                    ny = (Math.random() - 0.5) * 0.5;
                }
                break;
                
            case 'flower':
                // Flower of Life - Rosenförmige Muster
                const rF = Math.sqrt(x * x + y * y) + 0.001;
                const thetaF = Math.atan2(y, x);
                const petals = Math.floor(a * 3) + 3; // 3-8 Blütenblätter
                const roseR = Math.cos(petals * thetaF) * 0.5;
                const targetR = Math.abs(roseR) + k * 0.3;
                const dR = (targetR - rF) * 0.03;
                const dTheta = 0.015 + b * 0.005 + Math.sin(c * rF) * 0.008;
                const finalR = rF + dR + Math.sin(d * thetaF * 2) * 0.005;
                const finalTheta = thetaF + dTheta;
                nx = finalR * Math.cos(finalTheta);
                ny = finalR * Math.sin(finalTheta);
                if (Math.abs(nx) > 3 || Math.abs(ny) > 3) {
                    nx = (Math.random() - 0.5) * 0.2;
                    ny = (Math.random() - 0.5) * 0.2;
                }
                break;
        }
        
        particle.x = nx;
        particle.y = ny;
        particle.age++;
        
        // Safety: reset particle if coordinates become NaN/Infinity or too large
        if (!isFinite(particle.x) || !isFinite(particle.y) || 
            Math.abs(particle.x) > 500 || Math.abs(particle.y) > 500 ||
            (particle.z !== undefined && (!isFinite(particle.z) || Math.abs(particle.z) > 500))) {
            particle.x = (Math.random() - 0.5) * 0.3;
            particle.y = (Math.random() - 0.5) * 0.3;
            if (this.patternMode === 'lorenz') {
                particle.z = 20 + Math.random() * 10;
            } else {
                delete particle.z;
            }
            particle.age = 0;
            return;
        }
        
        // Partikel zurücksetzen wenn zu alt
        if (particle.age > this.maxParticleAge) {
            if (Math.random() < 0.1) {
                if (this.patternMode === 'lorenz') {
                    // Lorenz: re-seed near attractor region
                    particle.x = (Math.random() - 0.5) * 2;
                    particle.y = (Math.random() - 0.5) * 2;
                    particle.z = 20 + Math.random() * 10;
                } else {
                    particle.x = (Math.random() - 0.5) * 0.3;
                    particle.y = (Math.random() - 0.5) * 0.3;
                    delete particle.z;
                }
                particle.age = 0;
            } else {
                particle.age = this.maxParticleAge * 0.9;
            }
        }
    }

    getButterflyColor(x, y, frame) {
        // Farbberechnung basierend auf Modus (wie in Referenz)
        // Verwende verfügbaren Bereich für Zentrum
        const availWidth = this.availableWidth || this.width;
        const availHeight = this.availableHeight || this.height;
        const offsetX = this.offsetX || 0;
        const offsetY = this.offsetY || 0;
        const cx = offsetX + availWidth / 2;
        const cy = offsetY + availHeight / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt((availWidth / 2) ** 2 + (availHeight / 2) ** 2);
        const normalizedDist = dist / maxDist;
        const angle = Math.atan2(dy, dx);
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        
        // Sehr kleine Mitte ausblenden
        const minDist = 2;
        if (dist < minDist) {
            return { h: 0, s: 0, l: 0, a: 0 }; // Transparent
        }
        
        const effectiveDist = dist - minDist;
        const effectiveMaxDist = maxDist - minDist;
        const normalizedDistEffective = Math.min(1, effectiveDist / effectiveMaxDist);
        const time = this.breathingPhase * 0.01;
        
        let h, s, l, a;
        
        switch (this.colorMode) {
            case 'butterfly':
                // Schmetterlings-ähnliche Farben: Orange, Gelb, Schwarz, Weiß
                const wingEdge = normalizedDistEffective > 0.7;
                const eyePattern = Math.sin(effectiveDist * 0.02 + time * 100) > 0.3 && 
                                 Math.abs(angle) > 0.5 && Math.abs(angle) < 2.5 &&
                                 normalizedDistEffective > 0.3 && normalizedDistEffective < 0.7;
                
                if (eyePattern) {
                    h = 30 + Math.sin(effectiveDist * 0.05) * 10;
                    s = 80;
                    l = 25;
                    a = 0.08;
                } else if (wingEdge) {
                    h = 20;
                    s = 70;
                    l = 30;
                    a = 0.06;
                } else {
                    h = (30 + normalizedDistEffective * 60 + Math.sin(time * 100) * 20) % 360;
                    s = 85 + Math.sin(effectiveDist * 0.03) * 15;
                    l = 40 + normalizedDistEffective * 25;
                    a = 0.05;
                }
                break;
            case 'monarch':
                const monarchPattern = Math.sin(effectiveDist * 0.03 + time * 100) > 0;
                if (monarchPattern) {
                    h = 25 + Math.sin(effectiveDist * 0.04) * 5;
                    s = 90;
                    l = 40 + normalizedDistEffective * 20;
                    a = 0.06;
                } else {
                    h = 20;
                    s = 60;
                    l = 20;
                    a = 0.05;
                }
                break;
            case 'blue':
                const bluePattern = Math.sin(effectiveDist * 0.025 + angle * 2) > 0.2;
                if (bluePattern) {
                    h = 200 + Math.sin(effectiveDist * 0.04) * 30;
                    s = 85;
                    l = 40 + normalizedDistEffective * 20;
                    a = 0.06;
                } else {
                    h = 210;
                    s = 70;
                    l = 25;
                    a = 0.05;
                }
                break;
            case 'rainbow':
                const angle2 = Math.atan2(y - cy, x - cx);
                h = ((angle2 * 180 / Math.PI + 360) % 360 + frame * 0.5) % 360;
                s = 90;
                l = 50 + normalizedDistEffective * 20;
                a = 0.04;
                break;
            case 'fire':
                h = 15 + normalizedDistEffective * 30;
                s = 90 - normalizedDistEffective * 20;
                l = 40 + normalizedDistEffective * 30;
                a = 0.05;
                break;
            case 'ocean':
                h = 180 + normalizedDistEffective * 40;
                s = 70 + normalizedDistEffective * 20;
                l = 30 + normalizedDistEffective * 20;
                a = 0.04;
                break;
            case 'neon':
                h = (frame * 0.8 + normalizedDistEffective * 180) % 360;
                s = 100;
                l = 50 + normalizedDistEffective * 30;
                a = 0.06;
                break;
            default:
                h = (frame * 0.4) % 360;
                s = 80;
                l = 40 + normalizedDistEffective * 20;
                a = 0.035;
        }
        
        // Palindrom-spezifischer Farbton: Jedes Palindrom hat eine eigene Farbpalette
        // Der palindromHue verschiebt das gesamte Farbspektrum
        h = (h + this.palindromHue) % 360;
        
        // === AUDIO-REACTIVE: Frequenzband-basierte Farbänderungen ===
        const ar = this.audioReactivity;
        
        // Bass → wärmere Farbtöne (Hue Shift Richtung Rot/Orange)
        h += ar.bassEnergy * -30; // Shift Richtung wärmere Töne
        
        // Mids → mehr Sättigung
        s += ar.midEnergy * 25;
        
        // Highs → mehr Helligkeit (Glitzer-Effekt)
        l += ar.highEnergy * 20;
        
        // Volume → allgemeine Aufhellung
        l += ar.smoothVolume * 25;
        
        // Beat → Sättigungs-Boost (knalligere Farben bei Beats)
        s += ar.beatDecay * 20;
        
        // Distortion → Farbverschiebung (psychedelischer Effekt)
        h += ar.distortion * 40;
        
        // Clamp-Werte
        s = Math.min(100, Math.max(0, s));
        l = Math.min(80, Math.max(10, l));
        
        return { h: h % 360, s, l, a };
    }

    hslToRgba(h, s, l, a) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
            a: Math.min(255, Math.max(0, Math.round(a * 255)))
        };
    }

    setButterflyPixel(x, y, r, g, b, a) {
        // Alpha-Blending für Überlagerung
        const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
        
        if (index < 0 || index >= this.pixels.length - 3) return;
        
        const currentA = this.pixels[index + 3] / 255;
        const newA = a / 255;
        const combinedA = currentA + newA * (1 - currentA);
        
        if (combinedA > 0) {
            this.pixels[index] = (this.pixels[index] * currentA + r * newA * (1 - currentA)) / combinedA;
            this.pixels[index + 1] = (this.pixels[index + 1] * currentA + g * newA * (1 - currentA)) / combinedA;
            this.pixels[index + 2] = (this.pixels[index + 2] * currentA + b * newA * (1 - currentA)) / combinedA;
            this.pixels[index + 3] = combinedA * 255;
        }
    }
    
    setButterflyPixelArea(x, y, r, g, b, a, size) {
        // Setzt mehrere Pixel für größere Partikel
        const halfSize = Math.floor(size / 2);
        for (let dy = -halfSize; dy <= halfSize; dy++) {
            for (let dx = -halfSize; dx <= halfSize; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= halfSize) {
                    // Alpha basierend auf Distanz zum Zentrum (weicher Rand)
                    const distFactor = 1 - (dist / halfSize) * 0.5;
                    const adjustedA = a * distFactor;
                    this.setButterflyPixel(x + dx, y + dy, r, g, b, adjustedA);
                }
            }
        }
    }

    updateAudioReactivity() {
        if (!audioSystem.audioContext) return;
        
        const ar = this.audioReactivity;
        
        // Volume-Level (roh)
        ar.prevVolume = ar.volume;
        ar.volume = audioSystem.getVolumeLevel();
        
        // Geglätteter Volume (für sanftes Pulsieren)
        ar.smoothVolume += (ar.volume - ar.smoothVolume) * 0.15;
        
        // === BEAT-DETECTION ===
        // Erkennt plötzliche Lautstärke-Anstiege als "Beats"
        const volumeJump = ar.volume - ar.prevVolume;
        if (volumeJump > ar.beatThreshold) {
            ar.beat = Math.min(1.0, volumeJump * 4);
            ar.beatDecay = 1.0;
        } else {
            ar.beat *= 0.85; // Schneller Abfall
        }
        // Beat-Decay klingt langsamer ab (für Flügelschlag-Animation)
        ar.beatDecay *= 0.92;
        
        // Auch Beat-Style berücksichtigen
        if (audioSystem.beatStyle !== 'none') {
            ar.beat = Math.max(ar.beat, 0.3);
            ar.beatDecay = Math.max(ar.beatDecay, 0.2);
        }
        
        // Distortion-Level
        ar.distortion = audioSystem.distortion / 100;
        
        // === FREQUENZBAND-ANALYSE ===
        const freqData = audioSystem.getFrequencyData();
        if (freqData) {
            const binCount = freqData.length;
            const bucketSize = Math.floor(binCount / 32);
            
            // 32 Buckets füllen
            for (let i = 0; i < 32; i++) {
                let sum = 0;
                for (let j = 0; j < bucketSize; j++) {
                    sum += freqData[i * bucketSize + j] || 0;
                }
                ar.frequency[i] = sum / (bucketSize * 255);
            }
            
            // Bass (Buckets 0-3, ~20-200Hz)
            ar.bassEnergy = (ar.frequency[0] + ar.frequency[1] + ar.frequency[2] + ar.frequency[3]) / 4;
            
            // Mids (Buckets 4-15, ~200-2kHz)
            let midSum = 0;
            for (let i = 4; i < 16; i++) midSum += ar.frequency[i];
            ar.midEnergy = midSum / 12;
            
            // Highs (Buckets 16-31, ~2k-20kHz)
            let highSum = 0;
            for (let i = 16; i < 32; i++) highSum += ar.frequency[i];
            ar.highEnergy = highSum / 16;
        }
        
        // === AUDIO-REACTIVE PARAMETER BERECHNEN ===
        
        // 1. Pulsieren: Volume → Scale (stärker! max ±35%)
        const targetPulse = ar.smoothVolume * 0.35 + ar.bassEnergy * 0.25;
        this.audioScalePulse += (targetPulse - this.audioScalePulse) * 0.25;
        
        // 2. Flügelschlag: Beat → Wing Ratio Modulation (stärker!)
        const targetFlap = ar.beatDecay * 0.5 + ar.bassEnergy * 0.2;
        this.audioWingFlap += (targetFlap - this.audioWingFlap) * 0.35;
        
        // 3. Partikelgröße: Mid+High Energie → größere Partikel
        const targetSize = (ar.midEnergy + ar.highEnergy) * 0.8;
        this.audioParticleSize += (targetSize - this.audioParticleSize) * 0.25;
        
        // 4. Rotation: Volume + Bass → Drehung
        this.audioRotation += (ar.smoothVolume * 0.03 + ar.bassEnergy * 0.02 + ar.distortion * 0.015);
        
        // 5. NEU: Wellen-Amplitude (Bass + Mid → Wellenbewegung)
        const targetWave = ar.bassEnergy * 0.6 + ar.midEnergy * 0.4 + ar.smoothVolume * 0.3;
        this.audioWaveAmp = this.audioWaveAmp || 0;
        this.audioWaveAmp += (targetWave - this.audioWaveAmp) * 0.3;
        
        // 6. NEU: Wellen-Frequenz (Higher notes → schnellere Wellen)
        this.audioWaveFreq = this.audioWaveFreq || 3;
        const targetWaveFreq = 3 + ar.highEnergy * 8 + ar.midEnergy * 4;
        this.audioWaveFreq += (targetWaveFreq - this.audioWaveFreq) * 0.15;
        
        // 7. NEU: Attraktor-Wobble (Bass moduliert die Form selbst!)
        this.audioAttrWobble = this.audioAttrWobble || 0;
        const targetWobble = ar.bassEnergy * 0.15 + ar.beatDecay * 0.1;
        this.audioAttrWobble += (targetWobble - this.audioAttrWobble) * 0.2;
    }

    drawButterfly() {
        if (!this.isRunning) return;
        
        // Parameter-Interpolation für sanfte Übergänge
        this.a += (this.targetA - this.a) * 0.05;
        this.b += (this.targetB - this.b) * 0.05;
        this.c += (this.targetC - this.c) * 0.05;
        this.d += (this.targetD - this.d) * 0.05;
        this.k += (this.targetK - this.k) * 0.05;
        
        // Parameter aktualisieren
        this.updateParams();
        
        // Audio-Reaktivität aktualisieren
        this.updateAudioReactivity();
        
        // Atmungseffekt — beschleunigt sich bei Audio!
        const audioSpeedBoost = 1 + (this.audioReactivity.smoothVolume || 0) * 2 + (this.audioReactivity.bassEnergy || 0) * 1.5;
        this.breathingPhase += 0.015 * audioSpeedBoost;
        
        // === AUDIO-REACTIVE: Fade-Out reagiert auf Sound ===
        // Bei Sound bleibt mehr stehen → intensivere, leuchtendere Trails
        const audioFade = Math.min(0.998, this.fadeFactor + this.audioReactivity.smoothVolume * 0.003);
        for (let i = 3; i < this.pixels.length; i += 4) {
            this.pixels[i] = this.pixels[i] * audioFade | 0;
        }
        
        // Verfügbare Dimensionen verwenden (falls gesetzt, sonst volle Größe)
        const availWidth = this.availableWidth || this.width;
        const availHeight = this.availableHeight || this.height;
        const offsetX = this.offsetX || 0;
        const offsetY = this.offsetY || 0;
        
        // Zentrum im verfügbaren Bereich
        const cx = offsetX + availWidth / 2;
        const cy = offsetY + availHeight / 2;
        
        // Skalierung basierend auf verfügbarem Platz
        const baseScale = Math.min(availWidth, availHeight) * 0.22 * this.patternScale;
        
        // Dynamische Skalierung für "Atmung" — stärker bei Sound!
        const breathSpeed = 1 + (this.audioReactivity.smoothVolume || 0) * 3;
        const breathing = 1 + Math.sin(this.breathingPhase * breathSpeed) * 0.05;
        
        // === AUDIO-REACTIVE: Pulsieren mit Lautstärke ===
        const audioPulse = 1.0 + this.audioScalePulse;
        
        // === AUDIO-REACTIVE: Flügelschlag mit Beat ===
        const flapEffect = Math.sin(this.breathingPhase * 4) * this.audioWingFlap;
        const dynamicWingRatio = this.wingRatio + flapEffect;
        
        // === AUDIO-REACTIVE: Rotation ===
        const rot = this.audioRotation || 0;
        const cosRot = Math.cos(rot);
        const sinRot = Math.sin(rot);
        
        // === AUDIO-REACTIVE: Wellen-Parameter ===
        const waveAmp = (this.audioWaveAmp || 0) * baseScale * 0.15;
        const waveFreq = this.audioWaveFreq || 3;
        const wavePhase = this.breathingPhase * 2;
        
        // Pattern-spezifische Skalierung
        let patternScaleFactor = 1.0;
        if (this.patternMode === 'lorenz') patternScaleFactor = 0.07;
        else if (this.patternMode === 'spiral') patternScaleFactor = 0.8;
        else if (this.patternMode === 'flower') patternScaleFactor = 1.2;
        
        // Palindrom-spezifische Flügelform + Audio-Reaktivität:
        const wingScaleX = baseScale * breathing * audioPulse * dynamicWingRatio * patternScaleFactor;
        const wingScaleY = baseScale * breathing * audioPulse * (2.3 - dynamicWingRatio) * patternScaleFactor;
        
        // Render Partikel - Batch-Verarbeitung
        this.frameSkip = (this.frameSkip + 1) % 2;
        
        for (let i = 0; i < this.particles.length; i++) {
            // Skip jeden zweiten Partikel abwechselnd für Performance
            if (i % 2 === this.frameSkip) continue;
            
            const p = this.particles[i];
            
            // Partikel-Schritt
            this.particleStep(p);
            
            // Koordinaten auf Canvas umrechnen + Wellen + Rotation
            let px = p.x * wingScaleX;
            let py = p.y * wingScaleY;
            
            // Wellen-Verzerrung: Sinuswelle verzerrt Positionen
            if (waveAmp > 0.5) {
                const dist = Math.sqrt(px * px + py * py);
                const waveOffset = Math.sin(dist * 0.008 * waveFreq + wavePhase) * waveAmp;
                const waveOffsetY = Math.cos(dist * 0.006 * waveFreq + wavePhase * 0.7) * waveAmp * 0.7;
                px += waveOffset;
                py += waveOffsetY;
            }
            
            // Leichte Rotation bei Audio
            if (rot > 0.001) {
                const rx = px * cosRot - py * sinRot;
                const ry = px * sinRot + py * cosRot;
                px = rx;
                py = ry;
            }
            
            const x = cx + px;
            const y = cy + py;
            
            // Nur rendern wenn im sichtbaren Bereich
            const xInt = x | 0;
            const yInt = y | 0;
            if (xInt >= 0 && xInt < this.width && yInt >= 0 && yInt < this.height) {
                const dx = x - cx;
                const dy = y - cy;
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                // Überspringe sehr kleine Mitte
                if (distFromCenter < 3) {
                    continue;
                }
                
                // Farbe berechnen
                const color = this.getButterflyColor(x, y, p.age);
                
                // Wenn transparent (Mitte), überspringe
                if (color.a === 0) {
                    continue;
                }
                
                // Partikel-Alter beeinflusst Intensität
                const ageFactor = Math.max(0.6, 1 - (p.age / this.maxParticleAge) * 0.4);
                let a = color.a * this.particleIntensity; // Intensität anwenden
                
                // Junge Partikel starten schwach und werden stärker
                const youngFactor = Math.min(1, p.age / 300);
                a = a * ageFactor * youngFactor;
                
                // === AUDIO-REACTIVE: Farbintensität verstärkt bei Sound ===
                const audioBoost = 1.0 + this.audioReactivity.smoothVolume * 1.5 + this.audioReactivity.bassEnergy * 0.8;
                a = a * audioBoost;
                
                // Sicherstellen, dass Alpha nicht zu klein ist
                if (a < 0.001) continue;
                
                // Alpha verstärken für bessere Sichtbarkeit
                a = Math.min(1, a * 1.5);
                
                // RGB berechnen (a ist 0-1, wird in hslToRgba zu 0-255 konvertiert)
                const rgba = this.hslToRgba(color.h, color.s, color.l, a);
                
                // VIERFACHE SPIEGELUNG für perfekte Schmetterlingsform
                const mirroredX = (cx - (x - cx)) | 0;
                const mirroredY = (cy - (y - cy)) | 0;
                
                // === AUDIO-REACTIVE: Partikelgröße reagiert auf Frequenzen ===
                // Mid+High Energie → größere Partikel (2-4px)
                const audioSizeBoost = Math.floor(this.audioParticleSize * 3);
                const particleSize = Math.max(this.particleSize, this.particleSize + audioSizeBoost);
                
                // Original-Position (oberer linker Flügel)
                this.setButterflyPixelArea(xInt, yInt, rgba.r, rgba.g, rgba.b, rgba.a, particleSize);
                
                // Horizontal gespiegelt (oberer rechter Flügel)
                this.setButterflyPixelArea(mirroredX, yInt, rgba.r, rgba.g, rgba.b, rgba.a, particleSize);
                
                // Vertikal gespiegelt (unterer linker Flügel)
                this.setButterflyPixelArea(xInt, mirroredY, rgba.r, rgba.g, rgba.b, rgba.a, particleSize);
                
                // Beide gespiegelt (unterer rechter Flügel)
                this.setButterflyPixelArea(mirroredX, mirroredY, rgba.r, rgba.g, rgba.b, rgba.a, particleSize);
            }
        }
        
        // ImageData auf Canvas zeichnen
        this.ctx.putImageData(this.imageData, 0, 0);
        
        this.animationId = requestAnimationFrame(() => this.drawButterfly());
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.drawButterfly();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    setPatternMode(mode) {
        this.patternMode = mode;
        // Re-initialize particles for the new pattern
        // Lorenz needs z-coordinate
        if (mode === 'lorenz') {
            for (const p of this.particles) {
                p.x = (Math.random() - 0.5) * 0.3;
                p.y = (Math.random() - 0.5) * 0.3;
                p.z = 20 + Math.random() * 5;
                p.age = Math.floor(Math.random() * this.maxParticleAge * 0.3);
            }
        } else {
            for (const p of this.particles) {
                p.x = (Math.random() - 0.5) * 0.3;
                p.y = (Math.random() - 0.5) * 0.3;
                delete p.z;
                p.age = Math.floor(Math.random() * this.maxParticleAge * 0.3);
            }
        }
    }

    setColorMode(mode) {
        this.colorMode = mode;
    }

    setParticleCount(count) {
        this.particleCount = count;
        this.initParticles();
    }
}

// Globale Instanz
const butterflyViz = new ButterflyVisualization();

