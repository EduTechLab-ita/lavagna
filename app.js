class EduBoard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.currentSize = 3;
        this.history = [];
        this.historyStep = -1;
        this.projects = JSON.parse(localStorage.getItem('eduboardProjects')) || {};
        this.currentProject = null;
        this.calibrationOffset = { x: 0, y: 0 };
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupGeometricTools();
        this.loadProjects();
        this.saveState();
        this.setupPWA();
    }

    initializeCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        this.canvas.width = Math.max(1920, rect.width);
        this.canvas.height = Math.max(1080, rect.height);
        
        this.ctx.putImageData(imageData, 0, 0);
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentSize;
    }

    setupEventListeners() {
        // Eventi canvas
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Eventi touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(this.createTouchEvent(touch));
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.draw(this.createTouchEvent(touch));
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });

        // Strumenti
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.target.closest('[data-tool]').dataset.tool);
            });
        });

        // Palette colori
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                this.setColor(e.target.dataset.color);
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        document.getElementById('custom-color-btn').addEventListener('click', () => {
            document.getElementById('color-picker').click();
        });

        document.getElementById('color-picker').addEventListener('change', (e) => {
            this.setColor(e.target.value);
        });

        // Controlli
        document.getElementById('brush-size').addEventListener('input', (e) => {
            this.currentSize = e.target.value;
            this.ctx.lineWidth = this.currentSize;
            document.getElementById('brush-size-display').textContent = `${this.currentSize}px`;
        });

        // Sfondi
        document.getElementById('background-select').addEventListener('change', (e) => {
            this.setBackground(e.target.value);
        });

        // Strumenti geometrici
        document.getElementById('ruler-tool').addEventListener('click', () => this.toggleRuler());
        document.getElementById('protractor-tool').addEventListener('click', () => this.toggleProtractor());

        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Azioni
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Schermo intero
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());

        // Gestione progetti
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('load-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('new-btn').addEventListener('click', () => this.newProject());

        // Modal
        document.getElementById('confirm-save').addEventListener('click', () => this.saveProject());
        document.getElementById('cancel-save').addEventListener('click', () => this.hideSaveModal());

        // Sidebar
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar());

        // Calibrazione
        document.getElementById('start-calibration').addEventListener('click', () => this.startCalibration());
        document.getElementById('skip-calibration').addEventListener('click', () => this.hideCalibrationModal());

        // Drag & Drop
        this.setupDragAndDrop();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    createTouchEvent(touch) {
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {}
        };
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX + this.calibrationOffset.x,
            y: (e.clientY - rect.top) * scaleY + this.calibrationOffset.y
        };
    }

    setTool(tool) {
        this.currentTool = tool;
        
        document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        
        switch(tool) {
            case 'pencil':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'pen':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'marker':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'fountain':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'eraser':
                this.canvas.style.cursor = 'grab';
                break;
            case 'text':
                this.canvas.style.cursor = 'text';
                break;
        }
    }

    setColor(color) {
        this.currentColor = color;
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
    }

    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;

        if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentSize * 2;
        } else if (this.currentTool === 'text') {
            this.addText(x, y);
            return;
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentSize;
            
            // Diversi stili per diversi strumenti
            switch(this.currentTool) {
                case 'pencil':
                    this.ctx.globalAlpha = 0.8;
                    break;
                case 'pen':
                    this.ctx.globalAlpha = 1.0;
                    break;
                case 'marker':
                    this.ctx.globalAlpha = 0.4;
                    this.ctx.lineWidth = this.currentSize * 3;
                    break;
                case 'fountain':
                    this.ctx.globalAlpha = 0.9;
                    this.ctx.lineWidth = this.currentSize * 1.5;
                    break;
            }
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    draw(e) {
        if (!this.isDrawing) return;

        const coords = this.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;

        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.globalAlpha = 1.0;
            this.saveState();
        }
    }

    addText(x, y) {
        const text = prompt('Inserisci il testo:');
        if (text) {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = this.currentColor;
            this.ctx.font = `${this.currentSize * 8}px Inter, sans-serif`;
            this.ctx.fillText(text, x, y);
            this.saveState();
        }
    }

    setBackground(type) {
        const canvas = this.canvas;
        
        canvas.classList.remove('canvas-lines', 'canvas-squares', 'canvas-music', 'canvas-dots');
        
        if (type !== 'blank') {
            canvas.classList.add(`canvas-${type}`);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Errore schermo intero:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    showCalibrationModal() {
        document.getElementById('calibration-modal').style.display = 'flex';
    }

    hideCalibrationModal() {
        document.getElementById('calibration-modal').style.display = 'none';
    }

    startCalibration() {
        let currentPoint = 0;
        const points = [
            { x: 100, y: 100 },
            { x: this.canvas.width - 100, y: 100 },
            { x: 100, y: this.canvas.height - 100 },
            { x: this.canvas.width - 100, y: this.canvas.height - 100 }
        ];
        const calibrationData = [];
        
        const calibrationPoints = document.querySelectorAll('.calibration-point');
        
        const handleCalibrationClick = (e) => {
            if (currentPoint >= points.length) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            calibrationData.push({
                expected: points[currentPoint],
                actual: { x: clickX, y: clickY }
            });
            
            calibrationPoints[currentPoint].style.background = '#10B981';
            currentPoint++;
            
            if (currentPoint >= points.length) {
                // Calcola offset medio
                let offsetX = 0, offsetY = 0;
                calibrationData.forEach(data => {
                    offsetX += data.expected.x - data.actual.x;
                    offsetY += data.expected.y - data.actual.y;
                });
                
                this.calibrationOffset = {
                    x: offsetX / calibrationData.length,
                    y: offsetY / calibrationData.length
                };
                
                this.canvas.removeEventListener('click', handleCalibrationClick);
                this.hideCalibrationModal();
                this.showNotification('Calibrazione completata! Offset applicato.');
            }
        };
        
        this.canvas.addEventListener('click', handleCalibrationClick);
        this.hideCalibrationModal();
        this.showNotification('Tocca i 4 angoli dello schermo nell\'ordine: alto-sx, alto-dx, basso-sx, basso-dx');
    }

    toggleRuler() {
        const ruler = document.getElementById('ruler');
        if (ruler.style.display === 'none') {
            ruler.style.display = 'block';
            ruler.style.left = '100px';
            ruler.style.top = '100px';
            this.makeGeometricToolDraggable(ruler);
        } else {
            ruler.style.display = 'none';
        }
    }

    toggleProtractor() {
        const protractor = document.getElementById('protractor');
        if (protractor.style.display === 'none') {
            protractor.style.display = 'block';
            protractor.style.left = '200px';
            protractor.style.top = '150px';
            this.makeGeometricToolDraggable(protractor);
        } else {
            protractor.style.display = 'none';
        }
    }

    setupGeometricTools() {
        const rulerMarks = document.querySelector('.ruler-marks');
        if (rulerMarks) {
            for (let i = 0; i <= 40; i++) {
                const mark = document.createElement('div');
                mark.style.position = 'absolute';
                mark.style.left = `${i * 10}px`;
                mark.style.bottom = '0';
                mark.style.width = '1px';
                mark.style.height = i % 5 === 0 ? '15px' : '10px';
                mark.style.backgroundColor = 'var(--primary-color)';
                rulerMarks.appendChild(mark);
            }
        }
    }

    makeGeometricToolDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(element.style.left) || 0;
            initialY = parseInt(element.style.top) || 0;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                element.style.left = `${initialX + deltaX}px`;
                element.style.top = `${initialY + deltaY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'move';
        });
    }

    setupDragAndDrop() {
        const dropOverlay = document.getElementById('drop-overlay');
        
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropOverlay.style.display = 'flex';
        });

        document.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                dropOverlay.style.display = 'none';
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            dropOverlay.style.display = 'none';
            
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => this.processFile(file));
        });
    }

    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => this.processFile(file));
    }

    processFile(file) {
        const fileType = file.type;
        
        if (fileType.startsWith('image/')) {
            this.loadImage(file);
        } else if (fileType === 'application/pdf') {
            this.loadPDF(file);
        } else {
            alert('Tipo di file non supportato. Usa immagini o PDF.');
        }
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxWidth = this.canvas.width * 0.8;
                const maxHeight = this.canvas.height * 0.8;
                let { width, height } = img;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                const x = (this.canvas.width - width) / 2;
                const y = (this.canvas.height - height) / 2;
                
                this.ctx.drawImage(img, x, y, width, height);
                this.saveState();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    loadPDF(file) {
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(50, 50, 300, 400);
        this.ctx.fillStyle = '#333';
        this.ctx.font = '16px Inter';
        this.ctx.fillText('📄 PDF caricato:', 60, 80);
        this.ctx.fillText(file.name, 60, 100);
        this.ctx.fillText('(Funzionalità PDF in sviluppo)', 60, 120);
        this.saveState();
    }

    clearCanvas() {
        if (confirm('Sei sicuro di voler cancellare tutto?')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.saveState();
        }
    }

    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        this.history.push(this.canvas.toDataURL());
        
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState();
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState();
        }
    }

    restoreState() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.history[this.historyStep];
    }

    showSaveModal() {
        document.getElementById('save-modal').style.display = 'flex';
        document.getElementById('project-name').focus();
    }

    hideSaveModal() {
        document.getElementById('save-modal').style.display = 'none';
    }

    saveProject() {
        const name = document.getElementById('project-name').value.trim();
        const folder = document.getElementById('project-folder').value;
        
        if (!name) {
            alert('Inserisci un nome per il progetto');
            return;
        }

        const projectData = {
            name: name,
            folder: folder,
            canvas: this.canvas.toDataURL(),
            timestamp: new Date().toISOString()
        };

        if (!this.projects[folder]) {
            this.projects[folder] = [];
        }

        this.projects[folder].push(projectData);
        localStorage.setItem('eduboardProjects', JSON.stringify(this.projects));
        
        this.currentProject = projectData;
        document.getElementById('current-project').textContent = name;
        
        this.hideSaveModal();
        this.loadProjects();
        
        this.showNotification('Progetto salvato con successo!');
    }

    loadProjects() {
        const folderStructure = document.querySelector('.folder-structure');
        
        Object.keys(this.projects).forEach(folderName => {
            let folder = document.querySelector(`[data-folder="${folderName}"]`);
            if (!folder) {
                folder = this.createFolderElement(folderName);
                folderStructure.appendChild(folder);
            }
            
            const folderContent = folder.querySelector('.folder-content');
            folderContent.innerHTML = '';
            
            this.projects[folderName].forEach((project, index) => {
                const projectElement = document.createElement('div');
                projectElement.className = 'project-item';
                projectElement.textContent = `📄 ${project.name}`;
                projectElement.addEventListener('click', () => this.loadProject(folderName, index));
                folderContent.appendChild(projectElement);
            });
        });
    }

    createFolderElement(folderName) {
        const folder = document.createElement('div');
        folder.className = 'folder';
        folder.setAttribute('data-folder', folderName);
        
        folder.innerHTML = `
            <div class="folder-header">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${folderName}</span>
                <button class="add-subfolder">+</button>
            </div>
            <div class="folder-content"></div>
        `;
        
        return folder;
    }

    loadProject(folderName, projectIndex) {
        const project = this.projects[folderName][projectIndex];
        
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
            this.saveState();
        };
        img.src = project.canvas;
        
        this.currentProject = project;
        document.getElementById('current-project').textContent = project.name;
        this.toggleSidebar();
    }

    newProject() {
        if (confirm('Creare un nuovo progetto? Le modifiche non salvate andranno perse.')) {
            this.clearCanvas();
            this.currentProject = null;
            document.getElementById('current-project').textContent = 'Nuovo Progetto';
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 's':
                    e.preventDefault();
                    this.showSaveModal();
                    break;
                case 'n':
                    e.preventDefault();
                    this.newProject();
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        }
    }

    setupPWA() {
        // Mostra prompt di installazione
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Mostra bottone di installazione personalizzato
            const installBtn = document.createElement('button');
            installBtn.textContent = '📱 Installa EduBoard';
            installBtn.className = 'install-btn';
            installBtn.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: var(--border-radius);
                font-weight: 600;
                cursor: pointer;
                box-shadow: var(--shadow-lg);
                z-index: 1000;
            `;
            
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.remove();
                    }
                    deferredPrompt = null;
                }
            });
            
            document.body.appendChild(installBtn);
            
            // Rimuovi dopo 10 secondi se non cliccato
            setTimeout(() => {
                if (installBtn.parentNode) {
                    installBtn.remove();
                }
            }, 10000);
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 12px 20px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Inizializza EduBoard
document.addEventListener('DOMContentLoaded', () => {
    new EduBoard();
});

// Service Worker per PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registrato:', registration);
            })
            .catch(error => {
                console.log('Errore SW:', error);
            });
    });
}