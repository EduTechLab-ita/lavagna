/**
 * EduBoard v2 — Lavagna digitale interattiva per la scuola
 * Architettura: 3 canvas sovrapposti (bg, draw, overlay)
 * NO import/export — script tag normale, classi ES6
 */

'use strict';

// =============================================================================
// SEZIONE 1 — CONFIG GLOBALE
// =============================================================================

const CONFIG = {
    currentTool: 'pen',
    currentColor: '#000000',
    currentSize: 3,
    currentShape: 'line',
    shapeFill: false,
    currentBg: 'white',
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    shapeStartX: 0,
    shapeStartY: 0,
    shapeSnapshot: null,  // ImageData per preview live forme
    undoStack: [],
    redoStack: [],
    maxUndo: 50,
    toolbarVisible: false,
    projectName: 'Nuova Lavagna',
    // Strumenti che usano colore + dimensione
    drawTools: ['pen', 'pencil', 'pastel', 'marker', 'eraser'],
};

// =============================================================================
// SEZIONE 2 — BackgroundManager
// Gestisce il canvas di sfondo (#bg-canvas): colori, righe, griglie, immagini
// =============================================================================

class BackgroundManager {
    constructor() {
        this.canvas = document.getElementById('bg-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentBg = 'white';
        this.uploadedImage = null; // HTMLImageElement se caricata foto
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Sfondo bianco base sempre presente
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        if (this.uploadedImage) {
            // Cover: scala per coprire tutto mantenendo proporzioni
            const img = this.uploadedImage;
            const scaleX = W / img.width;
            const scaleY = H / img.height;
            const scale = Math.max(scaleX, scaleY);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (W - w) / 2;
            const y = (H - h) / 2;
            ctx.globalAlpha = 0.9;
            ctx.drawImage(img, x, y, w, h);
            ctx.globalAlpha = 1;
            return;
        }

        // Sfondi predefiniti
        ctx.strokeStyle = '#bfdbfe'; // blue-200 — elegante e leggero
        ctx.lineWidth = 1;

        switch (this.currentBg) {
            case 'lines-8': // 8mm ≈ 30px a 96dpi
                this._drawLines(ctx, W, H, 30);
                break;
            case 'lines-5': // 5mm ≈ 19px
                this._drawLines(ctx, W, H, 19);
                break;
            case 'lines-3': // 3mm ≈ 11px
                this._drawLines(ctx, W, H, 11);
                break;
            case 'grid-10': // quadretti 10mm ≈ 38px
                this._drawGrid(ctx, W, H, 38);
                break;
            case 'grid-5': // quadretti 5mm ≈ 19px
                this._drawGrid(ctx, W, H, 19);
                break;
            case 'dots':
                this._drawDots(ctx, W, H, 20);
                break;
            case 'staff': // pentagramma musicale
                this._drawStaff(ctx, W, H);
                break;
            // 'white': solo bianco (già fatto sopra)
        }
    }

    _drawLines(ctx, W, H, spacing) {
        for (let y = spacing; y < H; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    _drawGrid(ctx, W, H, spacing) {
        ctx.strokeStyle = '#dbeafe'; // più leggero per le colonne
        for (let x = spacing; x < W; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        ctx.strokeStyle = '#bfdbfe';
        for (let y = spacing; y < H; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    _drawDots(ctx, W, H, spacing) {
        ctx.fillStyle = '#94a3b8';
        for (let x = spacing; x < W; x += spacing) {
            for (let y = spacing; y < H; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _drawStaff(ctx, W, H) {
        // Gruppi da 5 righe con spazio più grande tra i gruppi
        const lineSpacing = 12;  // tra le righe del pentagramma
        const groupSpacing = 60; // tra un pentagramma e il successivo
        let y = groupSpacing;
        while (y + lineSpacing * 4 < H) {
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(0, y + i * lineSpacing);
                ctx.lineTo(W, y + i * lineSpacing);
                ctx.stroke();
            }
            y += lineSpacing * 4 + groupSpacing;
        }
    }

    setBackground(bgKey) {
        this.currentBg = bgKey;
        this.uploadedImage = null;
        this.render();
        CONFIG.currentBg = bgKey;
    }

    setImage(imgElement) {
        this.uploadedImage = imgElement;
        this.currentBg = 'image';
        this.render();
    }
}

// =============================================================================
// SEZIONE 3 — BrushEngine
// Contiene i metodi per disegnare ogni tipo di pennello. NON accede al DOM.
// =============================================================================

class BrushEngine {

    // Penna liscia — tratto netto e scorrevole
    pen(ctx, x0, y0, x1, y1, size, color) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
    }

    // Matita HB — tratto granuloso, leggermente irregolare
    pencil(ctx, x0, y0, x1, y1, size, color) {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist * 1.5));
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x0 + t * (x1 - x0);
            const y = y0 + t * (y1 - y0);
            // 4-6 punti per step, dispersi casualmente
            const numDots = Math.floor(size * 0.7) + 3;
            for (let d = 0; d < numDots; d++) {
                const spread = size * 0.45;
                const dx = (Math.random() - 0.5) * spread;
                const dy = (Math.random() - 0.5) * spread;
                const dotR = Math.random() * size * 0.11 + size * 0.04;
                ctx.globalAlpha = Math.random() * 0.45 + 0.2;
                ctx.beginPath();
                ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Pastello morbido — sfumato con strati multipli (no filter:blur per performance)
    pastel(ctx, x0, y0, x1, y1, size, color) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;
        ctx.globalCompositeOperation = 'source-over';
        const layers = [
            { w: size * 3.5, a: 0.022 },
            { w: size * 2.5, a: 0.035 },
            { w: size * 1.8, a: 0.055 },
            { w: size * 1.2, a: 0.08  },
            { w: size * 0.7, a: 0.12  },
            { w: size * 0.35, a: 0.18 },
        ];
        layers.forEach(({ w, a }) => {
            ctx.globalAlpha = a;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        });
        ctx.restore();
    }

    // Evidenziatore — tratto largo e semitrasparente
    marker(ctx, x0, y0, x1, y1, size, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = size * 2.5;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
    }

    // Gomma — cancella usando destination-out (mostra il bg-canvas sotto)
    eraser(ctx, x, y, size) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Forme geometriche — disegna su ctx passato, con colore e spessore dati
    shape(ctx, type, x0, y0, x1, y1, size, color, fill) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 1;
        ctx.beginPath();

        switch (type) {
            case 'line':
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                break;

            case 'rect':
                if (fill) {
                    ctx.globalAlpha = 0.15;
                    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                    ctx.globalAlpha = 1;
                }
                ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
                break;

            case 'circle': {
                const rx = Math.abs(x1 - x0) / 2;
                const ry = Math.abs(y1 - y0) / 2;
                const cx = (x0 + x1) / 2;
                const cy = (y0 + y1) / 2;
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                if (fill) {
                    ctx.globalAlpha = 0.15;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                ctx.stroke();
                break;
            }

            case 'triangle': {
                const mx = (x0 + x1) / 2;
                ctx.moveTo(mx, y0);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x0, y1);
                ctx.closePath();
                if (fill) {
                    ctx.globalAlpha = 0.15;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                ctx.stroke();
                break;
            }

            case 'arrow': {
                const dx = x1 - x0;
                const dy = y1 - y0;
                const len = Math.hypot(dx, dy);
                if (len === 0) break;
                const ux = dx / len;
                const uy = dy / len;
                const headLen = Math.min(30, len * 0.35);
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 - headLen * (ux - uy * 0.4), y1 - headLen * (uy + ux * 0.4));
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 - headLen * (ux + uy * 0.4), y1 - headLen * (uy - ux * 0.4));
                ctx.stroke();
                break;
            }

            case 'star': {
                const cx2 = (x0 + x1) / 2;
                const cy2 = (y0 + y1) / 2;
                const outerR = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
                const innerR = outerR * 0.4;
                for (let i = 0; i < 10; i++) {
                    const angle = (i * Math.PI) / 5 - Math.PI / 2;
                    const r = i % 2 === 0 ? outerR : innerR;
                    if (i === 0) {
                        ctx.moveTo(cx2 + r * Math.cos(angle), cy2 + r * Math.sin(angle));
                    } else {
                        ctx.lineTo(cx2 + r * Math.cos(angle), cy2 + r * Math.sin(angle));
                    }
                }
                ctx.closePath();
                if (fill) {
                    ctx.globalAlpha = 0.15;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                ctx.stroke();
                break;
            }
        }

        ctx.restore();
    }
}

// =============================================================================
// SEZIONE 4 — LaserManager
// Effetto laser rosso con trail che svanisce. Usa #overlay-canvas.
// =============================================================================

class LaserManager {
    constructor(overlayCanvas) {
        this.canvas = overlayCanvas;
        this.ctx = overlayCanvas.getContext('2d');
        this.points = []; // { x, y, t }
        this.animFrame = null;
        this.active = false;
    }

    addPoint(x, y) {
        this.points.push({ x, y, t: performance.now() });
        if (!this.animFrame) this._animate();
    }

    stop() {
        // Continua l'animazione finché i punti svaniscono da soli
    }

    _animate() {
        const now = performance.now();
        const lifetime = 700; // ms prima che un punto sparisca
        this.points = this.points.filter(p => now - p.t < lifetime);

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.points.length === 0) {
            this.animFrame = null;
            return;
        }

        // Disegna cerchio rosso con glow sull'ultimo punto
        const last = this.points[this.points.length - 1];
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ff3333';
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Disegna trail che svanisce
        if (this.points.length > 1) {
            for (let i = 0; i < this.points.length - 1; i++) {
                const p = this.points[i];
                const age = (now - p.t) / lifetime;
                const alpha = (1 - age) * 0.5;
                const r = 4 * (1 - age * 0.7);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        this.animFrame = requestAnimationFrame(() => this._animate());
    }

    clear() {
        this.points = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
    }
}

// =============================================================================
// SEZIONE 5 — CanvasManager
// Gestisce draw-canvas, eventi mouse/touch, undo/redo.
// Dipende da: bgMgr, brush, laserMgr (globali); toolbarMgr, textMgr (globali post-init)
// =============================================================================

class CanvasManager {
    constructor(bgMgr, brush, laserMgr) {
        this.bgMgr = bgMgr;
        this.brush = brush;
        this.laser = laserMgr;

        this.canvas = document.getElementById('draw-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.undoStack = [];
        this.redoStack = [];

        this._setupEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const W = window.innerWidth;
        const H = window.innerHeight - 56; // 56px header

        // Salva disegno prima del resize
        const savedURL = this.canvas.width > 0 ? this.canvas.toDataURL() : null;
        const prevW = this.canvas.width;

        this.canvas.width = W;
        this.canvas.height = H;
        this.overlayCanvas.width = W;
        this.overlayCanvas.height = H;
        this.bgMgr.resize(W, H);
        this.laser.resize(W, H);

        // Ripristina disegno scalato al nuovo size
        if (savedURL && prevW > 0) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, W, H);
            };
            img.src = savedURL;
        }
    }

    getCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        if (e.touches) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _setupEvents() {
        const el = this.canvas;
        // Mouse
        el.addEventListener('mousedown',  e => this._onStart(e));
        el.addEventListener('mousemove',  e => this._onMove(e));
        el.addEventListener('mouseup',    e => this._onEnd(e));
        el.addEventListener('mouseleave', e => this._onEnd(e));
        // Touch
        el.addEventListener('touchstart', e => { e.preventDefault(); this._onStart(e); }, { passive: false });
        el.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(e);  }, { passive: false });
        el.addEventListener('touchend',   e => { e.preventDefault(); this._onEnd(e);   }, { passive: false });
    }

    _onStart(e) {
        const { x, y } = this.getCoords(e);
        CONFIG.isDrawing = true;

        // Auto-hide toolbar quando si inizia a disegnare
        toolbarMgr.hide();

        if (CONFIG.currentTool === 'laser') {
            this.laser.addPoint(x, y);
            return;
        }
        if (CONFIG.currentTool === 'text') {
            textMgr.placeInput(x, y);
            CONFIG.isDrawing = false;
            return;
        }
        if (CONFIG.currentTool === 'shape') {
            CONFIG.shapeStartX = x;
            CONFIG.shapeStartY = y;
            CONFIG.shapeSnapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        // Tutti gli altri strumenti: salva undo state all'inizio del tratto
        this._saveUndo();
        CONFIG.lastX = x;
        CONFIG.lastY = y;

        // Disegna il punto iniziale (dot)
        if (CONFIG.currentTool === 'eraser') {
            this.brush.eraser(this.ctx, x, y, CONFIG.currentSize * 2);
        } else {
            this._drawSegment(x, y, x, y);
        }
    }

    _onMove(e) {
        if (!CONFIG.isDrawing) return;
        const { x, y } = this.getCoords(e);

        if (CONFIG.currentTool === 'laser') {
            this.laser.addPoint(x, y);
            return;
        }
        if (CONFIG.currentTool === 'shape') {
            // Preview live: ripristina snapshot + disegna forma aggiornata
            this.ctx.putImageData(CONFIG.shapeSnapshot, 0, 0);
            this.brush.shape(
                this.ctx,
                CONFIG.currentShape,
                CONFIG.shapeStartX, CONFIG.shapeStartY,
                x, y,
                CONFIG.currentSize,
                CONFIG.currentColor,
                CONFIG.shapeFill
            );
            return;
        }

        if (CONFIG.currentTool === 'eraser') {
            this.brush.eraser(this.ctx, x, y, CONFIG.currentSize * 2);
        } else {
            this._drawSegment(CONFIG.lastX, CONFIG.lastY, x, y);
        }

        CONFIG.lastX = x;
        CONFIG.lastY = y;
    }

    _onEnd(e) {
        if (!CONFIG.isDrawing) return;
        CONFIG.isDrawing = false;

        if (CONFIG.currentTool === 'laser') {
            this.laser.stop();
            return;
        }
        if (CONFIG.currentTool === 'shape') {
            // La forma è già sul canvas (dall'ultimo _onMove)
            this._saveUndo(); // salva DOPO aver disegnato la forma
            CONFIG.shapeSnapshot = null;
            return;
        }
    }

    _drawSegment(x0, y0, x1, y1) {
        const tool  = CONFIG.currentTool;
        const color = CONFIG.currentColor;
        const size  = CONFIG.currentSize;

        switch (tool) {
            case 'pen':    this.brush.pen(this.ctx, x0, y0, x1, y1, size, color);    break;
            case 'pencil': this.brush.pencil(this.ctx, x0, y0, x1, y1, size, color); break;
            case 'pastel': this.brush.pastel(this.ctx, x0, y0, x1, y1, size, color); break;
            case 'marker': this.brush.marker(this.ctx, x0, y0, x1, y1, size, color); break;
        }
    }

    _saveUndo() {
        this.undoStack.push(this.canvas.toDataURL());
        if (this.undoStack.length > CONFIG.maxUndo) this.undoStack.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(this.canvas.toDataURL());
        const prev = this.undoStack.pop();
        this._loadURL(prev);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(this.canvas.toDataURL());
        const next = this.redoStack.pop();
        this._loadURL(next);
    }

    _loadURL(url) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = url;
    }

    clear() {
        this._saveUndo();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.laser.clear();
    }

    exportPNG() {
        // Componi bg + draw in un canvas temporaneo per l'export
        const tmp = document.createElement('canvas');
        tmp.width  = this.canvas.width;
        tmp.height = this.canvas.height;
        const tCtx = tmp.getContext('2d');
        tCtx.drawImage(this.bgMgr.canvas, 0, 0);
        tCtx.drawImage(this.canvas, 0, 0);
        const url = tmp.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = (CONFIG.projectName || 'eduboard') + '.png';
        a.click();
    }

    getDataURL() {
        return this.canvas.toDataURL();
    }
}

// =============================================================================
// SEZIONE 6 — ToolbarManager
// Gestisce la toolbar a scomparsa, la selezione strumenti, i pannelli opzioni.
// Dipende da: canvasMgr, bgMgr (globali post-init)
// =============================================================================

class ToolbarManager {
    constructor() {
        this.wrapper    = document.getElementById('toolbar-wrapper');
        this.toggleBtn  = document.getElementById('toolbar-toggle');
        this.optionsRow = document.getElementById('tool-options-row');
        this.visible    = false;

        this._setupToggle();
        this._setupTools();
        this._setupColors();
        this._setupSizes();
        this._setupShapePanel();
        this._setupBgPanel();
    }

    show() {
        this.visible = true;
        this.wrapper.classList.add('visible');
        this.toggleBtn.querySelector('#toggle-arrow').style.transform = 'rotate(180deg)';
    }

    hide() {
        this.visible = false;
        this.wrapper.classList.remove('visible');
        this.toggleBtn.querySelector('#toggle-arrow').style.transform = 'rotate(0deg)';
        this._closeAllPopups();
    }

    toggle() {
        if (this.visible) this.hide(); else this.show();
    }

    _setupToggle() {
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
    }

    _setupTools() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectTool(btn.dataset.tool, btn);
            });
        });

        document.getElementById('btn-undo').addEventListener('click',  () => canvasMgr.undo());
        document.getElementById('btn-redo').addEventListener('click',  () => canvasMgr.redo());
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Cancellare tutto il disegno?')) canvasMgr.clear();
        });
    }

    _selectTool(tool, btn) {
        // Chiudi popup aperti
        this._closeAllPopups();

        if (tool === 'background') {
            this._togglePopup('bg-popup', btn);
            return;
        }
        if (tool === 'shape') {
            this._togglePopup('shape-popup', btn);
            CONFIG.currentTool = 'shape';
            this._updateActiveBtn(btn);
            this._updateOptionsRow();
            return;
        }
        if (tool === 'upload-bg') {
            document.getElementById('file-bg-input').click();
            return;
        }

        CONFIG.currentTool = tool;
        this._updateActiveBtn(btn);
        this._updateOptionsRow();
        this._updateCursor();
    }

    _updateActiveBtn(activeBtn) {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
            b.classList.remove('active');
        });
        if (activeBtn) activeBtn.classList.add('active');
    }

    _updateOptionsRow() {
        const tool = CONFIG.currentTool;
        const showOptions = ['pen', 'pencil', 'pastel', 'marker', 'eraser', 'shape', 'text'].includes(tool);
        this.optionsRow.style.display = showOptions ? 'flex' : 'none';

        // Nascondi colori per strumenti che non ne hanno bisogno
        const showColors = !['eraser', 'laser'].includes(tool);
        document.getElementById('options-colors').style.display = showColors ? 'flex' : 'none';
        const divider = document.querySelector('.options-divider');
        if (divider) divider.style.display = showColors ? 'block' : 'none';
    }

    _updateCursor() {
        const canvas = document.getElementById('draw-canvas');
        const cursorMap = {
            pen:    'crosshair',
            pencil: 'crosshair',
            pastel: 'crosshair',
            marker: 'crosshair',
            eraser: 'cell',
            text:   'text',
            laser:  'none',
            shape:  'crosshair',
        };
        canvas.style.cursor = cursorMap[CONFIG.currentTool] || 'default';
    }

    _setupColors() {
        document.querySelectorAll('.color-swatch').forEach(btn => {
            if (btn.id === 'color-custom') return;
            btn.addEventListener('click', () => {
                CONFIG.currentColor = btn.dataset.color;
                document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('color-custom').addEventListener('click', () => {
            document.getElementById('color-picker-input').click();
        });

        document.getElementById('color-picker-input').addEventListener('input', (e) => {
            CONFIG.currentColor = e.target.value;
            const customBtn = document.getElementById('color-custom');
            customBtn.style.background = e.target.value;
            document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            customBtn.classList.add('active');
        });
    }

    _setupSizes() {
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                CONFIG.currentSize = parseInt(btn.dataset.size);
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    _setupShapePanel() {
        document.querySelectorAll('.shape-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                CONFIG.currentShape = btn.dataset.shape;
                document.querySelectorAll('.shape-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._closeAllPopups();
            });
        });

        document.getElementById('shape-fill-check').addEventListener('change', (e) => {
            CONFIG.shapeFill = e.target.checked;
        });
    }

    _setupBgPanel() {
        document.querySelectorAll('.bg-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                bgMgr.setBackground(btn.dataset.bg);
                document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._closeAllPopups();
                toast('Sfondo aggiornato');
            });
        });

        document.getElementById('file-bg-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    bgMgr.setImage(img);
                    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
                    toast('Immagine sfondo caricata');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = ''; // reset per consentire ri-selezione stessa immagine
        });
    }

    _togglePopup(id, triggerBtn) {
        const popup = document.getElementById(id);
        const isVisible = popup.style.display !== 'none';
        this._closeAllPopups();
        if (!isVisible) {
            popup.style.display = 'block';
            // Posiziona popup sopra la toolbar
            const tbRect = this.wrapper.getBoundingClientRect();
            popup.style.bottom = (window.innerHeight - tbRect.top + 12) + 'px';
        }
    }

    _closeAllPopups() {
        document.getElementById('shape-popup').style.display = 'none';
        document.getElementById('bg-popup').style.display = 'none';
    }
}

