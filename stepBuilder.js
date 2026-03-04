/**
 * SQLens — stepBuilder.js
 * Advanced JOIN-aware staged execution builder.
 */

const StepBuilder = {
  _STEP_DEFS: {
    FROM:       { color: '#818cf8', desc: 'Load base table' },
    JOIN:       { color: '#a78bfa', desc: 'Apply JOIN operation' },
    WHERE:      { color: '#f472b6', desc: 'Filter rows' },
    'GROUP BY': { color: '#fb923c', desc: 'Group rows' },
    HAVING:     { color: '#facc15', desc: 'Filter grouped rows' },
    SELECT:     { color: '#34d399', desc: 'Project output columns' },
    'ORDER BY': { color: '#60a5fa', desc: 'Sort rows' },
    LIMIT:      { color: '#e879f9', desc: 'Limit result rows' }
  },

  buildSteps(q) {
    const steps = [];

    /* ───────── FROM ───────── */
    steps.push({
      name: 'FROM',
      type: 'FROM',
      sql: `SELECT * FROM ${q.baseFrom} LIMIT 1000`,
      ...this._STEP_DEFS.FROM
    });

    let cumulativeFrom = q.baseFrom;

    /* ───────── JOINs ───────── */
    q.joins.forEach((join, index) => {
      let joinSql;
      if (join.type === 'RIGHT') {
        joinSql = `LEFT JOIN ${cumulativeFrom} ON ${join.condition}`;
        cumulativeFrom = `${join.table} ${joinSql}`;
      }
      else if (join.type === 'FULL') {
        joinSql = `
          SELECT * FROM ${cumulativeFrom}
          LEFT JOIN ${join.table} ON ${join.condition}
          UNION
          SELECT * FROM ${join.table}
          LEFT JOIN ${cumulativeFrom} ON ${join.condition}
        `;
        steps.push({
          name: `FULL OUTER JOIN ${index + 1}`,
          type: 'JOIN',
          sql: joinSql,
          ...this._STEP_DEFS.JOIN
        });
        cumulativeFrom = `(${joinSql})`;
        return;
      }
      else if (join.type === 'CROSS') {
        cumulativeFrom += ` CROSS JOIN ${join.table}`;
      }
      else {
        cumulativeFrom += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
      }
      steps.push({
        name: `${join.type} JOIN ${index + 1}`,
        type: 'JOIN',
        sql: `SELECT * FROM ${cumulativeFrom} LIMIT 1000`,
        ...this._STEP_DEFS.JOIN
      });
    });

    /* ───────── WHERE ───────── */
    if (q.where) {
      steps.push({
        name: 'WHERE',
        type: 'WHERE',
        sql: `SELECT * FROM ${cumulativeFrom} WHERE ${q.where} LIMIT 1000`,
        ...this._STEP_DEFS.WHERE
      });
    }

    /* ───────── GROUP BY ───────── */
    if (q.groupBy) {
      steps.push({
        name: 'GROUP BY',
        type: 'GROUP BY',
        sql: `
          SELECT ${q.groupBy}, COUNT(*) as _group_size
          FROM ${cumulativeFrom}
          ${q.where ? `WHERE ${q.where}` : ''}
          GROUP BY ${q.groupBy}
          LIMIT 1000
        `.trim(),
        ...this._STEP_DEFS['GROUP BY']
      });
    }

    /* ───────── HAVING ───────── */
    if (q.having) {
      steps.push({
        name: 'HAVING',
        type: 'HAVING',
        sql: `
          SELECT ${q.groupBy}, COUNT(*) as _group_size
          FROM ${cumulativeFrom}
          ${q.where ? `WHERE ${q.where}` : ''}
          GROUP BY ${q.groupBy}
          HAVING ${q.having}
          LIMIT 1000
        `.trim(),
        ...this._STEP_DEFS.HAVING
      });
    }

    /* ───────── SELECT ───────── */
    steps.push({
      name: 'SELECT',
      type: 'SELECT',
      sql: `
        SELECT ${q.selectCols}
        FROM ${cumulativeFrom}
        ${q.where ? `WHERE ${q.where}` : ''}
        ${q.groupBy ? `GROUP BY ${q.groupBy}` : ''}
        ${q.having ? `HAVING ${q.having}` : ''}
        ${q.limit ? '' : 'LIMIT 1000'}
      `.trim(),
      ...this._STEP_DEFS.SELECT
    });

    /* ───────── ORDER BY ───────── */
    if (q.orderBy) {
      steps.push({
        name: 'ORDER BY',
        type: 'ORDER BY',
        sql: `
          SELECT ${q.selectCols}
          FROM ${cumulativeFrom}
          ${q.where ? `WHERE ${q.where}` : ''}
          ${q.groupBy ? `GROUP BY ${q.groupBy}` : ''}
          ${q.having ? `HAVING ${q.having}` : ''}
          ORDER BY ${q.orderBy}
          LIMIT 1000
        `.trim(),
        ...this._STEP_DEFS['ORDER BY']
      });
    }

    /* ───────── LIMIT ───────── */
    if (q.limit) {
      steps.push({
        name: 'LIMIT',
        type: 'LIMIT',
        sql: `
          SELECT ${q.selectCols}
          FROM ${cumulativeFrom}
          ${q.where ? `WHERE ${q.where}` : ''}
          ${q.groupBy ? `GROUP BY ${q.groupBy}` : ''}
          ${q.having ? `HAVING ${q.having}` : ''}
          ${q.orderBy ? `ORDER BY ${q.orderBy}` : ''}
          LIMIT ${q.limit}
        `.trim(),
        ...this._STEP_DEFS.LIMIT
      });
    }
    return steps;
  },

  executeSteps(parsedQuery) {
    const stepDefs = this.buildSteps(parsedQuery);
    const results  = [];
    for (const step of stepDefs) {
      let result;
      const start = performance.now();
      try {
        result = DBEngine.executeQuery(step.sql);
      }
      catch (e) {
        result = { columns: [], rows: [], error: e.message };
      }
      const duration = performance.now() - start;
      results.push({
        name: step.name,
        type: step.type,
        color: step.color,
        desc: step.desc,
        sql: step.sql,
        columns: result.columns || [],
        rows: result.rows || [],
        rowCount: (result.rows || []).length,
        duration: Math.round(duration * 100) / 100,
        error: result.error || null
      });
    }
    return results;
  }
};