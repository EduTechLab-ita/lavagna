/**
 * EduBoard v2 — geometry.js
 * Strumenti geometrici interattivi: Righello, Goniometro, Compasso
 *
 * DIPENDENZE GLOBALI (definite in app.js, caricato prima):
 *   - CONFIG         : configurazione globale corrente
 *   - canvasMgr      : CanvasManager (ctx, _saveUndo, overlay canvas)
 *   - toast(msg,type): notifiche temporanee
 *
 * INIT (aggiungere in app.js, SEZIONE 12 — INIT, dopo setupKeyboard()):
 *   let geoMgr;
 *   // ... dentro DOMContentLoaded, dopo setupKeyboard():
 *   geoMgr = new GeometryManager();
 *
 * CSS: aggiungere il blocco in fondo a style.css (oppure tenere qui
 *       il <style> iniettato da _injectCSS).
 */

'use strict';

// =============================================================================
// RulerTool — righello orizzontale draggabile e ruotabile
// =============================================================================

class RulerTool {
    constructor() {
        this.el       = null;   // div#ruler-tool
        this.body     = null;   // div.ruler-body
        this.canvas   = null;   // canvas interno per le tacche
        this.visible  = false;

        // Posizione e angolo correnti
        this.x     = 80;    // posizione left del div
        this.y     = 200;   // posizione top del div
        this.angle = 0;     // gradi

        // Centro geometrico (aggiornato dopo ogni move/rotate)
        this.cx = 0;
        this.cy = 0;

        // Stato drag principale
        this._drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };

