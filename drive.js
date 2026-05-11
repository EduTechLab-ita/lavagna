/**
 * EduBoard — drive.js
 * Integrazione Google Drive: salvataggio lezioni, sfondi personalizzati,
 * libreria lezioni con struttura ad albero.
 *
 * Dipende dai globali di app.js: canvasMgr, bgMgr, CONFIG, toast
 * Usa Google Identity Services (GIS) — script caricato in index.html
 *
 * TOKEN: salvato in sessionStorage (si perde alla chiusura del browser)
 * AUTORE: generato da Claude Code — EduTechLab Italia
 */

'use strict';

// =============================================================================
// COLORI CARTELLE — 8 opzioni predefinite
// =============================================================================

const FOLDER_COLORS = [
    '#ef4444', // rosso
    '#f97316', // arancione
    '#eab308', // giallo
    '#22c55e', // verde
    '#3b82f6', // blu
    '#8b5cf6', // viola
    '#ec4899', // rosa
    '#64748b', // grigio (default)
];

// =============================================================================
// SEZIONE 1 — DriveManager
// Gestisce autenticazione OAuth2 e tutte le operazioni su Drive API v3
// =============================================================================

class DriveManager {
    constructor() {
        // OAuth2 — stesso CLIENT_ID usato da CAArtella, ValPrimaria, ComportamentoScuola
        this.CLIENT_ID  = '374342529488-c123a5j5v8hnfs241udbl55fos5thfq6.apps.googleusercontent.com';
        this.SCOPE      = 'https://www.googleapis.com/auth/drive email profile';

        // Token OAuth2 — letto da sessionStorage all'avvio
        this.accessToken = null;
        this.tokenExpiry = 0;

        // Stato connessione
        this.connected    = false;
        this.userEmail    = '';
        this.userName     = '';   // nome visualizzato (da userinfo API)
        this.userPhotoUrl = null; // URL foto profilo Google

        // ID cartelle Drive (cache in sessionStorage)
        this.rootFolderId    = null;   // "EduBoard"
        this.lessonsFolderId = null;   // "EduBoard/Lezioni"
        this.bgFolderId      = null;   // "EduBoard/Sfondi"
    }

    // ──────────────────────────────────────────────────────────────────────────
    // AUTENTICAZIONE
    // ──────────────────────────────────────────────────────────────────────────

