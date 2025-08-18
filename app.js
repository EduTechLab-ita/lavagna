// Configurazione globale
const CONFIG = {
    tools: {
        pencil: { size: 4, color: '#000000', opacity: 1.0 },
        pen: { size: 4, color: '#000000', opacity: 1.0 },
        marker: { size: 12, color: '#FFFF00', opacity: 0.6 },
        fountain: { size: 6, color: '#000080', opacity: 1.0 },
        eraser: { size: 20 }
    },
    backgrounds: {
        blank: 'white',
        lines: 'repeating-linear-gradient(transparent, transparent 24px, #e2e8f0 24px, #e2e8f0 25px)',
        squares: 'repeating-linear-gradient(0deg, #e2e8f0, #e2e8f0 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #e2e8f0, #e2e8f0 1px, transparent 1px, transparent 20px)',
        music: 'repeating-linear-gradient(transparent, transparent 15px, #e2e8f0 15px, #e2e8f0 16px, transparent 16px, transparent 31px, #e2e8f0 31px, #e2e8f0 32px, transparent 32px, transparent 47px, #e2e8f0 47px, #e2e8f0 48px, transparent 48px, transparent 63px, #e2e8f0 63px, #e2e8f0 64px, transparent 64px, transparent 79px, #e2e8f0 79px, #e2e8f0 80px)',
        dots: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)'
    }
};

// Stato globale dell'applicazione
const AppState = {
    currentTool: 'pencil',
    currentBackground: 'blank',
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    undoStack: [],
    redoStack: [],
    maxUndoSteps: 50,
    currentProject: 'Nuova Lavagna'
};

// Gestione Canvas
class CanvasManager {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Configurazione iniziale del contesto
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.applyBackground();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events per dispositivi mobili
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        if (AppState.currentTool === 'hand') return;
        
        AppState.isDrawing = true;
        const coords = this.getCoordinates(e);
        AppState.lastX = coords.x;
        AppState.lastY = coords.y;

        // Salva stato per undo
        this.saveState();

        if (AppState.currentTool === 'text') {
            this.addText(coords.x, coords.y);
            return;
        }

        this.setupBrush();
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
    }

    draw(e) {
        if (!AppState.isDrawing || AppState.currentTool === 'hand' || AppState.currentTool === 'text') return;

        const coords = this.getCoordinates(e);
        
        if (AppState.currentTool === 'eraser') {
            this.erase(coords.x, coords.y);
        } else {
            this.ctx.lineTo(coords.x, coords.y);
            this.ctx.stroke();
        }

        AppState.lastX = coords.x;
        AppState.lastY = coords.y;
    }

    stopDrawing() {
        if (AppState.isDrawing) {
            AppState.isDrawing = false;
            this.ctx.beginPath();
        }
    }

    setupBrush() {
        const tool = CONFIG.tools[AppState.currentTool];
        
        if (AppState.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = tool.size;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = tool.color;
            this.ctx.lineWidth = tool.size;
            this.ctx.globalAlpha = tool.opacity;
        }
    }

    erase(x, y) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.arc(x, y, CONFIG.tools.eraser.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    addText(x, y) {
        const text = prompt('Inserisci il testo:');
        if (text) {
            this.ctx.save();
            this.ctx.font = '16px Inter, sans-serif';
            this.ctx.fillStyle = CONFIG.tools[AppState.currentTool]?.color || '#000000';
            this.ctx.fillText(text, x, y);
            this.ctx.restore();
        }
    }

    applyBackground() {
        this.canvas.className = '';
        this.canvas.style.background = '';
        
        if (AppState.currentBackground === 'blank') {
            this.canvas.style.background = CONFIG.backgrounds.blank;
        } else {
            this.canvas.className = `canvas-${AppState.currentBackground}`;
        }
    }

    clear() {
        this.saveState();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    saveState() {
        AppState.undoStack.push(this.canvas.toDataURL());
        if (AppState.undoStack.length > AppState.maxUndoSteps) {
            AppState.undoStack.shift();
        }
        AppState.redoStack = [];
    }

    undo() {
        if (AppState.undoStack.length > 0) {
            AppState.redoStack.push(this.canvas.toDataURL());
            const previousState = AppState.undoStack.pop();
            this.loadState(previousState);
        }
    }

    redo() {
        if (AppState.redoStack.length > 0) {
            AppState.undoStack.push(this.canvas.toDataURL());
            const nextState = AppState.redoStack.pop();
            this.loadState(nextState);
        }
    }

    loadState(dataURL) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataURL;
    }
}