        // Stato drag rotazione
        this._rot  = { active: false, startAngle: 0, startMouse: 0 };
    }

    // ------------------------------------------------------------------
    // Creazione DOM
    // ------------------------------------------------------------------

    create() {
        const wrapper = document.createElement('div');
        wrapper.id        = 'ruler-tool';
        wrapper.className = 'geo-tool';
        wrapper.style.display = 'none';

        wrapper.innerHTML = `
            <div class="ruler-body" id="ruler-body">
                <canvas id="ruler-canvas" width="560" height="48"></canvas>
                <div class="ruler-rotate-handle" id="ruler-rotate" title="Ruota">&#8635;</div>
                <div class="ruler-close" id="ruler-close" title="Chiudi">&#215;</div>
            </div>`;

        document.body.appendChild(wrapper);

        this.el     = wrapper;
        this.body   = wrapper.querySelector('.ruler-body');
        this.canvas = wrapper.querySelector('#ruler-canvas');

        this._renderMarks();
        this._setupDrag();
        this._setupRotate();
        wrapper.querySelector('#ruler-close').addEventListener('click', () => this.hide());
    }

    // ------------------------------------------------------------------
    // Tacche millimetriche
    // ------------------------------------------------------------------

    _renderMarks() {
        const cvs = this.canvas;
        const ctx = cvs.getContext('2d');
        const W   = cvs.width;
        const H   = cvs.height;

        ctx.clearRect(0, 0, W, H);

        // Ogni 5px = 1 mm, ogni 50px = 1 cm
        for (let px = 0; px <= W; px += 5) {
            const isCm  = px % 50 === 0;
            const isMid = px % 25 === 0 && !isCm;  // mezzo cm

            const tickH = isCm ? 20 : isMid ? 13 : 7;
            const y0    = 0;
            const y1    = tickH;

            ctx.beginPath();
            ctx.moveTo(px, y0);
            ctx.lineTo(px, y1);
            ctx.strokeStyle = isCm
                ? 'rgba(80, 40, 0, 0.85)'
                : 'rgba(80, 40, 0, 0.55)';
            ctx.lineWidth = isCm ? 1.4 : 0.8;
            ctx.stroke();

            // Numero cm
            if (isCm && px > 0) {
                const cm = px / 50;
                ctx.font      = '10px Inter, sans-serif';
                ctx.fillStyle = 'rgba(60, 30, 0, 0.85)';
                ctx.textAlign = 'center';
                ctx.fillText(String(cm), px, tickH + 11);
            }
        }

        // Linea di bordo inferiore (riferimento per snap)
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.strokeStyle = 'rgba(80, 40, 0, 0.5)';
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    // ------------------------------------------------------------------
    // Visibilità
    // ------------------------------------------------------------------

    show() {
        this.el.style.display = 'block';
        this._applyTransform();
        this.visible = true;
    }

    hide() {
        this.el.style.display = 'none';
        this.visible = false;
    }

    // ------------------------------------------------------------------
    // Posizionamento & trasformazione
    // ------------------------------------------------------------------

    _applyTransform() {
        this.el.style.left = this.x + 'px';
        this.el.style.top  = this.y + 'px';
        this.body.style.transform = `rotate(${this.angle}deg)`;
        this._updateCenter();
    }

    _updateCenter() {
        const rect = this.body.getBoundingClientRect();
        this.cx = rect.left + rect.width  / 2;
        this.cy = rect.top  + rect.height / 2;
    }

    // ------------------------------------------------------------------
    // Drag principale (sposta il righello)
    // ------------------------------------------------------------------

    _setupDrag() {
        const body = this.body;

        const onStart = (e) => {
            // Non avviare il drag se si clicca su handle o chiudi
            if (e.target.id === 'ruler-rotate' || e.target.id === 'ruler-close') return;
            e.preventDefault();
            const pt = _getPoint(e);
            this._drag = {
                active: true,
                startX: pt.x,
                startY: pt.y,
                origX:  this.x,
                origY:  this.y
            };
            body.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!this._drag.active) return;
            e.preventDefault();
            const pt = _getPoint(e);
            this.x = this._drag.origX + (pt.x - this._drag.startX);
            this.y = this._drag.origY + (pt.y - this._drag.startY);
            this._applyTransform();
        };

        const onEnd = () => {
            if (!this._drag.active) return;
            this._drag.active = false;
            body.style.cursor = 'move';
            this._updateCenter();
        };

        body.addEventListener('pointerdown',  onStart);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onEnd);
    }

    // ------------------------------------------------------------------
    // Drag rotazione
    // ------------------------------------------------------------------

    _setupRotate() {
        const handle = this.el.querySelector('#ruler-rotate');

        const onStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._updateCenter();
            const pt = _getPoint(e);
            const dx = pt.x - this.cx;
            const dy = pt.y - this.cy;
            const mouseAngle = Math.atan2(dy, dx) * 180 / Math.PI;
            this._rot = {
                active:     true,
                startAngle: this.angle,
                startMouse: mouseAngle
            };
            handle.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!this._rot.active) return;
            e.preventDefault();
            const pt = _getPoint(e);
            const dx = pt.x - this.cx;
            const dy = pt.y - this.cy;
            const mouseAngle = Math.atan2(dy, dx) * 180 / Math.PI;
            this.angle = this._rot.startAngle + (mouseAngle - this._rot.startMouse);
            this._applyTransform();
        };

        const onEnd = () => {
            if (!this._rot.active) return;
            this._rot.active = false;
            handle.style.cursor = 'grab';
            this._updateCenter();
        };

        handle.addEventListener('pointerdown',  onStart);
        window.addEventListener('pointermove',  onMove);
        window.addEventListener('pointerup',    onEnd);
    }

    // ------------------------------------------------------------------
    // Snap alla retta del righello
    // ------------------------------------------------------------------

    /**
     * Proietta il punto (x, y) sulla retta definita dalla posizione
     * e dall'angolo corrente del righello.
     * @param {number} x
     * @param {number} y
     * @returns {{x: number, y: number}}
     */
    snapToRuler(x, y) {
        const rad = this.angle * Math.PI / 180;
        const dx  = x - this.cx;
        const dy  = y - this.cy;
        const proj = dx * Math.cos(rad) + dy * Math.sin(rad);
        return {
            x: this.cx + proj * Math.cos(rad),
            y: this.cy + proj * Math.sin(rad)
        };
    }
}


// =============================================================================
// ProtractorTool — goniometro semicircolare draggabile
// =============================================================================