// =============================================================================
// SEZIONE 7 — TextManager
// Gestisce l'input testo inline (no prompt!).
// Dipende da: canvasMgr (globale post-init)
// =============================================================================

class TextManager {
    constructor() {
        this.el     = document.getElementById('text-cursor');
        this.active = false;
        this._setup();
    }

    _setup() {
        this.el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._commit();
            }
            if (e.key === 'Escape') {
                this._cancel();
            }
        });

        // Click sul canvas mentre si sta scrivendo: conferma il testo
        document.getElementById('draw-canvas').addEventListener('mousedown', () => {
            if (this.active) this._commit();
        });
    }

    placeInput(x, y) {
        this.active = true;
        const el = this.el;
        el.style.display   = 'block';
        el.style.left      = x + 'px';
        el.style.top       = (y + 56 - 24) + 'px'; // 56=header, 24=line-height offset
        el.style.fontSize  = Math.max(16, CONFIG.currentSize * 3) + 'px';
        el.style.color     = CONFIG.currentColor;
        el.innerText       = '';
        el.focus();
        // Posiziona il cursore alla fine del contenuto
        const range = document.createRange();
        const sel   = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    _commit() {
        if (!this.active) return;
        const text = this.el.innerText.trim();
        const x    = parseInt(this.el.style.left);
        const y    = parseInt(this.el.style.top) - 56 + 24;

        if (text) {
            const ctx = canvasMgr.ctx;
            canvasMgr._saveUndo();
            ctx.save();
            ctx.font      = `${Math.max(16, CONFIG.currentSize * 3)}px Inter, sans-serif`;
            ctx.fillStyle = CONFIG.currentColor;
            ctx.globalAlpha = 1;
            // Supporto testo multilinea (Shift+Enter)
            const lines = text.split('\n');
            const lineH = Math.max(16, CONFIG.currentSize * 3) * 1.3;
            lines.forEach((line, i) => {
                ctx.fillText(line, x, y + i * lineH);
            });
            ctx.restore();
        }

        this._cancel();
    }

    _cancel() {
        this.active      = false;
        this.el.style.display = 'none';
        this.el.innerText    = '';
    }
}