    /** Apre il popup OAuth2 e acquisisce il token. */
    async connect() {
        if (typeof google === 'undefined' || !google.accounts) {
            toast('Librerie Google non ancora caricate. Riprova tra un secondo.', 'error');
            return;
        }

        return new Promise((resolve, reject) => {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope:     this.SCOPE,
                callback:  async (tokenResponse) => {
                    if (tokenResponse.error) {
                        toast('Autorizzazione negata: ' + tokenResponse.error, 'error');
                        reject(new Error(tokenResponse.error));
                        return;
                    }
                    // Salva token in sessionStorage
                    this.accessToken = tokenResponse.access_token;
                    this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
                    this._saveSession();

                    try {
                        // Recupera email utente + foto profilo
                        const info = await this._apiFetch('https://www.googleapis.com/oauth2/v2/userinfo');
                        this.userEmail    = info.email || '';
                        this.userName     = info.given_name || info.name || '';
                        this.userPhotoUrl = info.picture || null;

                        // Inizializza struttura cartelle
                        await this._ensureRootFolder();
                        await this._ensureLessonsFolder();
                        await this._ensureBgFolder();

                        this.connected = true;
                        this._saveSession();
                        resolve();
                    } catch (err) {
                        toast('Errore connessione Drive: ' + err.message, 'error');
                        reject(err);
                    }
                }
            });
            client.requestAccessToken({ prompt: 'consent' });
        });
    }

    /**
     * Prova rinnovo silenzioso del token (senza popup).
     * Utile al caricamento della pagina se si era già connessi.
     */
    async trySilentConnect(retries = 6) {
        if (typeof google === 'undefined' || !google.accounts) {
            if (retries > 0) {
                setTimeout(() => this.trySilentConnect(retries - 1), 1500);
            }
            return false;
        }

        return new Promise((resolve) => {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope:     this.SCOPE,
                prompt:    '',
                callback:  async (tokenResponse) => {
                    if (tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
                        this.connected   = true;
                        this._saveSession();

                        // Assicura che le cartelle esistano ancora
                        try {
                            await this._ensureRootFolder();
                            await this._ensureLessonsFolder();
                            await this._ensureBgFolder();
                        } catch (_) {}

                        resolve(true);
                    } else {
                        this.connected = false;
                        resolve(false);
                    }
                }
            });
            client.requestAccessToken({ prompt: '' });
        });
    }

    /** Revoca il token e pulisce lo stato. */
    async disconnect() {
        if (this.accessToken && typeof google !== 'undefined' && google.accounts) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        this.accessToken     = null;
        this.tokenExpiry     = 0;
        this.connected       = false;
        this.userEmail       = '';
        this.rootFolderId    = null;
        this.lessonsFolderId = null;
        this.bgFolderId      = null;
        sessionStorage.removeItem('eduboard_drive_session');
    }

    /** Restituisce true se il token è valido. */
    isConnected() {
        return this.connected && !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    /** Controlla se il token sta per scadere (< 5 min) e avvisa. */
    async _refreshIfNeeded() {
        if (!this.connected) return;
        // Se mancano meno di 5 minuti alla scadenza, avvisa l'utente
        if (Date.now() > this.tokenExpiry - 5 * 60 * 1000) {
            toast('Sessione Drive in scadenza — riconnetti per continuare a salvare.', 'info');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PERSISTENZA SESSIONE (sessionStorage)
    // ──────────────────────────────────────────────────────────────────────────

    _saveSession() {
        try {
            sessionStorage.setItem('eduboard_drive_session', JSON.stringify({
                accessToken:     this.accessToken,
                tokenExpiry:     this.tokenExpiry,
                userEmail:       this.userEmail,
                userName:        this.userName,
                userPhotoUrl:    this.userPhotoUrl,
                rootFolderId:    this.rootFolderId,
                lessonsFolderId: this.lessonsFolderId,
                bgFolderId:      this.bgFolderId,
                connected:       this.connected
            }));
        } catch (_) {}
    }

    _loadSession() {
        try {
            const raw = sessionStorage.getItem('eduboard_drive_session');
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (!s.accessToken || Date.now() >= s.tokenExpiry) return false;
            Object.assign(this, s);
            return true;
        } catch (_) {
            return false;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CARTELLE
    // ──────────────────────────────────────────────────────────────────────────

    /** Crea "EduBoard" nella root Drive se non esiste. */
    async _ensureRootFolder() {
        if (this.rootFolderId) return this.rootFolderId;
        this.rootFolderId = await this._findOrCreateFolder('EduBoard', null);
        this._saveSession();
        return this.rootFolderId;
    }

    /** Crea "EduBoard/Lezioni" se non esiste. */
    async _ensureLessonsFolder() {
        await this._ensureRootFolder();
        if (this.lessonsFolderId) return this.lessonsFolderId;
        this.lessonsFolderId = await this._findOrCreateFolder('Lezioni', this.rootFolderId);
        this._saveSession();
        return this.lessonsFolderId;
    }

    /** Crea "EduBoard/Sfondi" se non esiste. */
    async _ensureBgFolder() {
        await this._ensureRootFolder();
        if (this.bgFolderId) return this.bgFolderId;
        this.bgFolderId = await this._findOrCreateFolder('Sfondi', this.rootFolderId);
        this._saveSession();
        return this.bgFolderId;
    }

    /**
     * Trova o crea una cartella in Drive.
     * @param {string} name       - nome cartella
     * @param {string|null} parentId - ID cartella padre (null = root Drive)
     * @returns {string} ID cartella
     */
    async createFolder(name, parentId) {
        return this._findOrCreateFolder(name, parentId);
    }

    /** Lista sottocartelle in un folder. */
    async listFolders(parentId) {
        this._checkConnected();
        const q = encodeURIComponent(
            `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        );
        const resp = await this._apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name`
        );
        return resp.files || [];
    }

    /** Lista file JSON in un folder. */
    async listFiles(folderId) {
        this._checkConnected();
        const q = encodeURIComponent(
            `'${folderId}' in parents and mimeType='application/json' and trashed=false`
        );
        const resp = await this._apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc`
        );
        return resp.files || [];
    }

    /** Elimina un file o una cartella. */
    async deleteItem(fileId) {
        this._checkConnected();
        await this._apiFetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            'DELETE'
        );
    }

    /** Rinomina un file o una cartella. */
    async renameItem(fileId, newName) {
        this._checkConnected();
        return this._apiFetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`,
            'PATCH',
            { name: newName }
        );
    }

    /**
     * Sposta un file o cartella in una nuova cartella padre.
     * @param {string} fileId        - ID elemento da spostare
     * @param {string} newParentId   - ID nuova cartella destinazione
     * @param {string} oldParentId   - ID vecchia cartella origine
     * @returns {Object} risposta API con id e parents
     */
    async moveItem(fileId, newParentId, oldParentId) {
        this._checkConnected();
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}` +
            `?addParents=${encodeURIComponent(newParentId)}` +
            `&removeParents=${encodeURIComponent(oldParentId)}` +
            `&fields=id,parents`;
        return this._apiFetch(url, 'PATCH');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LEZIONI
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Salva una lezione su Drive.
     * Se esiste già un file con lo stesso nome nella stessa cartella, sovrascrive.
     *
     * @param {Object} lesson
     *   lesson.name         {string}  - nome lezione
     *   lesson.folderId     {string}  - ID cartella Drive destinazione
     *   lesson.drawingDataURL {string} - canvas.toDataURL()
     *   lesson.bgKey        {string}  - chiave sfondo preset (es. 'lines-5')
     *   lesson.bgImageBase64 {string} - base64 immagine sfondo custom (opzionale)
     *   lesson.metadata     {Object}  - dati extra opzionali
     * @returns {string} ID file creato/aggiornato
     */
    async saveLesson(lesson) {
        this._checkConnected();
        await this._refreshIfNeeded();

        const now = new Date().toISOString();
        const payload = {
            version:    2,
            name:       lesson.name,
            createdAt:  now,   // verrà sovrascritto se il file esiste già
            modifiedAt: now,
            background: {
                type:        lesson.bgImageBase64 ? 'image' : 'preset',
                key:         lesson.bgKey || 'white',
                imageBase64: lesson.bgImageBase64 || ''
            },
            drawing:    lesson.drawingDataURL || '',
            ...(lesson.metadata || {})
        };

        const fileName = lesson.name.endsWith('.json')
            ? lesson.name
            : lesson.name + '.json';
        const targetFolderId = lesson.folderId || this.lessonsFolderId;

        // Cerca file esistente con lo stesso nome nella stessa cartella
        const existingId = await this._findFileInFolder(fileName, targetFolderId);

        if (existingId) {
            // Carica il createdAt originale per preservarlo
            try {
                const old = await this.loadLesson(existingId);
                payload.createdAt = old.createdAt || now;
            } catch (_) {}
            return this._uploadMultipart(fileName, payload, existingId);
        } else {
            return this._uploadMultipart(fileName, payload, null, targetFolderId);
        }
    }

    /**
     * Carica una lezione da Drive.
     * @param {string} fileId
     * @returns {Object} il JSON della lezione
     */
    async loadLesson(fileId) {
        this._checkConnected();
        const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: 'Bearer ' + this.accessToken } }
        );
        if (!resp.ok) throw new Error('Errore lettura lezione (' + resp.status + ')');
        return resp.json();
    }

    /**
     * Lista tutti i file .json in una cartella.
     * @param {string} folderId
     * @returns {Array<{id, name, modifiedTime}>}
     */
    async listLessons(folderId) {
        return this.listFiles(folderId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SFONDI
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Lista immagini in TUTTE le cartelle chiamate "Sfondi" nel Drive dell'utente.
     * Se non trova nessuna cartella "Sfondi", usa la cartella EduBoard/Sfondi.
     * @returns {Array<{id, name, mimeType, thumbnailLink, webContentLink}>}
     */
    async listBackgrounds() {
        this._checkConnected();
        // Cerca tutte le cartelle chiamate "Sfondi" nel Drive (ovunque)
        const folderQ = encodeURIComponent(
            `name = 'Sfondi' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        );
        let folders = [];
        try {
            const folderResp = await this._apiFetch(
                `https://www.googleapis.com/drive/v3/files?q=${folderQ}&fields=files(id,name)&pageSize=10`
            );
            folders = folderResp.files || [];
        } catch (_) {}

        // Fallback: usa la cartella EduBoard/Sfondi creata dall'app
        if (!folders.length) {
            await this._ensureBgFolder();
            if (this.bgFolderId) folders.push({ id: this.bgFolderId });
        }

        // Lista file immagine/PDF in TUTTE le cartelle "Sfondi" trovate
        const allFiles = [];
        const seenIds = new Set();
        for (const folder of folders) {
            const q = encodeURIComponent(
                `'${folder.id}' in parents and (mimeType contains 'image/' or mimeType='application/pdf') and trashed=false`
            );
            try {
                const resp = await this._apiFetch(
                    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&orderBy=name&pageSize=50`
                );
                for (const f of (resp.files || [])) {
                    if (!seenIds.has(f.id)) {
                        seenIds.add(f.id);
                        allFiles.push(f);
                    }
                }
            } catch (_) {}
        }
        return allFiles;
    }

    /**
     * Carica un file immagine nella cartella "Sfondi".
     * @param {File} file - oggetto File dal <input type="file">
     * @returns {{id, name, webContentLink}}
     */
    async uploadBackground(file) {
        this._checkConnected();
        await this._ensureBgFolder();

        const boundary = 'eduboard_bg_' + Date.now();
        const mimeType = file.type || 'image/jpeg';

        // Legge il file come ArrayBuffer
        const buffer = await file.arrayBuffer();
        const bytes  = new Uint8Array(buffer);

        // Costruisce body multipart (metadata + binario)
        const metaJson = JSON.stringify({ name: file.name, parents: [this.bgFolderId] });
        const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n`;
        const dataPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
        const ending   = `\r\n--${boundary}--`;

        // Assembla come Uint8Array per preservare i byte binari
        const enc       = new TextEncoder();
        const metaBytes = enc.encode(metaPart);
        const dataBytes = enc.encode(dataPart);
        const endBytes  = enc.encode(ending);

        const combined = new Uint8Array(
            metaBytes.length + dataBytes.length + bytes.length + endBytes.length
        );
        let offset = 0;
        combined.set(metaBytes, offset); offset += metaBytes.length;
        combined.set(dataBytes, offset); offset += dataBytes.length;
        combined.set(bytes,     offset); offset += bytes.length;
        combined.set(endBytes,  offset);

        const resp = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webContentLink',
            {
                method:  'POST',
                headers: {
                    Authorization:  'Bearer ' + this.accessToken,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: combined
            }
        );
        if (!resp.ok) throw new Error('Caricamento sfondo fallito (' + resp.status + ')');
        return resp.json();
    }

    /**
     * Scarica un'immagine da Drive e la converte in dataURL.
     * @param {string} fileId
     * @returns {string} dataURL (es. "data:image/jpeg;base64,...")
     */
    async loadBackgroundAsDataURL(fileId) {
        this._checkConnected();
        const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { Authorization: 'Bearer ' + this.accessToken } }
        );
        if (!resp.ok) throw new Error('Errore download sfondo (' + resp.status + ')');
        const blob   = await resp.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HELPER INTERNI
    // ──────────────────────────────────────────────────────────────────────────

    /** Trova o crea una cartella Drive per nome. */
    async _findOrCreateFolder(name, parentId) {
        let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentId) q += ` and '${parentId}' in parents`;
        const resp = await this._apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`
        );
        if (resp.files && resp.files.length > 0) return resp.files[0].id;

        // Crea cartella
        const body = { name, mimeType: 'application/vnd.google-apps.folder' };
        if (parentId) body.parents = [parentId];
        const created = await this._apiFetch(
            'https://www.googleapis.com/drive/v3/files?fields=id',
            'POST',
            body
        );
        return created.id;
    }

    /** Cerca un file per nome in una cartella specifica. Restituisce fileId o null. */
    async _findFileInFolder(name, folderId) {
        const q = encodeURIComponent(
            `name='${name}' and '${folderId}' in parents and trashed=false`
        );
        const resp = await this._apiFetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`
        );
        return (resp.files && resp.files.length > 0) ? resp.files[0].id : null;
    }

    /**
     * Upload multipart su Drive API v3 (per file JSON).
     * @param {string}      name      - nome file
     * @param {Object}      data      - oggetto JS da serializzare come JSON
     * @param {string|null} fileId    - se non null: PATCH (aggiornamento)
     * @param {string|null} parentId  - solo per nuovi file: cartella destinazione
     * @returns {string} ID file
     */
    async _uploadMultipart(name, data, fileId, parentId) {
        const boundary  = 'eduboard_' + Date.now();
        const payload   = JSON.stringify(data, null, 2);
        const metaObj   = fileId ? {} : { name, parents: parentId ? [parentId] : undefined };
        const metaJson  = JSON.stringify(metaObj);

        const body =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n` +
            `--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n` +
            `--${boundary}--`;

        const url    = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
        const method = fileId ? 'PATCH' : 'POST';

        const resp = await fetch(url, {
            method,
            headers: {
                Authorization:  'Bearer ' + this.accessToken,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        });
        if (!resp.ok) throw new Error('Salvataggio Drive fallito (' + resp.status + ')');
        const result = await resp.json();
        return result.id;
    }

    /** Helper fetch per Drive/Google API (JSON). Non per download binari. */
    async _apiFetch(url, method = 'GET', body) {
        const opts = {
            method,
            headers: { Authorization: 'Bearer ' + this.accessToken }
        };
        if (body !== undefined) {
            opts.body                    = JSON.stringify(body);
            opts.headers['Content-Type'] = 'application/json';
        }
        const resp = await fetch(url, opts);
        if (method === 'DELETE' && resp.status === 204) return null;
        if (!resp.ok) throw new Error(`Drive API error ${resp.status} — ${url}`);
        return resp.json();
    }

    /** Lancia un errore se non connessi. */
    _checkConnected() {
        if (!this.isConnected()) throw new Error('Non connesso a Google Drive.');
    }
}


// =============================================================================
// SEZIONE 1b — AutoSaveManager
// Gestisce il salvataggio automatico in tempo reale con debounce.
// Si attiva solo quando Drive è connesso E c'è un file aperto (currentFileId).
// =============================================================================

class AutoSaveManager {
    constructor() {
        this._timer   = null;
        this._saving  = false;
        this._loading = false; // true durante il caricamento lezione (blocca onDirty)
        this.DEBOUNCE_MS = 3000; // 3 secondi dopo l'ultima modifica
    }

    /**
     * Chiamato ad ogni modifica sulla lavagna (dopo isDirty = true).
     * Avvia il timer di debounce per il salvataggio automatico.
     */
    onDirty() {
        // Non avviare auto-save durante il caricamento di una lezione
        if (this._loading) return;
        // Auto-save solo se connesso Drive E c'è un file aperto
        if (!window.libraryMgr?.currentFileId) return;
        if (!window.driveMgr?.isConnected()) return;

        clearTimeout(this._timer);
        this._setPending();
        this._timer = setTimeout(() => this._doSave(), this.DEBOUNCE_MS);
    }

    /** Blocca onDirty durante il caricamento lezione. */
    beginLoading() { this._loading = true; }
    endLoading()   { this._loading = false; }

    async _doSave() {
        if (this._saving) return;
        this._saving = true;
        this._timer  = null;
        this._setSaving();
        try {
            await window.libraryMgr.overwriteCurrentLesson(true); // silent = true
            this._setSaved();
        } catch (e) {
            console.warn('Auto-save fallito:', e);
            this._setError();
        } finally {
            this._saving = false;
        }
    }

    /** True se un salvataggio è in corso (blocca la chiusura). */
    isSaving() { return this._saving; }

    /** True se ci sono modifiche in attesa di salvataggio. */
    hasPending() { return this._timer !== null; }

    /** Cancella il timer e resetta lo stato (usato dopo caricamento lezione). */
    reset() {
        clearTimeout(this._timer);
        this._timer  = null;
        this._saving = false;
        this._setError(); // rimuove tutti i badge
    }

    _getWrapper() {
        return document.getElementById('drive-fab-wrapper') ||
               document.getElementById('drive-fab')?.parentElement;
    }

    _setPending() {
        const w = this._getWrapper();
        if (!w) return;
        w.classList.remove('autosave-saving', 'autosave-saved');
        w.classList.add('autosave-pending');
    }
    _setSaving() {
        const w = this._getWrapper();
        if (!w) return;
        w.classList.remove('autosave-pending', 'autosave-saved');
        w.classList.add('autosave-saving');
    }
    _setSaved() {
        const w = this._getWrapper();
        if (!w) return;
        w.classList.remove('autosave-saving', 'autosave-pending');
        w.classList.add('autosave-saved');
        // Rimuovi il checkmark dopo 4 secondi
        clearTimeout(this._savedTimer);
        this._savedTimer = setTimeout(() => w.classList.remove('autosave-saved'), 4000);
    }
    _setError() {
        const w = this._getWrapper();
        if (!w) return;
        w.classList.remove('autosave-saving', 'autosave-pending', 'autosave-saved');
    }
}

// Istanza globale (disponibile anche in app.js)
window.autoSaveMgr = new AutoSaveManager();


// =============================================================================
// SEZIONE 2 — LibraryManager
// Gestisce il pannello UI della libreria lezioni (struttura ad albero)
// =============================================================================

class LibraryManager {
    constructor(driveManager) {
        this.drive  = driveManager;
        this.panel  = document.getElementById('library-panel');
        this.treeEl = document.getElementById('library-tree');

        // Cartella correntemente selezionata per il salvataggio
        this.currentFolderId = null;

        // FileId dell'ultima lezione aperta/salvata (per ripristino posizione)
        this.currentFileId = null;

        // Stato cartelle espanse: sopravvive al refresh
        this._expandedFolders = new Set();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // APERTURA / CHIUSURA
    // ──────────────────────────────────────────────────────────────────────────

    toggle() {
        const isOpen = this.panel.classList.contains('open');
        if (isOpen) {
            this.panel.classList.remove('open');
        } else {
            this.panel.classList.add('open');
            this.refresh();
        }
    }

    close() {
        this.panel.classList.remove('open');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // REFRESH — ricarica albero dal Drive
    // ──────────────────────────────────────────────────────────────────────────

    async refresh() {
        this._updateDriveStatus();
        const savedScroll = this.treeEl.scrollTop;
        this.treeEl.innerHTML = '<div class="tree-loading">Caricamento...</div>';

        if (!this.drive.isConnected()) {
            this.treeEl.innerHTML = `
                <div class="tree-empty">
                    <p>Connetti Google Drive per usare la libreria.</p>
                    <button class="tree-connect-btn" id="tree-connect-btn">Connetti Drive</button>
                </div>`;
            document.getElementById('tree-connect-btn')?.addEventListener('click', () => this._connectAndRefresh());
            return;
        }

        const CACHE_KEY = 'eduboard-lib-cache';
        const CACHE_TTL = 600000; // 10 minuti

        // Controlla cache localStorage
        const _renderFromData = async () => {
            await this.drive._ensureLessonsFolder();
            this.treeEl.innerHTML = '';
            await this.renderTree(this.drive.lessonsFolderId, this.treeEl, 0);
            if (!this.treeEl.hasChildNodes()) {
                this.treeEl.innerHTML = '<div class="tree-empty">Nessuna lezione salvata.</div>';
            }
            if (this.currentFileId) {
                // Espansione cartelle di primo livello è asincrona — attendi il DOM
                setTimeout(() => this._highlightCurrentLesson(), 1500);
            } else {
                this.treeEl.scrollTop = savedScroll;
            }
        };

        // Leggi cache
        let cached = null;
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) cached = JSON.parse(raw);
        } catch (_) {}

        const cacheValid = cached && (Date.now() - cached.ts < CACHE_TTL);

        if (cacheValid) {
            // Renderizza subito da cache, poi aggiorna da Drive in background
            try {
                await _renderFromData();
            } catch (err) {
                this.treeEl.innerHTML = `<div class="tree-empty tree-error">Errore: ${err.message}</div>`;
            }
            // Aggiornamento background silenzioso — aggiorna cache e re-render
            this._backgroundRefresh(CACHE_KEY, savedScroll);
        } else {
            // Cache mancante o scaduta: fetch Drive normalmente
            try {
                await _renderFromData();
                // Salva in cache dopo render riuscito
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now() }));
                } catch (_) {}
            } catch (err) {
                this.treeEl.innerHTML = `<div class="tree-empty tree-error">Errore: ${err.message}</div>`;
            }
        }
    }

    /** Aggiornamento silenzioso da Drive in background dopo render da cache. */
    async _backgroundRefresh(cacheKey, savedScroll) {
        try {
            await this.drive._ensureLessonsFolder();
            this.treeEl.innerHTML = '';
            await this.renderTree(this.drive.lessonsFolderId, this.treeEl, 0);
            if (!this.treeEl.hasChildNodes()) {
                this.treeEl.innerHTML = '<div class="tree-empty">Nessuna lezione salvata.</div>';
            }
            // Aggiorna timestamp cache dopo fetch riuscito
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now() }));
            } catch (_) {}
            if (this.currentFileId) {
                setTimeout(() => this._highlightCurrentLesson(), 1500);
            } else {
                this.treeEl.scrollTop = savedScroll;
            }
        } catch (_) {
            // Background refresh fallito: nessun messaggio (la cache è già mostrata)
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EVIDENZIA LEZIONE CORRENTE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Dopo il render dell'albero, cerca il file con currentFileId,
     * lo evidenzia con la classe lesson-item--active, espande le cartelle
     * genitrici e fa scroll fino all'elemento.
     */
    _highlightCurrentLesson() {
        if (!this.currentFileId) return;
        const panel = this.treeEl;
        if (!panel) return;
        // Rimuovi eventuali highlight precedenti
        panel.querySelectorAll('.lesson-item--active').forEach(el => el.classList.remove('lesson-item--active'));
        // Cerca l'elemento con data-file-id corrispondente
        const items = panel.querySelectorAll('[data-file-id]');
        items.forEach(item => {
            if (item.dataset.fileId === this.currentFileId) {
                item.classList.add('lesson-item--active');
                // Apri tutti i folder genitori fino alla radice del tree
                let parent = item.parentElement;
                while (parent && parent !== panel) {
                    if (parent.classList.contains('tree-subtree')) {
                        parent.style.display = 'block';
                        parent.dataset.loaded = parent.dataset.loaded || 'true';
                        // Aggiorna icona del folder genitore (la riga item precedente al subContainer)
                        const folderItem = parent.previousElementSibling;
                        if (folderItem && folderItem.classList.contains('tree-item')) {
                            const iconEl = folderItem.querySelector('.tree-icon');
                            if (iconEl) iconEl.textContent = '📂';
                            // Recupera folderId dall'event listener non è possibile direttamente;
                            // usiamo il dataset se disponibile
                        }
                    }
                    parent = parent.parentElement;
                }
                // Scroll verso l'elemento
                setTimeout(() => item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 150);
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RENDER ALBERO RICORSIVO
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Renderizza la struttura ad albero (cartelle + file) in modo ricorsivo.
     * @param {string}      parentId  - ID cartella Drive da cui partire
     * @param {HTMLElement} container - elemento DOM in cui appendere
     * @param {number}      depth     - profondità corrente (per indentazione)
     */
    async renderTree(parentId, container, depth = 0) {
        const [folders, files] = await Promise.all([
            this.drive.listFolders(parentId),
            this.drive.listLessons(parentId)
        ]);

        const indent = depth * 16;

        // --- Cartelle ---
        for (const folder of folders) {
            const item = this._createTreeItem('folder', '📁', folder.name, indent);
            container.appendChild(item);

            // Cerchietto colore cartella
            const colorDot = this._createColorDot(folder.id);
            // Inserisci il dot prima dell'icona cartella
            item.insertBefore(colorDot, item.firstChild);

            // Sottocartella collassabile
            const subContainer = document.createElement('div');
            subContainer.className = 'tree-subtree';
            subContainer.style.display = 'none';
            subContainer.dataset.loaded = 'false';
            container.appendChild(subContainer);

            // Helper per espandere la cartella (usato sia dal click che dall'auto-restore)
            const expandFolder = async () => {
                const iconEl = item.querySelector('.tree-icon');
                subContainer.style.display = 'block';
                if (iconEl) iconEl.textContent = '📂';
                this._expandedFolders.add(folder.id);
                if (subContainer.dataset.loaded === 'false') {
                    subContainer.dataset.loaded = 'true';
                    subContainer.innerHTML = `<div class="tree-loading" style="padding-left:${indent + 16}px">⏳ Caricamento...</div>`;
                    try {
                        subContainer.innerHTML = '';
                        await this.renderTree(folder.id, subContainer, depth + 1);
                        if (!subContainer.children.length) {
                            subContainer.innerHTML = `<div class="tree-empty" style="padding-left:${indent + 16}px;font-size:0.78rem;color:var(--text-muted)">Cartella vuota</div>`;
                        }
                    } catch (err) {
                        subContainer.innerHTML = `<div class="tree-empty" style="padding-left:${indent + 16}px;color:#ef4444">Errore: ${err.message}</div>`;
                    }
                }
            };

            // Click su TUTTA la riga cartella → espandi/collassa + seleziona
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                this._selectFolder(folder.id, item);

                const isOpen = subContainer.style.display !== 'none';
                if (isOpen) {
                    subContainer.style.display = 'none';
                    const iconEl = item.querySelector('.tree-icon');
                    if (iconEl) iconEl.textContent = '📁';
                    this._expandedFolders.delete(folder.id);
                } else {
                    await expandFolder();
                }
            });

            // Auto-espandi se era aperta prima del refresh
            // oppure se è una cartella di primo livello (depth === 0) — aperta di default
            if (this._expandedFolders.has(folder.id) || depth === 0) {
                if (!this._expandedFolders.has(folder.id)) {
                    this._expandedFolders.add(folder.id);
                }
                expandFolder(); // non awaita per non bloccare il render iniziale
            }

            // Pulsanti contestuali cartella (rinomina/elimina) — stopPropagation interno
            this._addContextButtons(item, folder, 'folder');

            // Drag-and-drop — questa cartella è sia draggable che drop target
            this._makeDraggable(item, folder.id, parentId, folder.name, 'folder');
            this._makeDropTarget(item, subContainer, folder.id);
        }

        // --- File lezioni ---
        for (const file of files) {
            const name = file.name.replace(/\.json$/, '');
            const item = this._createTreeItem('lesson', '📄', name, indent + 16);
            item.dataset.fileId = file.id; // necessario per _highlightCurrentLesson()
            container.appendChild(item);

            // Click su file: apre la lezione
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openLesson(file.id, file.name);
            });

            this._addContextButtons(item, { id: file.id, name }, 'lesson');

            // Drag-and-drop — i file sono solo draggable (non drop target)
            this._makeDraggable(item, file.id, parentId, file.name, 'lesson');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // AZIONI
    // ──────────────────────────────────────────────────────────────────────────

    /** Apre dialog per creare nuova cartella nella posizione selezionata. */
    async createFolder(parentId) {
        if (!this.drive.isConnected()) {
            toast('Connetti Drive prima.', 'error'); return;
        }
        const name = prompt('Nome nuova cartella:');
        if (!name || !name.trim()) return;
        try {
            await this.drive.createFolder(name.trim(), parentId || this.drive.lessonsFolderId);
            toast('Cartella creata!', 'success');
            this.refresh();
        } catch (err) {
            toast('Errore creazione cartella: ' + err.message, 'error');
        }
    }

    /**
     * Carica una lezione da Drive e la applica alla lavagna.
     * @param {string} fileId
     * @param {string} fileName - usato solo per il nome progetto
     */
    async openLesson(fileId, fileName) {
        if (!this.drive.isConnected()) {
            toast('Connetti Drive prima.', 'error'); return;
        }

        // Se auto-save in corso, blocca e avvisa
        if (window.autoSaveMgr?.isSaving()) {
            toast('Salvataggio automatico in corso — attendi un momento.', 'info');
            return;
        }

        // BUG 1 FIX: Se dirty E c'è un file Drive aperto → salva sempre prima di cambiare lezione,
        // indipendentemente dallo stato del timer debounce (già scaduto o ancora pending).
        if (typeof CONFIG !== 'undefined' && CONFIG.isDirty && this.currentFileId) {
            // Cancella timer pending se esiste (evita doppio salvataggio)
            if (window.autoSaveMgr?._timer) {
                clearTimeout(window.autoSaveMgr._timer);
                window.autoSaveMgr._timer = null;
            }
            try {
                await this.overwriteCurrentLesson(false); // false = mostra toast
            } catch(e) {
                console.warn('Salvataggio pre-cambio lezione fallito:', e);
            }
        }

        // Mostra dialog salvataggio SOLO se:
        // - c'è un auto-save pending senza currentFileId (flush immediato), OPPURE
        // - isDirty=true E non c'è currentFileId (nessun auto-save attivo, salvataggio manuale)
        const hasPendingAutoSave = window.autoSaveMgr?.hasPending();
        if (hasPendingAutoSave && !this.currentFileId) {
            // Flush immediato prima di procedere
            clearTimeout(window.autoSaveMgr._timer);
            window.autoSaveMgr._timer = null;
            try { await window.libraryMgr.overwriteCurrentLesson(); } catch (_) {}
            window.autoSaveMgr._setError();
        } else if (typeof CONFIG !== 'undefined' && CONFIG.isDirty && !this.currentFileId) {
            // Solo se dirty E senza auto-save attivo (nessun file Drive aperto)
            if (typeof confirmIfDirty === 'function') {
                const canContinue = await confirmIfDirty();
                if (!canContinue) return;
            }
        }
        try {
            window.autoSaveMgr?.beginLoading();
            toast('Caricamento lezione...', 'info');
            const lesson = await this.drive.loadLesson(fileId);

            // 1. Ripristina sfondo
            if (lesson.background) {
                if (lesson.background.type === 'image' && lesson.background.imageBase64) {
                    const img = new Image();
                    img.onload = () => bgMgr.setImage(img);
                    img.src    = lesson.background.imageBase64;
                } else {
                    bgMgr.setBackground(lesson.background.key || 'white');
                    // Aggiorna pulsante sfondo attivo nella toolbar
                    document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
                    const activeBtn = document.querySelector(`.bg-opt[data-bg="${lesson.background.key || 'white'}"]`);
                    if (activeBtn) activeBtn.classList.add('active');
                }
            }

            // 2. Ripristina disegno
            // FIX v14: se ci sono pagine multiple, NON caricare lesson.drawing —
            // createrebbe una race condition asincrona con _restorePage che
            // sovrappone il contenuto di una pagina sull'altra al caricamento.
            // lesson.drawing viene usato solo per retrocompatibilità (lezioni senza pages).
            const hasPages = lesson.pages && Array.isArray(lesson.pages) && lesson.pages.length > 0;
            if (lesson.drawing && !hasPages) {
                const img = new Image();
                img.onload = () => {
                    canvasMgr._saveUndo();
                    canvasMgr.ctx.clearRect(0, 0, canvasMgr.canvas.width, canvasMgr.canvas.height);
                    canvasMgr.ctx.drawImage(img, 0, 0);
                };
                img.src = lesson.drawing;
            }

            // 3. Aggiorna nome progetto
            const name = lesson.name || fileName.replace(/\.json$/, '');
            CONFIG.projectName = name;
            document.getElementById('project-name').textContent = name;

            // 4. Ripristina pagine multiple (se presenti)
            if (hasPages && typeof window.pageManager !== 'undefined' && window.pageManager) {
                window.pageManager.deserialize(lesson.pages);
            }

            toast('Lezione "' + name + '" caricata!', 'success');
            // Memorizza fileId corrente per ripristino posizione
            this.currentFileId = fileId;
            window.autoSaveMgr?.endLoading();
            // Reset isDirty con delay: le operazioni asincrone di ripristino (img.onload, ecc.)
            // potrebbero impostare isDirty=true dopo il reset sincrono — lo riesegiamo dopo
            setTimeout(() => {
                if (typeof CONFIG !== 'undefined') CONFIG.isDirty = false;
                window.autoSaveMgr?.reset();
            }, 500);
            // Memorizza come ultima lezione aperta per auto-open al prossimo avvio
            localStorage.setItem('eduboard_last_lesson', JSON.stringify({ fileId, fileName }));
            // Ripristina posizione (pan+zoom) salvata con la lezione
            const savedPos = localStorage.getItem('eduboard_view_' + fileId);
            if (savedPos) {
                try {
                    const pos = JSON.parse(savedPos);
                    if (typeof panMgr !== 'undefined' && panMgr && pos.dx !== undefined) {
                        // Piccolo delay per assicurarsi che il canvas sia renderizzato
                        // e che eventuali centerView() successivi non sovrascrivano
                        setTimeout(() => {
                            panMgr.dx = pos.dx;
                            panMgr.dy = pos.dy;
                            panMgr.scale = pos.scale || 1;
                            panMgr._applyTransform();
                        }, 100);
                    }
                } catch (_) {}
            }
            this.close();
        } catch (err) {
            window.autoSaveMgr?.endLoading();
            toast('Errore apertura lezione: ' + err.message, 'error');
        }
    }

    /**
     * Salva la lezione corrente nella cartella selezionata.
     * Se nessuna cartella è selezionata, chiede il nome e salva in "Lezioni".
     */
    async saveCurrentLesson(folderId) {
        if (!this.drive.isConnected()) {
            toast('Connetti Drive prima di salvare.', 'error'); return;
        }

        const targetFolder = folderId || this.currentFolderId || this.drive.lessonsFolderId;

        const name = prompt('Nome lezione:', CONFIG.projectName);
        if (!name || !name.trim()) return;

        try {
            toast('Salvataggio in corso...', 'info');

            // Salva posizione (pan+zoom) associata a questa lezione (se abbiamo un fileId corrente)
            if (typeof panMgr !== 'undefined' && panMgr && this.currentFileId) {
                localStorage.setItem('eduboard_view_' + this.currentFileId, JSON.stringify({
                    dx: panMgr.dx,
                    dy: panMgr.dy,
                    scale: panMgr.scale
                }));
            }

            // Raccoglie dati sfondo
            let bgImageBase64 = '';
            if (bgMgr.uploadedImage) {
                // Converti immagine sfondo in base64 usando un canvas temporaneo
                const tmp    = document.createElement('canvas');
                tmp.width    = bgMgr.canvas.width;
                tmp.height   = bgMgr.canvas.height;
                tmp.getContext('2d').drawImage(bgMgr.canvas, 0, 0);
                bgImageBase64 = tmp.toDataURL('image/jpeg', 0.85);
            }

            const savedFileId = await this.drive.saveLesson({
                name:           name.trim(),
                folderId:       targetFolder,
                drawingDataURL: canvasMgr.getDataURL(),
                bgKey:          bgMgr.currentBg,
                bgImageBase64,
                pages:          window.pageManager ? window.pageManager.serialize() : null
            });

            // Traccia fileId corrente e salva posizione associata al nuovo fileId
            if (savedFileId) {
                this.currentFileId = savedFileId;
                if (typeof panMgr !== 'undefined' && panMgr) {
                    localStorage.setItem('eduboard_view_' + savedFileId, JSON.stringify({
                        dx: panMgr.dx,
                        dy: panMgr.dy,
                        scale: panMgr.scale
                    }));
                }
                localStorage.setItem('eduboard_last_lesson', JSON.stringify({ fileId: savedFileId, fileName: name.trim() + '.json' }));
            }

            CONFIG.projectName = name.trim();
            document.getElementById('project-name').textContent = name.trim();
            CONFIG.isDirty = false;
            window.autoSaveMgr?.reset();
            toast('Lezione salvata su Drive!', 'success');
            this.refresh();
        } catch (err) {
            toast('Errore salvataggio: ' + err.message, 'error');
        }
    }

    /**
     * MODIFICA 5: Sovrascrive la lezione Drive corrente (currentFileId) senza chiedere il nome.
     * Usato dal dialog "modifiche non salvate" e dall'auto-save.
     * @param {boolean} [silent=false] - se true, non mostra toast (usato dall'auto-save)
     */
    async overwriteCurrentLesson(silent = false) {
        if (!this.drive.isConnected()) { if (!silent) toast('Connetti Drive prima di salvare.', 'error'); return; }
        if (!this.currentFileId) { return this.saveCurrentLesson(this.currentFolderId); }

        try {
            if (!silent) toast('Sovrascrittura in corso...', 'info');

            let bgImageBase64 = '';
            if (bgMgr.uploadedImage) {
                const tmp = document.createElement('canvas');
                tmp.width  = bgMgr.canvas.width;
                tmp.height = bgMgr.canvas.height;
                tmp.getContext('2d').drawImage(bgMgr.canvas, 0, 0);
                bgImageBase64 = tmp.toDataURL('image/jpeg', 0.85);
            }

            // Usa _uploadMultipart direttamente con il fileId corrente (PATCH)
            await this.drive._uploadMultipart(
                CONFIG.projectName + '.json',
                {
                    version:    2,
                    name:       CONFIG.projectName,
                    modifiedAt: new Date().toISOString(),
                    background: {
                        type:        bgImageBase64 ? 'image' : 'preset',
                        key:         bgMgr.currentBg,
                        imageBase64: bgImageBase64
                    },
                    drawing: canvasMgr.getDataURL(),
                    pages:   window.pageManager ? window.pageManager.serialize() : null
                },
                this.currentFileId  // PATCH sul file esistente
            );

            CONFIG.isDirty = false;
            if (!silent) {
                window.autoSaveMgr?.reset();
                toast('Lezione sovrascritta su Drive!', 'success');
            }
        } catch (err) {
            if (!silent) toast('Errore sovrascrittura: ' + err.message, 'error');
            throw err; // rilancia per auto-save error handling
        }
    }

    /** Rinomina un elemento (file o cartella). */
    async rename(fileId, currentName) {
        if (!this.drive.isConnected()) { toast('Connetti Drive prima.', 'error'); return; }
        const newName = prompt('Nuovo nome:', currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;
        try {
            await this.drive.renameItem(fileId, newName.trim());
            toast('Rinominato!', 'success');
            this.refresh();
        } catch (err) {
            toast('Errore rinomina: ' + err.message, 'error');
        }
    }

    /** Elimina un elemento con conferma. */
    async delete(fileId, name) {
        if (!this.drive.isConnected()) { toast('Connetti Drive prima.', 'error'); return; }
        if (!confirm(`Eliminare "${name}"? L'operazione non è reversibile.`)) return;
        try {
            await this.drive.deleteItem(fileId);
            toast('"' + name + '" eliminato.', 'success');
            this.refresh();
        } catch (err) {
            toast('Errore eliminazione: ' + err.message, 'error');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HELPER UI
    // ──────────────────────────────────────────────────────────────────────────

    /** Crea un elemento riga dell'albero. */
    _createTreeItem(type, icon, label, indent) {
        const item = document.createElement('div');
        item.className  = `tree-item ${type}`;
        item.style.paddingLeft = (8 + indent) + 'px';
        item.dataset.type = type;

        item.innerHTML = `
            <span class="tree-icon">${icon}</span>
            <span class="tree-label">${this._esc(label)}</span>
            <span class="tree-actions"></span>`;
        return item;
    }

    /** Aggiunge pulsanti Rinomina/Elimina a un tree-item. */
    _addContextButtons(item, entry, type) {
        const actionsEl = item.querySelector('.tree-actions');
        actionsEl.innerHTML = `
            <button class="tree-btn" title="Rinomina" data-action="rename">✏️</button>
            <button class="tree-btn" title="Elimina"  data-action="delete">🗑️</button>`;

        actionsEl.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.rename(entry.id, entry.name);
        });
        actionsEl.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.delete(entry.id, entry.name);
        });
    }

    /** Seleziona una cartella come destinazione corrente. */
    _selectFolder(folderId, itemEl) {
        document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
        itemEl.classList.add('selected');
        this.currentFolderId = folderId;
        // Applica lo sfondo memorizzato per questa cartella (se presente)
        const savedBg = localStorage.getItem('folder-bg-' + folderId);
        if (savedBg && typeof bgMgr !== 'undefined') {
            bgMgr.setBackground(savedBg);
            document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.bg-opt[data-bg="${savedBg}"]`);
            if (btn) btn.classList.add('active');
        }
    }

    /** Aggiorna il banner di stato Drive nel pannello. */
    _updateDriveStatus() {
        const statusEl = document.getElementById('library-drive-status');
        if (!statusEl) return;
        if (this.drive.isConnected()) {
            const display = this.drive.userName || this.drive.userEmail;
            statusEl.innerHTML = `<span class="drive-status-ok">☁️ ${this._esc(display)}</span>`;
        } else {
            statusEl.innerHTML = `<span class="drive-status-off">Drive non connesso</span>`;
        }
    }

    async _connectAndRefresh() {
        try {
            await this.drive.connect();
            driveConnectBtn.update();
            this.refresh();
        } catch (_) {}
    }

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // COLORI CARTELLE
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Crea il cerchietto colorato per una cartella.
     * Gestisce click → popup con 8 swatches.
     * @param {string} folderId
     * @returns {HTMLElement} il <span class="folder-color-dot">
     */
    _createColorDot(folderId) {
        const storageKey = 'folder-color-' + folderId;
        const currentColor = localStorage.getItem(storageKey) || '#64748b';

        const dot = document.createElement('span');
        dot.className = 'folder-color-dot';
        dot.style.backgroundColor = currentColor;
        dot.title = 'Cambia colore cartella';

        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showColorPopup(dot, folderId, storageKey);
        });

        return dot;
    }

    /**
     * Mostra il mini popup con gli 8 swatches di colore.
     * @param {HTMLElement} dotEl    - il cerchietto che ha scatenato il click
     * @param {string}      folderId
     * @param {string}      storageKey
     */
    _showColorPopup(dotEl, folderId, storageKey) {
        // Chiudi eventuali popup già aperti
        document.querySelector('.folder-color-popup')?.remove();

        const currentColor = localStorage.getItem(storageKey) || '#64748b';

        const popup = document.createElement('div');
        popup.className = 'folder-color-popup';

        for (const color of FOLDER_COLORS) {
            const swatch = document.createElement('div');
            swatch.className = 'folder-color-swatch' + (color === currentColor ? ' selected' : '');
            swatch.style.backgroundColor = color;
            swatch.title = color;

            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.setItem(storageKey, color);
                dotEl.style.backgroundColor = color;
                popup.remove();
            });

            popup.appendChild(swatch);
        }

        document.body.appendChild(popup);

        // Posiziona il popup vicino al cerchietto
        const rect = dotEl.getBoundingClientRect();
        popup.style.left = Math.min(rect.left, window.innerWidth - 116) + 'px';
        popup.style.top  = (rect.bottom + 4) + 'px';

        // Chiudi cliccando fuori
        const closeHandler = (e) => {
            if (!popup.contains(e.target) && e.target !== dotEl) {
                popup.remove();
                document.removeEventListener('click', closeHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DRAG AND DROP
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Rende un elemento riga trascinabile.
     * @param {HTMLElement} item      - la riga DOM
     * @param {string}      id        - ID Drive dell'elemento
     * @param {string}      parentId  - ID cartella padre corrente
     * @param {string}      name      - nome elemento
     * @param {string}      type      - 'folder' | 'lesson'
     */
    _makeDraggable(item, id, parentId, name, type) {
        item.setAttribute('draggable', 'true');

        item.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ id, parentId, name, type }));
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '';
        });
    }

    /**
     * Rende una cartella un drop target.
     * @param {HTMLElement} item         - la riga DOM della cartella
     * @param {HTMLElement} subContainer - il subContainer figli (può essere null)
     * @param {string}      folderId     - ID Drive della cartella destinazione
     */
    _makeDropTarget(item, subContainer, folderId) {
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.add('tree-drop-target');
        });

        item.addEventListener('dragleave', (e) => {
            // Rimuovi highlight solo se si esce effettivamente dall'elemento
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('tree-drop-target');
            }
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('tree-drop-target');

            let dragData;
            try {
                dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            } catch (_) {
                return;
            }

            // Evita di spostare un elemento in se stesso
            if (dragData.id === folderId) return;
            // Evita di spostare nella stessa cartella
            if (dragData.parentId === folderId) return;

            try {
                toast('Spostamento in corso...', 'info');
                await this.drive.moveItem(dragData.id, folderId, dragData.parentId);
                toast(`"${dragData.name}" spostato.`, 'success');
                // Ricarica l'albero per riflettere la nuova struttura
                this.refresh();
            } catch (err) {
                toast('Errore spostamento: ' + err.message, 'error');
            }
        });
    }
}


// =============================================================================
// SEZIONE 2b — UTILITY
// =============================================================================

/**
 * Apre automaticamente l'ultima lezione usata, se il Drive è connesso
 * e la lavagna non ha modifiche non salvate.
 */
async function _autoOpenLastLesson() {
    try {
        if (!driveMgr?.isConnected() || !libraryMgr) return;
        if (typeof CONFIG !== 'undefined' && CONFIG.isDirty) return; // non sovrascrivere lavoro in corso
        const raw = localStorage.getItem('eduboard_last_lesson');
        if (!raw) return;
        const last = JSON.parse(raw);
        if (!last?.fileId) return;
        await libraryMgr.openLesson(last.fileId, last.fileName || 'ultima lezione');
    } catch (_) {}
}


// =============================================================================
// SEZIONE 3 — DriveConnectButton
// Gestisce il FAB Drive (basso destra) e il testo di stato nell'header
// =============================================================================

class DriveConnectButton {
    constructor(drive) {
        this.drive = drive;
        // FAB in basso a destra
        this.fab      = document.getElementById('drive-fab');
        this.fabIcon  = document.getElementById('drive-fab-icon');
        this.fabPhoto = document.getElementById('drive-fab-photo');
        this.fabBadge = document.getElementById('drive-fab-badge');
        // Status header
        this.statusEl   = document.getElementById('drive-status-header');
        this.statusText = document.getElementById('drive-status-text');
        this.statusIcon = document.getElementById('drive-status-icon');

        if (this.fab) {
            this.fab.addEventListener('click', () => this._onClick());
        }
    }

    update(state) {
        const connected = this.drive.isConnected();

        // --- Aggiorna FAB ---
        if (this.fab) {
            this.fab.classList.toggle('drive-fab--connected', connected);
        }
        if (this.fabBadge) {
            this.fabBadge.style.display = connected ? 'block' : 'none';
        }

        if (connected) {
            // Prova a caricare foto profilo
            const photoUrl = this.drive.userPhotoUrl;
            if (photoUrl && this.fabPhoto) {
                this.fabIcon.style.display = 'none';
                this.fabPhoto.src = photoUrl;
                this.fabPhoto.style.display = 'block';
            } else {
                // Nessuna foto: mostra omino con bordo verde (già gestito dal CSS)
                if (this.fabIcon) this.fabIcon.style.display = 'block';
                if (this.fabPhoto) this.fabPhoto.style.display = 'none';
                // Colora l'omino di verde quando connesso
                if (this.fabIcon) this.fabIcon.style.stroke = '#86efac';
            }
            // Status header
            if (this.statusEl) this.statusEl.classList.add('drive-status--connected');
            if (this.statusIcon) this.statusIcon.style.display = 'block';
            const name = this.drive.userName || this.drive.userEmail || 'Drive';
            if (this.statusText) this.statusText.textContent = name;
        } else {
            // Non connesso
            if (this.fabIcon) { this.fabIcon.style.display = 'block'; this.fabIcon.style.stroke = 'currentColor'; }
            if (this.fabPhoto) this.fabPhoto.style.display = 'none';
            if (this.statusEl) this.statusEl.classList.remove('drive-status--connected');
            if (this.statusIcon) this.statusIcon.style.display = 'none';
            if (this.statusText) this.statusText.textContent = 'Non connesso';
        }

        // Gestione stato syncing/errore (mantieni compatibilità)
        if (state === 'syncing' && this.fab) {
            this.fab.title = 'Drive — salvataggio in corso...';
        } else if (state === 'error' && this.fab) {
            this.fab.title = 'Drive — errore. Clicca per riconnetterti.';
        } else if (connected && this.fab) {
            this.fab.title = 'Drive connesso — clicca per opzioni';
        } else if (this.fab) {
            this.fab.title = 'Connetti a Google Drive';
        }
    }

    // Compatibilità con i listener precedenti
    async handleClick() {
        return this._onClick();
    }

    async _onClick() {
        if (this.drive.isConnected()) {
            this._showStatusPanel();
        } else {
            try {
                await this.drive.connect();
                this.update();
                const greeting = this.drive.userName || this.drive.userEmail;
                toast('Google Drive connesso! Benvenuto, ' + greeting, 'success');
                setTimeout(() => _autoOpenLastLesson(), 800);
            } catch (err) {
                if (err?.message !== 'cancelled') {
                    toast('Errore connessione Drive: ' + (err?.message || err), 'error');
                }
                this.update('error');
            }
        }
    }

    _showStatusPanel() {
        // Mostra un mini-pannello con opzioni: Libreria, Disconnetti
        let panel = document.getElementById('drive-fab-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'drive-fab-panel';
            panel.style.cssText = `
                position: fixed;
                bottom: 84px;
                right: 16px;
                background: rgba(15,23,42,0.95);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(148,163,184,0.2);
                border-radius: 12px;
                padding: 8px;
                z-index: 601;
                min-width: 200px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;
            const email = this.drive.userEmail || '';
            const name  = this.drive.userName  || '';
            panel.innerHTML = `
                <div style="padding:8px 10px;border-bottom:1px solid rgba(148,163,184,0.15);margin-bottom:4px">
                    <div style="font-size:0.85rem;font-weight:600;color:#e2e8f0">${this._esc(name)}</div>
                    <div style="font-size:0.72rem;color:#94a3b8">${this._esc(email)}</div>
                </div>
                <button id="fab-panel-library" style="background:transparent;border:none;color:#e2e8f0;padding:8px 12px;text-align:left;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:background 0.15s">📚 Apri libreria lezioni</button>
                <button id="fab-panel-disconnect" style="background:transparent;border:none;color:#f87171;padding:8px 12px;text-align:left;border-radius:8px;cursor:pointer;font-size:0.85rem;transition:background 0.15s">🔌 Disconnetti</button>
            `;
            document.body.appendChild(panel);
            // Hover
            panel.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(148,163,184,0.1)');
                btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
            });
            document.getElementById('fab-panel-library')?.addEventListener('click', () => {
                panel.remove();
                const libraryPanel = document.getElementById('library-panel');
                if (libraryPanel) {
                    libraryPanel.classList.add('open');
                    if (typeof libraryMgr !== 'undefined' && libraryMgr) libraryMgr.refresh();
                }
            });
            document.getElementById('fab-panel-disconnect')?.addEventListener('click', async () => {
                panel.remove();
                await this.drive.disconnect();
                this.update();
                libraryMgr?.refresh();
                toast('Drive disconnesso', 'info');
            });
            // Chiudi cliccando fuori
            setTimeout(() => {
                document.addEventListener('click', function closePanel(e) {
                    if (!panel.contains(e.target) && e.target !== document.getElementById('drive-fab')) {
                        panel.remove();
                        document.removeEventListener('click', closePanel);
                    }
                });
            }, 100);
        } else {
            panel.remove(); // toggle
        }
    }

    _esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
}


