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
    isDirty: false,
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
        ctx.strokeStyle = '#94a3b8'; // slate-400 — visibile ma non invadente
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
            case 'lines-15-aux': // 1a elementare — 3 zone grande-piccola-grande
                this._drawLinesThreeZone(ctx, W, H, 36, 20); // 36px grande, 20px piccola (x-height)
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

    // Feature 4a: righino ausiliario per 2a elementare (2 zone)
    _drawLinesWithAux(ctx, W, H, spacing, auxOffset) {
        // Riga principale blu
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.2;
        for (let y = spacing; y < H; y += spacing) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        // Righino ausiliario rosso
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 0.9;
        for (let y = spacing; y < H; y += spacing) {
            const auxY = y - spacing + auxOffset;
            if (auxY > 0) {
                ctx.beginPath(); ctx.moveTo(0, auxY); ctx.lineTo(W, auxY); ctx.stroke();
            }
        }
        // Margine sinistro rosso
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(60, 0); ctx.lineTo(60, H); ctx.stroke();
    }

    // Feature 4b: righe a 3 zone per 1a elementare (grande-piccola-grande)
    _drawLinesThreeZone(ctx, W, H, large, small) {
        const period = large + small + large;
        for (let y = large; y < H; y += period) {
            // Rigo superiore (leggero, grigio-blu) — tetto lettere alte
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            // Rigo x-height (rosso) — tetto lettere piccole, dove si scrive
            const xhY = y + large;
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 1.0;
            ctx.beginPath(); ctx.moveTo(0, xhY); ctx.lineTo(W, xhY); ctx.stroke();
            // Baseline (blu, più spessa) — riga di base
            const baseY = y + large + small;
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(W, baseY); ctx.stroke();
        }
        // Margine sinistro rosso
        ctx.strokeStyle = '#f87171';
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
        const vW = window.innerWidth;
        const headerH = document.body.classList.contains('fullscreen-mode') ? 0 : 56;
        const vH = window.innerHeight - headerH;
        const W = vW * 3;   // canvas 3× viewport per simulare area infinita
        const H = vH * 3;

        // Salva disegno prima del resize
        const savedURL = this.canvas.width > 0 ? this.canvas.toDataURL() : null;
        const prevW = this.canvas.width;

        this.canvas.width = W;
        this.canvas.height = H;
        this.canvas.style.width  = W + 'px';
        this.canvas.style.height = H + 'px';
        this.overlayCanvas.width = W;
        this.overlayCanvas.height = H;
        this.overlayCanvas.style.width  = W + 'px';
        this.overlayCanvas.style.height = H + 'px';
        // Nota: bgCanvas non ha stile gestito qui, è gestito da bgMgr
        const bgCvs = document.getElementById('bg-canvas');
        if (bgCvs) { bgCvs.style.width = W + 'px'; bgCvs.style.height = H + 'px'; }
        // objects-canvas
        if (typeof objectLayer !== 'undefined' && objectLayer) {
            objectLayer.resize(W, H);
        } else {
            const objCvs = document.getElementById('objects-canvas');
            if (objCvs) { objCvs.width = W; objCvs.height = H; objCvs.style.width = W + 'px'; objCvs.style.height = H + 'px'; }
        }
        this.bgMgr.resize(W, H);
        this.laser.resize(W, H);

        // Ripristina disegno senza distorsione (nessuna scalatura, mantiene proporzioni)
        if (savedURL && prevW > 0) {
            const img = new Image();
            img.onload = () => {
                // Disegna all'origine senza scalare: il canvas è 3× viewport,
                // quindi c'è abbondante spazio senza dover stirare il contenuto.
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = savedURL;
        }

        // Ricentra la vista dopo il resize
        if (typeof panMgr !== 'undefined' && panMgr) panMgr.centerView();
    }

    getCoords(e) {
        // Con il nuovo sistema CSS transform su canvas-area, le coordinate
        // devono essere convertite usando panMgr.getCanvasCoords() che divide per scale
        if (typeof panMgr !== 'undefined' && panMgr) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return panMgr.getCanvasCoords(clientX, clientY);
        }
        // Fallback: senza panMgr usa il rect direttamente
        const rect = this.canvas.getBoundingClientRect();
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) / (rect.width / this.canvas.width),
                y: (e.touches[0].clientY - rect.top) / (rect.height / this.canvas.height)
            };
        }
        return {
            x: (e.clientX - rect.left) / (rect.width / this.canvas.width),
            y: (e.clientY - rect.top) / (rect.height / this.canvas.height)
        };
    }

    _setupEvents() {
        // Usa overlay-canvas come surface di input (z-index più alto, gestisce tutti gli eventi)
        // draw-canvas rimane sotto, non intercetta
        const el = this.overlayCanvas;
        el.style.pointerEvents = 'auto'; // overlay riceve eventi
        this.canvas.style.pointerEvents = 'none'; // draw-canvas non riceve eventi diretti

        // Mouse
        el.addEventListener('mousedown',  e => this._onStart(e));
        el.addEventListener('mousemove',  e => this._onMove(e));
        el.addEventListener('mouseup',    e => this._onEnd(e));
        el.addEventListener('mouseleave', e => this._onEnd(e));
        // Touch (esclude pinch a 2 dita gestito da PanManager)
        el.addEventListener('touchstart', e => {
            if (e.touches.length === 1) { e.preventDefault(); this._onStart(e); }
        }, { passive: false });
        el.addEventListener('touchmove',  e => {
            if (e.touches.length === 1) { e.preventDefault(); this._onMove(e); }
        }, { passive: false });
        el.addEventListener('touchend',   e => { e.preventDefault(); this._onEnd(e); }, { passive: false });
    }

    _onStart(e) {
        const { x, y } = this.getCoords(e);
        CONFIG.isDrawing = true;

        // Auto-hide toolbar quando si inizia a disegnare
        toolbarMgr.hide();

        if (CONFIG.currentTool === 'select') {
            selectMgr?.onPointerDown(x, y);
            return;
        }
        if (CONFIG.currentTool === 'pan') {
            panMgr?.onPointerDown(e.clientX || e.touches?.[0]?.clientX || 0,
                                  e.clientY || e.touches?.[0]?.clientY || 0);
            CONFIG.isDrawing = true;
            return;
        }
        if (CONFIG.currentTool === 'laser') {
            this.laser.addPoint(x, y);
            return;
        }
        if (CONFIG.currentTool === 'text') {
            // Il TextManager gestisce i click sul canvas autonomamente via pointerdown
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

        if (CONFIG.currentTool === 'select') {
            selectMgr?.onPointerMove(x, y);
            return;
        }
        if (CONFIG.currentTool === 'pan') {
            panMgr?.onPointerMove(e.clientX || e.touches?.[0]?.clientX || 0,
                                  e.clientY || e.touches?.[0]?.clientY || 0);
            return;
        }
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

        if (CONFIG.currentTool === 'select') {
            const { x, y } = this.getCoords(e);
            selectMgr?.onPointerUp(x, y);
            return;
        }
        if (CONFIG.currentTool === 'pan') {
            panMgr?.onPointerUp();
            CONFIG.isDrawing = false;
            return;
        }
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
        CONFIG.isDirty = true;
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

        // Mostra la riga opzioni subito (penna selezionata di default)
        this._updateOptionsRow();
        this._updateColorSwatches(CONFIG.currentTool);
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
            selectMgr?.deactivate();
            this._togglePopup('bg-popup', btn);
            return;
        }
        if (tool === 'shape') {
            selectMgr?.deactivate();
            this._togglePopup('shape-popup', btn);
            CONFIG.currentTool = 'shape';
            this._updateActiveBtn(btn);
            this._updateOptionsRow();
            return;
        }
        if (tool === 'geo') {
            selectMgr?.deactivate();
            this._togglePopup('geo-popup', btn);
            this._updateActiveBtn(btn);
            return;
        }
        if (tool === 'upload-bg') {
            selectMgr?.deactivate();
            document.getElementById('file-bg-input').click();
            return;
        }
        if (tool === 'import-media') {
            selectMgr?.deactivate();
            document.getElementById('file-import-input').click();
            return;
        }
        if (tool === 'select') {
            CONFIG.currentTool = 'select';
            this._updateActiveBtn(btn);
            this._updateOptionsRow();
            this._updateCursor();
            selectMgr?.activate();
            panMgr?.deactivate();
            return;
        }
        if (tool === 'pan') {
            CONFIG.currentTool = 'pan';
            this._updateActiveBtn(btn);
            this._updateCursor();
            panMgr?.activate();
            selectMgr?.deactivate();
            return;
        }

        // Tutti gli altri strumenti: disattiva select e text
        selectMgr?.deactivate();
        panMgr?.deactivate();
        if (tool !== 'text' && typeof textMgr !== 'undefined') {
            textMgr.deactivate();
        }

        CONFIG.currentTool = tool;
        this._updateActiveBtn(btn);
        this._updateOptionsRow();
        this._updateCursor();

        // Attiva textMgr se strumento testo
        if (tool === 'text' && typeof textMgr !== 'undefined') {
            textMgr.activate();
        }

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
        // 'select', 'laser', 'geo', 'background', 'upload-bg' non mostrano la riga opzioni
        this.optionsRow.style.display = showOptions ? 'flex' : 'none';

        // Nascondi colori per strumenti che non ne hanno bisogno
        const showColors = !['eraser', 'laser'].includes(tool);
        document.getElementById('options-colors').style.display = showColors ? 'flex' : 'none';
        const divider = document.querySelector('.options-divider');
        if (divider) divider.style.display = showColors ? 'block' : 'none';
    }

    _updateCursor() {
        // overlay-canvas è ora il layer di input (pointer-events: auto)
        const canvas = document.getElementById('overlay-canvas');
        const cursorMap = {
            pen:    'crosshair',
            pencil: 'crosshair',
            pastel: 'crosshair',
            marker: 'crosshair',
            eraser: 'cell',
            text:   'text',
            laser:  'none',
            shape:  'crosshair',
            select: 'crosshair',
            pan:    'grab',
            'import-media': 'default',
        };
        if (canvas) canvas.style.cursor = cursorMap[CONFIG.currentTool] || 'default';
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
                // Memorizza sfondo per la cartella corrente (se Drive connesso)
                if (typeof libraryMgr !== 'undefined' && libraryMgr?.currentFolderId) {
                    localStorage.setItem('folder-bg-' + libraryMgr.currentFolderId, btn.dataset.bg);
                }
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

        // Import media (immagini/PDF) come oggetti sul canvas
        const importInput = document.getElementById('file-import-input');
        if (importInput) {
            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.type.startsWith('image/')) {
                    await importImageFile(file);
                } else if (file.type === 'application/pdf') {
                    await importPdfFile(file);
                }
                e.target.value = '';
            });
        }

        // Drag & Drop di file sul canvas-area
        const area = document.getElementById('canvas-area');
        if (area) {
            area.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            area.addEventListener('drop', async e => {
                e.preventDefault();
                const files = e.dataTransfer.files;
                if (!files.length) return;
                for (const file of files) {
                    if (file.type.startsWith('image/')) {
                        await importImageFile(file, e.clientX, e.clientY);
                    } else if (file.type === 'application/pdf') {
                        await importPdfFile(file, e.clientX, e.clientY);
                    }
                }
            });
        }
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
            // Se è il popup sfondi, carica le immagini da Drive
            if (id === 'bg-popup') {
                loadDriveBackgrounds();
            }
        }
    }

    _closeAllPopups() {
        ['shape-popup', 'bg-popup', 'color-palette-popup', 'geo-popup'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }
}

