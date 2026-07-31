// ══════════════════════════════════════════════════════════
// IndexedDB 本地儲存模組 — 所有報告草稿存在使用者瀏覽器內，永不上傳
// ══════════════════════════════════════════════════════════

const Storage = {
  db: null,
  DB_NAME: 'esg-report-db',
  VERSION: 1,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('reports')) {
          const store = db.createObjectStore('reports', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('sections')) {
          db.createObjectStore('sections', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async saveReport(id, data) {
    return this._put('reports', { id, data, updatedAt: Date.now() });
  },

  async loadReport(id) {
    const rec = await this._get('reports', id);
    return rec ? rec.data : null;
  },

  async listReports() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('reports', 'readonly');
      const store = tx.objectStore('reports');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteReport(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('reports', 'readwrite');
      tx.objectStore('reports').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveSection(reportId, sectionKey, text) {
    return this._put('sections', { id: `${reportId}:${sectionKey}`, reportId, sectionKey, text, updatedAt: Date.now() });
  },

  async loadSections(reportId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sections', 'readonly');
      const store = tx.objectStore('sections');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []).filter(s => s.reportId === reportId);
        const map = {};
        all.forEach(s => map[s.sectionKey] = s.text);
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  },

  _put(storeName, obj) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = () => reject(tx.error);
    });
  },

  _get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // 匯出所有資料為 JSON（供備份）
  async exportAll() {
    const reports = await this.listReports();
    return JSON.stringify({ version: this.VERSION, exportedAt: Date.now(), reports }, null, 2);
  },

  // 從 JSON 匯入資料
  async importAll(json) {
    const data = JSON.parse(json);
    for (const r of (data.reports || [])) {
      await this._put('reports', r);
    }
    return data.reports?.length || 0;
  }
};

if (typeof module !== 'undefined') module.exports = Storage;
