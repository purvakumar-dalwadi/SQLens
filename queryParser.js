/**
 * SQLens — queryParser.js
 * Advanced SELECT parser with structured JOIN extraction.
 */

const QueryParser = {
  _validate(sql) {
    const trimmed = sql.trim();
    if (!trimmed) throw new Error('Query is empty');
    return true;
  },

  isSelect(sql) {
    return /^\s*SELECT\s/i.test(sql.trim());
  },

  getQueryType(sql) {
    const kw = sql.trim().match(/^\s*(\w+)/);
    return kw ? kw[1].toUpperCase() : 'UNKNOWN';
  },

  parse(sql) {
    this._validate(sql);

    const result = {
      selectCols: '',
      baseFrom: '',
      joins: [],
      where: '',
      groupBy: '',
      having: '',
      orderBy: '',
      limit: '',
      raw: sql
    };

    /* ─── SELECT ─── */
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
    if (!selectMatch) throw new Error('Invalid SELECT query');
    result.selectCols = selectMatch[1].trim();

    /* ─── FROM ─── */
    const fromMatch = sql.match(
      /FROM\s+([\s\S]+?)(?=\s+WHERE|\s+GROUP\s+BY|\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|$)/i
    );
    if (!fromMatch) throw new Error('Missing FROM clause');

    const fullFrom = fromMatch[1].trim();

    /* ─── Extract Base Table ─── */
    const joinStart = fullFrom.search(/\b(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b/i);

    if (joinStart === -1) {
      result.baseFrom = fullFrom;
    } else {
      result.baseFrom = fullFrom.substring(0, joinStart).trim();
    }

    /* ─── Extract Structured JOINs ─── */
    const joinRegex =
      /(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([\s\S]+?)(?:\s+ON\s+([\s\S]+?))(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\b|$)/gi;

    let match;
    while ((match = joinRegex.exec(fullFrom)) !== null) {
      result.joins.push({
        type: (match[1] || 'INNER').toUpperCase(),
        table: match[2].trim(),
        condition: match[3] ? match[3].trim() : null
      });
    }

    /* ─── WHERE ─── */
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?=\s+GROUP\s+BY|\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    result.where = whereMatch ? whereMatch[1].trim() : '';

    /* ─── GROUP BY ─── */
    const groupMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?=\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    result.groupBy = groupMatch ? groupMatch[1].trim() : '';

    /* ─── HAVING ─── */
    const havingMatch = sql.match(/HAVING\s+([\s\S]+?)(?=\s+ORDER\s+BY|\s+LIMIT|$)/i);
    result.having = havingMatch ? havingMatch[1].trim() : '';

    /* ─── ORDER BY ─── */
    const orderMatch = sql.match(/ORDER\s+BY\s+([\s\S]+?)(?=\s+LIMIT|$)/i);
    result.orderBy = orderMatch ? orderMatch[1].trim() : '';

    /* ─── LIMIT ─── */
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    result.limit = limitMatch ? limitMatch[1] : '';

    return result;
  }
};