// =============================================================================
// SEZIONE 7 — TextManager
// Gestisce l'input testo inline (no prompt!).
// Dipende da: canvasMgr (globale post-init)
// =============================================================================

class TextManager {
    constructor() {
        this.active     = false;
        this.editing    = false;
        this.fontFamily = 'Inter, sans-serif';
        this.fontSize   = 28;
        this.fontStyle  = '';        // '' | 'bold' | 'italic' | 'bold italic'
        this.underline  = false;
        this.color      = '#000000';

        this._buildToolbar();
        this._buildInput();
        this._setupCanvasListener();
    }

    // ── Toolbar contestuale testo ─────────────────────────────────────
    _buildToolbar() {
        // Crea un popup contestuale FISSO in cima alla toolbar (visibile quando text è attivo)
        const bar = document.createElement('div');
        bar.id        = 'text-toolbar';
        bar.className = 'text-toolbar';
        bar.innerHTML = `
            <select id="txt-font" title="Font">
                <option value="Inter, sans-serif">Inter</option>
                <option value="'Georgia', serif">Georgia</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Arial', sans-serif">Arial</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Comic Sans MS', cursive">Comic Sans</option>
                <option value="'Verdana', sans-serif">Verdana</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
            </select>
            <select id="txt-size" title="Dimensione">
                ${[12,16,20,24,28,32,40,48,56,72].map(s =>
                    `<option value="${s}" ${s===28?'selected':''}>${s}px</option>`
                ).join('')}
            </select>
            <button id="txt-bold"      class="txt-btn" title="Grassetto (Ctrl+B)"><b>B</b></button>
            <button id="txt-italic"    class="txt-btn" title="Corsivo (Ctrl+I)"><i>I</i></button>
            <button id="txt-underline" class="txt-btn" title="Sottolineato (Ctrl+U)"><u>U</u></button>
            <div class="txt-sep"></div>
            <button id="txt-confirm" class="txt-btn txt-btn--primary" title="Conferma (Enter)">✓ OK</button>
            <button id="txt-cancel"  class="txt-btn" title="Annulla (Esc)">✕</button>
        `;
        bar.style.display = 'none';
        document.body.appendChild(bar);

        // Listeners
        document.getElementById('txt-font').addEventListener('change', e => {
            this.fontFamily = e.target.value;
            this._syncInputStyle();
        });
        document.getElementById('txt-size').addEventListener('change', e => {
            this.fontSize = parseInt(e.target.value);
            this._syncInputStyle();
        });
        document.getElementById('txt-bold').addEventListener('click', () => {
            this._toggleBold();
        });
        document.getElementById('txt-italic').addEventListener('click', () => {
            this._toggleItalic();
        });
        document.getElementById('txt-underline').addEventListener('click', () => {
            this.underline = !this.underline;
            document.getElementById('txt-underline').classList.toggle('txt-btn--active', this.underline);
            this._syncInputStyle();
        });
        document.getElementById('txt-confirm').addEventListener('click', () => this._commit());
        document.getElementById('txt-cancel').addEventListener('click',  () => this._cancel());
    }

    _toggleBold() {
        const hasBold = this.fontStyle.includes('bold');
        this.fontStyle = hasBold
            ? this.fontStyle.replace('bold', '').trim()
            : (this.fontStyle + ' bold').trim();
        document.getElementById('txt-bold').classList.toggle('txt-btn--active', !hasBold);
        this._syncInputStyle();
    }