// =============================================================================
// SEZIONE 8 — ProjectManager
// Salvataggio su LocalStorage ed esportazione.
// Dipende da: canvasMgr, bgMgr (globali post-init)
// =============================================================================

class ProjectManager {
    save() {
        const name = prompt('Nome progetto:', CONFIG.projectName) || CONFIG.projectName;
        CONFIG.projectName = name;
        document.getElementById('project-name').textContent = name;

        const data = {
            name,
            drawing: canvasMgr.getDataURL(),
            bg: CONFIG.currentBg,
            ts: Date.now()
        };
        const projects = JSON.parse(localStorage.getItem('eduboard-v2') || '{}');
        projects[name + '_' + Date.now()] = data;
        localStorage.setItem('eduboard-v2', JSON.stringify(projects));
        toast('Progetto salvato!', 'success');
    }

    newBoard() {
        if (confirm('Nuova lavagna? Il disegno non salvato andra\u0300 perso.')) {
            canvasMgr.clear();
            bgMgr.setBackground('white');
            CONFIG.projectName = 'Nuova Lavagna';
            document.getElementById('project-name').textContent = CONFIG.projectName;
            document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
            const whiteBtn = document.querySelector('.bg-opt[data-bg="white"]');
            if (whiteBtn) whiteBtn.classList.add('active');
        }
    }
}