class ProtractorTool {
    constructor() {
        this.el      = null;
        this.cvs     = null;
        this.visible = false;

        this.x = 200;
        this.y = 120;

        this._drag = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };
    }

    // ------------------------------------------------------------------
    // Creazione DOM
    // ------------------------------------------------------------------

    create() {
        const wrapper = document.createElement('div');
        wrapper.id        = 'protractor-tool';
        wrapper.className = 'geo-tool';
        wrapper.style.display = 'none';

        wrapper.innerHTML = `
            <canvas id="protractor-canvas" width="300" height="160"></canvas>
            <div class="geo-close" id="protractor-close" title="Chiudi">&#215;</div>`;

        document.body.appendChild(wrapper);

        this.el  = wrapper;
        this.cvs = wrapper.querySelector('#protractor-canvas');

        this._render();
        this._setupDrag();
        wrapper.querySelector('#protractor-close').addEventListener('click', () => this.hide());
    }

    // ------------------------------------------------------------------
    // Rendering semicerchio
    // ------------------------------------------------------------------

    _render() {
        const canvas = this.cvs;
        const ctx    = canvas.getContext('2d');
        const W      = canvas.width;
        const H      = canvas.height;
        const cx     = W / 2;
        const cy     = H - 10;
        const R      = H - 20;

        ctx.clearRect(0, 0, W, H);

        // Sfondo semicircolare semitrasparente
        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI, 0);
        ctx.lineTo(cx + R, cy);
        ctx.lineTo(cx - R, cy);
        ctx.closePath();
        ctx.fillStyle   = 'rgba(219, 234, 254, 0.70)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.80)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Diametro di base
        ctx.beginPath();
        ctx.moveTo(cx - R, cy);
        ctx.lineTo(cx + R, cy);
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.85)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Tacche e numeri
        for (let deg = 0; deg <= 180; deg += 5) {
            const rad     = (180 - deg) * Math.PI / 180;
            const isMajor = deg % 10 === 0;
            const len     = isMajor ? 15 : 8;

            ctx.beginPath();
            ctx.moveTo(
                cx + (R - len) * Math.cos(rad),
                cy - (R - len) * Math.sin(rad)
            );
            ctx.lineTo(
                cx + R * Math.cos(rad),
                cy - R * Math.sin(rad)
            );
            ctx.strokeStyle = 'rgba(30, 58, 138, 0.80)';
            ctx.lineWidth   = isMajor ? 1.5 : 0.8;
            ctx.stroke();

            if (isMajor) {
                const textR = R - 22;
                ctx.font      = '9px Inter, sans-serif';
                ctx.fillStyle = 'rgba(30, 58, 138, 0.90)';
                ctx.textAlign = 'center';
                ctx.fillText(
                    String(deg),
                    cx + textR * Math.cos(rad),
                    cy - textR * Math.sin(rad) + 3
                );
            }
        }

        // Punto centrale
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.90)';
        ctx.fill();
    }

    // ------------------------------------------------------------------
    // Visibilità
    // ------------------------------------------------------------------

    show() {
        this.el.style.display = 'block';
        this.el.style.left    = this.x + 'px';
        this.el.style.top     = this.y + 'px';
        this.visible = true;
    }

    hide() {
        this.el.style.display = 'none';
        this.visible = false;
    }

    // ------------------------------------------------------------------
    // Drag
    // ------------------------------------------------------------------

    _setupDrag() {
        const el = this.el;

        const onStart = (e) => {
            if (e.target.id === 'protractor-close') return;
            e.preventDefault();
            const pt = _getPoint(e);
            this._drag = {
                active: true,
                startX: pt.x,
                startY: pt.y,
                origX:  this.x,
                origY:  this.y
            };
            el.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!this._drag.active) return;
            e.preventDefault();
            const pt = _getPoint(e);
            this.x = this._drag.origX + (pt.x - this._drag.startX);
            this.y = this._drag.origY + (pt.y - this._drag.startY);
            el.style.left = this.x + 'px';
            el.style.top  = this.y + 'px';
        };

        const onEnd = () => {
            if (!this._drag.active) return;
            this._drag.active = false;
            el.style.cursor = 'move';
        };

        el.addEventListener('pointerdown',  onStart);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onEnd);
    }
}


// =============================================================================
// CompassTool — compasso a 2 fasi (centro + raggio)
// =============================================================================

class CompassTool {
    constructor() {
        this.active = false;
        this.phase  = 0;   // 0=inattivo, 1=aspetta centro, 2=aspetta raggio
        this.cx     = 0;
        this.cy     = 0;
        this.radius = 0;
    }

    activate() {
        this.active = true;
        this.phase  = 1;
        document.getElementById('draw-canvas').style.cursor = 'crosshair';
        toast('Compasso: clicca per impostare il centro', 'info');
    }

