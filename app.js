// --- Inizializzazione ---
const canvas = new fabric.Canvas('whiteboard', { objectCaching: false });

function resizeCanvas() {
    const mainElement = document.querySelector('main');
    canvas.setWidth(mainElement.offsetWidth - 32);
    canvas.setHeight(mainElement.offsetHeight - 32);
    canvas.renderAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

canvas.isDrawingMode = true;
canvas.freeDrawingBrush.width = 5;
canvas.freeDrawingBrush.color = '#000000';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.102/pdf.worker.min.js`;
console.log('Lavagna PWA pronta!' );

// --- Elementi del DOM ---
const drawBtn = document.getElementById('draw-btn');
const selectBtn = document.getElementById('select-btn');
const eraserBtn = document.getElementById('eraser-btn');
const rulerBtn = document.getElementById('ruler-btn');
const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const imageLoader = document.getElementById('image-loader');
const pdfLoader = document.getElementById('pdf-loader');
const clearBtn = document.getElementById('clear-btn');

// --- Variabili e API Google ---
const CLIENT_ID = 'IL_TUO_CLIENT_ID_DI_GOOGLE.apps.googleusercontent.com'; // <-- SOSTITUISCI
const API_KEY = 'LA_TUA_API_KEY_DI_GOOGLE'; // <-- SOSTITUISCI
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest", "https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

const loginBtn = document.getElementById('login-btn' );
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');

function gapiLoaded() {
    gapi.load('client:picker', () => {
        gapiInited = true;
        maybeEnableButtons();
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        loginBtn.style.display = 'block';
    }
}

loginBtn.addEventListener('click', () => {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
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

saveBtn.addEventListener('click', () => {
    const boardContent = JSON.stringify(canvas.toJSON());
    const blob = new Blob([boardContent], { type: 'application/json' });
    const fileName = prompt("Come vuoi chiamare il file?", "lavagna.json");
    if (!fileName) return;
    const metadata = { 'name': fileName, 'mimeType': 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken( ).access_token }),
        body: form,
    }).then(res => res.json()).then(file => {
        alert(`File "${file.name}" salvato con successo!`);
    });
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
                alert('Lavoro caricato con successo!');
            });
        });
    }
}

// --- Logica Toolbar ---
function updateActiveButton(activeBtn) {
    document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
}
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
    canvas.freeDrawingBrush.color = '#ffffff';
    canvas.freeDrawingBrush.width = parseInt(brushSize.value, 10);
    updateActiveButton(eraserBtn);
});
colorPicker.addEventListener('input', (e) => {
    canvas.freeDrawingBrush.color = e.target.value;
    if (!canvas.isDrawingMode) drawBtn.click();
});
brushSize.addEventListener('input', (e) => {
    canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
});
clearBtn.addEventListener('click', () => {
    if (confirm('Sei sicuro di voler cancellare tutto?')) {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
    }
});
updateActiveButton(drawBtn);

// --- Logica Righello ---
let ruler = null;
function createRuler() {
    const rulerBody = new fabric.Rect({ width: 500, height: 60, fill: 'rgba(200, 200, 200, 0.7)', stroke: '#666', strokeWidth: 2, originX: 'center', originY: 'center' });
    const angleText = new fabric.Text('0°', { fontSize: 16, fill: 'black', originX: 'center', originY: 'center' });
    ruler = new fabric.Group([rulerBody, angleText], { left: canvas.width / 2, top: canvas.height / 2, isRuler: true, hasControls: true, cornerColor: 'blue', cornerSize: 12, transparentCorners: false });
    ruler.on('rotating', () => {
        const angle = Math.round(ruler.angle);
        angleText.set('text', `${angle}°`);
    });
    canvas.add(ruler);
}
rulerBtn.addEventListener('click', () => {
    if (ruler) {
        canvas.remove(ruler);
        ruler = null;
        rulerBtn.classList.remove('active');
    } else {
        createRuler();
        rulerBtn.classList.add('active');
    }
    canvas.renderAll();
});
let isDrawingGuided = false;
canvas.on('mouse:down', (o) => {
    if (!canvas.isDrawingMode || !ruler) return;
    const pointer = canvas.getPointer(o.e);
    const rulerRect = ruler.getBoundingRect();
    const tolerance = 15;
    if (pointer.x >= rulerRect.left && pointer.x <= rulerRect.left + rulerRect.width && (Math.abs(pointer.y - rulerRect.top) < tolerance || Math.abs(pointer.y - (rulerRect.top + rulerRect.height)) < tolerance)) {
        isDrawingGuided = true;
        canvas.isDrawingMode = false;
        const startPoint = getSnappedPoint(pointer);
        const line = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], { stroke: canvas.freeDrawingBrush.color, strokeWidth: canvas.freeDrawingBrush.width, isGuidedLine: true });
        canvas.add(line);
    }
});
canvas.on('mouse:move', (o) => {
    if (!isDrawingGuided) return;
    const pointer = canvas.getPointer(o.e);
    const endPoint = getSnappedPoint(pointer);
    const line = canvas.getObjects().find(obj => obj.isGuidedLine);
    if (line) {
        line.set({ x2: endPoint.x, y2: endPoint.y });
        canvas.renderAll();
    }
});
canvas.on('mouse:up', () => {
    if (isDrawingGuided) {
        isDrawingGuided = false;
        canvas.isDrawingMode = true;
        const line = canvas.getObjects().find(obj => obj.isGuidedLine);
        if (line) delete line.isGuidedLine;
    }
});
function getSnappedPoint(pointer) {
    const localPoint = new fabric.Point(pointer.x, pointer.y);
    const invertedMatrix = fabric.util.invertTransform(ruler.calcTransformMatrix());
    const transformedPoint = fabric.util.transformPoint(localPoint, invertedMatrix);
    transformedPoint.y = Math.abs(transformedPoint.y - (-ruler.height / 2)) < Math.abs(transformedPoint.y - (ruler.height / 2)) ? -ruler.height / 2 : ruler.height / 2;
    return fabric.util.transformPoint(transformedPoint, ruler.calcTransformMatrix());
}

// --- Logica Caricamento File ---
imageLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
        fabric.Image.fromURL(f.target.result, (img) => {
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
            img.scale(scale).set({ left: (canvas.width - img.getScaledWidth()) / 2, top: (canvas.height - img.getScaledHeight()) / 2 });
            canvas.add(img);
            canvas.renderAll();
        });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});
canvas.wrapperEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
canvas.wrapperEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (f) => {
            fabric.Image.fromURL(f.target.result, (img) => {
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.8;
                const pointer = canvas.getPointer(e);
                img.scale(scale).set({ left: pointer.x - img.getScaledWidth() / 2, top: pointer.y - img.getScaledHeight() / 2 });
                canvas.add(img);
                canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    }
});
pdfLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedarray = new Uint8Array(this.result);
        const pageNum = parseInt(prompt("Quale pagina del PDF vuoi caricare?", "1"), 10);
        if (isNaN(pageNum) || pageNum <= 0) return;
        const loadingTask = pdfjsLib.getDocument(typedarray);
        loadingTask.promise.then(pdf => {
            if (pageNum > pdf.numPages) return alert(`Il PDF ha solo ${pdf.numPages} pagine.`);
            pdf.getPage(pageNum).then(page => {
                const viewport = page.getViewport({ scale: 1.5 });
                const tempCanvas = document.createElement('canvas');
                tempCanvas.height = viewport.height;
                tempCanvas.width = viewport.width;
                const renderContext = { canvasContext: tempCanvas.getContext('2d'), viewport: viewport };
                page.render(renderContext).promise.then(() => {
                    const img = new fabric.Image(tempCanvas, { selectable: false, evented: false });
                    const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
                    img.scale(scale).set({ left: (canvas.width - img.getScaledWidth()) / 2, top: (canvas.height - img.getScaledHeight()) / 2 });
                    canvas.add(img);
                    canvas.sendToBack(img);
                    canvas.renderAll();
                });
            });
        });
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = '';
});

// --- Registrazione Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/lavagna/sw.js').then(reg => {
            console.log('Service worker registrato con successo.', reg);
        }).catch(err => {
            console.error('Registrazione Service worker fallita:', err);
        });
    });
}
