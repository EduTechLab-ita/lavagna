// --- Inizializzazione Globale ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('Lavagna PWA pronta!');

    // --- Variabili e Inizializzazione API Google ---
    const CLIENT_ID = 'IL_TUO_CLIENT_ID_DI_GOOGLE.apps.googleusercontent.com'; // <-- SOSTITUISCI QUI
    const API_KEY = 'LA_TUA_API_KEY_DI_GOOGLE'; // <-- SOSTITUISCI QUI
    const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest", "https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest"];
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    // --- Inizializzazione Canvas ---
    const canvas = new fabric.Canvas('whiteboard', {
        objectCaching: false,
        backgroundColor: '#ffffff' // Sfondo bianco di default
    });

    // --- Elementi del DOM ---
    const mainElement = document.querySelector('main');
    const drawBtn = document.getElementById('draw-btn');
    const selectBtn = document.getElementById('select-btn');
    const eraserBtn = document.getElementById('eraser-btn');
    const rulerBtn = document.getElementById('ruler-btn');
    const colorPicker = document.getElementById('color-picker');
    const brushSize = document.getElementById('brush-size');
    const imageLoader = document.getElementById('image-loader');
    const pdfLoader = document.getElementById('pdf-loader');
    const clearBtn = document.getElementById('clear-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.getElementById('user-profile');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');

    // --- Gestione Finestre di Dialogo (Modali) ---
    const modalContainer = document.getElementById('modal-container');
    const confirmModal = document.getElementById('confirm-modal');
    const promptModal = document.getElementById('prompt-modal');
    const alertModal = document.getElementById('alert-modal');

    // Funzione per mostrare un modale
    function showModal(modalElement) {
        modalContainer.style.display = 'flex';
        setTimeout(() => modalContainer.classList.add('visible'), 10);
        modalElement.style.display = 'block';
    }

    // Funzione per nascondere tutti i modali
    function hideModals() {
        modalContainer.classList.remove('visible');
        setTimeout(() => {
            modalContainer.style.display = 'none';
            confirmModal.style.display = 'none';
            promptModal.style.display = 'none';
            alertModal.style.display = 'none';
        }, 300);
    }

    // Funzione per mostrare un avviso (sostituisce alert)
    function customAlert(title, text) {
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-text').innerText = text;
        showModal(alertModal);
        return new Promise(resolve => {
            document.getElementById('alert-ok-btn').onclick = () => {
                hideModals();
                resolve(true);
            };
        });
    }

    // Funzione per mostrare una conferma (sostituisce confirm)
    function customConfirm(title, text) {
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-text').innerText = text;
        showModal(confirmModal);
        return new Promise(resolve => {
            document.getElementById('confirm-ok-btn').onclick = () => { hideModals(); resolve(true); };
            document.getElementById('confirm-cancel-btn').onclick = () => { hideModals(); resolve(false); };
        });
    }
    
    // Funzione per mostrare una richiesta di input (sostituisce prompt)
    function customPrompt(title, text, defaultValue = '') {
        document.getElementById('prompt-title').innerText = title;
        document.getElementById('prompt-text').innerText = text;
        const input = document.getElementById('prompt-input');
        input.value = defaultValue;
        showModal(promptModal);
        return new Promise(resolve => {
            document.getElementById('prompt-ok-btn').onclick = () => { hideModals(); resolve(input.value); };
            document.getElementById('prompt-cancel-btn').onclick = () => { hideModals(); resolve(null); };
        });
    }


    // --- Logica Principale dell'Applicazione ---

    // Funzione per ridimensionare il canvas
    function resizeCanvas() {
        // La lavagna occupa tutto lo spazio del contenitore 'main'
        canvas.setWidth(mainElement.offsetWidth);
        canvas.setHeight(mainElement.offsetHeight);
        canvas.renderAll();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Chiamata iniziale

    // Impostazioni iniziali
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = colorPicker.value;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.102/pdf.worker.min.js`;

    // Funzione per aggiornare il bottone attivo nella toolbar
    function updateActiveButton(activeBtn) {
        document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }
    updateActiveButton(drawBtn);

    // --- Event Listener della Toolbar ---
    drawBtn.addEventListener('click', () => {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.color = colorPicker.value;
        canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
        updateActiveButton(drawBtn);
    });

    selectBtn.addEventListener('click', () => {
        canvas.isDrawingMode = false;
        updateActiveButton(selectBtn);
    });

    eraserBtn.addEventListener('click', () => {
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.color = canvas.backgroundColor; // Gomma usa il colore di sfondo
        canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
        updateActiveButton(eraserBtn);
    });

    colorPicker.addEventListener('input', (e) => {
        canvas.freeDrawingBrush.color = e.target.value;
        if (!canvas.isDrawingMode) {
            drawBtn.click();
        }
    });

    brushSize.addEventListener('input', (e) => {
        canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
    });

    clearBtn.addEventListener('click', async () => {
        const confirmed = await customConfirm('Pulisci Lavagna', 'Sei sicuro di voler cancellare tutto? L\'azione è irreversibile.');
        if (confirmed) {
            canvas.clear();
            canvas.backgroundColor = '#ffffff'; // Ripristina lo sfondo
            canvas.renderAll();
        }
    });

    // --- Logica del Righello ---
    let ruler = null;
    rulerBtn.addEventListener('click', () => {
        if (ruler) {
            canvas.remove(ruler);
            ruler = null;
            rulerBtn.classList.remove('active');
        } else {
            const rulerBody = new fabric.Rect({ width: 500, height: 60, fill: 'rgba(100, 116, 139, 0.7)', stroke: '#475569', strokeWidth: 2, originX: 'center', originY: 'center' });
            const angleText = new fabric.Text('0°', { fontSize: 16, fill: 'white', originX: 'center', originY: 'center' });
            ruler = new fabric.Group([rulerBody, angleText], { left: canvas.width / 2, top: canvas.height / 2, hasControls: true, cornerColor: '#4F46E5', cornerSize: 12, transparentCorners: false });
            ruler.on('rotating', () => {
                const angle = Math.round(ruler.angle);
                angleText.set('text', `${angle}°`);
            });
            canvas.add(ruler);
            ruler.center();
            rulerBtn.classList.add('active');
        }
        canvas.renderAll();
    });

    // --- Logica di Caricamento File (Immagini e PDF) ---
    imageLoader.addEventListener('change', (e) => handleImageFile(e.target.files[0]));
    pdfLoader.addEventListener('change', (e) => handlePdfFile(e.target.files[0]));

    // Drag and Drop
    canvas.wrapperEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    canvas.wrapperEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file, canvas.getPointer(e));
        }
    });

    function handleImageFile(file, pointer) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                const scale = Math.min((canvas.width / img.width) * 0.8, (canvas.height / img.height) * 0.8);
                img.scale(scale);
                if (pointer) {
                    img.set({ left: pointer.x, top: pointer.y, originX: 'center', originY: 'center' });
                } else {
                    img.center();
                }
                canvas.add(img);
                canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
        imageLoader.value = '';
    }

    async function handlePdfFile(file) {
        if (!file || file.type !== 'application/pdf') return;
        const pageNumStr = await customPrompt('Carica PDF', 'Quale pagina del PDF vuoi caricare?', '1');
        const pageNum = parseInt(pageNumStr, 10);
        if (isNaN(pageNum) || pageNum <= 0) return;

        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            const loadingTask = pdfjsLib.getDocument(typedarray);
            loadingTask.promise.then(pdf => {
                if (pageNum > pdf.numPages) return customAlert('Errore', `Il PDF ha solo ${pdf.numPages} pagine.`);
                pdf.getPage(pageNum).then(page => {
                    const viewport = page.getViewport({ scale: 1.5 });
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.height = viewport.height;
                    tempCanvas.width = viewport.width;
                    const renderContext = { canvasContext: tempCanvas.getContext('2d'), viewport: viewport };
                    page.render(renderContext).promise.then(() => {
                        const img = new fabric.Image(tempCanvas, { selectable: true, evented: true });
                        const scale = Math.min((canvas.width / img.width) * 0.9, (canvas.height / img.height) * 0.9);
                        img.scale(scale).center();
                        canvas.add(img);
                        canvas.sendToBack(img);
                        canvas.renderAll();
                    });
                });
            });
        };
        fileReader.readAsArrayBuffer(file);
        pdfLoader.value = '';
    }

    // --- Logica Autenticazione e Drive ---
    // Funzioni gapiLoaded e gisLoaded vengono chiamate dall'HTML (onload)
    window.gapiLoaded = () => { gapi.load('client:picker', () => { gapiInited = true; maybeEnableButtons(); }); };
    window.gisLoaded = () => {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // Gestito dinamicamente
        });
        gisInited = true;
        maybeEnableButtons();
    };

    function maybeEnableButtons() {
        if (gapiInited && gisInited) {
            loginBtn.style.display = 'block';
        }
    }

    loginBtn.addEventListener('click', () => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) { throw (resp); }
            await gapi.client.init({ apiKey: API_KEY, discoveryDocs: DISCOVERY_DOCS });
            updateUiOnLogin();
        };
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });

    logoutBtn.addEventListener('click', () => {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                updateUiOnLogout();
            });
        }
    });

    function updateUiOnLogin() {
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        saveBtn.style.display = 'inline-flex';
        loadBtn.style.display = 'inline-flex';
        gapi.client.oauth2.userinfo.get().then(response => {
            document.getElementById('user-name').innerText = response.result.name;
            document.getElementById('user-pic').src = response.result.picture;
        });
    }

    function updateUiOnLogout() {
        loginBtn.style.display = 'block';
        userProfile.style.display = 'none';
        saveBtn.style.display = 'none';
        loadBtn.style.display = 'none';
        document.getElementById('user-name').innerText = '';
        document.getElementById('user-pic').src = '';
    }

    saveBtn.addEventListener('click', async () => {
        const fileName = await customPrompt("Salva su Drive", "Come vuoi chiamare il file?", "lavagna.json");
        if (!fileName) return;

        const boardContent = JSON.stringify(canvas.toJSON());
        const blob = new Blob([boardContent], { type: 'application/json' });
        const metadata = { 'name': fileName, 'mimeType': 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        try {
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
                body: form,
            });
            const file = await res.json();
            customAlert('Successo', `File "${file.name}" salvato con successo!`);
        } catch (err) {
            console.error("Errore nel salvataggio:", err);
            customAlert('Errore', 'Si è verificato un problema durante il salvataggio.');
        }
    });

    loadBtn.addEventListener('click', () => {
        const view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes("application/json");
        const picker = new google.picker.PickerBuilder()
            .setAppId(CLIENT_ID.split('-')[0])
            .setOAuthToken(gapi.client.getToken().access_token)
            .addView(view)
            .setDeveloperKey(API_KEY)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    });

    function pickerCallback(data) {
        if (data.action === google.picker.Action.PICKED) {
            const fileId = data.docs[0].id;
            gapi.client.drive.files.get({ fileId: fileId, alt: 'media' }).then(res => {
                canvas.loadFromJSON(res.body, () => {
                    canvas.renderAll();
                    customAlert('Successo', 'Lavoro caricato correttamente!');
                });
            }).catch(err => {
                console.error("Errore nel caricamento:", err);
                customAlert('Errore', 'Impossibile caricare il file.');
            });
        }
    }

    // --- Registrazione del Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/lavagna/sw.js').then(reg => {
                console.log('Service worker registrato con successo.', reg);
            }).catch(err => {
                console.error('Registrazione Service worker fallita:', err);
            });
        });
    }
});
