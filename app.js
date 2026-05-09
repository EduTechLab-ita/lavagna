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

// Colori standard palette toolbar (usati da tutti gli strumenti tranne marker)
const DEFAULT_COLORS = [
    { color: '#000000', title: 'Nero' },
    { color: '#1d4ed8', title: 'Blu' },
    { color: '#dc2626', title: 'Rosso' },
    { color: '#16a34a', title: 'Verde' },
    { color: '#d97706', title: 'Arancio' },
    { color: '#7c3aed', title: 'Viola' },
    { color: '#be185d', title: 'Rosa' },
    { color: '#0891b2', title: 'Azzurro' },
    { color: '#854d0e', title: 'Marrone' },
    { color: '#ffffff', title: 'Bianco' },
];

// Colori evidenziatore (Feature 1)
const MARKER_COLORS = [
    { color: '#FFFF00', title: 'Giallo' },
    { color: '#00FF7F', title: 'Verde' },
    { color: '#FF69B4', title: 'Rosa' },
    { color: '#FF8C00', title: 'Arancio' },
    { color: '#00BFFF', title: 'Azzurro' },
    { color: '#DA70D6', title: 'Orchidea' },
    { color: '#7FFFD4', title: 'Acquamarina' },
    { color: '#FF6347', title: 'Pomodoro' },
    { color: '#ffffff', title: 'Bianco' },  // placeholder per mantenere layout
    { color: '#ffffff', title: 'Bianco' },  // placeholder
];

