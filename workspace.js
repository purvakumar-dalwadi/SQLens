/**
 * SQLens — workspace.js
 * Manages workspaces per user: create, list, delete.
 * Each workspace stores its own sqlite binary (exported from sql.js).
 * Also manages query history.
 */

const Workspace = {
  _DB_NAME: 'sqlviz_workspaces',
  _DB_VERSION: 1,
  _STORE_WS: 'workspaces',
  _STORE_HIST: 'query_history',
  _db: null,

  async openDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(this._STORE_WS)) {
          const ws = db.createObjectStore(this._STORE_WS, { keyPath: 'id' });
          ws.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(this._STORE_HIST)) {
          const hist = db.createObjectStore(this._STORE_HIST, { keyPath: 'id' });
          hist.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
      };

      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror   = (e) => reject(new Error('Failed to open workspace DB: ' + e.target.error));
    });
  },

  idbGetAll(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  },

  idbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  },

  idbPut(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  },

  generateId() {
    return crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  },

  async create(userId, name, description = '') {
    await this.openDB();
    const ws = {
      id: this.generateId(),
      userId,
      name: name.trim(),
      description: description.trim(),
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tableCount: 0,
      dbData: null
    };
    await this.idbPut(this._STORE_WS, ws);
    return ws;
  },

  async list(userId) {
    await this.openDB();
    const all = await this.idbGetAll(this._STORE_WS, 'userId', userId);
    return all.sort((a, b) => new Date(b.created) - new Date(a.created));
  },

  async get(workspaceId) {
    await this.openDB();
    return this.idbGet(this._STORE_WS, workspaceId);
  },

  async save(workspace) {
    await this.openDB();
    workspace.updated = new Date().toISOString();
    return this.idbPut(this._STORE_WS, workspace);
  },

  async remove(workspaceId) {
    await this.openDB();
    const hist = await this.idbGetAll(this._STORE_HIST, 'workspaceId', workspaceId);
    for (const h of hist) await this.idbDelete(this._STORE_HIST, h.id);
    return this.idbDelete(this._STORE_WS, workspaceId);
  },

  async saveHistory(workspaceId, entry) {
    await this.openDB();
    const record = {
      id: this.generateId(),
      workspaceId,
      query:       entry.query,
      rowCount:    entry.rowCount,
      duration:    entry.duration,
      executedAt:  new Date().toISOString()
    };
    await this.idbPut(this._STORE_HIST, record);
    return record;
  },

  async getHistory(workspaceId, limit = 50) {
    await this.openDB();
    const all = await this.idbGetAll(this._STORE_HIST, 'workspaceId', workspaceId);
    return all
      .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
      .slice(0, limit);
  },

  async clearHistory(workspaceId) {
    await this.openDB();
    const all = await this.idbGetAll(this._STORE_HIST, 'workspaceId', workspaceId);
    for (const h of all) await this.idbDelete(this._STORE_HIST, h.id);
  }
};
