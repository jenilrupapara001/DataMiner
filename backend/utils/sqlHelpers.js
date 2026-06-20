const { sql } = require('../database/db');

function buildInClause(request, paramPrefix, values, sqlType = sql.VarChar) {
    const placeholders = [];
    values.forEach((val, i) => {
        const name = `${paramPrefix}_${i}`;
        request.input(name, sqlType, val);
        placeholders.push(`@${name}`);
    });
    return placeholders.join(',');
}

module.exports = { buildInClause };
