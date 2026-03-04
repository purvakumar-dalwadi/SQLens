/**
 * SQLens — animationEngine.js
 * Manages animated transitions between step result tables.
 * Tracks row identity across steps and applies:
 *   - Fade-in for new rows
 *   - Fade-out for removed rows
 *   - Highlight for changed/grouped rows
 *   - Reorder transitions for ORDER BY
 *   - Column reduction on SELECT
 */

const AnimationEngine = {
  _prevRowSigs: [],
  _prevCols: [],

  reset() {
    this._prevRowSigs = [];
    this._prevCols = [];
  },

  async animateTransition(tbody, newCols, newRows, stepName) {
    const newSigs = newRows.map(row => row.join('||'));
    const isGroupStep   = stepName === 'GROUP BY' || stepName === 'HAVING';
    const isSelectStep  = stepName === 'SELECT';
    const isOrderStep   = stepName === 'ORDER BY';
    const isLimitStep   = stepName === 'LIMIT';
    if (this._prevRowSigs.length === 0) {
      this.renderWithEnterAnim(tbody, newCols, newRows);
      this._prevRowSigs = newSigs;
      this._prevCols    = newCols;
      return;
    }
    const prevSet = new Set(this._prevRowSigs);
    const newSet  = new Set(newSigs);
    if (isOrderStep) {
      await this._animateReorder(tbody, newCols, newRows);
    } else if (isGroupStep) {
      await this._animateGroupMerge(tbody, newCols, newRows);
    } else if (isSelectStep && newCols.length < this._prevCols.length) {
      await this._animateColumnReduction(tbody, newCols, newRows, this._prevCols);
    } else {
      await this._animateAddRemove(tbody, newCols, newRows, prevSet, newSet, newSigs);
    }
    this._prevRowSigs = newSigs;
    this._prevCols    = newCols;
  },

  renderWithEnterAnim(tbody, cols, rows) {
    tbody.innerHTML = '';
    rows.forEach((row, i) => {
      const tr = this._createRow(row, cols);
      tr.style.animationDelay = `${i * 20}ms`;
      tr.classList.add('row-enter');
      tbody.appendChild(tr);
    });
  },

  async _animateAddRemove(tbody, newCols, newRows, prevSet, newSet, newSigs) {
    const existingRows = Array.from(tbody.querySelectorAll('tr'));
    const removePromises = [];
    existingRows.forEach((tr, i) => {
      const sig = this._prevRowSigs[i];
      if (sig && !newSet.has(sig)) {
        tr.classList.add('row-exit');
        removePromises.push(
          new Promise(res => setTimeout(() => { tr.remove(); res(); }, 280))
        );
      }
    });
    await Promise.all(removePromises);
    tbody.innerHTML = '';
    newRows.forEach((row, i) => {
      const tr = this._createRow(row, newCols);
      const sig = newSigs[i];
      if (!prevSet.has(sig)) {
        tr.classList.add('row-enter');
        tr.style.animationDelay = `${i * 15}ms`;
      } else {
        tr.classList.add('row-highlight');
      }
      tbody.appendChild(tr);
    });
  },

  async _animateReorder(tbody, cols, rows) {
    const existingTrs = Array.from(tbody.querySelectorAll('tr'));
    const positions   = {};
    existingTrs.forEach((tr, i) => {
      const sig = this._prevRowSigs[i];
      if (sig) {
        positions[sig] = tr.getBoundingClientRect().top;
      }
    });
    tbody.innerHTML = '';
    const newSigs = rows.map(r => r.join('||'));
    rows.forEach((row, i) => {
      const tr  = this._createRow(row, cols);
      const sig = newSigs[i];
      if (positions[sig] !== undefined) {
        const oldTop = positions[sig];
        tbody.appendChild(tr);
        const newTop = tr.getBoundingClientRect().top;
        const delta  = oldTop - newTop;
        if (Math.abs(delta) > 1) {
          tr.style.transform  = `translateY(${delta}px)`;
          tr.style.transition = 'none';
          requestAnimationFrame(() => {
            tr.style.transition = 'transform 0.35s ease';
            tr.style.transform  = 'translateY(0)';
          });
        }
        tr.classList.add('row-highlight');
      } else {
        tr.classList.add('row-enter');
        tbody.appendChild(tr);
      }
    });
  },

  async _animateGroupMerge(tbody, cols, rows) {
    const existingTrs = Array.from(tbody.querySelectorAll('tr'));
    existingTrs.forEach(tr => {
      tr.querySelectorAll('td').forEach(td => {
        td.style.background = 'rgba(251, 146, 60, 0.08)';
        td.style.transition = 'background 0.3s ease';
      });
    });
    await this._delay(350);
    tbody.innerHTML = '';
    rows.forEach((row, i) => {
      const tr = this._createRow(row, cols);
      tr.classList.add('row-group');
      tr.style.animationDelay = `${i * 40}ms`;
      tbody.appendChild(tr);
    });
  },

  async _animateColumnReduction(tbody, newCols, newRows, prevCols) {
    const existingTrs  = Array.from(tbody.querySelectorAll('tr'));
    const prevColSet   = new Set(newCols.map(c => c.toLowerCase()));
    existingTrs.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      cells.forEach((cell, j) => {
        if (j < prevCols.length) {
          const colName = prevCols[j].toLowerCase();
          if (!prevColSet.has(colName)) {
            cell.classList.add('col-reduced');
          }
        }
      });
    });
    await this._delay(400);
    tbody.innerHTML = '';
    newRows.forEach((row, i) => {
      const tr = this._createRow(row, newCols);
      tr.classList.add('row-highlight');
      tbody.appendChild(tr);
    });
  },

  _createRow(rowData, cols) {
    const tr = document.createElement('tr');
    rowData.forEach((cell, i) => {
      const td = document.createElement('td');
      if (cell === null || cell === undefined) {
        td.innerHTML = '<span class="null-val">NULL</span>';
      } else {
        td.textContent = String(cell);
      }
      tr.appendChild(td);
    });
    return tr;
  },

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