// Gestione Toolbar
class ToolbarManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.setupToolButtons();
        this.setupPanels();
        this.setupControls();
    }

    setupToolButtons() {
        // Gestione strumenti principali
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                if (tool) {
                    this.selectTool(tool);
                }
            });
        });

        // Gestione pannelli espandibili
        document.querySelectorAll('.toolbar-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                if (['pencil', 'pen', 'marker', 'fountain'].includes(tool)) {
                    this.togglePanel('pen-panel');
                }
            });
        });
    }

    selectTool(tool) {
        if (tool === 'clear') {
            if (confirm('Sei sicuro di voler cancellare tutto?')) {
                this.canvasManager.clear();
            }
            return;
        }

        if (tool === 'upload') {
            document.getElementById('file-input').click();
            return;
        }

        // Aggiorna stato
        AppState.currentTool = tool;

        // Aggiorna UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Aggiorna cursore
        this.updateCursor();
    }

    updateCursor() {
        const canvas = this.canvasManager.canvas;
        
        switch (AppState.currentTool) {
            case 'hand':
                canvas.style.cursor = 'grab';
                break;
            case 'eraser':
                canvas.style.cursor = 'crosshair';
                break;
            case 'text':
                canvas.style.cursor = 'text';
                break;
            default:
                canvas.style.cursor = 'crosshair';
        }
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        const isActive = panel.classList.contains('active');
        
        // Chiudi tutti i pannelli
        document.querySelectorAll('.expand-panel').forEach(p => {
            p.classList.remove('active');
        });

        // Apri il pannello selezionato se non era attivo
        if (!isActive) {
            panel.classList.add('active');
        }
    }

    setupPanels() {
        // Gestione dimensioni
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                CONFIG.tools[AppState.currentTool].size = size;
                
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Gestione colori
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.id === 'custom-color') {
                    document.getElementById('color-picker').click();
                    return;
                }

                const color = btn.dataset.color;
                CONFIG.tools[AppState.currentTool].color = color;
                
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Color picker personalizzato
        document.getElementById('color-picker').addEventListener('change', (e) => {
            const color = e.target.value;
            CONFIG.tools[AppState.currentTool].color = color;
            
            // Aggiorna il pulsante custom
            const customBtn = document.getElementById('custom-color');
            customBtn.style.background = color;
            
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            customBtn.classList.add('active');
        });

        // Gestione sfondi
        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bg = btn.dataset.bg;
                AppState.currentBackground = bg;
                this.canvasManager.applyBackground();
                
                document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    setupControls() {
        // Undo/Redo
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.canvasManager.undo();
        });

        document.getElementById('redo-btn').addEventListener('click', () => {
            this.canvasManager.redo();
        });

        // Chiusura pannelli quando si clicca fuori
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.floating-toolbar')) {
                document.querySelectorAll('.expand-panel').forEach(panel => {
                    panel.classList.remove('active');
                });
            }
        });
    }
}

// Gestione Progetti
class ProjectManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Pulsante progetti
        document.getElementById('projects-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Pulsante salva
        document.getElementById('save-btn').addEventListener('click', () => {
            this.showSaveModal();
        });

        // Chiusura sidebar
        document.getElementById('sidebar-close').addEventListener('click', () => {
            this.closeSidebar();
        });

        // Gestione cartelle
        document.querySelectorAll('.folder-header').forEach(header => {
            header.addEventListener('click', () => {
                this.toggleFolder(header);
            });
        });

        // Gestione progetti
        document.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadProject(item.dataset.project);
            });
        });

        // Form di salvataggio
        document.getElementById('save-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProject();
        });

        document.getElementById('cancel-save').addEventListener('click', () => {
            this.hideSaveModal();
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
    }

    toggleFolder(header) {
        const folder = header.parentElement;
        const content = folder.querySelector('.folder-content');
        const toggle = header.querySelector('.folder-toggle');
        
        if (content.style.display === 'none' || !content.style.display) {
            content.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
        }
    }

    showSaveModal() {
        document.getElementById('save-modal').classList.add('show');
        document.getElementById('project-name').focus();
    }

    hideSaveModal() {
        document.getElementById('save-modal').classList.remove('show');
        document.getElementById('save-form').reset();
    }

    saveProject() {
        const name = document.getElementById('project-name').value;
        const folder = document.getElementById('project-folder').value;
        
        if (!name.trim()) {
            alert('Inserisci un nome per il progetto');
            return;
        }

        // Salva nel localStorage
        const projectData = {
            name: name,
            folder: folder,
            canvas: canvasManager.canvas.toDataURL(),
            background: AppState.currentBackground,
            timestamp: new Date().toISOString()
        };

        const projects = JSON.parse(localStorage.getItem('eduboard-projects') || '{}');
        const projectId = `${folder}-${Date.now()}`;
        projects[projectId] = projectData;
        localStorage.setItem('eduboard-projects', JSON.stringify(projects));

        // Aggiorna nome progetto corrente
        AppState.currentProject = name;
        document.getElementById('project-info').textContent = name;

        this.hideSaveModal();
        this.showNotification('Progetto salvato con successo!');
    }

    loadProject(projectId) {
        const projects = JSON.parse(localStorage.getItem('eduboard-projects') || '{}');
        const project = projects[projectId];
        
        if (project) {
            // Carica il canvas
            const img = new Image();
            img.onload = () => {
                canvasManager.ctx.clearRect(0, 0, canvasManager.canvas.width, canvasManager.canvas.height);
                canvasManager.ctx.drawImage(img, 0, 0);
            };
            img.src = project.canvas;

            // Aggiorna stato
            AppState.currentProject = project.name;
            AppState.currentBackground = project.background;
            
            // Aggiorna UI
            document.getElementById('project-info').textContent = project.name;
            canvasManager.applyBackground();
            
            this.closeSidebar();
            this.showNotification(`Progetto "${project.name}" caricato!`);
        }
    }

    showNotification(message) {
        // Crea notifica temporanea
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success);
            color: white;
            padding: 12px 20px;
            border-radius: var(--radius-sm);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Gestione File Upload
class FileManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('file-input');
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag & Drop
        const canvas = this.canvasManager.canvas;
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.style.opacity = '0.7';
        });

        canvas.addEventListener('dragleave', () => {
            canvas.style.opacity = '1';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.style.opacity = '1';
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                this.loadImage(file);
            }
        });
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.canvasManager.saveState();
                
                // Calcola dimensioni per mantenere proporzioni
                const maxWidth = this.canvasManager.canvas.width * 0.8;
                const maxHeight = this.canvasManager.canvas.height * 0.8;
                
                let { width, height } = img;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                // Centra l'immagine
                const x = (this.canvasManager.canvas.width - width) / 2;
                const y = (this.canvasManager.canvas.height - height) / 2;

                this.canvasManager.ctx.drawImage(img, x, y, width, height);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Gestione PWA