// =============================================================================
// SEZIONE 3b — CSS INIETTATO
// Stili per colori cartelle e drag-and-drop (iniettati nel <head>)
// =============================================================================

function _injectDriveStyles() {
    if (document.getElementById('drive-extra-styles')) return; // già iniettato
    const style = document.createElement('style');
    style.id = 'drive-extra-styles';
    style.textContent = `
/* ── Colori cartelle ── */
.folder-color-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.3);
    transition: transform 0.1s;
    margin-right: 4px;
}
.folder-color-dot:hover { transform: scale(1.3); }
.folder-color-popup {
    position: fixed;
    background: var(--bg-elevated, #1e293b);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100px;
    z-index: 9999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.folder-color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.1s, transform 0.1s;
}
.folder-color-swatch:hover { transform: scale(1.15); border-color: rgba(255,255,255,0.5); }
.folder-color-swatch.selected { border-color: white; }

/* ── Drag and drop ── */
.tree-drop-target {
    background: rgba(59, 130, 246, 0.2);
    border: 1px dashed rgba(59, 130, 246, 0.6);
    border-radius: 4px;
}
`;
    document.head.appendChild(style);
}

// =============================================================================
// SEZIONE 4 — INIT
// Collegamento globale: istanziazione e wiring degli event listener
// =============================================================================