    _toggleItalic() {
        const hasItalic = this.fontStyle.includes('italic');
        this.fontStyle = hasItalic
            ? this.fontStyle.replace('italic', '').trim()
            : (this.fontStyle + ' italic').trim();
        document.getElementById('txt-italic').classList.toggle('txt-btn--active', !hasItalic);
        this._syncInputStyle();
    }

    // ── Input box ─────────────────────────────────────────────────────
    _buildInput() {
        // Usa il div #text-cursor esistente
        this.inputEl = document.getElementById('text-cursor');
        if (!this.inputEl) {
            this.inputEl = document.createElement('div');
            this.inputEl.id = 'text-cursor';
            document.getElementById('canvas-area').appendChild(this.inputEl);
        }
        this.inputEl.contentEditable = 'false';
        this.inputEl.style.display   = 'none';

        // Tasti speciali nell'input
        this.inputEl.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); this._cancel(); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._commit(); }
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); this._toggleBold(); }
            if (e.ctrlKey && e.key === 'i') { e.preventDefault(); this._toggleItalic(); }
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                this.underline = !this.underline;
                document.getElementById('txt-underline').classList.toggle('txt-btn--active', this.underline);
                this._syncInputStyle();
            }
        });
    }

    _syncInputStyle() {
        if (!this.inputEl) return;
        const style = `${this.fontStyle} ${this.fontSize}px ${this.fontFamily}`.trim();
        this.inputEl.style.font           = style;
        this.inputEl.style.textDecoration = this.underline ? 'underline' : '';
        this.inputEl.style.color          = this.color;
    }

    // ── Listener sul canvas ───────────────────────────────────────────
    _setupCanvasListener() {
        // Usa overlay-canvas come surface di input (è il layer più in alto con pointer-events)
        const inputCanvas = document.getElementById('overlay-canvas');
        inputCanvas.addEventListener('pointerdown', e => {
            if (CONFIG.currentTool !== 'text') return;
            if (this.editing) {
                // Se clicco fuori dall'input → commit
                const rect = this.inputEl.getBoundingClientRect();
                const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top  && e.clientY <= rect.bottom;
                if (!inside) this._commit();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this._startEditing(e.clientX, e.clientY);
        });
    }

    _startEditing(clientX, clientY) {
        this.editing = true;
        this.color   = CONFIG.currentColor || '#000000';

        // Posiziona l'input nel canvas
        const canvasArea = document.getElementById('canvas-area');
        const areaRect   = canvasArea.getBoundingClientRect();
        const x = clientX - areaRect.left;
        const y = clientY - areaRect.top;

        this.inputEl.style.display  = 'block';
        this.inputEl.style.left     = x + 'px';
        this.inputEl.style.top      = y + 'px';
        this.inputEl.style.minWidth = '4px';
        this.inputEl.style.minHeight = (this.fontSize + 8) + 'px';
        this.inputEl.textContent    = '';
        this.inputEl.contentEditable = 'true';
        this._syncInputStyle();

        // Mostra toolbar testo
        document.getElementById('text-toolbar').style.display = 'flex';

        // Focus e cursore
        this.inputEl.focus();
        const range = document.createRange();
        range.selectNodeContents(this.inputEl);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    _commit() {
        if (!this.editing) return;
        const text = this.inputEl.textContent.trim();
        if (text) {
            this._renderTextToCanvas(text);
        }
        this._endEditing();
    }

    _cancel() {
        this._endEditing();
    }

    _endEditing() {
        this.editing = false;
        this.inputEl.contentEditable = 'false';
        this.inputEl.style.display   = 'none';
        this.inputEl.textContent     = '';
        document.getElementById('text-toolbar').style.display = 'none';
    }

    _renderTextToCanvas(text) {
        const drawCanvas = document.getElementById('draw-canvas');
        const ctx        = drawCanvas.getContext('2d');

        // Recupera posizione input relativa al canvas
        const canvasRect  = drawCanvas.getBoundingClientRect();
        const inputRect   = this.inputEl.getBoundingClientRect();
        const scaleX = drawCanvas.width  / canvasRect.width;
        const scaleY = drawCanvas.height / canvasRect.height;
        const x = (inputRect.left - canvasRect.left) * scaleX;
        const y = (inputRect.top  - canvasRect.top)  * scaleY + this.fontSize * scaleY;

        // Salva undo
        if (typeof canvasMgr !== 'undefined') canvasMgr._saveUndo();

        ctx.save();
        const fontString = `${this.fontStyle} ${this.fontSize * scaleY}px ${this.fontFamily}`.trim();
        ctx.font          = fontString;
        ctx.fillStyle     = this.color;
        ctx.textBaseline  = 'alphabetic';

        // Testo multilinea
        const lines = text.split('\n');
        const lineH = this.fontSize * scaleY * 1.3;
        lines.forEach((line, i) => {
            ctx.fillText(line, x, y + i * lineH);
            if (this.underline) {
                const w = ctx.measureText(line).width;
                ctx.strokeStyle = this.color;
                ctx.lineWidth   = Math.max(1, this.fontSize * scaleY * 0.06);
                ctx.beginPath();
                ctx.moveTo(x, y + i * lineH + 2);
                ctx.lineTo(x + w, y + i * lineH + 2);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    activate()   { this.active = true; }
    deactivate() { this.active = false; if (this.editing) this._cancel(); }
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
        CONFIG.isDirty = false;
        toast('Progetto salvato!', 'success');
    }

    saveQuiet() {
        const data = {
            name: CONFIG.projectName,
            drawing: canvasMgr.getDataURL(),
            bg: CONFIG.currentBg,
            ts: Date.now()
        };
        const projects = JSON.parse(localStorage.getItem('eduboard-v2') || '{}');
        projects[CONFIG.projectName + '_' + Date.now()] = data;
        localStorage.setItem('eduboard-v2', JSON.stringify(projects));
        CONFIG.isDirty = false;
        toast('Progetto salvato!', 'success');
    }

    async newBoard() {
        if (CONFIG.isDirty) {
            const ok = await confirmIfDirty();
            if (!ok) return;
        }
        canvasMgr.clear();
        bgMgr.setBackground('white');
        CONFIG.projectName = 'Nuova Lavagna';
        CONFIG.isDirty = false;
        document.getElementById('project-name').textContent = CONFIG.projectName;
        document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
        const whiteBtn = document.querySelector('.bg-opt[data-bg="white"]');
        if (whiteBtn) whiteBtn.classList.add('active');
    }
}

// =============================================================================
// SEZIONE 8b — Dialog "salva prima di continuare"
// =============================================================================

function confirmIfDirty() {
    return new Promise((resolve) => {
        if (!CONFIG.isDirty) { resolve(true); return; }

        const modal = document.getElementById('dirty-modal');
        if (!modal) { resolve(true); return; }
        modal.style.display = 'flex';

        const btnSave   = document.getElementById('dirty-btn-save');
        const btnSkip   = document.getElementById('dirty-btn-skip');
        const btnCancel = document.getElementById('dirty-btn-cancel');

        function cleanup() {
            modal.style.display = 'none';
            btnSave.removeEventListener('click', onSave);
            btnSkip.removeEventListener('click', onSkip);
            btnCancel.removeEventListener('click', onCancel);
        }

        function onSave() {
            cleanup();
            projectMgr.saveQuiet();
            resolve(true);
        }
        function onSkip() {
            cleanup();
            resolve(true);
        }
        function onCancel() {
            cleanup();
            resolve(false);
        }

        btnSave.addEventListener('click', onSave);
        btnSkip.addEventListener('click', onSkip);
        btnCancel.addEventListener('click', onCancel);
    });
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
        if (textMgr.editing) return;
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
            // Gestione tasti speciali per SelectManager (Escape, Delete, Backspace)
            selectMgr?.handleKeydown(e);

            // Scorciatoie strumenti:
            //   p=penna  m=matita  c=pastello  h=evidenziatore
            //   e=gomma  l=laser   t=testo     s=forme  a=seleziona
            const toolMap = {
                p: 'pen',
                m: 'pencil',
                c: 'pastel',
                h: 'marker',
                e: 'eraser',
                l: 'laser',
                t: 'text',
                s: 'shape',
                a: 'select',
                g: 'pan',
            };
            if (toolMap[e.key]) {
                const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[e.key]}"]`);
                if (btn) btn.click();
            }
        }
    });
}

