/**
 * SQLens — auth.js
 * Handles: user registration, login, password hashing,
 * IndexedDB persistence, session management via localStorage.
 */

const Auth = {
  _DB_NAME: 'sqlviz_auth',
  _DB_VERSION: 1,
  _STORE_USERS: 'users',
  _SESSION_KEY: 'sqlviz_session',
  _db: null,

  async openDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._DB_NAME, this._DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this._STORE_USERS)) {
          const store = db.createObjectStore(this._STORE_USERS, { keyPath: 'id' });
          store.createIndex('username', 'username', { unique: true });
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };

      req.onerror = (e) => {
        reject(new Error('Failed to open auth DB: ' + e.target.error));
      };
    });
  },

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  generateId() {
    return crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  },

  idbGet(store, index, value) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(store, 'readonly');
      const req = tx.objectStore(store).index(index).get(value);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  },

  idbPut(store, data) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  async register(username, password) {
    await this.openDB();

    username = username.trim().toLowerCase();
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const existing = await this.idbGet(this._STORE_USERS, 'username', username);
    if (existing) throw new Error('Username already taken');

    const user = {
      id: this.generateId(),
      username,
      passwordHash: await this.hashPassword(password),
      created: new Date().toISOString()
    };

    await this.idbPut(this._STORE_USERS, user);
    return { id: user.id, username: user.username };
  },

  async login(username, password) {
    await this.openDB();

    username = username.trim().toLowerCase();
    const user = await this.idbGet(this._STORE_USERS, 'username', username);
    if (!user) throw new Error('Invalid username or password');

    const hash = await this.hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('Invalid username or password');

    return { id: user.id, username: user.username };
  },

  getSession() {
    try {
      const raw = localStorage.getItem(this._SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setSession(user) {
    localStorage.setItem(this._SESSION_KEY, JSON.stringify({
      userId: user.id,
      username: user.username,
      loginAt: new Date().toISOString()
    }));
  },

  clearSession() {
    localStorage.removeItem(this._SESSION_KEY);
  }
};
