class EduBoard {
    constructor() {
        this.canvas = document.getElementById('whiteboard');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'pencil';
        this.currentColor = '#000000';
        this.currentSize = 6;
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
        this.setupFloatingToolbar();
    }

    initializeCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.imageSmoothingEnabled = true;
        this.updateCanvasStyle();
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
        this.updateCanvasStyle();
    }

    updateCanvasStyle() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentSize;
        this.ctx.globalAlpha = 1.0;
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
            const rect = this.canvas.getBoundingClientRect();
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

        // Header buttons
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('save-btn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('load-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('new-btn').addEventListener('click', () => this.newProject());

        // Toolbar events
        this.setupToolbarEvents();

        // Modal events
        document.getElementById('confirm-save').addEventListener('click', () => this.saveProject());
        document.getElementById('cancel-save').addEventListener('click', () => this.hideSaveModal());

        // Sidebar
        document.getElementById('close-sidebar').addEventListener('click', () => this.toggleSidebar());

        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Actions
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.floating-toolbar')) {
                this.closeAllPanels();
            }
        });
    }

    setupFloatingToolbar() {
        const toolbar = document.getElementById('floating-toolbar');
        let isDragging = false;
        let startX, startY, initialX, initialY;
        let dragThreshold = 5; // Soglia minima per iniziare il drag
        let hasMoved = false;

        const handleMouseDown = (e) => {
            // Solo se non è un click su un bottone
            if (e.target.closest('.toolbar-btn')) {
                return; // Non iniziare il drag se si clicca su un bottone
            }
            
            startX = e.clientX;
            startY = e.clientY;
            const rect = toolbar.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            hasMoved = false;
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (startX !== undefined && startY !== undefined) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Controlla se abbiamo superato la soglia di drag
                if (!isDragging && (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold)) {
                    isDragging = true;
                    toolbar.style.cursor = 'grabbing';
                    hasMoved = true;
                }
                
                if (isDragging) {
                    const newX = Math.max(0, Math.min(window.innerWidth - toolbar.offsetWidth, initialX + deltaX));
                    const newY = Math.max(0, Math.min(window.innerHeight - toolbar.offsetHeight, initialY + deltaY));
                    toolbar.style.left = `${newX}px`;
                    toolbar.style.top = `${newY}px`;
                    toolbar.style.right = 'auto';
                    toolbar.style.bottom = 'auto';
                }
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            startX = undefined;
            startY = undefined;
            toolbar.style.cursor = 'default';
            
            // Reset hasMoved dopo un breve delay per permettere ai click di funzionare
            setTimeout(() => {
                hasMoved = false;
            }, 10);
        };

        // Aggiungi event listener solo alla toolbar, non ai bottoni
        toolbar.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events
        toolbar.addEventListener('touchstart', (e) => {
            // Solo se non è un touch su un bottone
            if (e.target.closest('.toolbar-btn')) {
                return;
            }
            
            const touch = e.touches[0];
            handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches[0]) {
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });

        document.addEventListener('touchend', handleMouseUp);
        
        // Previeni il drag quando si clicca sui bottoni
        toolbar.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, true);
    }

    setupToolbarEvents() {
        // Toolbar buttons
        document.getElementById('tools-btn').addEventListener('click', () => {
            this.togglePanel('tools-panel');
        });

        document.getElementById('backgrounds-btn').addEventListener('click', () => {
            this.togglePanel('backgrounds-panel');
        });

        document.getElementById('geometry-btn').addEventListener('click', () => {
            this.togglePanel('geometry-panel');
        });

        document.getElementById('shapes-btn').addEventListener('click', () => {
            this.togglePanel('shapes-panel');
        });

        document.getElementById('hand-btn').addEventListener('click', () => {
            this.setTool('hand');
            this.updateMainToolSelection('hand-btn');
        });
        document.getElementById('lasso-btn').addEventListener('click', () => {
            this.setTool('lasso');
            this.updateMainToolSelection('lasso-btn');
        });

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.setTool(tool);
                this.updateToolSelection(e.currentTarget);
                this.updateActiveToolButton();
            });
        });

        // Size buttons
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = parseInt(e.currentTarget.dataset.size);
                this.currentSize = size;
                this.updateCanvasStyle();
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.currentTarget.id === 'custom-color') {
                    document.getElementById('color-picker').click();
                } else {
                    const color = e.currentTarget.dataset.color;
                    this.setColor(color);
                    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                }
            });
        });

        // Custom color picker
        document.getElementById('color-picker').addEventListener('change', (e) => {
            this.setColor(e.target.value);
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        });

        // Background buttons
        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bg = e.currentTarget.dataset.bg;
                this.setBackground(bg);
                document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Geometry tools
        document.getElementById('ruler-btn').addEventListener('click', () => this.toggleRuler());
        document.getElementById('protractor-btn').addEventListener('click', () => this.toggleProtractor());
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        const wasActive = panel.classList.contains('active');
        
        this.closeAllPanels();
        
        // Solo se il pannello non era attivo, riaprilo
        if (!wasActive) {
            const btn = document.querySelector(`[data-panel="${panelId.replace('-panel', '')}"]`);
            
            panel.classList.add('active');
            
            // Update button states
            document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
        }
    }

    closeAllPanels() {
        document.querySelectorAll('.expand-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Reset button states except for active tool
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            if (!btn.id.includes('tools-btn')) {
                btn.classList.remove('active');
            }
        });
    }

    updateMainToolSelection(selectedBtnId) {
        // Reset all main toolbar buttons
        document.querySelectorAll('#floating-toolbar .toolbar-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Activate selected button
        document.getElementById(selectedBtnId).classList.add('active');
        this.closeAllPanels();
    }

    updateToolSelection(selectedBtn) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        selectedBtn.classList.add('active');
    }

    updateActiveToolButton() {
        const toolsBtn = document.getElementById('tools-btn');
        toolsBtn.classList.add('active');
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
        this.selectedObjects = []; // Clear any selections when changing tools
        
        // Aggiorna il cursore
        switch(tool) {
            case 'pencil':
            case 'pen':
            case 'marker':
            case 'fountain':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'hand':
                this.canvas.style.cursor = 'grab';
                break;
            case 'lasso':
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
        this.updateCanvasStyle();
    }

    setBackground(type) {
        // Reset all background styles
        this.canvas.style.backgroundImage = 'none';
        this.canvas.style.backgroundSize = 'auto';
        this.canvas.style.backgroundRepeat = 'repeat';
        
        // Apply the selected background
        switch(type) {
            case 'lines':
                this.canvas.style.backgroundImage = 'repeating-linear-gradient(transparent 0px, transparent 24px, #e2e8f0 24px, #e2e8f0 25px)';
                break;
            case 'squares':
                this.canvas.style.backgroundImage = `
                    repeating-linear-gradient(0deg, #e2e8f0 0px, #e2e8f0 1px, transparent 1px, transparent 20px),
                    repeating-linear-gradient(90deg, #e2e8f0 0px, #e2e8f0 1px, transparent 1px, transparent 20px)
                `;
                break;
            case 'music':
                this.canvas.style.backgroundImage = `
                    repeating-linear-gradient(
                        transparent 0px, transparent 15px, #e2e8f0 15px, #e2e8f0 16px,
                        transparent 16px, transparent 31px, #e2e8f0 31px, #e2e8f0 32px,
                        transparent 32px, transparent 47px, #e2e8f0 47px, #e2e8f0 48px,
                        transparent 48px, transparent 63px, #e2e8f0 63px, #e2e8f0 64px,
                        transparent 64px, transparent 79px, #e2e8f0 79px, #e2e8f0 80px
                    )
                `;
                break;
            case 'dots':
                this.canvas.style.backgroundImage = 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)';
                this.canvas.style.backgroundSize = '20px 20px';
                break;
            default: // blank
                // Already reset above
                break;
        }
        
        // Force canvas refresh
        this.canvas.style.display = 'none';
        this.canvas.offsetHeight; // Trigger reflow
        this.canvas.style.display = 'block';
        
        this.showNotification(`Sfondo "${type}" applicato!`);
    }

    startDrawing(e) {
        if (this.currentTool === 'hand') {
            // Strumento mano - non disegna, solo per trascinare
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        if (this.currentTool === 'lasso') {
            // Strumento lazo - inizia selezione
            this.startLassoSelection(e);
            return;
        }
        
        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;

        if (this.currentTool === 'text') {
            this.addText(x, y);
            return;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        
        // Configura lo stile in base allo strumento
        this.configureToolStyle();
    }

    configureToolStyle() {
        switch(this.currentTool) {
            case 'pencil':
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 0.6; // Trasparente come una matita
                this.ctx.strokeStyle = this.currentColor;
                this.ctx.lineWidth = this.currentSize;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                break;
                
            case 'pen':
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 1.0; // Marcato come una biro
                this.ctx.strokeStyle = this.currentColor;
                this.ctx.lineWidth = this.currentSize;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                break;
                
            case 'marker':
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 0.4; // Trasparente
                // Solo colori tipici degli evidenziatori
                const markerColors = ['#FFEB3B', '#4CAF50', '#2196F3', '#FF9800', '#E91E63'];
                if (!markerColors.includes(this.currentColor)) {
                    this.ctx.strokeStyle = '#FFEB3B'; // Default giallo
                } else {
                    this.ctx.strokeStyle = this.currentColor;
                }
                this.ctx.lineWidth = this.currentSize * 4; // Punta larga
                this.ctx.lineCap = 'square'; // Punta tagliata
                this.ctx.lineJoin = 'miter';
                break;
                
            case 'fountain':
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.globalAlpha = 0.9; // Effetto inchiostro
                this.ctx.strokeStyle = this.currentColor;
                this.ctx.lineWidth = this.currentSize * 1.8; // Più spesso per le "pance"
                this.ctx.lineCap = 'square'; // Punta tagliata per stilografica
                this.ctx.lineJoin = 'miter'; // Angoli netti
                break;
                
            case 'eraser':
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = this.currentSize * 2;
                this.ctx.lineCap = 'round';
                break;
        }
    }

    draw(e) {
        if (this.currentTool === 'lasso' && this.isLassoActive) {
            this.updateLassoSelection(e);
            return;
        }
        
        if (!this.isDrawing) return;

        const coords = this.getCanvasCoordinates(e);
        const x = coords.x;
        const y = coords.y;

        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.currentTool === 'hand') {
            this.canvas.style.cursor = 'grab';
            return;
        }
        
        if (this.currentTool === 'lasso') {
            this.completeLassoSelection();
            return;
        }
        
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
            this.ctx.globalAlpha = 1.0;
            this.ctx.fillStyle = this.currentColor;
            this.ctx.font = `${this.currentSize * 8}px Inter, sans-serif`;
            this.ctx.fillText(text, x, y);
            this.saveState();
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
            ruler.style.left = '0';
            ruler.style.top = '0';
            ruler.style.width = '100vw';
            ruler.style.height = '100vh';
            ruler.classList.add('entering');
            
            // Rimuovi la classe di animazione dopo l'animazione
            setTimeout(() => {
                ruler.classList.remove('entering');
            }, 400);
            
            this.makeGeometricToolDraggable(ruler);
            this.setupRulerControls(ruler);
        } else {
            ruler.classList.add('exiting');
            setTimeout(() => {
                ruler.style.display = 'none';
                ruler.classList.remove('exiting');
            }, 300);
        }
    }

    setupRulerControls(ruler) {
        const closeBtn = ruler.querySelector('.ruler-close-btn');
        const scaleControls = ruler.querySelectorAll('.scale-btn');
        const angleDisplay = ruler.querySelector('.ruler-angle-display');
        
        // Gestione chiusura righello
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRuler();
        });
        
        // Gestione controlli scala
        scaleControls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const rulerBody = ruler.querySelector('.ruler-body');
                const scaleDisplay = ruler.querySelector('.scale-display');
                
                let currentScale = parseFloat(scaleDisplay.textContent) || 100;
                
                if (action === 'zoom-in' && currentScale < 200) {
                    currentScale += 25;
                } else if (action === 'zoom-out' && currentScale > 50) {
                    currentScale -= 25;
                }
                
                scaleDisplay.textContent = `${currentScale}%`;
                rulerBody.style.width = `${currentScale}%`;
            });
        });
        
        // Aggiorna l'angolo quando il righello viene trascinato
        this.updateRulerAngle(ruler, 0);
    }

    updateRulerAngle(ruler, angle) {
        const angleDisplay = ruler.querySelector('.ruler-angle-display');
        if (angleDisplay) {
            angleDisplay.textContent = `${Math.round(angle)}°`;
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
            // Crea più segni per un righello più lungo
            for (let i = 0; i <= 100; i++) {
                const mark = document.createElement('div');
                mark.style.position = 'absolute';
                mark.style.left = `${i * 1}%`;
                mark.style.bottom = '0';
                mark.style.width = '1px';
                mark.style.height = i % 10 === 0 ? '12px' : i % 5 === 0 ? '8px' : '4px';
                mark.style.backgroundColor = '#667eea';
                rulerMarks.appendChild(mark);
                
                if (i % 10 === 0 && i > 0) {
                    const number = document.createElement('div');
                    number.style.position = 'absolute';
                    number.style.left = `${i * 1}%`;
                    number.style.bottom = '14px';
                    number.style.fontSize = '10px';
                    number.style.color = '#667eea';
                    number.style.transform = 'translateX(-50%)';
                    number.style.fontWeight = '600';
                    number.textContent = i / 10;
                    rulerMarks.appendChild(number);
                }
            }
        }
    }

    makeGeometricToolDraggable(element) {
        let isDragging = false;
        let isRotating = false;
        let startX, startY, initialX, initialY;
        let startAngle = 0;
        let currentAngle = 0;

        const rulerBody = element.querySelector('.ruler-body');
        const centerHandle = element.querySelector('.ruler-center-handle');
        
        if (!rulerBody) return;

        const handleMouseDown = (e) => {
            // Solo se si clicca sul corpo del righello o sul centro
            if (!e.target.closest('.ruler-body') && !e.target.closest('.ruler-center-handle')) {
                return;
            }
            
            // Previeni il drag se si clicca sui controlli
            if (e.target.closest('.ruler-controls')) {
                return;
            }
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = rulerBody.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calcola l'angolo iniziale se si sta ruotando dal centro
            if (e.target.closest('.ruler-center-handle')) {
                isRotating = true;
                startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            } else {
                // Ottieni la posizione corrente
                const transform = rulerBody.style.transform || 'translate(-50%, -50%)';
                const matches = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (matches) {
                    initialX = parseFloat(matches[1]) || -50;
                    initialY = parseFloat(matches[2]) || -50;
                } else {
                    initialX = -50;
                    initialY = -50;
                }
            }
            
            element.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            if (isRotating) {
                const rect = rulerBody.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                const currentAngleRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                currentAngle = (currentAngleRad * 180 / Math.PI - startAngle) % 360;
                
                rulerBody.style.transform = `translate(-50%, -50%) rotate(${currentAngle}deg)`;
                this.updateRulerAngle(element, currentAngle);
            } else {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Calcola la nuova posizione in percentuale
                const newX = initialX + (deltaX / window.innerWidth) * 100;
                const newY = initialY + (deltaY / window.innerHeight) * 100;
                
                rulerBody.style.transform = `translate(${newX}%, ${newY}%) rotate(${currentAngle}deg)`;
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            isRotating = false;
            element.style.cursor = 'move';
        };

        rulerBody.addEventListener('mousedown', handleMouseDown);
        if (centerHandle) {
            centerHandle.addEventListener('mousedown', handleMouseDown);
        }
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events
        const handleTouchStart = (e) => {
            const touch = e.touches[0];
            handleMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => e.preventDefault()
            });
        };
        
        rulerBody.addEventListener('touchstart', handleTouchStart);
        if (centerHandle) {
            centerHandle.addEventListener('touchstart', handleTouchStart);
        }

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches[0]) {
                const touch = e.touches[0];
                handleMouseMove({
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });

        document.addEventListener('touchend', handleMouseUp);
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
                this.showNotification('Immagine caricata con successo!');
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
        document.getElementById('save-modal').classList.add('show');
        document.getElementById('project-name').focus();
    }

    hideSaveModal() {
        document.getElementById('save-modal').classList.remove('show');
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
        } else {
            // Delete selected objects with Delete key
            if (e.key === 'Delete' && this.selectedObjects.length > 0) {
                this.deleteSelectedObjects();
            }
        }
    }

    deleteSelectedObjects() {
        if (this.selectedObjects.length === 0) return;
        
        // Clear the areas where selected objects are
        this.selectedObjects.forEach(obj => {
            this.ctx.clearRect(obj.x, obj.y, obj.width, obj.height);
        });
        
        this.selectedObjects = [];
        this.saveState();
        this.showNotification('Oggetti selezionati eliminati!');
    }

    setupPWA() {
        // Registra il Service Worker e gestisce gli aggiornamenti
        this.registerServiceWorker();
        
        // Gestisce il prompt di installazione PWA
        this.handleInstallPrompt();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('[PWA] Service Worker registrato:', registration);
                        
                        // Controlla aggiornamenti ogni 30 secondi
                        setInterval(() => {
                            registration.update();
                        }, 30000);
                        
                        // Controllo proattivo per Service Worker in attesa
                        if (registration.waiting) {
                            console.log('[PWA] Service Worker in attesa rilevato immediatamente');
                            this.showUpdateBanner('Una nuova versione di EduBoard è disponibile!');
                        }
                        
                        // Ascolta per nuovi Service Worker in attesa
                        registration.addEventListener('updatefound', () => {
                            console.log('[PWA] Nuovo Service Worker trovato');
                            const newWorker = registration.installing;
                            
                            if (newWorker) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        console.log('[PWA] Nuovo Service Worker installato');
                                        // Il nuovo SW è installato ma non ancora attivo
                                        // Verrà attivato quando tutti i tab saranno chiusi
                                    }
                                });
                            }
                        });
                    })
                    .catch(error => {
                        console.log('[PWA] Errore Service Worker:', error);
                    });
            });
        }

        // Ascolta i messaggi dal Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[PWA] Messaggio ricevuto dal SW:', event.data);
            
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
                this.showUpdateBanner(event.data.message);
            }
        });
    }

    showUpdateBanner(message) {
        const banner = document.getElementById('update-banner');
        const updateBtn = document.getElementById('update-btn');
        const dismissBtn = document.getElementById('dismiss-btn');
        
        // Mostra il banner
        banner.classList.add('show');
        
        // Gestisce il click sul pulsante "Aggiorna ora"
        updateBtn.onclick = () => {
            console.log('[PWA] Utente ha richiesto aggiornamento');
            
            // Invia messaggio al SW per saltare l'attesa
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SKIP_WAITING'
                });
            }
            
            // Ricarica la pagina dopo un breve delay
            setTimeout(() => {
                window.location.reload();
            }, 500);
        };
        
        // Gestisce il click sul pulsante di chiusura
        dismissBtn.onclick = () => {
            banner.classList.remove('show');
            
            // Nasconde il banner per questa sessione
            setTimeout(() => {
                banner.style.display = 'none';
            }, 400);
        };
        
        // Auto-nascondi dopo 10 secondi se non interagisce
        setTimeout(() => {
            if (banner.classList.contains('show')) {
                dismissBtn.click();
            }
        }, 10000);
        
        this.showNotification('🎉 Nuova versione disponibile! Clicca il banner verde per aggiornare.');
    }

    handleInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            const installBtn = document.createElement('button');
            installBtn.textContent = '📱 Installa EduBoard';
            installBtn.className = 'install-btn';
            installBtn.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                animation: bounce 2s infinite;
            `;
            
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.remove();
                        this.showNotification('🎉 EduBoard installato con successo!');
                    }
                    deferredPrompt = null;
                }
            });
            
            document.body.appendChild(installBtn);
            
            setTimeout(() => {
                if (installBtn.parentNode) {
                    installBtn.remove();
                }
            }, 10000);
        });
    }

    startLassoSelection(e) {
        this.isLassoActive = true;
        this.lassoPath = [];
        this.lassoStartPoint = this.getCanvasCoordinates(e);
        const coords = this.getCanvasCoordinates(e);
        this.lassoPath.push({x: coords.x, y: coords.y});
        
        // Create overlay canvas for lasso drawing
        if (!this.overlayCanvas) {
            this.overlayCanvas = document.createElement('canvas');
            this.overlayCanvas.width = this.canvas.width;
            this.overlayCanvas.height = this.canvas.height;
            this.overlayCanvas.style.position = 'absolute';
            this.overlayCanvas.style.top = '0';
            this.overlayCanvas.style.left = '0';
            this.overlayCanvas.style.pointerEvents = 'none';
            this.overlayCanvas.style.zIndex = '10';
            this.canvas.parentElement.appendChild(this.overlayCanvas);
            this.overlayCtx = this.overlayCanvas.getContext('2d');
        }
    }

    updateLassoSelection(e) {
        if (!this.isLassoActive) return;
        
        const coords = this.getCanvasCoordinates(e);
        this.lassoPath.push({x: coords.x, y: coords.y});
        
        // Clear overlay and redraw lasso path
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw lasso path on overlay
        this.overlayCtx.strokeStyle = '#2563EB';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(this.lassoPath[0].x, this.lassoPath[0].y);
        for (let i = 1; i < this.lassoPath.length; i++) {
            this.overlayCtx.lineTo(this.lassoPath[i].x, this.lassoPath[i].y);
        }
        this.overlayCtx.stroke();
        this.overlayCtx.setLineDash([]);
    }

    completeLassoSelection() {
        if (!this.isLassoActive) return;
        
        this.isLassoActive = false;
        
        // Close the lasso path
        if (this.lassoPath.length > 2) {
            this.lassoPath.push(this.lassoPath[0]); // Close the path
        }
        
        // Find objects within lasso selection
        this.selectedObjects = this.findObjectsInLasso();
        
        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        // Draw selection indicators
        this.drawSelectionIndicators();
        
        if (this.selectedObjects.length > 0) {
            this.showNotification(`${this.selectedObjects.length} oggetti selezionati! Usa Delete per eliminarli.`);
        } else {
            this.showNotification('Nessun oggetto selezionato.');
        }
        
        this.lassoPath = [];
    }

    findObjectsInLasso() {
        const selectedObjects = [];
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // Sample points within the lasso to find drawn content
        const minX = Math.min(...this.lassoPath.map(p => p.x));
        const maxX = Math.max(...this.lassoPath.map(p => p.x));
        const minY = Math.min(...this.lassoPath.map(p => p.y));
        const maxY = Math.max(...this.lassoPath.map(p => p.y));
        
        // Check for non-transparent pixels within lasso bounds
        for (let x = minX; x <= maxX; x += 5) {
            for (let y = minY; y <= maxY; y += 5) {
                if (this.isPointInLasso(x, y) && this.hasContentAt(x, y, data)) {
                    // Found content, create a selection object
                    const obj = {
                        x: Math.max(0, x - 20),
                        y: Math.max(0, y - 20),
                        width: 40,
                        height: 40,
                        originalX: x,
                        originalY: y
                    };
                    
                    // Check if this area overlaps with existing selections
                    const overlaps = selectedObjects.some(existing => 
                        Math.abs(existing.originalX - x) < 30 && Math.abs(existing.originalY - y) < 30
                    );
                    
                    if (!overlaps) {
                        selectedObjects.push(obj);
                    }
                }
            }
        }
        
        return selectedObjects;
    }

    isPointInLasso(x, y) {
        if (this.lassoPath.length < 3) return false;
        
        let inside = false;
        for (let i = 0, j = this.lassoPath.length - 1; i < this.lassoPath.length; j = i++) {
            const xi = this.lassoPath[i].x;
            const yi = this.lassoPath[i].y;
            const xj = this.lassoPath[j].x;
            const yj = this.lassoPath[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    hasContentAt(x, y, imageData) {
        const index = (Math.floor(y) * this.canvas.width + Math.floor(x)) * 4;
        if (index < 0 || index >= imageData.length) return false;
        
        // Check if pixel is not transparent (alpha > 0)
        return imageData[index + 3] > 0;
    }

    drawSelectionIndicators() {
        this.selectedObjects.forEach(obj => {
            this.overlayCtx.strokeStyle = '#2563EB';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.setLineDash([3, 3]);
            this.overlayCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            this.overlayCtx.setLineDash([]);
            
            // Draw corner handles
            this.overlayCtx.fillStyle = '#2563EB';
            this.overlayCtx.fillRect(obj.x - 3, obj.y - 3, 6, 6);
            this.overlayCtx.fillRect(obj.x + obj.width - 3, obj.y - 3, 6, 6);
            this.overlayCtx.fillRect(obj.x - 3, obj.y + obj.height - 3, 6, 6);
            this.overlayCtx.fillRect(obj.x + obj.width - 3, obj.y + obj.height - 3, 6, 6);
        });
    }

    deleteSelectedObjects() {
        if (this.selectedObjects.length === 0) return;
        
        // Clear the areas where selected objects are
        this.selectedObjects.forEach(obj => {
            this.ctx.clearRect(obj.x, obj.y, obj.width, obj.height);
        });
        
        this.selectedObjects = [];
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.saveState();
        this.showNotification('Oggetti selezionati eliminati!');
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #43e97b, #38f9d7);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
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

// Inizializza EduBoard
document.addEventListener('DOMContentLoaded', () => {
    new EduBoard();
});