// =============================================================================
// SEZIONE 12 — Feature 5: Fullscreen API (con header nascosto)
// =============================================================================

function setupFullscreen() {
    const btnFs    = document.getElementById('btn-fullscreen');
    const btnExit  = document.getElementById('btn-exit-fullscreen');
    const icon     = document.getElementById('fullscreen-icon');
    const label    = document.getElementById('fullscreen-label');

    function enterFs() {
        const el = document.documentElement;
        if (el.requestFullscreen)            el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen)    el.mozRequestFullScreen();
    }

    function exitFs() {
        if (document.exitFullscreen)            document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen)  document.mozCancelFullScreen();
    }

    function isFullscreen() {
        return !!(document.fullscreenElement ||
                  document.webkitFullscreenElement ||
                  document.mozFullScreenElement);
    }

    function applyFullscreenUI(active) {
        const header     = document.getElementById('app-header');
        const canvasArea = document.getElementById('canvas-area');
        if (active) {
            document.body.classList.add('fullscreen-mode');
            if (header) header.style.display = 'none';
            if (btnExit) btnExit.style.display = 'flex';
            if (icon)    icon.innerHTML = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>';
            if (label)   label.textContent = 'Riduci';
        } else {
            document.body.classList.remove('fullscreen-mode');
            if (header) header.style.display = '';
            if (btnExit) btnExit.style.display = 'none';
            if (icon)    icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
            if (label)   label.textContent = 'Espandi';
        }
        // Ridisegna il canvas con le nuove dimensioni
        setTimeout(() => canvasMgr?.resize(), 0);
    }

    if (btnFs) btnFs.addEventListener('click', () => {
        if (isFullscreen()) {
            exitFs();
            applyFullscreenUI(false);
        } else {
            enterFs();
            applyFullscreenUI(true);
        }
    });
    if (btnExit) btnExit.addEventListener('click', () => {
        exitFs();
        applyFullscreenUI(false);
    });

    // Tasto F11 (intercept + fullscreen API)
    document.addEventListener('keydown', e => {
        if (e.key === 'F11') { e.preventDefault(); isFullscreen() ? exitFs() : enterFs(); }
    });

    // Ascolta cambiamenti fullscreen (es. utente preme Esc)
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach(ev => {
        document.addEventListener(ev, () => {
            applyFullscreenUI(isFullscreen());
            // Ridisegna il canvas dopo il resize
            setTimeout(() => { if (typeof canvasMgr !== 'undefined') canvasMgr.resize(); }, 100);
        });
    });
}

// =============================================================================
// SEZIONE 12b — Linguette libreria laterali + apertura da lato
// =============================================================================

function setupLibraryTabs() {
    ['left', 'right'].forEach(side => {
        const tab = document.getElementById(`lib-tab-${side}`);
        if (!tab) return;

        // Ripristina posizione salvata
        const savedTop = localStorage.getItem(`lib-tab-${side}-top`);
        if (savedTop) {
            tab.style.top    = savedTop;
            tab.style.transform = 'none';
        }

        let dragStartY = 0, dragStartTop = 0, isDragging = false;

        tab.addEventListener('pointerdown', (e) => {
            dragStartY   = e.clientY;
            dragStartTop = tab.getBoundingClientRect().top;
            isDragging   = false;
            tab.setPointerCapture(e.pointerId);
        });

        tab.addEventListener('pointermove', (e) => {
            const dy = Math.abs(e.clientY - dragStartY);
            if (dy > 5) isDragging = true;
            if (!isDragging) return;
            const newTop = Math.max(40, Math.min(window.innerHeight - 80,
                dragStartTop + (e.clientY - dragStartY)));
            tab.style.top       = newTop + 'px';
            tab.style.transform = 'none';
            localStorage.setItem(`lib-tab-${side}-top`, newTop + 'px');
        });

        tab.addEventListener('pointerup', (e) => {
            if (!isDragging) {
                // È un click: apri/chiudi libreria dal lato corrispondente
                if (typeof libraryMgr !== 'undefined' && libraryMgr) {
                    openLibraryFrom(side);
                } else {
                    toast('Connetti Google Drive per usare la libreria', 'info');
                }
            }
        });
    });
}