// Palette 80 colori Material Design (Feature 2)
const COLOR_PALETTE = [
    // Rossi
    '#FFEBEE','#FFCDD2','#EF9A9A','#E57373','#EF5350','#F44336','#E53935','#D32F2F','#C62828','#B71C1C',
    // Rosa
    '#FCE4EC','#F8BBD0','#F48FB1','#F06292','#EC407A','#E91E63','#D81B60','#C2185B','#AD1457','#880E4F',
    // Viola
    '#F3E5F5','#E1BEE7','#CE93D8','#BA68C8','#AB47BC','#9C27B0','#8E24AA','#7B1FA2','#6A1B9A','#4A148C',
    // Blu-viola
    '#EDE7F6','#D1C4E9','#B39DDB','#9575CD','#7E57C2','#673AB7','#5E35B1','#512DA8','#4527A0','#311B92',
    // Blu
    '#E3F2FD','#BBDEFB','#90CAF9','#64B5F6','#42A5F5','#2196F3','#1E88E5','#1976D2','#1565C0','#0D47A1',
    // Ciano/verde
    '#E0F7FA','#B2EBF2','#80DEEA','#4DD0E1','#26C6DA','#00BCD4','#00ACC1','#0097A7','#00838F','#006064',
    // Verde
    '#E8F5E9','#C8E6C9','#A5D6A7','#81C784','#66BB6A','#4CAF50','#43A047','#388E3C','#2E7D32','#1B5E20',
    // Giallo/ambra/arancio
    '#FFFDE7','#FFF9C4','#FFF176','#FFF176','#FFEE58','#FFEB3B','#FDD835','#F9A825','#F57F17','#E65100',
];

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
            // Feature 4 — Righe Primaria
            case 'lines-15-aux': // 1a elementare — 15mm con righino ausiliario a 8mm
                this._drawLinesWithAux(ctx, W, H, 60, 32); // 60px ≈ 15mm, 32px ≈ 8mm
                break;
            case 'lines-12-aux': // 2a elementare — 12mm con righino
                this._drawLinesWithAux(ctx, W, H, 48, 24);
                break;
            case 'lines-9': // 3a elementare — 9mm
                this._drawLines(ctx, W, H, 36);
                break;
            case 'lines-7': // 4a elementare — 7mm
                this._drawLines(ctx, W, H, 28);
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

    // Feature 4: righino ausiliario per primaria
    _drawLinesWithAux(ctx, W, H, spacing, auxOffset) {
        // Riga principale blu
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.2;
        for (let y = spacing; y < H; y += spacing) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        // Righino ausiliario rosso (a metà)
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 0.7;
        for (let y = spacing; y < H; y += spacing) {
            const auxY = y - spacing + auxOffset;
            if (auxY > 0) {
                ctx.beginPath(); ctx.moveTo(0, auxY); ctx.lineTo(W, auxY); ctx.stroke();
            }
        }
        // Margine sinistro rosso
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, H); ctx.stroke();
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

    // Helper: poligono regolare (Feature 3)
    _polygon(ctx, cx, cy, r, sides, rotation = 0) {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2 + rotation;
            if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        }
        ctx.closePath();
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

            // Feature 3 — Forme aggiuntive

            case 'diamond': {
                const dcx = (x0 + x1) / 2;
                const dcy = (y0 + y1) / 2;
                const dw = Math.abs(x1 - x0) / 2;
                const dh = Math.abs(y1 - y0) / 2;
                ctx.moveTo(dcx, dcy - dh);
                ctx.lineTo(dcx + dw, dcy);
                ctx.lineTo(dcx, dcy + dh);
                ctx.lineTo(dcx - dw, dcy);
                ctx.closePath();
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'pentagon': {
                const pcx = (x0 + x1) / 2;
                const pcy = (y0 + y1) / 2;
                const pr = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
                this._polygon(ctx, pcx, pcy, pr, 5);
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'hexagon': {
                const hcx = (x0 + x1) / 2;
                const hcy = (y0 + y1) / 2;
                const hr = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
                this._polygon(ctx, hcx, hcy, hr, 6, Math.PI / 6);
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'arrow-right': {
                // Freccia destra: corpo rettangolare + testa triangolare
                const arW = x1 - x0;
                const arH = y1 - y0;
                const ary = y0 + arH * 0.3;
                const arMidY = y0 + arH / 2;
                const aryB = y0 + arH * 0.7;
                const arTip = x1;
                const arBody = x0 + arW * 0.65;
                ctx.moveTo(x0, ary);
                ctx.lineTo(arBody, ary);
                ctx.lineTo(arBody, y0);
                ctx.lineTo(arTip, arMidY);
                ctx.lineTo(arBody, y1);
                ctx.lineTo(arBody, aryB);
                ctx.lineTo(x0, aryB);
                ctx.closePath();
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'double-arrow': {
                // Freccia doppia ← →
                const daW = x1 - x0;
                const daH = y1 - y0;
                const day = y0 + daH * 0.3;
                const daMidY = y0 + daH / 2;
                const dayB = y0 + daH * 0.7;
                const daHead = Math.abs(daW) * 0.2;
                const daBodyL = x0 + daHead;
                const daBodyR = x1 - daHead;
                ctx.moveTo(x0, daMidY);
                ctx.lineTo(daBodyL, y0);
                ctx.lineTo(daBodyL, day);
                ctx.lineTo(daBodyR, day);
                ctx.lineTo(daBodyR, y0);
                ctx.lineTo(x1, daMidY);
                ctx.lineTo(daBodyR, y1);
                ctx.lineTo(daBodyR, dayB);
                ctx.lineTo(daBodyL, dayB);
                ctx.lineTo(daBodyL, y1);
                ctx.closePath();
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'speech': {
                // Nuvoletta: rettangolo arrotondato + codino in basso a sinistra
                const sw = x1 - x0;
                const sh = y1 - y0;
                const sRadius = Math.min(Math.abs(sw), Math.abs(sh)) * 0.12;
                const tailH = Math.abs(sh) * 0.2;
                const bodyH = Math.abs(sh) - tailH;
                const sx0 = Math.min(x0, x1);
                const sy0 = Math.min(y0, y1);
                const sx1 = Math.max(x0, x1);
                const sy1 = Math.max(y0, y1);
                const sbH = (sy1 - sy0) - tailH;
                // Corpo arrotondato
                ctx.moveTo(sx0 + sRadius, sy0);
                ctx.lineTo(sx1 - sRadius, sy0);
                ctx.arcTo(sx1, sy0, sx1, sy0 + sRadius, sRadius);
                ctx.lineTo(sx1, sy0 + sbH - sRadius);
                ctx.arcTo(sx1, sy0 + sbH, sx1 - sRadius, sy0 + sbH, sRadius);
                // Codino
                ctx.lineTo(sx0 + (sx1 - sx0) * 0.35, sy0 + sbH);
                ctx.lineTo(sx0 + (sx1 - sx0) * 0.15, sy1);
                ctx.lineTo(sx0 + (sx1 - sx0) * 0.25, sy0 + sbH);
                ctx.lineTo(sx0 + sRadius, sy0 + sbH);
                ctx.arcTo(sx0, sy0 + sbH, sx0, sy0 + sbH - sRadius, sRadius);
                ctx.lineTo(sx0, sy0 + sRadius);
                ctx.arcTo(sx0, sy0, sx0 + sRadius, sy0, sRadius);
                ctx.closePath();
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'heart': {
                const hx = (x0 + x1) / 2;
                const hy = (y0 + y1) / 2;
                const hr2 = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2;
                ctx.moveTo(hx, hy + hr2 * 0.3);
                ctx.bezierCurveTo(hx, hy - hr2 * 0.6, hx - hr2, hy - hr2 * 0.6, hx - hr2, hy);
                ctx.bezierCurveTo(hx - hr2, hy + hr2 * 0.6, hx, hy + hr2, hx, hy + hr2);
                ctx.bezierCurveTo(hx, hy + hr2, hx + hr2, hy + hr2 * 0.6, hx + hr2, hy);
                ctx.bezierCurveTo(hx + hr2, hy - hr2 * 0.6, hx, hy - hr2 * 0.6, hx, hy + hr2 * 0.3);
                ctx.closePath();
                if (fill) { ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1; }
                ctx.stroke();
                break;
            }

            case 'brace': {
                // Parentesi graffa aperta { (verticale, orientata a destra)
                const bcx = (x0 + x1) / 2;
                const bcy = (y0 + y1) / 2;
                const bh = Math.abs(y1 - y0) / 2;
                const bw = Math.abs(x1 - x0) * 0.3;
                const tip = bcx - Math.abs(x1 - x0) * 0.15;
                const right = Math.max(x0, x1);
                ctx.moveTo(right, y0);
                ctx.bezierCurveTo(right - bw, y0, tip, bcy - bh * 0.3, tip, bcy);
                ctx.bezierCurveTo(tip, bcy + bh * 0.3, right - bw, y1, right, y1);
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
        this._setupColorPalettePopup(); // Feature 2
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

        // Feature 1: aggiorna palette colori in base allo strumento
        this._updateColorSwatches(tool);
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

    // Feature 1: aggiorna i color-swatch in base allo strumento
    _updateColorSwatches(tool) {
        const swatches = document.querySelectorAll('.color-swatch:not(#color-custom)');
        const colors = (tool === 'marker') ? MARKER_COLORS : DEFAULT_COLORS;

        swatches.forEach((btn, i) => {
            if (i < colors.length) {
                const c = colors[i];
                btn.dataset.color = c.color;
                btn.style.background = c.color;
                btn.title = c.title;
                // I placeholder bianchi del marker li rendiamo invisibili
                if (tool === 'marker' && i >= 8) {
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                } else {
                    btn.style.opacity = '';
                    btn.style.pointerEvents = '';
                }
                // Bordo speciale per il bianco
                if (c.color === '#ffffff' && !(tool === 'marker' && i >= 8)) {
                    btn.style.border = '2px solid #64748b';
                } else if (tool !== 'marker' || i < 8) {
                    btn.style.border = '';
                }
            }
        });

        // Rimuovi active da tutti, imposta attivo sul primo
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        if (swatches[0]) {
            swatches[0].classList.add('active');
            CONFIG.currentColor = colors[0].color;
        }
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

        // Feature 2: il pulsante "+" apre la tavolozza invece del picker diretto
        document.getElementById('color-custom').addEventListener('click', () => {
            this._togglePopup('color-palette-popup', document.getElementById('color-custom'));
        });

        document.getElementById('color-picker-input').addEventListener('input', (e) => {
            CONFIG.currentColor = e.target.value;
            const customBtn = document.getElementById('color-custom');
            customBtn.style.background = e.target.value;
            document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            customBtn.classList.add('active');
        });
    }

    // Feature 2: setup popup tavolozza 80 colori
    _setupColorPalettePopup() {
        const grid = document.getElementById('color-palette-grid');
        if (!grid) return;

        // Genera griglia 80 colori
        COLOR_PALETTE.forEach(color => {
            const btn = document.createElement('button');
            btn.style.background = color;
            btn.title = color;
            btn.addEventListener('click', () => {
                CONFIG.currentColor = color;
                const customBtn = document.getElementById('color-custom');
                customBtn.style.background = color;
                document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
                customBtn.classList.add('active');
                this._closeAllPopups();
            });
            grid.appendChild(btn);
        });

        // Pulsante colore personalizzato in fondo alla tavolozza
        document.getElementById('palette-custom-btn').addEventListener('click', () => {
            document.getElementById('color-picker-input').click();
            this._closeAllPopups();
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
        document.getElementById('color-palette-popup').style.display = 'none';
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
        if (confirm('Nuova lavagna? Il disegno non salvato andr\u00e0 perso.')) {
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
        // Non interferire con il project-name in modifica
        if (document.getElementById('project-name').contentEditable === 'true') return;

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
// SEZIONE 12 — Feature 5: Fullscreen API
// =============================================================================

function setupFullscreen() {
    const btn = document.getElementById('btn-fullscreen');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFS = !!document.fullscreenElement;
        const icon = document.getElementById('fullscreen-icon');
        const label = document.getElementById('fullscreen-label');
        if (icon) {
            icon.innerHTML = isFS
                ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
                : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
        }
        if (label) label.textContent = isFS ? 'Esci' : 'Espandi';
    });

    // F11 → fullscreen
    document.addEventListener('keydown', e => {
        if (e.key === 'F11') { e.preventDefault(); btn.click(); }
    });
}

// =============================================================================
// SEZIONE 13 — Feature 6: Nome lezione modificabile
// =============================================================================

function setupProjectName() {
    const badge = document.getElementById('project-name');
    badge.title = 'Doppio click per rinominare';
    badge.style.cursor = 'pointer';

    badge.addEventListener('dblclick', () => {
        badge.contentEditable = 'true';
        badge.focus();
        // Seleziona tutto
        const range = document.createRange();
        range.selectNodeContents(badge);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    });

    badge.addEventListener('blur', () => {
        badge.contentEditable = 'false';
        CONFIG.projectName = badge.textContent.trim() || 'Nuova Lavagna';
        badge.textContent = CONFIG.projectName;
    });

    badge.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); badge.blur(); }
        if (e.key === 'Escape') { badge.textContent = CONFIG.projectName; badge.blur(); }
    });
}

// =============================================================================
// SEZIONE 14 — INIT
// Istanziazione globale dei manager e avvio dell'applicazione.
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
    setupFullscreen();    // Feature 5
    setupProjectName();   // Feature 6

    // 2. Pulsanti header
    document.getElementById('btn-save').addEventListener('click',   () => projectMgr.save());
    document.getElementById('btn-export').addEventListener('click', () => canvasMgr.exportPNG());
    document.getElementById('btn-new').addEventListener('click',    () => projectMgr.newBoard());

    // 3. Posizionamento area canvas (sotto header da 56px)
    document.getElementById('canvas-area').style.top = '56px';

    console.log('EduBoard v2 \u2014 pronto!');
    setTimeout(() => toast('Benvenuto in EduBoard! Clicca \u25b2 per gli strumenti', 'info'), 800);
});
