const GLOBAL_ROLES = ['admin', 'operational_manager', 'Listing Manager'];
const { buildInClause } = require('../utils/sqlHelpers');
const { sql, getPool } = require('../database/db');

function getUserRoleName(user) {
    return user?.role?.name || user?.role || '';
}

module.exports = {
    GLOBAL_ROLES,

    getUserRoleName,

    isGlobalUser(user) {
        return GLOBAL_ROLES.includes(getUserRoleName(user));
    },

    async buildSellerFilter(user, tableAlias = 'a') {
        const alias = tableAlias ? `${tableAlias}.` : '';
        if (this.isGlobalUser(user)) {
            return '';
        }
        const assignedIds = user?.assignedSellers || [];
        if (assignedIds.length === 0) {
            return ` AND ${alias}SellerId = '000000000000000000000000'`;
        }
        const pool = await getPool();
        const req = pool.request();
        const placeholders = buildInClause(req, 'sellerId', assignedIds);
        return { filter: ` AND ${alias}SellerId IN (${placeholders})`, request: req };
    },

    getAccessibleSellerIds(user) {
        if (this.isGlobalUser(user)) {
            return null;
        }
        const assignedIds = user?.assignedSellers || [];
        return assignedIds.length > 0 ? assignedIds : [];
    }
};
