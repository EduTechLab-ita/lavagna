class EduBoard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.currentSize = 5;
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
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentSize;
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Salva il contenuto esistente
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
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
        // Eventi canvas per mouse
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Eventi touch per dispositivi mobili e digital board
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

        // Menu flottante trascinabile
        this.setupFloatingMenu();
        
        // Menu buttons
        document.getElementById('tools-btn').addEventListener('click', () => this.toggleSubmenu('tools-submenu'));
        document.getElementById('background-btn').addEventListener('click', () => this.toggleSubmenu('background-submenu'));
        document.getElementById('geometry-btn').addEventListener('click', () => this.toggleSubmenu('geometry-submenu'));

        // Opzioni strumenti nel pannello
        document.querySelectorAll('.tool-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.setTool(tool);
                document.querySelectorAll('.tool-option').forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Opzioni dimensioni
        document.querySelectorAll('.size-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const size = parseInt(e.currentTarget.dataset.size);
                this.currentSize = size;
                this.ctx.lineWidth = this.currentSize;
                document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Palette colori nel pannello
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                this.setColor(e.target.dataset.color);
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Color picker personalizzato
        document.getElementById('custom-color-btn').addEventListener('click', () => {
            document.getElementById('color-picker').click();
        });

        document.getElementById('color-picker').addEventListener('change', (e) => {
            this.setColor(e.target.value);
            // Aggiorna la selezione visiva
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        });

        // Opzioni sfondi
        document.querySelectorAll('.bg-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const bg = e.currentTarget.dataset.bg;
                this.setBackground(bg);
                document.querySelectorAll('.bg-option').forEach(opt => opt.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Strumenti geometrici
        document.getElementById('ruler-tool').addEventListener('click', () => this.toggleRuler());
        document.getElementById('protractor-tool').addEventListener('click', () => this.toggleProtractor());

        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Azioni toolbar
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Header buttons
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('load-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('new-btn').addEventListener('click', () => this.newProject());

        // Modal eventi
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
        
        // Chiudi submenu quando si clicca fuori
        document.addEventListener('click', (e) => {
            const floatingMenu = document.getElementById('floating-menu');
            if (!floatingMenu.contains(e.target)) {
                this.closeAllSubmenus();
            }
        });
    }
    
    setupFloatingMenu() {
        const menu = document.getElementById('floating-menu');
        const handle = document.getElementById('menu-handle');
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const handleMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = menu.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            menu.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                const newX = Math.max(0, Math.min(window.innerWidth - menu.offsetWidth, initialX + deltaX));
                const newY = Math.max(0, Math.min(window.innerHeight - menu.offsetHeight, initialY + deltaY));
                menu.style.left = `${newX}px`;
                menu.style.top = `${newY}px`;
                menu.style.right = 'auto';
                menu.style.bottom = 'auto';
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            menu.style.cursor = 'default';
        };

        handle.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events
        handle.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });

        document.addEventListener('touchend', handleMouseUp);
    }
    
    toggleSubmenu(submenuId) {
        const submenu = document.getElementById(submenuId);
        const isOpen = submenu.classList.contains('open');
        
        // Chiudi tutti i submenu
        this.closeAllSubmenus();
        
        // Apri quello selezionato se non era già aperto
        if (!isOpen) {
            submenu.classList.add('open');
            const arrow = submenu.previousElementSibling.querySelector('.expand-arrow');
            if (arrow) arrow.textContent = '▲';
        }
    }
    
    closeAllSubmenus() {
        document.querySelectorAll('.submenu').forEach(submenu => {
            submenu.classList.remove('open');
        });
        document.querySelectorAll('.expand-arrow').forEach(arrow => {
            arrow.textContent = '▼';
        });
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
        
        // Aggiorna il cursore
        switch(tool) {
            case 'pencil':
            case 'pen':
            case 'marker':
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
        
        // Rimuovi tutte le classi di sfondo
        canvas.classList.remove('canvas-lines', 'canvas-squares', 'canvas-music', 'canvas-dots');
        
        // Aggiungi la nuova classe se non è bianco
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

    toggleRuler() {
        const ruler = document.getElementById('ruler');
        if (ruler.style.display === 'none' || !ruler.style.display) {
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
        if (protractor.style.display === 'none' || !protractor.style.display) {
            protractor.style.display = 'block';
            protractor.style.left = '200px';
            protractor.style.top = '150px';
            this.makeGeometricToolDraggable(protractor);
        } else {
            protractor.style.display = 'none';
        }
    }

    setupGeometricTools() {
        // Crea i segni del righello
        const rulerMarks = document.querySelector('.ruler-marks');
        if (rulerMarks) {
            rulerMarks.innerHTML = '';
            for (let i = 0; i <= 30; i++) {
                const mark = document.createElement('div');
                mark.style.position = 'absolute';
                mark.style.left = `${i * 10}px`;
                mark.style.bottom = '0';
                mark.style.width = '1px';
                mark.style.height = i % 5 === 0 ? '15px' : '10px';
                mark.style.backgroundColor = 'var(--primary-color)';
                rulerMarks.appendChild(mark);
                
                // Aggiungi numeri ogni 5 tacche
                if (i % 5 === 0 && i > 0) {
                    const number = document.createElement('div');
                    number.style.position = 'absolute';
                    number.style.left = `${i * 10 - 5}px`;
                    number.style.bottom = '16px';
                    number.style.fontSize = '8px';
                    number.style.color = 'var(--primary-color)';
                    number.textContent = i;
                    rulerMarks.appendChild(number);
                }
            }
        }
    }

    makeGeometricToolDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const handleMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(element.style.left) || 0;
            initialY = parseInt(element.style.top) || 0;
            element.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                element.style.left = `${initialX + deltaX}px`;
                element.style.top = `${initialY + deltaY}px`;
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            element.style.cursor = 'move';
        };

        element.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events per dispositivi mobili
        element.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });

        document.addEventListener('touchend', handleMouseUp);
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
            this.showNotification('Tipo di file non supportato. Usa immagini o PDF.');
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
                
                // Ridimensiona se necessario
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                // Centra l'immagine
                const x = (this.canvas.width - width) / 2;
                const y = (this.canvas.height - height) / 2;
                
                this.ctx.drawImage(img, x, y, width, height);
                this.saveState();
                this.showNotification('Immagine caricata con successo!');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    loadPDF(file) {
        // Placeholder per PDF - funzionalità futura
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(50, 50, 300, 400);
        this.ctx.fillStyle = '#333';
        this.ctx.font = '16px Inter';
        this.ctx.fillText('📄 PDF caricato:', 60, 80);
        this.ctx.fillText(file.name, 60, 100);
        this.ctx.fillText('(Funzionalità PDF in sviluppo)', 60, 120);
        this.saveState();
        this.showNotification('PDF caricato (funzionalità in sviluppo)');
    }

    clearCanvas() {
        if (confirm('Sei sicuro di voler cancellare tutto?')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.saveState();
            this.showNotification('Lavagna pulita!');
        }
    }

    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        this.history.push(this.canvas.toDataURL());
        
        // Mantieni solo gli ultimi 50 stati per performance
        if (this.history.length > 50) {
            this.history.shift();
            this.historyStep--;
        }
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState();
            this.showNotification('Annullato');
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState();
            this.showNotification('Ripetuto');
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
            this.showNotification('Inserisci un nome per il progetto');
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
        this.showNotification(`Progetto "${project.name}" caricato!`);
    }

    newProject() {
        if (confirm('Creare un nuovo progetto? Le modifiche non salvate andranno perse.')) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.saveState();
            this.currentProject = null;
            document.getElementById('current-project').textContent = 'Nuovo Progetto';
            this.showNotification('Nuovo progetto creato!');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    toggleToolsPanel() {
        const panel = document.getElementById('tools-panel');
        panel.classList.toggle('open');
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
        
        const handleCalibrationClick = (e) => {
            if (currentPoint >= points.length) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            
            calibrationData.push({
                expected: points[currentPoint],
                actual: { x: clickX, y: clickY }
            });
            
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
                this.showNotification('Calibrazione completata!');
            } else {
                this.showNotification(`Tocca il punto ${currentPoint + 1} di 4`);
            }
        };
        
        this.canvas.addEventListener('click', handleCalibrationClick);
        this.hideCalibrationModal();
        this.showNotification('Tocca i 4 angoli dello schermo nell\'ordine indicato');
    }

    hideCalibrationModal() {
        document.getElementById('calibration-modal').style.display = 'none';
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
        // Registra service worker
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

        // Gestisci prompt di installazione
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
                animation: bounce 2s infinite;
            `;
            
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.remove();
                        this.showNotification('EduBoard installato con successo!');
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
            top: 80px;
            right: 20px;
            background: var(--success-color);
            color: white;
            padding: 12px 20px;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            font-weight: 500;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Inizializza EduBoard quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    new EduBoard();
});