    deactivate() {
        this.active = false;
        this.phase  = 0;
        document.getElementById('draw-canvas').style.cursor = 'crosshair';
        const overlay = document.getElementById('overlay-canvas');
        overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    }

    handleStart(x, y) {
        if (this.phase === 1) {
            this.cx    = x;
            this.cy    = y;
            this.phase = 2;
            toast('Trascina per impostare il raggio', 'info');
        }
    }

    handleMove(x, y) {
        if (this.phase !== 2) return;
        this.radius = Math.hypot(x - this.cx, y - this.cy);

        const overlay = document.getElementById('overlay-canvas');
        const ctx     = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        ctx.save();
        ctx.strokeStyle = CONFIG.currentColor;
        ctx.globalAlpha = 0.7;

        // Punto centrale
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, 4, 0, Math.PI * 2);
        ctx.stroke();

        // Linea raggio tratteggiata
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Cerchio preview
        ctx.setLineDash([]);
        ctx.lineWidth = CONFIG.currentSize;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    handleEnd() {
        if (this.phase !== 2 || this.radius < 5) {
            // Raggio troppo piccolo: resta in fase 1 per nuovo centro
            this.phase = 1;
            const overlay = document.getElementById('overlay-canvas');
            overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
            return;
        }

        // Disegna definitivamente sul draw canvas
        canvasMgr._saveUndo();
        const ctx = canvasMgr.ctx;
        ctx.save();
        ctx.strokeStyle = CONFIG.currentColor;
        ctx.lineWidth   = CONFIG.currentSize;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Pulisce overlay
        const overlay = document.getElementById('overlay-canvas');
        overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);

        // Torna in fase 1 per un altro cerchio
        this.phase = 1;
        toast('Cerchio disegnato! Clicca per un nuovo centro', 'info');
    }
}


// =============================================================================
// GeometryManager — controller principale
// =============================================================================

class GeometryManager {
    constructor() {
        this._injectCSS();
        this.ruler      = new RulerTool();
        this.protractor = new ProtractorTool();
        this.compass    = new CompassTool();

        this.ruler.create();
        this.protractor.create();

        this._injectToolbarButtons();
        this._setupButtons();
        this._patchCanvasManager();
    }

    // ------------------------------------------------------------------
    // CSS iniettato dinamicamente (alternativa: copiarlo in style.css)
    // ------------------------------------------------------------------

    _injectCSS() {
        const style = document.createElement('style');
        style.id    = 'geometry-css';
        style.textContent = `
/* ============================================================
   EduBoard v2 — Strumenti geometrici (geometry.js)
   ============================================================ */

/* --- Contenitore comune --- */
.geo-tool {
    position: fixed;
    z-index: 180;
    user-select: none;
    touch-action: none;
    cursor: move;
}

/* ============================================================
   RIGHELLO
   ============================================================ */

#ruler-tool {
    /* posizione gestita via JS */
}

.ruler-body {
    position: relative;
    width: 600px;
    height: 48px;
    background: rgba(212, 160, 23, 0.82);
    border: 1.5px solid rgba(160, 110, 5, 0.90);
    border-radius: 4px;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.30);
    display: flex;
    align-items: flex-start;
    overflow: visible;
    transform-origin: center center;
}

#ruler-canvas {
    display: block;
    pointer-events: none;
    /* Il canvas delle tacche occupa la parte sinistra del corpo */
    flex: 1;
}

.ruler-rotate-handle {
    position: absolute;
    right: 22px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    cursor: grab;
    color: rgba(80, 40, 0, 0.85);
    font-size: 20px;
    line-height: 1;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}

.ruler-rotate-handle:active {
    cursor: grabbing;
}

.ruler-close {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.30);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    color: #fff;
    line-height: 1;
    z-index: 3;
}

.ruler-close:hover {
    background: rgba(0, 0, 0, 0.55);
}

/* ============================================================
   GONIOMETRO
   ============================================================ */

#protractor-tool {
    position: fixed;
}

#protractor-canvas {
    display: block;
    pointer-events: none;
}

.geo-close {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.30);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 13px;
    color: #fff;
    line-height: 1;
    z-index: 3;
}

.geo-close:hover {
    background: rgba(0, 0, 0, 0.55);
}

/* ============================================================
   GRUPPO GEOMETRIA NELLA TOOLBAR
   ============================================================ */

#geo-tool-group .tool-btn.geo-active {
    background: rgba(59, 130, 246, 0.20);
    color: #93c5fd;
}
        `;
        document.head.appendChild(style);
    }