// =============================================================================
// SEZIONE 9 — Toast
// Funzione globale per notifiche temporanee a schermo.
// =============================================================================

function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className   = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

// =============================================================================
// SEZIONE 10 — PWAManager
// Gestisce registrazione Service Worker e banner aggiornamento.
// =============================================================================

class PWAManager {
    constructor() {
        if ('serviceWorker' in navigator && location.protocol === 'https:') {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                reg.addEventListener('updatefound', () => {
                    const w = reg.installing;
                    w.addEventListener('statechange', () => {
                        if (w.state === 'installed' && navigator.serviceWorker.controller) {
                            document.getElementById('update-banner').style.display = 'flex';
                        }
                    });
                });
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload();
                });
            });
        }

        document.getElementById('update-btn').addEventListener('click', () => {
            navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
        });
        document.getElementById('dismiss-update').addEventListener('click', () => {
            document.getElementById('update-banner').style.display = 'none';
        });
    }
}

// =============================================================================
// SEZIONE 11 — Keyboard shortcuts
// =============================================================================

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        // Non interferire con l'input testo inline
        if (textMgr.active) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                e.shiftKey ? canvasMgr.redo() : canvasMgr.undo();
            }
            if (e.key === 'y') {
                e.preventDefault();
                canvasMgr.redo();
            }
            if (e.key === 's') {
                e.preventDefault();
                projectMgr.save();
            }
        }

        if (!e.ctrlKey && !e.metaKey) {
            // Scorciatoie strumenti:
            //   p=penna  m=matita  c=pastello  h=evidenziatore
            //   e=gomma  l=laser   t=testo     s=forme
            const toolMap = {
                p: 'pen',
                m: 'pencil',
                c: 'pastel',
                h: 'marker',
                e: 'eraser',
                l: 'laser',
                t: 'text',
                s: 'shape',
            };
            if (toolMap[e.key]) {
                const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[e.key]}"]`);
                if (btn) btn.click();
            }
        }
    });
}

