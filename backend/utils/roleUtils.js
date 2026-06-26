/**
 * Global user roles that have full system access.
 * Use this instead of hardcoding ['admin', 'operational_manager'] everywhere.
 */
const GLOBAL_ROLES = ['admin', 'super_admin', 'developer', 'operational_manager'];

/**
 * Check if a role name represents a global (full-access) user.
 * @param {string} roleName - The role name to check
 * @returns {boolean}
 */
function isGlobalUserRole(roleName) {
  return GLOBAL_ROLES.includes(roleName);
}

module.exports = { GLOBAL_ROLES, isGlobalUserRole };