    // ------------------------------------------------------------------
    // Inietta il gruppo pulsanti nella toolbar
    // ------------------------------------------------------------------

    _injectToolbarButtons() {
        // Trova la .main-row nella toolbar per appendere il separatore + gruppo
        const mainRow = document.querySelector('.toolbar-row.main-row');
        if (!mainRow) return;

        const sep = document.createElement('div');
        sep.className = 'tool-separator';

        const group = document.createElement('div');
        group.className = 'tool-group';
        group.id        = 'geo-tool-group';
        group.innerHTML = `
            <button class="tool-btn" data-tool="ruler" id="btn-geo-ruler" title="Righello">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="2" y="8" width="20" height="8" rx="1.5"/>
                    <line x1="6"  y1="8" x2="6"  y2="12"/>
                    <line x1="9"  y1="8" x2="9"  y2="11"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="15" y1="8" x2="15" y2="11"/>
                    <line x1="18" y1="8" x2="18" y2="12"/>
                </svg>
                <span>Righello</span>
            </button>
            <button class="tool-btn" data-tool="protractor" id="btn-geo-protractor" title="Goniometro">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M3 18 A9 9 0 0 1 21 18"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                    <line x1="12" y1="9"  x2="12" y2="18"/>
                    <line x1="7"  y1="11" x2="8.5" y2="13.5"/>
                    <line x1="17" y1="11" x2="15.5" y2="13.5"/>
                </svg>
                <span>Goniometro</span>
            </button>
            <button class="tool-btn" data-tool="compass" id="btn-geo-compass" title="Compasso">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <circle cx="12" cy="12" r="2"/>
                    <line x1="12" y1="2"  x2="12" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="22"/>
                    <line x1="2"  y1="12" x2="10" y2="12"/>
                    <line x1="14" y1="12" x2="22" y2="12"/>
                </svg>
                <span>Compasso</span>
            </button>`;

        mainRow.appendChild(sep);
        mainRow.appendChild(group);
    }

    // ------------------------------------------------------------------
    // Collegamento pulsanti
    // ------------------------------------------------------------------

    _setupButtons() {
        const btnRuler      = document.getElementById('btn-geo-ruler');
        const btnProtractor = document.getElementById('btn-geo-protractor');
        const btnCompass    = document.getElementById('btn-geo-compass');

        if (btnRuler) {
            btnRuler.addEventListener('click', () => {
                if (this.ruler.visible) {
                    this.ruler.hide();
                    btnRuler.classList.remove('geo-active');
                } else {
                    this.showRuler();
                    btnRuler.classList.add('geo-active');
                }
            });
        }

        if (btnProtractor) {
            btnProtractor.addEventListener('click', () => {
                if (this.protractor.visible) {
                    this.protractor.hide();
                    btnProtractor.classList.remove('geo-active');
                } else {
                    this.showProtractor();
                    btnProtractor.classList.add('geo-active');
                }
            });
        }

        if (btnCompass) {
            btnCompass.addEventListener('click', () => {
                // Compasso è uno strumento di disegno: cambia CONFIG.currentTool
                if (CONFIG.currentTool === 'compass' && this.compass.active) {
                    this._deactivateCompass(btnCompass);
                } else {
                    this._activateCompass(btnCompass);
                }
            });
        }
    }

    _activateCompass(btn) {
        // Deseleziona altri tool-btn
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        CONFIG.currentTool = 'compass';
        this.compass.activate();
    }

    _deactivateCompass(btn) {
        btn.classList.remove('active');
        CONFIG.currentTool = 'pen';
        this.compass.deactivate();
        // Ripristina il cursore
        const penBtn = document.querySelector('.tool-btn[data-tool="pen"]');
        if (penBtn) {
            penBtn.classList.add('active');
        }
        document.getElementById('draw-canvas').style.cursor = 'crosshair';
    }

    // ------------------------------------------------------------------
    // Patch del CanvasManager per intercettare il compasso e lo snap
    // al righello durante la penna
    // ------------------------------------------------------------------