// =============================================================================
// SEZIONE 12 — INIT
// Istanziazione globale dei manager e avvio dell'applicazione.
// Le variabili globali sono dichiarate con let prima del DOMContentLoaded
// così tutte le classi possono cross-riferirsi dopo l'init completo.
// =============================================================================

let bgMgr, brush, laserMgr, canvasMgr, toolbarMgr, textMgr, projectMgr;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inizializza i manager nell'ordine corretto (le dipendenze prima)
    bgMgr      = new BackgroundManager();
    brush      = new BrushEngine();
    laserMgr   = new LaserManager(document.getElementById('overlay-canvas'));
    canvasMgr  = new CanvasManager(bgMgr, brush, laserMgr);
    toolbarMgr = new ToolbarManager();
    textMgr    = new TextManager();
    projectMgr = new ProjectManager();
    new PWAManager();
    setupKeyboard();

    // 2. Pulsanti header
    document.getElementById('btn-save').addEventListener('click',   () => projectMgr.save());
    document.getElementById('btn-export').addEventListener('click', () => canvasMgr.exportPNG());
    document.getElementById('btn-new').addEventListener('click',    () => projectMgr.newBoard());

    // 3. Posizionamento area canvas (sotto header da 56px)
    document.getElementById('canvas-area').style.top = '56px';

    console.log('EduBoard v2 \u2014 pronto!');
    setTimeout(() => toast('Benvenuto in EduBoard! Clicca \u25b2 per gli strumenti', 'info'), 800);
});
