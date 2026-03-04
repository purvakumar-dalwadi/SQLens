/**
 * SQLens — app.js
 * Master application controller.
 */

const App = {
  _state: { session:null, currentWorkspace:null, activeTable:null, pendingCSV:null },

  _esc(str) {
    if (str===null||str===undefined) return '';
    const d=document.createElement('div'); d.textContent=String(str); return d.innerHTML;
  },
  _formatDate(iso) { return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); },
  _formatAgo(iso) {
    const s=Math.floor((Date.now()-new Date(iso))/1000);
    if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago';
    if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago';
  },
  _toast(msg,type='default',ms=3000) {
    const el=document.getElementById('toast');
    el.textContent=msg; el.className=`toast ${type}`; el.classList.remove('hidden');
    clearTimeout(el._t); el._t=setTimeout(()=>el.classList.add('hidden'),ms);
  },
  _show(name) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-'+name).classList.add('active');
  },
  _openModal(id)  { document.getElementById(id).classList.remove('hidden'); },
  _closeModal(id) { document.getElementById(id).classList.add('hidden'); },
  _switchTab(panelId) {
    document.querySelectorAll('.main-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.main-panel-content').forEach(p=>p.classList.remove('active'));
    const t=document.querySelector(`[data-panel="${panelId}"]`); if(t) t.classList.add('active');
    const p=document.getElementById(panelId); if(p) p.classList.add('active');
  },
  _showErr(el,msg){ el.textContent=msg; el.classList.remove('hidden'); },

  /* ===== AUTH ===== */
  bindAuth() {
    document.querySelectorAll('.auth-tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.auth-form-wrap').forEach(f=>f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
      });
    });
    document.getElementById('form-login').addEventListener('submit', async e=>{
      e.preventDefault();
      const errEl=document.getElementById('login-error'); errEl.classList.add('hidden');
      try {
        const user=await Auth.login(
          document.getElementById('login-username').value,
          document.getElementById('login-password').value
        );
        Auth.setSession(user); this._state.session=Auth.getSession();
        this._show('dashboard'); this.loadDashboard();
      } catch(err){ showErr(errEl,err.message); }
    });
    document.getElementById('form-register').addEventListener('submit', async e=>{
      e.preventDefault();
      const errEl=document.getElementById('reg-error'); errEl.classList.add('hidden');
      try {
        const p=document.getElementById('reg-password').value;
        if(p!==document.getElementById('reg-confirm').value) throw new Error('Passwords do not match');
        const user=await Auth.register(document.getElementById('reg-username').value,p);
        Auth.setSession(user); this._state.session=Auth.getSession();
        this._show('dashboard'); this.loadDashboard();
      } catch(err){ showErr(errEl,err.message); }
    });
  },
  logout(){
    Auth.clearSession();
    Object.assign(this._state,{session:null,currentWorkspace:null,activeTable:null});
    this._show('auth');
  },

  /* ===== DASHBOARD ===== */
  async loadDashboard(){
    document.getElementById('dash-username').textContent='@'+this._state.session.username;
    const list=await Workspace.list(this._state.session.userId);
    const grid=document.getElementById('workspace-grid');
    if(!list.length){
      grid.innerHTML=`<div class="empty-state"><div class="empty-state-icon">⬡</div><p>No workspaces yet. Create your first one.</p></div>`;
      return;
    }
    grid.innerHTML=list.map(ws=>`
      <div class="workspace-card" data-wsid="${ws.id}">
        <button class="ws-card-delete" data-wsdel="${ws.id}">✕</button>
        <div class="ws-card-icon">⊞</div>
        <div class="ws-card-name">${this._esc(ws.name)}</div>
        <div class="ws-card-desc">${this._esc(ws.description||'No description')}</div>
        <div class="ws-card-meta">
          <span class="ws-card-tables">${ws.tableCount||0} table${ws.tableCount!==1?'s':''}</span>
          <span class="ws-card-date">${this._formatDate(ws.created)}</span>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.workspace-card').forEach(card=>{
      card.addEventListener('click',e=>{
        if(e.target.closest('[data-wsdel]')) return; this.openWorkspace(card.dataset.wsid);
      });
    });
    grid.querySelectorAll('[data-wsdel]').forEach(btn=>{
      btn.addEventListener('click',async e=>{
        e.stopPropagation();
        if(!confirm('Delete workspace? Cannot be undone.')) return;
        await Workspace.remove(btn.dataset.wsdel); this._toast('Workspace deleted'); this.loadDashboard();
      });
    });
  },
  bindDashboard(){
    document.getElementById('btn-logout').addEventListener('click',()=>this.logout());
    document.getElementById('btn-ws-logout').addEventListener('click',()=>this.logout());
    document.getElementById('btn-new-workspace').addEventListener('click',()=>{
      document.getElementById('ws-name').value='';
      document.getElementById('ws-desc').value='';
      this._openModal('modal-new-workspace');
      document.getElementById('ws-name').focus();
    });
    document.getElementById('btn-create-workspace').addEventListener('click',async()=>{
      const name=document.getElementById('ws-name').value.trim();
      const desc=document.getElementById('ws-desc').value.trim();
      if(!name){ this._toast('Name is required','error'); return; }
      try {
        await Workspace.create(this._state.session.userId,name,desc);
        this._closeModal('modal-new-workspace'); this._toast('Workspace created!','success'); this.loadDashboard();
      } catch(err){ this._toast(err.message,'error'); }
    });
    document.getElementById('ws-name').addEventListener('keydown',e=>{
      if(e.key==='Enter') document.getElementById('btn-create-workspace').click();
    });
  },

  /* ===== OPEN WORKSPACE ===== */
  async openWorkspace(wsId){
    try {
      const ws=await Workspace.get(wsId);
      if(!ws){ this._toast('Workspace not found','error'); return; }
      this._state.currentWorkspace=ws; this._state.activeTable=null;
      await DBEngine.loadWorkspace(wsId);
      document.getElementById('ws-breadcrumb-name').textContent=ws.name;
      document.getElementById('ws-username').textContent='@'+this._state.session.username;
      this._show('workspace');
      document.getElementById('editor-placeholder').classList.remove('hidden');
      document.getElementById('editor-content').classList.add('hidden');
      this.refreshTableList(); this.loadQueryHistory();
      document.getElementById('viz-content').innerHTML=
        '<div class="result-placeholder">Enter a SELECT query in the SQL tab, then click "▶ Visualize Query"</div>';
      document.getElementById('viz-steps-timeline').classList.add('hidden');
    } catch(err){ this._toast('Failed: '+err.message,'error'); console.error(err); }
  },

  /* ===== TABLE SIDEBAR ===== */
  refreshTableList(){
    const tables=DBEngine.listTables();
    const list=document.getElementById('table-list');
    if(!tables.length){
      list.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:12px;">No tables — click + to create</div>';
      return;
    }
    list.innerHTML=tables.map(n=>`
      <div class="table-item ${n===this._state.activeTable?'active':''}" data-tbl="${this._esc(n)}">
        <span class="table-item-icon">▤</span>
        <span class="table-item-name">${this._esc(n)}</span>
      </div>`).join('');
    list.querySelectorAll('.table-item').forEach(item=>{
      item.addEventListener('click',()=>{
        this._state.activeTable=item.dataset.tbl;
        this.refreshTableList(); this.loadTableEditor(this._state.activeTable); this._switchTab('panel-editor');
      });
    });
  },

  /* ===== DATA GRID ===== */
  loadTableEditor(name){
    document.getElementById('editor-placeholder').classList.add('hidden');
    document.getElementById('editor-content').classList.remove('hidden');
    document.getElementById('editor-table-name').textContent=name;
    this.renderDataGrid(name);
  },
  renderDataGrid(name){
    let schema,data;
    try { schema=DBEngine.getTableSchema(name); data=DBEngine.getTableData(name); }
    catch(err){ toast('Error: '+err.message,'error'); return; }

    document.getElementById('data-grid-head').innerHTML=`<tr>
      ${schema.map(c=>`<th title="${this._esc(c.type)}${c.pk?' PK':''}">
        ${this._esc(c.name)}${c.pk?'<span style="color:var(--accent);font-size:9px;margin-left:3px">PK</span>':''}
      </th>`).join('')}<th class="col-actions">Actions</th></tr>`;

    const tbody=document.getElementById('data-grid-body');
    if(!data.rows.length){
      tbody.innerHTML=`<tr><td colspan="${schema.length+1}" style="text-align:center;padding:32px;color:var(--text-muted)">No rows yet — click "+ Row" to insert data</td></tr>`;
      return;
    }
    tbody.innerHTML=data.rows.map((row,ri)=>`
      <tr data-ri="${ri}">
        ${row.map((cell,ci)=>`<td data-col="${this._esc(schema[ci]?.name)}" data-val="${cell===null?'':this._esc(String(cell))}">
          ${cell===null?'<span class="null-val">NULL</span>':this._esc(String(cell))}</td>`).join('')}
        <td class="col-actions"><div class="row-actions">
          <button class="row-btn edit-btn" data-ri="${ri}">Edit</button>
          <button class="row-btn danger del-btn" data-ri="${ri}">Del</button>
        </div></td>
      </tr>`).join('');
    tbody.querySelectorAll('.del-btn').forEach(btn=>btn.addEventListener('click',()=>this.delRow(name,schema,data,+btn.dataset.ri)));
    tbody.querySelectorAll('.edit-btn').forEach(btn=>btn.addEventListener('click',()=>this.editRow(name,schema,data,+btn.dataset.ri)));
  },

  async delRow(name,schema,data,ri){
    if(!confirm('Delete this row?')) return;
    try {
      const row=data.rows[ri]; const pks=schema.filter(c=>c.pk);
      let wc,wv;
      if(pks.length){
        wc=pks.map(c=>`"${c.name}" = ?`).join(' AND ');
        wv=pks.map(c=>row[schema.findIndex(s=>s.name===c.name)]);
      } else {
        const r=DBEngine.executeQuery(`SELECT rowid,* FROM "${name}" LIMIT 1000`);
        if(!r.rows[ri]){ toast('Cannot identify row','error'); return; }
        wc='rowid = ?'; wv=[r.rows[ri][0]];
      }
      await DBEngine.deleteRow(name,wc,wv); this.renderDataGrid(name); this._toast('Row deleted');
    } catch(err){ toast(err.message,'error'); }
  },

  editRow(name,schema,data,ri){
    const tbody=document.getElementById('data-grid-body');
    const tr=tbody.querySelector(`[data-ri="${ri}"]`);
    const row=data.rows[ri]; if(!tr) return;
    const cells=tr.querySelectorAll('td:not(.col-actions)');
    cells.forEach((td,ci)=>{ const v=row[ci]; td.innerHTML=`<input class="cell-edit-input" value="${v===null?'':this._esc(String(v))}" />`; });
    tr.querySelector('.col-actions').innerHTML=`<div class="row-actions">
      <button class="row-btn save-inline">Save</button>
      <button class="row-btn cancel-inline">✕</button></div>`;
    tr.querySelector('.save-inline').addEventListener('click',async()=>{
      const inputs=tr.querySelectorAll('.cell-edit-input');
      const nd={};
      schema.forEach((col,i)=>{ nd[col.name]=inputs[i]?.value??null; });
      try {
        const pks=schema.filter(c=>c.pk); let wc,wv;
        if(pks.length){
          wc=pks.map(c=>`"${c.name}" = ?`).join(' AND ');
          wv=pks.map(c=>row[schema.findIndex(s=>s.name===c.name)]);
        } else { wc=schema.map(c=>`"${c.name}" = ?`).join(' AND '); wv=[...row]; }
        await DBEngine.updateRow(name,nd,wc,wv); this.renderDataGrid(name); this._toast('Row updated','success');
      } catch(err){ toast(err.message,'error'); }
    });
    tr.querySelector('.cancel-inline').addEventListener('click',()=>this.renderDataGrid(name));
  },

  /* ===== CREATE TABLE ===== */
  addColRow(n='',t='TEXT',pk=false){
    const r=document.createElement('div'); r.className='schema-col-row';
    r.innerHTML=`
      <input type="text" placeholder="column_name" value="${this._esc(n)}" class="col-n" />
      <select class="col-t">${['INTEGER','TEXT','REAL','BLOB','NUMERIC'].map(x=>`<option ${t===x?'selected':''}>${x}</option>`).join('')}</select>
      <label class="col-pk-check"><input type="checkbox" class="col-pk" ${pk?'checked':''}> PK / AI</label>
      <button class="schema-col-del">✕</button>`;
    r.querySelector('.schema-col-del').addEventListener('click',()=>r.remove());
    document.getElementById('schema-columns').appendChild(r);
  },
  bindCreateTable(){
    document.getElementById('btn-new-table').addEventListener('click',()=>{
      document.getElementById('tbl-name').value='';
      document.getElementById('schema-columns').innerHTML='';
      this.addColRow('id','INTEGER',true); this.addColRow('name','TEXT');
      this._openModal('modal-create-table'); document.getElementById('tbl-name').focus();
    });
    document.getElementById('btn-add-column').addEventListener('click',()=>this.addColRow());
    document.getElementById('btn-save-table').addEventListener('click',async()=>{
      const name=document.getElementById('tbl-name').value.trim();
      if(!name){ toast('Table name required','error'); return; }
      const rows=document.querySelectorAll('#schema-columns .schema-col-row');
      if(!rows.length){ toast('Add at least one column','error'); return; }
      const cols=Array.from(rows).map(r=>({
        name:r.querySelector('.col-n').value.trim(),
        type:r.querySelector('.col-t').value,
        pk:r.querySelector('.col-pk').checked,
        notnull:false,
        autoincrement:r.querySelector('.col-pk').checked&&r.querySelector('.col-t').value==='INTEGER'
      }));
      if(cols.some(c=>!c.name)){ toast('All columns need a name','error'); return; }
      try {
        await DBEngine.createTable(name,cols);
        this._closeModal('modal-create-table');
        this._state.activeTable=name; this.refreshTableList(); this.loadTableEditor(name); this._switchTab('panel-editor');
        this._toast(`Table "${name}" created`,'success');
      } catch(err){ toast(err.message,'error'); }
    });
  },

  /* ===== EDITOR ACTIONS (Add Row / CSV / Delete Table) ===== */
  bindEditorActions(){
    document.getElementById('btn-add-row').addEventListener('click',()=>{
      if(!state.activeTable) return;
      const schema=DBEngine.getTableSchema(this._state.activeTable);
      const div=document.getElementById('add-row-fields'); div.innerHTML='';
      schema.forEach(col=>{
        const isAI=col.pk&&col.type==='INTEGER';
        const fg=document.createElement('div'); fg.className='field-group';
        fg.innerHTML=`<label>${this._esc(col.name)} <span style="color:var(--text-muted)">(${col.type}${col.pk?' PK':''})</span></label>
          <input type="text" id="arf-${this._esc(col.name)}" placeholder="${isAI?'auto (leave blank)':'value or leave blank for NULL'}" ${isAI?'disabled':''} />`;
        div.appendChild(fg);
      });
      this._openModal('modal-add-row');
    });
    document.getElementById('btn-save-row').addEventListener('click',async()=>{
      if(!this._state.activeTable) return;
      const schema=DBEngine.getTableSchema(this._state.activeTable);
      const rd={};
      schema.forEach(col=>{
        if(col.pk&&col.type==='INTEGER') return;
        const el=document.getElementById('arf-'+col.name);
        if(el) rd[col.name]=el.value.trim()===''?null:el.value.trim();
      });
      try {
        await DBEngine.insertRow(this._state.activeTable,rd);
        this._closeModal('modal-add-row'); this.renderDataGrid(this._state.activeTable); this._toast('Row inserted','success');
      } catch(err){ this._toast(err.message,'error'); }
    });
    document.getElementById('btn-import-csv').addEventListener('click',()=>{
      if(!this._state.activeTable) return;
      this._state.pendingCSV=null;
      document.getElementById('csv-filename').textContent='';
      document.getElementById('csv-preview').classList.add('hidden');
      document.getElementById('csv-error').classList.add('hidden');
      document.getElementById('csv-file-input').value='';
      this._openModal('modal-import-csv');
    });
    document.getElementById('btn-delete-table').addEventListener('click',async()=>{
      if(!this._state.activeTable) return;
      if(!confirm(`Delete table "${this._state.activeTable}"? All data will be permanently lost.`)) return;
      try {
        await DBEngine.dropTable(this._state.activeTable);
        this._state.activeTable=null;
        document.getElementById('editor-placeholder').classList.remove('hidden');
        document.getElementById('editor-content').classList.add('hidden');
        this.refreshTableList(); this._toast('Table deleted');
      } catch(err){ this._toast(err.message,'error'); }
    });
  },

  /* ===== CSV IMPORT ===== */
  bindCSV(){
    const dz=document.getElementById('csv-drop-zone');
    const fi=document.getElementById('csv-file-input');
    document.getElementById('btn-browse-csv').addEventListener('click',()=>fi.click());
    fi.addEventListener('change',e=>{ if(e.target.files[0]) this.readCSV(e.target.files[0]); });
    dz.addEventListener('dragover',e=>{ e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
    dz.addEventListener('drop',e=>{
      e.preventDefault(); dz.classList.remove('drag-over');
      const f=e.dataTransfer.files[0];
      if(f&&f.name.endsWith('.csv')) this.readCSV(f); else this._toast('Drop a .csv file','error');
    });
    document.getElementById('btn-do-import').addEventListener('click',async()=>{
      if(!this._state.pendingCSV){ this._toast('Select a CSV file first','error'); return; }
      try {
        const n=await DBEngine.importCSV(this._state.activeTable,this._state.pendingCSV);
        this._closeModal('modal-import-csv'); this.renderDataGrid(this._state.activeTable);
        this._state.pendingCSV=null; this._toast(`Imported ${n} rows`,'success');
      } catch(err){
        const e=document.getElementById('csv-error');
        e.textContent=err.message; e.classList.remove('hidden');
      }
    });
  },
  readCSV(file){
    const r=new FileReader();
    r.onload=e=>{
      this._state.pendingCSV=e.target.result;
      document.getElementById('csv-filename').textContent=file.name;
      const p=document.getElementById('csv-preview');
      p.textContent=this._state.pendingCSV.split('\n').slice(0,6).join('\n');
      p.classList.remove('hidden');
    };
    r.readAsText(file);
  },

  /* ===== SQL QUERY (DDL + DML + SELECT) ===== */

  // Split SQL respecting quoted strings and parentheses
  splitStatements(sql) {
    const stmts = [];
    let cur = '', inStr = false, strChar = '';
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (inStr) {
        cur += ch;
        if (ch === strChar && sql[i-1] !== '\\') inStr = false;
      } else if (ch === "'" || ch === '"') {
        inStr = true; strChar = ch; cur += ch;
      } else if (ch === '-' && sql[i+1] === '-') {
        while (i < sql.length && sql[i] !== '\n') i++;
        cur += '\n';
      } else if (ch === '/' && sql[i+1] === '*') {
        i += 2;
        while (i < sql.length && !(sql[i]==='*' && sql[i+1]==='/')) i++;
        i++;
      } else if (ch === ';') {
        const t = cur.trim();
        if (t) stmts.push(t);
        cur = '';
      } else {
        cur += ch;
      }
    }
    const last = cur.trim();
    if (last) stmts.push(last);
    return stmts.filter(s => s.length > 0);
  },

  async runQuery() {
    const sql    = document.getElementById('sql-editor').value.trim();
    const errEl  = document.getElementById('query-error');
    const metaEl = document.getElementById('query-result-meta');
    const resEl  = document.getElementById('query-result-table');

    errEl.classList.add('hidden');
    metaEl.textContent = '';
    resEl.innerHTML = '<div class="result-placeholder"><div class="spinner"></div></div>';

    if (!sql) { this._showErr(errEl, 'Query is empty'); resEl.innerHTML = ''; return; }

    const statements = this.splitStatements(sql);
    if (!statements.length) { this._showErr(errEl, 'No valid statements found'); return; }

    let lastSelectResult = null;
    let totalDuration    = 0;
    const log            = [];  // execution log for multi-statement display
    let hasError         = false;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        const result = DBEngine.execute(stmt);
        totalDuration += result.duration || 0;

        if (result.type === 'SELECT') {
          lastSelectResult = result;
          log.push({ ok: true, type: 'SELECT', msg: `${result.rows.length} row${result.rows.length!==1?'s':''} returned`, duration: result.duration });
        } else {
          log.push({ ok: true, type: result.type, msg: result.detail, duration: result.duration });
          // DDL/DML — refresh sidebar
          refreshTableList();
          // If active table was dropped, reset editor
          if (result.type === 'DROP' && state.activeTable) {
            const tables = DBEngine.listTables();
            if (!tables.includes(state.activeTable)) {
              state.activeTable = null;
              document.getElementById('editor-placeholder').classList.remove('hidden');
              document.getElementById('editor-content').classList.add('hidden');
            }
          }
          // If active table was modified, reload it
          if ((result.type === 'INSERT' || result.type === 'UPDATE' || result.type === 'DELETE' || result.type === 'ALTER') && state.activeTable) {
            renderDataGrid(state.activeTable);
          }
        }
      } catch(err) {
        hasError = true;
        log.push({ ok: false, type: QueryParser.getQueryType(stmt), msg: err.message, stmt });
      }
    }

    // ── Render result area ──────────────────────────────
    const ms = Math.round(totalDuration * 10) / 10;

    if (statements.length === 1 && lastSelectResult) {
      // Single SELECT — show results table directly
      Visualizer.renderResultTable(lastSelectResult, resEl);
      metaEl.textContent = `${lastSelectResult.rows.length} row${lastSelectResult.rows.length!==1?'s':''} · ${ms}ms`;
      if (lastSelectResult.limited) metaEl.textContent += ' · limited to 1000';
    } else {
      // Multi-statement or DDL/DML — show execution log
      resEl.innerHTML = this.renderExecLog(log, lastSelectResult);
      const okCount  = log.filter(l => l.ok).length;
      const errCount = log.filter(l => !l.ok).length;
      metaEl.textContent = `${statements.length} statement${statements.length!==1?'s':''} · ${okCount} ok${errCount?' · '+errCount+' failed':''} · ${ms}ms`;
    }

    if (hasError) {
      const firstErr = log.find(l => !l.ok);
      if (firstErr) this._showErr(errEl, firstErr.msg);
    }

    // Save to history (use the last SELECT, or the first statement)
    if (this._state.currentWorkspace) {
      const histQuery  = sql;
      const histRows   = lastSelectResult ? lastSelectResult.rows.length : log.filter(l=>l.ok).length;
      await Workspace.saveHistory(this._state.currentWorkspace.id, {
        query:  histQuery,
        rowCount: histRows,
        duration: ms
      });
      this.loadQueryHistory();
    }
  },

  renderExecLog(log, lastSelect) {
    const rows = log.map(entry => {
      const icon  = entry.ok ? '✓' : '✗';
      const color = entry.ok ? 'var(--success)' : 'var(--danger)';
      const bg    = entry.ok ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.05)';
      return `
        <tr style="background:${bg}">
          <td style="padding:8px 14px;font-family:var(--font-code);font-size:11px;color:${color};width:20px">${icon}</td>
          <td style="padding:8px 14px;font-family:var(--font-code);font-size:11px;color:var(--accent);width:80px">${entry.type}</td>
          <td style="padding:8px 14px;font-size:12px;color:var(--text-primary)">${this._esc(entry.msg)}</td>
          <td style="padding:8px 14px;font-family:var(--font-code);font-size:11px;color:var(--text-muted);text-align:right">${entry.duration != null ? entry.duration+'ms' : ''}</td>
        </tr>`;
    }).join('');

    let selectPreview = '';
    if (lastSelect && lastSelect.rows.length > 0) {
      selectPreview = `
        <div style="border-top:1px solid var(--border);padding:10px 14px;font-size:11px;font-family:var(--font-ui);color:var(--text-muted);font-weight:600;letter-spacing:.05em;text-transform:uppercase;">
          Last SELECT Result
        </div>`;
      const headerCells = lastSelect.columns.map(c=>`<th style="padding:8px 14px;text-align:left;font-size:11px;font-family:var(--font-code);color:var(--text-secondary);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.04em;background:var(--bg2)">${this._esc(c)}</th>`).join('');
      const bodyRows = lastSelect.rows.map(row=>
        `<tr>${row.map(cell=>
          `<td style="padding:7px 14px;font-family:var(--font-code);font-size:12px;color:var(--text-code);border-bottom:1px solid rgba(42,51,72,.4)">${cell===null?'<span style="color:var(--text-muted);font-style:italic">NULL</span>':this._esc(String(cell))}</td>`
        ).join('')}</tr>`
      ).join('');
      selectPreview += `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
    }

    return `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--bg2)">
            <th style="padding:8px 14px;text-align:left;font-size:10px;color:var(--text-muted);font-family:var(--font-ui);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)"></th>
            <th style="padding:8px 14px;text-align:left;font-size:10px;color:var(--text-muted);font-family:var(--font-ui);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Type</th>
            <th style="padding:8px 14px;text-align:left;font-size:10px;color:var(--text-muted);font-family:var(--font-ui);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Result</th>
            <th style="padding:8px 14px;text-align:right;font-size:10px;color:var(--text-muted);font-family:var(--font-ui);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${selectPreview}
    `;
  },

  bindQuery(){
    document.getElementById('btn-run-query').addEventListener('click',()=>this.runQuery());
    document.getElementById('sql-editor').addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); this.runQuery(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        const el=e.target, pos=el.selectionStart;
        el.value=el.value.slice(0,pos)+'  '+el.value.slice(el.selectionEnd);
        el.selectionStart=el.selectionEnd=pos+2;
      }
    });
  },

  /* ===== VISUALIZER ===== */
  async runVisualize(){
    const sql = document.getElementById('sql-editor').value.trim();
    if (!sql) { toast('Enter a query in the SQL tab first','error'); return; }

    // Visualizer only supports SELECT
    const stmts = this.splitStatements(sql);
    const selectStmt = stmts.find(s => QueryParser.isSelect(s));

    if (!selectStmt) {
      const vizEl = document.getElementById('viz-content');
      vizEl.innerHTML = `<div class="result-placeholder" style="flex-direction:column;gap:10px">
        <div style="font-size:28px;opacity:.4">⊘</div>
        <div>Visualization is only available for <strong style="color:var(--accent)">SELECT</strong> queries.</div>
        <div style="color:var(--text-muted);font-size:12px">DDL and DML statements ran successfully in the SQL tab.</div>
      </div>`;
      document.getElementById('viz-steps-timeline').classList.add('hidden');
      return;
    }

    let parsed;
    try { parsed = QueryParser.parse(selectStmt); }
    catch(err) { toast('Parse error: '+err.message,'error'); return; }

    const vizEl = document.getElementById('viz-content');
    vizEl.innerHTML = '<div class="result-placeholder"><div class="spinner"></div> Building execution steps…</div>';

    try {
      const steps = StepBuilder.executeSteps(parsed);
      if (!steps.length) { vizEl.innerHTML='<div class="result-placeholder">No steps could be generated for this query</div>'; return; }
      AnimationEngine.reset();
      Visualizer.loadSteps(steps);
    } catch(err) {
      vizEl.innerHTML=`<div class="result-placeholder" style="color:var(--danger)">Error: ${this._esc(err.message)}</div>`;
      console.error(err);
    }
  },
  bindVisualizer(){
    document.getElementById('btn-visualize').addEventListener('click',()=>this.runVisualize());
  },

  /* ===== TABS ===== */
  bindTabs(){
    document.querySelectorAll('.main-tab').forEach(tab=>{
      tab.addEventListener('click',()=>this._switchTab(tab.dataset.panel));
    });
  },

  /* ===== QUERY HISTORY ===== */
  async loadQueryHistory(){
    if(!this._state.currentWorkspace) return;
    const history=await Workspace.getHistory(this._state.currentWorkspace.id);
    const list=document.getElementById('query-history-list');
    if(!history.length){
      list.innerHTML='<div style="padding:14px 12px;color:var(--text-muted);font-size:12px;">No queries yet</div>'; return;
    }
    list.innerHTML=history.map(h=>`
      <div class="history-item" data-q="${this._esc(h.query)}">
        <div class="history-item-query">${this._esc(h.query)}</div>
        <div class="history-item-meta">
          <span class="history-rows">${h.rowCount} rows</span>
          <span>${this._formatAgo(h.executedAt)}</span>
        </div>
      </div>`).join('');
    list.querySelectorAll('.history-item').forEach(item=>{
      item.addEventListener('click',()=>{
        document.getElementById('sql-editor').value=item.dataset.q;
        this._switchTab('panel-query');
      });
    });
  },
  bindHistory(){
    document.getElementById('btn-clear-history').addEventListener('click',async()=>{
      if(!this._state.currentWorkspace) return;
      await Workspace.clearHistory(this._state.currentWorkspace.id);
      document.getElementById('query-history-list').innerHTML=
        '<div style="padding:14px 12px;color:var(--text-muted);font-size:12px;">No queries yet</div>';
    });
  },

  /* ===== NAV / MODALS ===== */
  bindNav(){
    document.getElementById('btn-back-dash').addEventListener('click',async()=>{
      this._state.currentWorkspace=null; this._state.activeTable=null;
      this._show('dashboard'); this.loadDashboard();
    });
  },
  bindModals(){
    document.querySelectorAll('.modal-overlay').forEach(overlay=>{
      overlay.addEventListener('click',e=>{ if(e.target===overlay) this._closeModal(overlay.id); });
    });
    document.querySelectorAll('.modal-close, button[data-modal]').forEach(btn=>{
      btn.addEventListener('click',()=>{ if(btn.dataset.modal) this._closeModal(btn.dataset.modal); });
    });
  },

  /* ===== INIT ===== */
  async init(){
    await Auth.openDB();
    await Workspace.openDB();
    this.bindModals(); this.bindAuth(); this.bindDashboard(); this.bindNav();
    this.bindTabs(); this.bindCreateTable(); this.bindEditorActions(); this.bindCSV();
    this.bindQuery(); this.bindVisualizer(); this.bindHistory();
    Visualizer.init(
      document.getElementById('viz-steps-timeline'),
      document.getElementById('viz-content')
    );
    const session=Auth.getSession();
    if(session){ this._state.session=session; this._show('dashboard'); this.loadDashboard(); }
    else this._show('auth');
  },

};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>App.init());
else App.init();