function openLibraryFrom(side) {
    const panel = document.getElementById('library-panel');
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    const currentSide = panel.dataset.side || 'left';

    if (isOpen && currentSide === side) {
        // Chiudi
        panel.classList.remove('open');
        document.getElementById(`lib-tab-${side}`)?.classList.remove('lib-tab--active');
        return;
    }

    // Aggiorna lato
    panel.dataset.side = side;
    if (side === 'right') {
        panel.classList.add('from-right');
    } else {
        panel.classList.remove('from-right');
    }

    // Chiudi tab opposta
    const otherSide = side === 'left' ? 'right' : 'left';
    document.getElementById(`lib-tab-${otherSide}`)?.classList.remove('lib-tab--active');
    document.getElementById(`lib-tab-${side}`)?.classList.add('lib-tab--active');

    panel.classList.add('open');
    if (typeof libraryMgr !== 'undefined' && libraryMgr) {
        libraryMgr.refresh();
    }
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
// SEZIONE 13a — PanManager
// Strumento mano: trascina per scorrere la lavagna + zoom con scroll/pinch
// =============================================================================

class PanManager {
    constructor() {
        this.active = false;
        this.dx = 0;
        this.dy = 0;
        this.scale = 1;
        this._drag = { on: false, startX: 0, startY: 0, origDx: 0, origDy: 0 };
        this._pinch = { active: false, initialDist: 0, initialScale: 1 };
        this._zoomIndicatorTimer = null;
        this._setupScrollZoom();
        this._setupPinchZoom();
    }

    activate() {
        this.active = true;
        this._setCursor('grab');
    }

    deactivate() {
        this.active = false;
        this._setCursor('crosshair');
    }

    onPointerDown(clientX, clientY) {
        this._drag = { on: true, startX: clientX, startY: clientY, origDx: this.dx, origDy: this.dy };
        this._setCursor('grabbing');
    }

    onPointerMove(clientX, clientY) {
        if (!this._drag.on) return;
        this.dx = this._drag.origDx + (clientX - this._drag.startX);
        this.dy = this._drag.origDy + (clientY - this._drag.startY);
        this._applyTransform();
    }

    onPointerUp() {
        this._drag.on = false;
        this._setCursor('grab');
    }

    resetPan() {
        this.dx = 0;
        this.dy = 0;
        this.scale = 1;
        this._applyTransform();
    }

    centerView() {
        // Centra la vista: parte dal centro del canvas 3× viewport
        // così si può andare in tutte le direzioni ugualmente
        const area = document.getElementById('canvas-area');
        if (!area) return;
        const canvas = document.getElementById('draw-canvas');
        if (!canvas) return;
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const vW = window.innerWidth;
        const headerH = document.body.classList.contains('fullscreen-mode') ? 0 : 56;
        const vH = window.innerHeight - headerH;
        // dx negativo: il canvas inizia al centro del viewport
        this.dx = -(canvasW - vW) / 2;
        this.dy = -(canvasH - vH) / 2;
        this._applyTransform();
    }

    // Converte coordinate client in coordinate canvas (tenendo conto di pan+zoom)
    getCanvasCoords(clientX, clientY) {
        const area = document.getElementById('canvas-area');
        const rect = area.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / this.scale,
            y: (clientY - rect.top) / this.scale
        };
    }

    _setupScrollZoom() {
        const area = document.getElementById('canvas-area');
        if (!area) return;
        area.addEventListener('wheel', (e) => {
            e.preventDefault();
            const oldScale = this.scale;
            const factor = e.deltaY < 0 ? 1.08 : 0.92;
            const newScale = Math.max(0.2, Math.min(4, oldScale * factor));

            // Zoom centrato sul centro del viewport (più stabile del cursore)
            const vw = window.innerWidth;
            const headerH = document.body.classList.contains('fullscreen-mode') ? 0 : 56;
            const vh = window.innerHeight - headerH;
            const pivotX = vw / 2;
            const pivotY = vh / 2;

            this.dx = pivotX - (pivotX - this.dx) * (newScale / oldScale);
            this.dy = pivotY - (pivotY - this.dy) * (newScale / oldScale);
            this.scale = newScale;
            this._applyTransform();
            this._showZoomIndicator();
        }, { passive: false });
    }

    _setupPinchZoom() {
        // Ascolta su document per catturare pinch da qualsiasi elemento
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Controlla che il pinch sia dentro l'area della lavagna
                const area = document.getElementById('canvas-area');
                if (!area) return;
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                this._pinch = {
                    active: true,
                    initialDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
                    initialScale: this.scale,
                    initialDx: this.dx,
                    initialDy: this.dy,
                    midX: (t1.clientX + t2.clientX) / 2,
                    midY: (t1.clientY + t2.clientY) / 2
                };
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this._pinch.active && e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const newScale = Math.max(0.2, Math.min(4,
                    this._pinch.initialScale * (newDist / this._pinch.initialDist)));

                // Pivot sul centro del pinch iniziale
                const pivotX = this._pinch.midX;
                const pivotY = this._pinch.midY;
                this.dx = pivotX - (pivotX - this._pinch.initialDx) * (newScale / this._pinch.initialScale);
                this.dy = pivotY - (pivotY - this._pinch.initialDy) * (newScale / this._pinch.initialScale);
                this.scale = newScale;
                this._applyTransform();
                this._showZoomIndicator();
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this._pinch.active = false;
            }
        });
    }

    _applyTransform() {
        // Applica la transform CSS a #canvas-area (container di tutti i canvas)
        const area = document.getElementById('canvas-area');
        if (area) {
            area.style.transform = `translate(${this.dx}px, ${this.dy}px) scale(${this.scale})`;
            area.style.transformOrigin = '0 0';
        }
    }

    _showZoomIndicator() {
        let indicator = document.getElementById('zoom-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            document.body.appendChild(indicator);
        }
        indicator.textContent = Math.round(this.scale * 100) + '%';
        indicator.classList.add('visible');
        clearTimeout(this._zoomIndicatorTimer);
        this._zoomIndicatorTimer = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 1500);
    }

    _setCursor(cursor) {
        const el = document.getElementById('overlay-canvas');
        if (el) el.style.cursor = cursor;
    }
}

// =============================================================================
// SEZIONE 13b — SelectManager
// Strumento freccia/dito: selezione rettangolare e spostamento
// =============================================================================

class SelectManager {
    constructor(drawCanvas, bgCanvas) {
        this.drawCanvas = drawCanvas;
        this.bgCanvas   = bgCanvas;
        this.ctx        = drawCanvas.getContext('2d');
        this.active     = false;   // strumento attivo
        this.selection  = null;    // { x, y, w, h } rettangolo selezionato
        this.dragData   = null;    // { startX, startY, imgData, selX, selY }
        this.phase      = 'idle'; // 'idle' | 'selecting' | 'selected' | 'dragging' | 'object-selected' | 'object-dragging'
        this.startX     = 0;
        this.startY     = 0;
        this.selectedObject = null; // oggetto ObjectLayer selezionato
        this._objDragStart  = null; // {x, y, origObjX, origObjY}
        this._setupContextPanel();
    }

    activate() {
        this.active = true;
        this.phase = 'idle';
        this.selection = null;
        this.selectedObject = null;
        // Cursore sull'overlay
        const oc = document.getElementById('overlay-canvas');
        if (oc) oc.style.cursor = 'crosshair';
    }
    deactivate() {
        this.active = false;
        this._clearSelection();
        this._hideContextPanel();
    }

    _setupContextPanel() {
        const panel = document.getElementById('object-context-panel');
        if (!panel) return;

        document.getElementById('ctx-bring-front')?.addEventListener('click', () => {
            if (this.selectedObject) {
                objectLayer.bringToFront(this.selectedObject.id);
                this._updateSelectionOverlay();
            }
        });
        document.getElementById('ctx-send-back')?.addEventListener('click', () => {
            if (this.selectedObject) {
                objectLayer.sendToBack(this.selectedObject.id);
                this._updateSelectionOverlay();
            }
        });
        document.getElementById('ctx-delete')?.addEventListener('click', () => {
            if (this.selectedObject) {
                objectLayer.removeObject(this.selectedObject.id);
                this.selectedObject = null;
                this._clearSelection();
                this._hideContextPanel();
            }
        });

        const bInput = document.getElementById('ctx-brightness');
        const cInput = document.getElementById('ctx-contrast');
        const sInput = document.getElementById('ctx-saturation');
        [bInput, cInput, sInput].forEach(input => {
            if (!input) return;
            input.addEventListener('input', () => {
                if (!this.selectedObject) return;
                objectLayer.updateFilter(
                    this.selectedObject.id,
                    parseInt(bInput?.value || 100),
                    parseInt(cInput?.value || 100),
                    parseInt(sInput?.value || 100)
                );
            });
        });
    }

    _showContextPanel(obj) {
        const panel = document.getElementById('object-context-panel');
        if (!panel) return;
        const area = document.getElementById('canvas-area');
        const rect = area.getBoundingClientRect();
        const scale = (typeof panMgr !== 'undefined' && panMgr) ? panMgr.scale : 1;
        const screenX = rect.left + obj.x * scale;
        const screenY = rect.top + obj.y * scale;
        panel.style.left = Math.min(screenX + obj.w * scale + 8, window.innerWidth - 180) + 'px';
        panel.style.top  = Math.max(screenY, 60) + 'px';
        panel.style.display = 'flex';
        // Aggiorna valori slider
        const f = obj.filter || { brightness: 100, contrast: 100, saturation: 100 };
        const bInput = document.getElementById('ctx-brightness');
        const cInput = document.getElementById('ctx-contrast');
        const sInput = document.getElementById('ctx-saturation');
        if (bInput) bInput.value = f.brightness;
        if (cInput) cInput.value = f.contrast;
        if (sInput) sInput.value = f.saturation;
    }

