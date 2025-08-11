class DigitalWhiteboard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.currentColor = '#000000';
        this.currentSize = 3;
        this.history = [];
        this.historyStep = -1;
        this.projects = JSON.parse(localStorage.getItem('whiteboardProjects')) || {};
        this.currentProject = null;
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupGeometricTools();
        this.loadProjects();
        this.saveState();
    }

    initializeCanvas() {
        // Imposta dimensioni responsive
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Configurazione iniziale del contesto
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Salva il contenuto corrente
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Ridimensiona
        this.canvas.width = Math.max(1920, rect.width);
        this.canvas.height = Math.max(1080, rect.height);
        
        // Ripristina il contenuto
        this.ctx.putImageData(imageData, 0, 0);
        
        // Ripristina le impostazioni del contesto
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

        // Eventi touch per dispositivi mobili
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

        // Strumenti
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('text-tool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('shape-tool').addEventListener('click', () => this.setTool('shape'));

        // Controlli
        document.getElementById('color-picker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            this.ctx.strokeStyle = this.currentColor;
        });

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

        // Gestione progetti
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('load-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('new-btn').addEventListener('click', () => this.newProject());

        // Modal
        document.getElementById('confirm-save').addEventListener('click', () => this.saveProject());
        document.getElementById('cancel-save').addEventListener('click', () => this.hideSaveModal());

        // Sidebar
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar());

        // Drag & Drop
        this.setupDragAndDrop();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
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

    setTool(tool) {
        this.currentTool = tool;
        
        // Aggiorna UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}-tool`).classList.add('active');
        
        // Cambia cursore
        switch(tool) {
            case 'pen':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'eraser':
                this.canvas.style.cursor = 'grab';
                break;
            case 'text':
                this.canvas.style.cursor = 'text';
                break;
            case 'shape':
                this.canvas.style.cursor = 'copy';
                break;
        }
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentSize * 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
        } else if (this.currentTool === 'text') {
            this.addText(x, y);
        }
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
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
        
        // Rimuovi classi esistenti
        canvas.classList.remove('canvas-lines', 'canvas-squares', 'canvas-music', 'canvas-dots');
        
        // Aggiungi nuova classe
        if (type !== 'blank') {
            canvas.classList.add(`canvas-${type}`);
        }
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
        // Genera segni per il righello
        const rulerMarks = document.querySelector('.ruler-marks');
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
                // Calcola dimensioni per mantenere proporzioni
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
                
                // Disegna l'immagine al centro
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
        // Per i PDF, mostriamo un placeholder
        // In una versione completa, useresti PDF.js
        const reader = new FileReader();
        reader.onload = () => {
            this.ctx.fillStyle = '#f0f0f0';
            this.ctx.fillRect(50, 50, 300, 400);
            this.ctx.fillStyle = '#333';
            this.ctx.font = '16px Inter';
            this.ctx.fillText('📄 PDF caricato:', 60, 80);
            this.ctx.fillText(file.name, 60, 100);
            this.ctx.fillText('(Funzionalità PDF in sviluppo)', 60, 120);
            this.saveState();
        };
        reader.readAsArrayBuffer(file);
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
        
        // Limita la cronologia a 50 stati
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
        localStorage.setItem('whiteboardProjects', JSON.stringify(this.projects));
        
        this.currentProject = projectData;
        document.getElementById('current-project').textContent = name;
        
        this.hideSaveModal();
        this.loadProjects();
        
        // Mostra messaggio di successo
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
                case 's':
                    e.preventDefault();
                    this.showSaveModal();
                    break;
                case 'n':
                    e.preventDefault();
                    this.newProject();
                    break;
            }
        }
    }

    showNotification(message) {
        // Crea notifica temporanea
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
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Inizializza l'applicazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    new DigitalWhiteboard();
});

// Service Worker per PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registrato con successo:', registration);
            })
            .catch(registrationError => {
                console.log('Registrazione SW fallita:', registrationError);
            });
    });
}