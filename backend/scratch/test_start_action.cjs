const { getPool } = require('../database/db');
const sql = require('mssql');
const SystemLogService = require('../services/SystemLogService');

async function main() {
    console.log('Testing Start Action DB query simulation...');
    try {
        const pool = await getPool();
        const id = '3ded7bada5b24e01ab05fa0d';
        
        // Fetch existing
        const actionResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query("SELECT * FROM Actions WHERE Id = @id");
        
        const action = actionResult.recordset[0];
        console.log('Fetched Action successfully.');

        const userId = '53948eb7838845f59107ee67'; // Admin User ID

        // Stage history parsing
        let stageHistory = { current: 'PENDING', history: [] };
        if (action.Stage) {
            try {
                stageHistory = JSON.parse(action.Stage);
            } catch (e) {
                stageHistory = { current: String(action.Stage), history: [] };
            }
        }
        stageHistory.history = stageHistory.history || [];
        stageHistory.history.push({ from: stageHistory.current || 'PENDING', to: 'IN_PROGRESS', changedBy: userId, changedAt: new Date() });
        stageHistory.current = 'IN_PROGRESS';

        let timeTracking = {};
        if (action.TimeTracking) {
            try {
                timeTracking = JSON.parse(action.TimeTracking);
            } catch (e) {}
        }

        console.log('Simulating UPDATE Actions query...');
        await pool.request()
            .input('id', sql.VarChar, id)
            .input('Stage', sql.NVarChar, JSON.stringify(stageHistory))
            .input('TimeTracking', sql.NVarChar, JSON.stringify({ ...timeTracking, startedAt: new Date() }))
            .query(`UPDATE Actions SET Stage = @Stage, TimeTracking = @TimeTracking, UpdatedAt = GETDATE() WHERE Id = @id`);
        console.log('✓ UPDATE Actions query completed successfully.');

        console.log('Simulating SystemLogService.log...');
        const logRes = await SystemLogService.log({
            type: 'STATUS_CHANGE',
            entityType: 'ACTION',
            entityId: id,
            entityTitle: action.Title,
            user: userId,
            description: `Started action: ${action.Title}`
        });
        console.log('✓ SystemLogService.log finished. Result:', logRes);

        console.log('Simulating fetch updated Action...');
        const updated = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`SELECT * FROM Actions WHERE Id = @id`);
        console.log('✓ Fetch updated Action query completed successfully.', updated.recordset[0]);

    } catch (e) {
        console.error('❌ SIMULATION THREW ERROR:', e);
    }
    process.exit(0);
}

main();