class PWAManager {
    constructor() {
        this.setupServiceWorker();
        this.setupInstallPrompt();
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] Service Worker registrato:', registration);

                // Gestione aggiornamenti
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateBanner();
                        }
                    });
                });

                // Ascolta messaggi dal Service Worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data.type === 'UPDATE_AVAILABLE') {
                        this.showUpdateBanner();
                    }
                });

            } catch (error) {
                console.error('[PWA] Errore registrazione Service Worker:', error);
            }
        }
    }

    setupInstallPrompt() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.showInstallButton();
        });

        // Gestione installazione
        document.addEventListener('click', async (e) => {
            if (e.target.matches('.install-btn')) {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('[PWA] Installazione:', outcome);
                    deferredPrompt = null;
                }
            }
        });
    }

    showInstallButton() {
        // Mostra pulsante di installazione se non già presente
        if (!document.querySelector('.install-btn')) {
            const installBtn = document.createElement('button');
            installBtn.className = 'install-btn header-btn';
            installBtn.innerHTML = '📱 Installa App';
            document.querySelector('.header-right').appendChild(installBtn);
        }
    }

    showUpdateBanner() {
        const banner = document.getElementById('update-banner');
        banner.classList.add('show');

        document.getElementById('update-btn').addEventListener('click', () => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        });

        document.getElementById('dismiss-update').addEventListener('click', () => {
            banner.classList.remove('show');
        });
    }
}

// Gestione Scorciatoie da Tastiera
class KeyboardManager {
    constructor(canvasManager, projectManager) {
        this.canvasManager = canvasManager;
        this.projectManager = projectManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Previeni azioni di default per le nostre scorciatoie
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.projectManager.showSaveModal();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.canvasManager.redo();
                        } else {
                            this.canvasManager.undo();
                        }
                        break;
                    case 'n':
                        e.preventDefault();
                        if (confirm('Creare una nuova lavagna? Le modifiche non salvate andranno perse.')) {
                            this.canvasManager.clear();
                            AppState.currentProject = 'Nuova Lavagna';
                            document.getElementById('project-info').textContent = AppState.currentProject;
                        }
                        break;
                }
            }

            // Scorciatoie per strumenti (senza modificatori)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'p':
                        toolbarManager.selectTool('pencil');
                        break;
                    case 'b':
                        toolbarManager.selectTool('pen');
                        break;
                    case 'e':
                        toolbarManager.selectTool('eraser');
                        break;
                    case 't':
                        toolbarManager.selectTool('text');
                        break;
                    case 'h':
                        toolbarManager.selectTool('hand');
                        break;
                }
            }
        });
    }
}

// Inizializzazione App
let canvasManager, toolbarManager, projectManager, fileManager, pwaManager, keyboardManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 EduBoard - Inizializzazione...');

    // Inizializza componenti
    canvasManager = new CanvasManager();
    toolbarManager = new ToolbarManager(canvasManager);
    projectManager = new ProjectManager();
    fileManager = new FileManager(canvasManager);
    pwaManager = new PWAManager();
    keyboardManager = new KeyboardManager(canvasManager, projectManager);

    // Stato iniziale
    toolbarManager.selectTool('pencil');
    
    console.log('✅ EduBoard - Pronto!');
    
    // Mostra messaggio di benvenuto
    setTimeout(() => {
        projectManager.showNotification('Benvenuto in EduBoard! 🎨');
    }, 1000);
});

// Gestione errori globali
window.addEventListener('error', (e) => {
    console.error('Errore EduBoard:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rifiutata:', e.reason);
});

// Export per debug
window.EduBoard = {
    AppState,
    CONFIG,
    canvasManager,
    toolbarManager,
    projectManager
};