    _hideContextPanel() {
        const panel = document.getElementById('object-context-panel');
        if (panel) panel.style.display = 'none';
    }

    _updateSelectionOverlay() {
        if (!this.selectedObject) return;
        this._drawSelectionRect(
            this.selectedObject.x, this.selectedObject.y,
            this.selectedObject.w, this.selectedObject.h, true
        );
        this._showContextPanel(this.selectedObject);
    }

    // Disegna il rettangolo di selezione tratteggiato sull'overlay
    // isObject=true → colore blu acceso per oggetti ObjectLayer
    _drawSelectionRect(x, y, w, h, isObject = false) {
        const oc  = document.getElementById('overlay-canvas');
        const ctx = oc.getContext('2d');
        ctx.clearRect(0, 0, oc.width, oc.height);
        ctx.save();
        ctx.strokeStyle = isObject ? '#22d3ee' : '#3b82f6';
        ctx.lineWidth   = isObject ? 2 : 1.5;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(x, y, w, h);
        // Handle angoli
        ctx.fillStyle   = 'white';
        ctx.strokeStyle = isObject ? '#22d3ee' : '#3b82f6';
        ctx.lineWidth   = 1;
        ctx.setLineDash([]);
        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
        ctx.restore();
    }

    _clearSelection() {
        const oc = document.getElementById('overlay-canvas');
        if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
        this.selection = null;
        this.selectedObject = null;
        this.phase     = 'idle';
        this._hideContextPanel();
    }

    // Deseleziona solo la selezione pixel (non l'oggetto)
    _clearPixelSelection() {
        const oc = document.getElementById('overlay-canvas');
        if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
        this.selection = null;
    }

    onPointerDown(x, y) {
        if (!this.active) return false;

        // 1. Hit test su ObjectLayer (priorità su selezione pixel)
        if (typeof objectLayer !== 'undefined' && objectLayer) {
            const hit = objectLayer.hitTest(x, y);
            if (hit) {
                // Se avevo un oggetto selezionato e clicco su di lui → drag
                if (this.phase === 'object-selected' && this.selectedObject?.id === hit.id) {
                    this.phase = 'object-dragging';
                    this._objDragStart = { x, y, origX: hit.x, origY: hit.y };
                    return true;
                }
                // Seleziona nuovo oggetto
                this.selectedObject = hit;
                this.phase = 'object-selected';
                this._clearPixelSelection();
                this._drawSelectionRect(hit.x, hit.y, hit.w, hit.h, true);
                this._showContextPanel(hit);
                return true;
            }
        }

        // 2. Click fuori da qualsiasi oggetto: deseleziona oggetto se c'era
        if (this.phase === 'object-selected' || this.phase === 'object-dragging') {
            this.selectedObject = null;
            this._clearSelection();
            this._hideContextPanel();
        }

        // 3. Selezione pixel rettangolare
        if (this.phase === 'selected' && this.selection) {
            const { x: sx, y: sy, w, h } = this.selection;
            // Dentro la selezione → inizia drag
            if (x >= sx && x <= sx + w && y >= sy && y <= sy + h) {
                this.phase    = 'dragging';
                this.dragData = {
                    startX: x,
                    startY: y,
                    imgData: this.ctx.getImageData(sx, sy, w, h),
                    selX:   sx,
                    selY:   sy,
                };
                // Cancella l'area originale
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.fillStyle = 'rgba(255,255,255,1)';
                this.ctx.fillRect(sx, sy, w, h);
                this.ctx.restore();
                return true;
            }
        }

        // Nuova selezione rettangolare
        this.phase  = 'selecting';
        this.startX = x;
        this.startY = y;
        this._clearSelection();
        return true;
    }

    onPointerMove(x, y) {
        if (!this.active) return false;

        // Drag oggetto ObjectLayer
        if (this.phase === 'object-dragging' && this._objDragStart && this.selectedObject) {
            const dx = x - this._objDragStart.x;
            const dy = y - this._objDragStart.y;
            const newX = this._objDragStart.origX + dx;
            const newY = this._objDragStart.origY + dy;
            this.selectedObject.x = newX;
            this.selectedObject.y = newY;
            objectLayer.render();
            this._drawSelectionRect(newX, newY, this.selectedObject.w, this.selectedObject.h, true);
            this._showContextPanel(this.selectedObject);
            return true;
        }

        if (this.phase === 'selecting') {
            const rx = Math.min(x, this.startX);
            const ry = Math.min(y, this.startY);
            const rw = Math.abs(x - this.startX);
            const rh = Math.abs(y - this.startY);
            this._drawSelectionRect(rx, ry, rw, rh);
            return true;
        }

        if (this.phase === 'dragging' && this.dragData) {
            const dx   = x - this.dragData.startX;
            const dy   = y - this.dragData.startY;
            const newX = this.dragData.selX + dx;
            const newY = this.dragData.selY + dy;
            const { w, h } = this.selection;

            // Preview su overlay
            const oc  = document.getElementById('overlay-canvas');
            const ctx = oc.getContext('2d');
            ctx.clearRect(0, 0, oc.width, oc.height);

            const tmp = document.createElement('canvas');
            tmp.width  = w;
            tmp.height = h;
            tmp.getContext('2d').putImageData(this.dragData.imgData, 0, 0);
            ctx.drawImage(tmp, newX, newY);

            this._drawSelectionRect(newX, newY, w, h);
            return true;
        }

        return this.phase !== 'idle';
    }

    onPointerUp(x, y) {
        if (!this.active) return false;

        // Fine drag oggetto ObjectLayer
        if (this.phase === 'object-dragging' && this.selectedObject) {
            this.phase = 'object-selected';
            this._objDragStart = null;
            this._drawSelectionRect(this.selectedObject.x, this.selectedObject.y,
                this.selectedObject.w, this.selectedObject.h, true);
            this._showContextPanel(this.selectedObject);
            return true;
        }

        if (this.phase === 'selecting') {
            const rx = Math.min(x, this.startX);
            const ry = Math.min(y, this.startY);
            const rw = Math.abs(x - this.startX);
            const rh = Math.abs(y - this.startY);
            if (rw > 2 && rh > 2) {
                this.selection = { x: rx, y: ry, w: rw, h: rh };
                this.phase     = 'selected';
                this._drawSelectionRect(rx, ry, rw, rh);
            } else {
                this._clearSelection();
            }
            return true;
        }

        if (this.phase === 'dragging' && this.dragData) {
            const dx   = x - this.dragData.startX;
            const dy   = y - this.dragData.startY;
            const newX = this.dragData.selX + dx;
            const newY = this.dragData.selY + dy;
            const { w, h } = this.selection;

            // Deposita definitivamente sul draw-canvas
            const tmp = document.createElement('canvas');
            tmp.width  = w;
            tmp.height = h;
            tmp.getContext('2d').putImageData(this.dragData.imgData, 0, 0);
            this.ctx.drawImage(tmp, newX, newY);

            // Aggiorna selezione e overlay
            this.selection = { x: newX, y: newY, w, h };
            this.phase     = 'selected';
            const oc = document.getElementById('overlay-canvas');
            oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
            this._drawSelectionRect(newX, newY, w, h);
            this.dragData = null;
            return true;
        }

        return false;
    }

