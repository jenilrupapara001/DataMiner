const User = require('../models/User');

/**
 * Recursively find all subordinates of a user
 * @param {string} userId - The user ID to find subordinates for
 * @returns {Promise<string[]>} - Array of subordinate user IDs
 */
exports.getSubordinateIds = async (userId) => {
    const subordinates = await User.find({ supervisors: userId }).select('_id');
    const ids = subordinates.map(s => s._id.toString());

    let allIds = [...ids];
    for (const id of ids) {
        const nestedIds = await exports.getSubordinateIds(id);
        allIds = [...allIds, ...nestedIds];
    }

    return [...new Set(allIds)]; // Return unique IDs
};
