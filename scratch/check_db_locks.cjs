const { getPool } = require('../backend/database/db');

async function checkLocks() {
    try {
        const pool = await getPool();
        console.log('Querying active requests / blocks...');
        const res = await pool.request().query(`
            SELECT 
                r.session_id,
                r.status,
                r.blocking_session_id,
                r.wait_type,
                r.wait_time,
                r.last_wait_type,
                SUBSTRING(t.text, (r.statement_start_offset/2)+1,   
                    (((CASE r.statement_end_offset  
                        WHEN -1 THEN DATALENGTH(t.text)  
                        ELSE r.statement_end_offset  
                    END) - r.statement_start_offset)/2) + 1) AS statement_text
            FROM sys.dm_exec_requests r
            OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
            WHERE r.session_id > 50;
        `);
        console.log('Active requests count:', res.recordset.length);
        res.recordset.forEach(req => {
            console.log(`Session ${req.session_id}: status=${req.status}, blocking=${req.blocking_session_id}, wait_type=${req.wait_type}, wait_time=${req.wait_time}`);
            console.log(`SQL: ${req.statement_text ? req.statement_text.substring(0, 100) : 'N/A'}`);
            console.log('---');
        });
        
        console.log('Querying locks summary by session...');
        const locksRes = await pool.request().query(`
            SELECT 
                request_session_id as session_id,
                resource_type,
                request_mode,
                request_status,
                COUNT(*) as lock_count
            FROM sys.dm_tran_locks
            WHERE resource_database_id = DB_ID() AND request_session_id > 50
            GROUP BY request_session_id, resource_type, request_mode, request_status;
        `);
        console.log('Locks Summary:', locksRes.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error('Failed to check locks:', err);
        process.exit(1);
    }
}

checkLocks();