    _patchCanvasManager() {
        // Aspetta che canvasMgr esista (geometry.js caricato dopo app.js,
        // ma potrebbe essere chiamato prima del DOMContentLoaded di app.js)
        if (typeof canvasMgr === 'undefined' || !canvasMgr) {
            // Riprova dopo un tick
            setTimeout(() => this._patchCanvasManager(), 50);
            return;
        }

        const mgr = canvasMgr;
        const geo  = this;

        // Salva i metodi originali
        const origStart = mgr._onStart.bind(mgr);
        const origMove  = mgr._onMove.bind(mgr);
        const origEnd   = mgr._onEnd.bind(mgr);

        mgr._onStart = function(e) {
            if (CONFIG.currentTool === 'compass' && geo.compass.active) {
                const { x, y } = mgr.getCoords(e);
                geo.compass.handleStart(x, y);
                CONFIG.isDrawing = true;
                return;
            }
            origStart(e);
        };

        mgr._onMove = function(e) {
            if (CONFIG.currentTool === 'compass' && geo.compass.active) {
                if (!CONFIG.isDrawing) return;
                const { x, y } = mgr.getCoords(e);
                geo.compass.handleMove(x, y);
                return;
            }

            // Snap al righello per penna/matita/pastello
            if (geo.ruler.visible && CONFIG.isDrawing &&
                ['pen', 'pencil', 'pastel', 'marker'].includes(CONFIG.currentTool)) {

                // Override getCoords temporaneamente con lo snap
                const origGetCoords = mgr.getCoords.bind(mgr);
                mgr.getCoords = (ev) => {
                    const raw = origGetCoords(ev);
                    const snapped = geo.ruler.snapToRuler(raw.x, raw.y);
                    mgr.getCoords = origGetCoords; // ripristina subito
                    return snapped;
                };
            }

            origMove(e);
        };

        mgr._onEnd = function(e) {
            if (CONFIG.currentTool === 'compass' && geo.compass.active) {
                geo.compass.handleEnd();
                CONFIG.isDrawing = false;
                return;
            }
            origEnd(e);
        };
    }

    // ------------------------------------------------------------------
    // API pubblica
    // ------------------------------------------------------------------

    showRuler() {
        this.ruler.show();
    }

    hideRuler() {
        this.ruler.hide();
    }

    showProtractor() {
        this.protractor.show();
    }

    hideProtractor() {
        this.protractor.hide();
    }

    showCompass() {
        const btn = document.getElementById('btn-geo-compass');
        this._activateCompass(btn);
    }
}


// =============================================================================
// Utility condivisa: coordinate unificate mouse / touch / pointer
// =============================================================================

function _getPoint(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}


// =============================================================================
// INIT — viene eseguito a DOMContentLoaded (geometry.js caricato dopo app.js)
// =============================================================================

// NOTA PER L'INTEGRAZIONE IN app.js:
// ─────────────────────────────────────────────────────────────────────────────
// 1. Aggiungere in index.html PRIMA di </body>, DOPO <script src="app.js">:
//        <script src="geometry.js"></script>
//
// 2. Aggiungere nella SEZIONE 12 di app.js, nella dichiarazione let globale:
//        let bgMgr, brush, laserMgr, canvasMgr, toolbarMgr, textMgr, projectMgr, geoMgr;
//
// 3. Aggiungere in DOMContentLoaded di app.js, DOPO setupKeyboard():
//        geoMgr = new GeometryManager();
//
// Oppure, in alternativa senza modificare app.js, geometry.js si auto-inizializza
// qui sotto all'evento DOMContentLoaded (se il DOM non è ancora pronto)
// oppure immediatamente (se lo script è caricato dopo il parsing del body).
// ─────────────────────────────────────────────────────────────────────────────

(function autoInit() {
    // Se geometry.js è caricato DOPO app.js (come da design),
    // canvasMgr potrebbe non essere ancora pronto al momento del parsing
    // ma lo sarà dopo il DOMContentLoaded di app.js.
    // La dichiarazione globale permette ai callback di app.js di trovarlo.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Piccolo delay per lasciare che app.js completi il suo DOMContentLoaded
            setTimeout(() => {
                if (typeof geoMgr === 'undefined') {
                    window.geoMgr = new GeometryManager();
                }
            }, 0);
        });
    } else {
        // DOM già pronto (script eseguito dopo il parsing)
        if (typeof geoMgr === 'undefined') {
            window.geoMgr = new GeometryManager();
        }
    }
})();
