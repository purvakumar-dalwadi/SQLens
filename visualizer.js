/**
 * SQLens — visualizer.js
 * Renders the step timeline, step result tables, and metadata.
 */

const Visualizer = {
  _steps: [],
  _activeStep: 0,
  _timelineEl: null,
  _contentEl: null,

  init(timelineEl, contentEl) {
    this._timelineEl = timelineEl;
    this._contentEl  = contentEl;
  },

  loadSteps(steps) {
    this._steps = steps || [];
    this._activeStep = 0;
    AnimationEngine.reset();
    this._renderTimeline();
    if (this._steps.length > 0) {
      this.showStep(0);
    }
  },

  _renderTimeline() {
    if (!this._timelineEl) return;
    this._timelineEl.innerHTML = '';
    this._steps.forEach((step, i) => {
      if (i > 0) {
        const conn = document.createElement('span');
        conn.className = 'step-connector';
        conn.textContent = '›';
        this._timelineEl.appendChild(conn);
      }
      const btn = document.createElement('button');
      btn.className = 'step-btn';
      btn.dataset.step = step.type || step.name;
      btn.dataset.idx = i;
      btn.innerHTML = `
        <span style="width:8px;height:8px;border-radius:50%;background:${step.color};display:inline-block;"></span>
        ${step.name}
      `;
      btn.addEventListener('click', () => this.showStep(i));
      this._timelineEl.appendChild(btn);
    });
    this._timelineEl.classList.remove('hidden');
    this._updateActiveButton();
  },

  async showStep(index) {
    if (index < 0 || index >= this._steps.length) return;
    const prevIndex = this._activeStep;
    this._activeStep = index;
    this._updateActiveButton();
    const step = this._steps[index];
    this._renderStepContent(step, index, prevIndex);
  },

  _updateActiveButton() {
    if (!this._timelineEl) return;
    this._timelineEl.querySelectorAll('.step-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === this._activeStep);
    });
  },

  _renderStepContent(step, index, prevIndex) {
    const hasError = !!step.error;
    const rows = step.rows || [];
    const cols = step.columns || [];
    const rowCount = rows.length;
    this._contentEl.innerHTML = `
      <div class="step-display">
        <div class="step-display-header">
          <div class="step-title">
            <span class="step-badge"
            style="background:${step.color}22;color:${step.color};border:1px solid ${step.color}44">
              ${step.name}
            </span>
            <span class="step-description">${step.desc}</span>
          </div>
          <div class="step-stats">
            <span>Rows: ${rowCount}</span>
            <span>Time: ${step.duration || 0}ms</span>
            <span>Cols: ${cols.length}</span>
          </div>
        </div>
        ${hasError ? `
          <div style="padding:16px;color:var(--danger)">
            ⚠ ${this._escapeHtml(step.error)}
          </div>
        ` : `
          <div class="step-table-wrap">
            ${this._renderStepTable(step)}
          </div>
        `}
        <div style="
          padding:10px 16px;
          border-top:1px solid var(--border);
          background:var(--bg-1);
          font-family:var(--font-code);
          font-size:11px;
          color:var(--text-muted);
          word-break:break-all;
        ">
          <span style="opacity:0.7">Staged query:</span>
          <code>${this._escapeHtml(step.sql)}</code>
        </div>
      </div>
    `;
  },

  _renderStepTable(step) {
    const rows = step.rows || [];
    const cols = step.columns || [];
    if (!cols.length) {
      return '<div class="result-placeholder">No results</div>';
    }
    const headerCells = cols
      .map(col => `<th>${this._escapeHtml(col)}</th>`)
      .join('');
    const bodyRows = rows
      .map(row => `
        <tr>
          ${row.map(cell =>
            cell === null
              ? '<td><span class="null-val">NULL</span></td>'
              : `<td>${this._escapeHtml(String(cell))}</td>`
          ).join('')}
        </tr>
      `).join('');
    return `
      <table class="step-table">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
      ${rows.length === 0
        ? '<div class="result-placeholder" style="padding:20px">No rows at this stage</div>'
        : ''}
    `;
  },

  renderResultTable(result, container) {
    if (!result || (!result.columns.length && !result.error)) {
      container.innerHTML =
        '<div class="result-placeholder">Query returned no results</div>';
      return;
    }
    if (result.error) {
      container.innerHTML = `
        <div class="result-placeholder" style="color:var(--danger)">
          Error: ${this._escapeHtml(result.error)}
        </div>
      `;
      return;
    }
    const headerCells = result.columns
      .map(col => `<th>${this._escapeHtml(col)}</th>`)
      .join('');
    const bodyRows = result.rows
      .map(row => `
        <tr>
          ${row.map(cell =>
            cell === null
              ? '<td><span class="null-val">NULL</span></td>'
              : `<td>${this._escapeHtml(String(cell))}</td>`
          ).join('')}
        </tr>
      `).join('');
    container.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    `;
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};