let driveMgr, libraryMgr, driveConnectBtn;

/**
 * initDrive() — chiamata dal DOMContentLoaded in app.js
 * (oppure si attiva automaticamente tramite window load listener)
 */
function initDrive() {
    _injectDriveStyles();

    driveMgr        = new DriveManager();
    libraryMgr      = new LibraryManager(driveMgr);
    driveConnectBtn = new DriveConnectButton(driveMgr);

    // Esponi come globali window.* — necessario per AutoSaveManager (onDirty usa window.libraryMgr e window.driveMgr)
    window.driveMgr   = driveMgr;
    window.libraryMgr = libraryMgr;

    // Ripristina sessione precedente (se il token è ancora valido)
    const restored = driveMgr._loadSession();
    if (restored) {
        driveConnectBtn.update();
        // BUG 4 fix: se il token è ancora valido, auto-apri l'ultima lezione subito
        if (driveMgr.isConnected()) {
            setTimeout(() => _autoOpenLastLesson(), 1200);
        }
    }

    // ── Pulsante chiudi pannello libreria ──────────────────────────────────
    document.getElementById('library-close')?.addEventListener('click', () => {
        const panel = document.getElementById('library-panel');
        const side  = panel?.dataset.side || 'left';
        panel?.classList.remove('open');
        document.getElementById(`lib-tab-${side}`)?.classList.remove('lib-tab--active');
    });

    // ── Pulsante "Nuova cartella" nel pannello ─────────────────────────────
    document.getElementById('library-new-folder')?.addEventListener('click', () => {
        libraryMgr.createFolder(libraryMgr.currentFolderId);
    });

    // ── Pulsante "Salva qui" nel pannello ──────────────────────────────────
    document.getElementById('library-save-here')?.addEventListener('click', () => {
        libraryMgr.saveCurrentLesson(libraryMgr.currentFolderId);
    });

    // ── Pulsante Salva in header — sovrascrive projectMgr.save con Drive ──
    // (solo se Drive è connesso, altrimenti usa il salvataggio locale)
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            if (driveMgr.isConnected()) {
                libraryMgr.saveCurrentLesson(libraryMgr.currentFolderId);
            }
            // Se non connesso: il listener originale di app.js gestisce il salvataggio locale
        }, true); // capture=true → intercetta prima del listener in app.js
    }

    // ── Rinnovo silenzioso token se sessione ripristinata ──────────────────
    if (driveMgr.connected && !driveMgr.isConnected()) {
        // Token scaduto: prova rinnovo silenzioso
        driveMgr.trySilentConnect().then(ok => {
            if (ok) {
                driveConnectBtn.update();
                libraryMgr._updateDriveStatus();
                // Auto-apri ultima lezione (con delay per dare tempo al DOM di caricarsi)
                setTimeout(() => _autoOpenLastLesson(), 1000);
            }
        });
    }

    console.log('EduBoard Drive — inizializzato.');
}

// Auto-init se caricato dopo DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDrive);
} else {
    initDrive();
}
