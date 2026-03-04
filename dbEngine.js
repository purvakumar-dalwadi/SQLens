/**
 * SQLens — dbEngine.js
 * Wraps sql.js (SQLite WASM) for each workspace.
 * Provides: table CRUD, query execution, CSV import, persistence.
 * Saves the entire sqlite binary back to IndexedDB after mutations.
 */

const DBEngine = {
  _SQL: null,          // sql.js module
  _db: null,           // current sql.js DB instance
  _workspaceId: null,  // current workspace id
  _MAX_ROWS: 1000,

  async initSQLjs() {
    if (this._SQL) return this._SQL;
    this._SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    });
    return this._SQL;
  },

  async loadWorkspace(workspaceId) {
    await this.initSQLjs();
    this._workspaceId = workspaceId;

    const ws = await Workspace.get(workspaceId);
    if (!ws) throw new Error('Workspace not found: ' + workspaceId);

    if (this._db) { try { this._db.close(); } catch(e) {} }

    if (ws.dbData && ws.dbData.length > 0) {
      this._db = new this._SQL.Database(new Uint8Array(ws.dbData));
    } else {
      this._db = new this._SQL.Database();
    }

    return this._db;
  },

  async persistDB() {
    if (!this._db || !this._workspaceId) return;
    const data = this._db.export();
    const ws   = await Workspace.get(this._workspaceId);
    if (!ws) return;
    const tables = this.listTables();
    ws.dbData    = Array.from(data);
    ws.tableCount = tables.length;
    await Workspace.save(ws);
  },

  listTables() {
    if (!this._db) return [];
    try {
      const res = this._db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );
      if (!res.length) return [];
      return res[0].values.map(r => r[0]);
    } catch { return []; }
  },

  getTableSchema(tableName) {
    if (!this._db) return [];
    const safe = this.sanitizeIdentifier(tableName);
    const res = this._db.exec(`PRAGMA table_info("${safe}")`);
    if (!res.length) return [];
    return res[0].values.map(row => ({
      cid:      row[0],
      name:     row[1],
      type:     row[2],
      notnull:  row[3],
      dflt:     row[4],
      pk:       row[5]
    }));
  },

  getTableData(tableName) {
    if (!this._db) return { columns: [], rows: [] };
    const safe = this.sanitizeIdentifier(tableName);
    try {
      const res = this._db.exec(`SELECT * FROM "${safe}" LIMIT ${this._MAX_ROWS}`);
      if (!res.length) return { columns: [], rows: [] };
      return { columns: res[0].columns, rows: res[0].values };
    } catch (e) {
      throw new Error('Failed to read table: ' + e.message);
    }
  },

  async createTable(tableName, columns) {
    if (!this._db) throw new Error('No database loaded');
    const safe = this.sanitizeIdentifier(tableName);
    const colDefs = columns.map(col => {
      const colName = this.sanitizeIdentifier(col.name);
      let def = `"${colName}" ${col.type}`;
      if (col.pk) def += ' PRIMARY KEY';
      if (col.notnull && !col.pk) def += ' NOT NULL';
      if (col.autoincrement && col.pk) def += ' AUTOINCREMENT';
      return def;
    });
    const sql = `CREATE TABLE IF NOT EXISTS "${safe}" (${colDefs.join(', ')})`;
    this._db.run(sql);
    await this.persistDB();
    return true;
  },

  async dropTable(tableName) {
    if (!this._db) throw new Error('No database loaded');
    const safe = this.sanitizeIdentifier(tableName);
    this._db.run(`DROP TABLE IF EXISTS "${safe}"`);
    await this.persistDB();
  },

  async insertRow(tableName, rowData) {
    if (!this._db) throw new Error('No database loaded');
    const safe = this.sanitizeIdentifier(tableName);
    const cols = Object.keys(rowData).map(k => `"${this.sanitizeIdentifier(k)}"`);
    const placeholders = cols.map(() => '?');
    const values = Object.values(rowData);
    const sql = `INSERT INTO "${safe}" (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
    this._db.run(sql, values);
    await this.persistDB();
  },

  async updateRow(tableName, rowData, whereClause, whereValues) {
    if (!this._db) throw new Error('No database loaded');
    const safe = this.sanitizeIdentifier(tableName);
    const setClauses = Object.keys(rowData)
      .map(k => `"${this.sanitizeIdentifier(k)}" = ?`);
    const values = [...Object.values(rowData), ...whereValues];
    const sql = `UPDATE "${safe}" SET ${setClauses.join(', ')} WHERE ${whereClause}`;
    this._db.run(sql, values);
    await this.persistDB();
  },

  async deleteRow(tableName, whereClause, whereValues) {
    if (!this._db) throw new Error('No database loaded');
    const safe = this.sanitizeIdentifier(tableName);
    this._db.run(`DELETE FROM "${safe}" WHERE ${whereClause}`, whereValues);
    await this.persistDB();
  },

  async importCSV(tableName, csvText) {
    if (!this._db) throw new Error('No database loaded');
    const rows  = this.parseCSV(csvText);
    if (!rows.length) throw new Error('CSV is empty');
    const headers = rows[0];
    const schema  = this.getTableSchema(tableName);
    if (!schema.length) throw new Error('Table not found: ' + tableName);
    // Find if there is an AUTOINCREMENT PRIMARY KEY column (usually id)
    const autoIncCol = schema.find(col => col.pk && /int/i.test(col.type) && /auto/i.test((col.type || '') + (col.autoincrement ? ' autoincrement' : '')));
    const autoIncColName = autoIncCol ? autoIncCol.name : null;
    const schemaNames = schema.map(c => c.name.toLowerCase());
    // Map headers to schema, but skip AUTOINCREMENT PK
    const mappedHeaders = headers.map(h => {
      const idx = schemaNames.indexOf(h.toLowerCase().trim());
      if (idx >= 0) {
        const col = schema[idx];
        if (col.name === autoIncColName) return null; // skip AUTOINCREMENT PK
        return col.name;
      }
      return null;
    });
    const safe = this.sanitizeIdentifier(tableName);
    let imported = 0;
    this._db.run('BEGIN TRANSACTION');
    try {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.length || (row.length === 1 && row[0] === '')) continue;
        const rowData = {};
        mappedHeaders.forEach((colName, j) => {
          if (colName) rowData[colName] = row[j] !== undefined ? row[j] : null;
        });
        const cols = Object.keys(rowData).map(k => `"${this.sanitizeIdentifier(k)}"`);
        const ph   = cols.map(() => '?');
        const vals = Object.values(rowData);
        if (cols.length) {
          this._db.run(
            `INSERT OR IGNORE INTO "${safe}" (${cols.join(',')}) VALUES (${ph.join(',')})`,
            vals
          );
          imported++;
        }
      }
      this._db.run('COMMIT');
    } catch (e) {
      this._db.run('ROLLBACK');
      throw new Error('Import failed: ' + e.message);
    }
    await this.persistDB();
    return imported;
  },

  execute(sql) {
    if (!this._db) throw new Error('No database loaded');
    const trimmed  = sql.trim();
    const type     = (trimmed.match(/^\s*(\w+)/)?.[1] || '').toUpperCase();
    const isSelect = /^SELECT\b/i.test(trimmed);
    const start    = performance.now();
    if (isSelect) {
      const res      = this._db.exec(trimmed);
      const duration = performance.now() - start;
      if (!res.length) {
        return { type:'SELECT', columns:[], rows:[], total:0, limited:false, duration:Math.round(duration*100)/100 };
      }
      const rows = res[0].values.slice(0, this._MAX_ROWS);
      return {
        type:'SELECT', columns:res[0].columns, rows,
        total:res[0].values.length, limited:res[0].values.length>this._MAX_ROWS,
        duration:Math.round(duration*100)/100
      };
    }
    this._db.run(trimmed);
    const duration = performance.now() - start;
    let changed = 0;
    try {
      const r = this._db.exec('SELECT changes()');
      if (r.length) changed = r[0].values[0][0];
    } catch(e) {}
    let detail = '';
    if (type === 'CREATE') {
      const m = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
      detail = m ? `Table "${m[1]}" created successfully` : 'Object created';
    } else if (type === 'DROP') {
      const m = trimmed.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`]?(\w+)["`]?/i);
      detail = m ? `Table "${m[1]}" dropped` : 'Object dropped';
    } else if (type === 'INSERT') {
      detail = `${changed} row${changed !== 1 ? 's' : ''} inserted`;
    } else if (type === 'UPDATE') {
      detail = `${changed} row${changed !== 1 ? 's' : ''} updated`;
    } else if (type === 'DELETE') {
      detail = `${changed} row${changed !== 1 ? 's' : ''} deleted`;
    } else if (type === 'ALTER') {
      detail = 'Table altered successfully';
    } else {
      detail = `${type} executed successfully`;
    }
    this.persistDB();
    return { type, changed, detail, duration: Math.round(duration*100)/100 };
  },

  executeQuery(sql, params = []) {
    if (!this._db) throw new Error('No database loaded');
    const start = performance.now();
    const res   = this._db.exec(sql, params);
    const duration = performance.now() - start;
    if (!res.length) {
      return { columns: [], rows: [], duration };
    }
    const result = res[0];
    const rows = result.values.slice(0, this._MAX_ROWS);
    return {
      columns:  result.columns,
      rows,
      total:    result.values.length,
      limited:  result.values.length > this._MAX_ROWS,
      duration: Math.round(duration * 100) / 100
    };
  },

  sanitizeIdentifier(name) {
    return String(name).replace(/[^a-zA-Z0-9_]/g, '');
  },

  parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      rows.push(this.parseCSVLine(line));
    }
    return rows;
  },

  parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  getCurrentDB()    { return this._db; },
  getCurrentWsId()  { return this._workspaceId; }
};
 