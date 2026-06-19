const { sql } = require('../database/db');

function buildInClause(request, paramPrefix, values, sqlType = sql.VarChar) {
    const placeholders = [];
    values.forEach((val, i) => {
        const paramName = `@${paramPrefix}_${i}`;
        request.input(paramName, sqlType, val);
        placeholders.push(paramName);
    });
    return placeholders.join(',');
}

module.exports = { buildInClause };
