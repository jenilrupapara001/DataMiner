const { sql, getPool, generateId } = require('../database/db');

/**
 * Get all teams for current user (SQL Version)
 * Returns teams where user is either owner or member
 */
exports.getTeams = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const teamsResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`
                SELECT DISTINCT t.*, u.FirstName as ManagerFirstName, u.LastName as ManagerLastName, u.Email as ManagerEmail
                FROM Teams t
                LEFT JOIN Users u ON t.ManagerId = u.Id
                WHERE t.Id IN (
                    SELECT TeamId FROM TeamMembers WHERE UserId = @userId
                )
                OR t.ManagerId = @userId
                ORDER BY t.Name ASC
            `);

        const teams = await Promise.all(teamsResult.recordset.map(async (team) => {
            // Get members
            const membersResult = await pool.request()
                .input('teamId', sql.VarChar, team.Id)
                .query(`
                    SELECT tm.*, u.Id as userId, u.FirstName, u.LastName, u.Email, u.Avatar, u.Role as userRole
                    FROM TeamMembers tm
                    JOIN Users u ON tm.UserId = u.Id
                    WHERE tm.TeamId = @teamId
                `);

            const members = membersResult.recordset.map(m => ({
                _id: m.UserId,
                user: { _id: m.UserId, firstName: m.FirstName, lastName: m.LastName, email: m.Email, avatar: m.Avatar, role: m.userRole },
                role: m.Role,
                resourceAccess: m.ResourceAccess ? JSON.parse(m.ResourceAccess) : []
            }));

            // Get stats
            const statsResult = await pool.request()
                .input('teamId', sql.VarChar, team.Id)
                .query(`
                    SELECT 
                        COUNT(DISTINCT tm.UserId) as memberCount,
                        COUNT(DISTINCT CASE WHEN u.IsOnline = 1 THEN tm.UserId END) as onlineCount,
                        COUNT(DISTINCT s.Id) as sellerCount
                    FROM TeamMembers tm
                    LEFT JOIN Users u ON tm.UserId = u.Id
                    LEFT JOIN UserSellers us ON tm.UserId = us.UserId
                    LEFT JOIN Sellers s ON us.SellerId = s.Id
                    WHERE tm.TeamId = @teamId
                `);

            const stats = statsResult.recordset[0];

            return {
                ...team,
                _id: team.Id,
                owner: team.ManagerId ? {
                    _id: team.ManagerId,
                    firstName: team.ManagerFirstName,
                    lastName: team.ManagerLastName,
                    email: team.ManagerEmail
                } : null,
                members,
                stats
            };
        }));

        res.json({ success: true, count: teams.length, data: teams });
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create new team
 */
exports.createTeam = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const teamId = generateId();

        await pool.request()
            .input('Id', sql.VarChar, teamId)
            .input('Name', sql.NVarChar, name)
            .input('Description', sql.NVarChar, description || '')
            .input('ManagerId', sql.VarChar, userId)
            .query(`
                INSERT INTO Teams (Id, Name, Description, ManagerId, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, @Description, @ManagerId, GETDATE(), GETDATE())
            `);

        // Add owner as lead member
        await pool.request()
            .input('TeamId', sql.VarChar, teamId)
            .input('UserId', sql.VarChar, userId)
            .input('Role', sql.NVarChar, 'lead')
            .query(`
                INSERT INTO TeamMembers (TeamId, UserId, Role)
                VALUES (@TeamId, @UserId, @Role)
            `);

        // Update user's current team
        await pool.request()
            .input('userId', sql.VarChar, userId)
            .input('teamId', sql.VarChar, teamId)
            .query("UPDATE Users SET CurrentTeam = @teamId WHERE Id = @userId");

        // Fetch created team with details
        const teamResult = await pool.request()
            .input('id', sql.VarChar, teamId)
            .query(`
                SELECT t.*, u.FirstName as ManagerFirstName, u.LastName as ManagerLastName, u.Email as ManagerEmail
                FROM Teams t
                LEFT JOIN Users u ON t.ManagerId = u.Id
                WHERE t.Id = @id
            `);

        const team = teamResult.recordset[0];
        res.status(201).json({
            success: true,
            data: {
                ...team,
                _id: team.Id,
                owner: team.ManagerId ? { _id: team.ManagerId, firstName: team.ManagerFirstName, lastName: team.ManagerLastName, email: team.ManagerEmail } : null,
                members: [{
                    user: { _id: userId },
                    role: 'lead',
                    resourceAccess: []
                }]
            }
        });
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get team members
 */