    // Gestisce Escape (deseleziona) e Delete/Backspace (cancella area selezionata o oggetto)
    handleKeydown(e) {
        if (!this.active) return;
        if (e.key === 'Escape') {
            this._clearSelection();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Elimina oggetto ObjectLayer selezionato
            if ((this.phase === 'object-selected') && this.selectedObject) {
                objectLayer.removeObject(this.selectedObject.id);
                this._clearSelection();
                return;
            }
            // Cancella selezione pixel
            if (this.phase === 'selected' && this.selection) {
                const { x, y, w, h } = this.selection;
                this.ctx.save();
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.fillStyle = 'rgba(255,255,255,1)';
                this.ctx.fillRect(x, y, w, h);
                this.ctx.restore();
                this._clearSelection();
            }
        }
    }
}

// =============================================================================
// SEZIONE 13b2 — ObjectLayer
// Gestisce gli oggetti importati (immagini/PDF) su un canvas separato.
// =============================================================================

class ObjectLayer {
    constructor() {
        this.canvas = document.getElementById('objects-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.objects = []; // Array di oggetti: {id, type, img, x, y, w, h, rotation, originalW, originalH, filter}
        this._nextId = 1;
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.render();
    }

    addObject(type, img, x, y, w, h) {
        const obj = {
            id: this._nextId++,
            type, // 'image' | 'pdf-page'
            img,  // HTMLImageElement o HTMLCanvasElement
            x, y, w, h,
            originalW: img.naturalWidth || img.width || w,
            originalH: img.naturalHeight || img.height || h,
            rotation: 0,
            filter: { brightness: 100, contrast: 100, saturation: 100 }
        };
        this.objects.push(obj);
        this.render();
        return obj;
    }

    removeObject(id) {
        this.objects = this.objects.filter(o => o.id !== id);
        this.render();
    }

    bringToFront(id) {
        const idx = this.objects.findIndex(o => o.id === id);
        if (idx < 0 || idx === this.objects.length - 1) return;
        const obj = this.objects.splice(idx, 1)[0];
        this.objects.push(obj);
        this.render();
    }

    sendToBack(id) {
        const idx = this.objects.findIndex(o => o.id === id);
        if (idx <= 0) return;
        const obj = this.objects.splice(idx, 1)[0];
        this.objects.unshift(obj);
        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const obj of this.objects) {
            ctx.save();
            // Applica filtri CSS canvas
            if (obj.filter) {
                ctx.filter = `brightness(${obj.filter.brightness}%) contrast(${obj.filter.contrast}%) saturate(${obj.filter.saturation}%)`;
            } else {
                ctx.filter = 'none';
            }
            if (obj.rotation) {
                const cx = obj.x + obj.w / 2;
                const cy = obj.y + obj.h / 2;
                ctx.translate(cx, cy);
                ctx.rotate(obj.rotation * Math.PI / 180);
                ctx.drawImage(obj.img, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
            } else {
                ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
            }
            ctx.filter = 'none';
            ctx.restore();
        }
    }

    // Hit test: restituisce l'oggetto sotto (x,y) o null. Cerca dall'alto (ultimo prima)
    hitTest(x, y) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o;
        }
        return null;
    }

    // Sposta un oggetto (delta assoluto)
    moveObject(id, dx, dy) {
        const obj = this.objects.find(o => o.id === id);
        if (!obj) return;
        obj.x += dx;
        obj.y += dy;
        this.render();
    }

    // Ridimensiona un oggetto mantenendo le proporzioni
    resizeObject(id, newW) {
        const obj = this.objects.find(o => o.id === id);
        if (!obj) return;
        const ratio = obj.originalH / obj.originalW;
        obj.w = newW;
        obj.h = newW * ratio;
        this.render();
    }

    // Aggiorna filtri
    updateFilter(id, brightness, contrast, saturation) {
        const obj = this.objects.find(o => o.id === id);
        if (!obj) return;
        obj.filter = { brightness, contrast, saturation };
        this.render();
    }

    // Serializza per salvataggio
    serialize() {
        return this.objects.map(o => {
            const tmp = document.createElement('canvas');
            const srcW = o.img.naturalWidth || o.img.width || o.w;
            const srcH = o.img.naturalHeight || o.img.height || o.h;
            tmp.width = srcW;
            tmp.height = srcH;
            tmp.getContext('2d').drawImage(o.img, 0, 0);
            return {
                id: o.id, type: o.type, dataUrl: tmp.toDataURL(),
                x: o.x, y: o.y, w: o.w, h: o.h,
                rotation: o.rotation,
                originalW: o.originalW, originalH: o.originalH,
                filter: o.filter
            };
        });
    }

    // Carica da serializzato
    async loadSerialized(arr) {
        this.objects = [];
        for (const item of arr) {
            const img = new Image();
            await new Promise(r => { img.onload = r; img.src = item.dataUrl; });
            this.objects.push({ ...item, img });
        }
        this._nextId = Math.max(...this.objects.map(o => o.id), 0) + 1;
        this.render();
    }

    clear() {
        this.objects = [];
        this.render();
    }
}

// =============================================================================
// SEZIONE 13c — Sfondi da Google Drive
// Carica e mostra le miniature della cartella "Sfondi" nel bg-popup.
// =============================================================================