exports.getTeamMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const membersResult = await pool.request()
            .input('teamId', sql.VarChar, id)
            .query(`
                SELECT tm.*, u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, u.Role as userRole, u.IsOnline
                FROM TeamMembers tm
                JOIN Users u ON tm.UserId = u.Id
                WHERE tm.TeamId = @teamId
            `);

        const members = membersResult.recordset.map(m => ({
            _id: m.Id,
            firstName: m.FirstName,
            lastName: m.LastName,
            email: m.Email,
            avatar: m.Avatar,
            role: m.userRole,
            isOnline: m.IsOnline,
            teamRole: m.Role,
            resourceAccess: m.ResourceAccess ? JSON.parse(m.ResourceAccess) : []
        }));

        res.json({ success: true, count: members.length, data: members });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Add member to team
 */
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role = 'member', resourceAccess = [] } = req.body;
        const pool = await getPool();

        // Check if team exists and user is manager
        const teamCheck = await pool.request()
            .input('teamId', sql.VarChar, id)
            .input('managerId', sql.VarChar, req.user.Id || req.user._id)
            .query("SELECT ManagerId FROM Teams WHERE Id = @teamId AND ManagerId = @managerId");

        if (teamCheck.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'Only team manager can add members' });
        }

        await pool.request()
            .input('TeamId', sql.VarChar, id)
            .input('UserId', sql.VarChar, userId)
            .input('Role', sql.NVarChar, role)
            .input('ResourceAccess', sql.NVarChar, JSON.stringify(resourceAccess))
            .query(`
                IF NOT EXISTS (SELECT 1 FROM TeamMembers WHERE TeamId = @TeamId AND UserId = @UserId)
                BEGIN
                    INSERT INTO TeamMembers (TeamId, UserId, Role, ResourceAccess)
                    VALUES (@TeamId, @UserId, @Role, @ResourceAccess)
                END
            `);

        res.json({ success: true, message: 'Member added' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Remove member from team
 */
exports.removeMember = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const pool = await getPool();

        await pool.request()
            .input('teamId', sql.VarChar, id)
            .input('memberId', sql.VarChar, userId)
            .query("DELETE FROM TeamMembers WHERE TeamId = @teamId AND UserId = @memberId");

        res.json({ success: true, message: 'Member removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update team member (role/resource access)
 */
exports.updateMember = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const { role, resourceAccess } = req.body;
        const pool = await getPool();

        const updates = [];
        const request = pool.request();
        let idx = 0;

        if (role) { updates.push(`Role = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, role); }
        if (resourceAccess !== undefined) { updates.push(`ResourceAccess = @p${idx++}`); request.input(`p${idx-1}`, sql.NVarChar, JSON.stringify(resourceAccess)); }

        if (updates.length === 0) return res.status(400).json({ success: false, message: 'No updates' });

        updates.push('UpdatedAt = GETDATE()');
        request.input('teamId', sql.VarChar, id);
        request.input('userId', sql.VarChar, userId);
        const updateSql = `UPDATE TeamMembers SET ${updates.join(', ')} WHERE TeamId = @teamId AND UserId = @userId; SELECT * FROM TeamMembers WHERE TeamId = @teamId AND UserId = @userId;`;
        const result = await request.query(updateSql);

        if (result.recordset[1]?.length === 0) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        res.json({ success: true, data: result.recordset[1][0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update team details
 */
exports.updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const pool = await getPool();

        await pool.request()
            .input('id', sql.VarChar, id)
            .input('name', sql.NVarChar, name)
            .input('desc', sql.NVarChar, description || '')
            .query(`
                UPDATE Teams 
                SET Name = @name, Description = @desc, UpdatedAt = GETDATE()
                WHERE Id = @id
            `);

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Teams WHERE Id = @id");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Team not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete team
 */
exports.deleteTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        // Remove members first
        await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM TeamMembers WHERE TeamId = @id");

        // Remove team
        await pool.request()
            .input('id', sql.VarChar, id)
            .query("DELETE FROM Teams WHERE Id = @id");

        res.json({ success: true, message: 'Team deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