async function loadDriveBackgrounds() {
    const section = document.getElementById('bg-drive-section');
    const grid    = document.getElementById('bg-drive-images');
    if (!section || !grid) return;

    // Mostra sezione solo se Drive connesso
    if (typeof driveMgr === 'undefined' || !driveMgr || !driveMgr.isConnected()) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    grid.innerHTML = '<div class="bg-drive-loading">Caricamento...</div>';

    try {
        const images = await driveMgr.listBackgrounds();
        if (!images.length) {
            grid.innerHTML = '<div class="bg-drive-empty">Nessun sfondo nella cartella Drive</div>';
            return;
        }
        grid.innerHTML = '';
        for (const img of images) {
            const thumb = document.createElement('div');
            thumb.className = 'bg-drive-thumb';
            thumb.title = img.name;
            if (img.thumbnailLink) {
                thumb.style.backgroundImage = `url('${img.thumbnailLink}')`;
                thumb.style.backgroundSize = 'cover';
                thumb.style.backgroundPosition = 'center';
            } else {
                thumb.textContent = img.mimeType === 'application/pdf' ? '📄' : '🖼️';
            }
            // Mostra badge se PDF
            if (img.mimeType === 'application/pdf') {
                const badge = document.createElement('span');
                badge.textContent = 'PDF';
                badge.style.cssText = 'position:absolute;bottom:2px;right:2px;background:rgba(239,68,68,0.85);color:white;font-size:9px;padding:1px 3px;border-radius:2px;line-height:1.2';
                thumb.style.position = 'relative';
                thumb.appendChild(badge);
            }
            thumb.addEventListener('click', async () => {
                if (img.mimeType === 'application/pdf') {
                    toast('I PDF come sfondo non sono supportati — usa Importa per aggiungerli come oggetto', 'info');
                    return;
                }
                toast('Caricamento...', 'info');
                try {
                    const token = driveMgr.accessToken;
                    if (!token) { toast('Connetti Drive prima', 'error'); return; }
                    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${img.id}?alt=media`, {
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const blob = await res.blob();
                    const url  = URL.createObjectURL(blob);
                    const image = new Image();
                    image.onload = () => {
                        // Aggiunge come oggetto sul canvas (non come sfondo)
                        const center = getViewportCenter();
                        const x = center.x - image.naturalWidth / 2;
                        const y = center.y - image.naturalHeight / 2;
                        objectLayer.addObject('image', image,
                            Math.max(0, x), Math.max(0, y),
                            image.naturalWidth, image.naturalHeight);
                        const popup = document.getElementById('bg-popup');
                        if (popup) popup.style.display = 'none';
                        toast('Immagine aggiunta alla lavagna! Usa Seleziona per spostarla.', 'success');
                        URL.revokeObjectURL(url);
                    };
                    image.onerror = () => toast('Errore caricamento immagine', 'error');
                    image.src = url;
                } catch (err) {
                    toast('Errore: ' + err.message, 'error');
                }
            });
            grid.appendChild(thumb);
        }
    } catch (err) {
        grid.innerHTML = `<div class="bg-drive-empty" style="color:#ef4444">Errore: ${err.message}</div>`;
    }
}

// =============================================================================
// SEZIONE 13d — Import Media (immagini e PDF come oggetti sul canvas)
// =============================================================================

/**
 * Calcola il centro del viewport visibile in coordinate canvas
 * (tenendo conto del pan e dello zoom corrente).
 */
function getViewportCenter() {
    const vw = window.innerWidth;
    const headerH = document.body.classList.contains('fullscreen-mode') ? 0 : 56;
    const vh = window.innerHeight - headerH;
    const area = document.getElementById('canvas-area');
    const rect = area.getBoundingClientRect();
    const scale = (typeof panMgr !== 'undefined' && panMgr) ? panMgr.scale : 1;
    const cx = (vw / 2 - rect.left) / scale;
    const cy = (vh / 2 - rect.top) / scale;
    return { x: cx, y: cy };
}

/**
 * Importa un file immagine come oggetto sul canvas.
 * @param {File} file
 * @param {number} [clientX] - posizione X del drop (opzionale, usa centro se omesso)
 * @param {number} [clientY] - posizione Y del drop (opzionale, usa centro se omesso)
 */
async function importImageFile(file, clientX, clientY) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    return new Promise((resolve) => {
        img.onload = () => {
            let x, y;
            if (clientX !== undefined && clientY !== undefined) {
                // Drop position
                const area = document.getElementById('canvas-area');
                const rect = area.getBoundingClientRect();
                const scale = (typeof panMgr !== 'undefined' && panMgr) ? panMgr.scale : 1;
                x = (clientX - rect.left) / scale - img.naturalWidth / 2;
                y = (clientY - rect.top) / scale - img.naturalHeight / 2;
            } else {
                const center = getViewportCenter();
                x = center.x - img.naturalWidth / 2;
                y = center.y - img.naturalHeight / 2;
            }
            objectLayer.addObject('image', img, Math.max(0, x), Math.max(0, y),
                img.naturalWidth, img.naturalHeight);
            URL.revokeObjectURL(url);
            toast('Immagine importata! Usa Seleziona per spostarla.', 'success');
            resolve();
        };
        img.onerror = () => {
            toast('Errore nel caricare l\'immagine', 'error');
            URL.revokeObjectURL(url);
            resolve();
        };
        img.src = url;
    });
}

/**
 * Importa un PDF (prima pagina) come oggetto sul canvas tramite PDF.js.
 * @param {File} file
 * @param {number} [clientX]
 * @param {number} [clientY]
 */
async function importPdfFile(file, clientX, clientY) {
    if (typeof pdfjsLib === 'undefined') {
        toast('PDF non supportato — converti in immagine (JPG/PNG)', 'error');
        return;
    }
    try {
        toast('Caricamento PDF...', 'info');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const tmp = document.createElement('canvas');
        tmp.width = viewport.width;
        tmp.height = viewport.height;
        const tmpCtx = tmp.getContext('2d');
        await page.render({ canvasContext: tmpCtx, viewport }).promise;

        // Crea Image dal canvas PDF
        const img = new Image();
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = tmp.toDataURL();
        });

        let x, y;
        if (clientX !== undefined && clientY !== undefined) {
            const area = document.getElementById('canvas-area');
            const rect = area.getBoundingClientRect();
            const scale = (typeof panMgr !== 'undefined' && panMgr) ? panMgr.scale : 1;
            x = (clientX - rect.left) / scale - img.naturalWidth / 2;
            y = (clientY - rect.top) / scale - img.naturalHeight / 2;
        } else {
            const center = getViewportCenter();
            x = center.x - img.naturalWidth / 2;
            y = center.y - img.naturalHeight / 2;
        }
        objectLayer.addObject('pdf-page', img, Math.max(0, x), Math.max(0, y),
            img.naturalWidth, img.naturalHeight);
        toast('PDF importato (pagina 1)! Usa Seleziona per spostarla.', 'success');
    } catch (err) {
        toast('Errore PDF: ' + err.message, 'error');
    }
}

// =============================================================================
// SEZIONE 14 — INIT
// Istanziazione globale dei manager e avvio dell'applicazione.
// =============================================================================

let bgMgr, brush, laserMgr, canvasMgr, toolbarMgr, textMgr, projectMgr, selectMgr, panMgr, objectLayer;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inizializza i manager nell'ordine corretto (le dipendenze prima)
    bgMgr      = new BackgroundManager();
    brush      = new BrushEngine();
    laserMgr   = new LaserManager(document.getElementById('overlay-canvas'));
    canvasMgr  = new CanvasManager(bgMgr, brush, laserMgr);
    objectLayer = new ObjectLayer();
    selectMgr  = new SelectManager(
        document.getElementById('draw-canvas'),
        document.getElementById('bg-canvas')
    );
    panMgr     = new PanManager();
    panMgr.centerView();
    toolbarMgr = new ToolbarManager();
    textMgr    = new TextManager();
    projectMgr = new ProjectManager();
    new PWAManager();
    setupKeyboard();
    setupFullscreen();    // Feature 5
    setupProjectName();   // Feature 6
    setupLibraryTabs();   // Feature A: linguette libreria laterali

    // 2. Pulsanti header
    document.getElementById('btn-save').addEventListener('click',   () => projectMgr.save());
    document.getElementById('btn-export').addEventListener('click', () => _printBoard());
    document.getElementById('btn-new').addEventListener('click',    () => projectMgr.newBoard());

    // 3. Avviso modifiche non salvate alla chiusura finestra/tab
    window.addEventListener('beforeunload', (e) => {
        if (CONFIG.isDirty) {
            e.preventDefault();
            e.returnValue = 'Hai modifiche non salvate. Vuoi davvero uscire?';
        }
    });

    console.log('EduBoard v2 \u2014 pronto!');
    setTimeout(() => toast('Benvenuto in EduBoard! Clicca \u25b2 per gli strumenti', 'info'), 800);
});

// =============================================================================
// SEZIONE 14 — STAMPA PDF
// Apre finestra di stampa con l'intera lavagna (come OneNote)
// =============================================================================

function _printBoard() {
    // Componi bg + draw in un canvas temporaneo
    const tmp    = document.createElement('canvas');
    tmp.width    = canvasMgr.canvas.width;
    tmp.height   = canvasMgr.canvas.height;
    const ctx    = tmp.getContext('2d');
    const bgCvs  = document.getElementById('bg-canvas');
    if (bgCvs) ctx.drawImage(bgCvs, 0, 0);
    ctx.drawImage(canvasMgr.canvas, 0, 0);
    const dataURL = tmp.toDataURL('image/png');

    const win = window.open('', '_blank');
    if (!win) { toast('Popup bloccato — abilita i popup per stampare.', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>EduBoard \u2014 Stampa</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
img{max-width:100%;max-height:100vh;object-fit:contain}
@media print{body{margin:0}img{width:100%;height:100vh;object-fit:contain;page-break-after:avoid}}
</style></head><body>
<img src="${dataURL}">
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000)}<\/script>
</body></html>`);
    win.document.close();
}
