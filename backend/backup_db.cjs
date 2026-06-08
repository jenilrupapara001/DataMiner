const fs = require('fs');
const path = require('path');
const { getPool } = require('./database/db');
require('dotenv').config({ path: './.env' });

async function backupDatabase() {
    console.log("Connecting to database using database/db.js...");
    const pool = await getPool();
    const backupDir = path.join(__dirname, 'database_backup');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const tables = ['Sellers', 'Asins', 'AsinHistory', 'AsinWeekHistory', 'AdsPerformance'];

    for (const table of tables) {
        console.log(`Backing up ${table}...`);
        const filePath = path.join(backupDir, `${table}.json`);
        
        await new Promise((resolve, reject) => {
            const request = pool.request();
            request.stream = true; // Use streaming to prevent OOM / Invalid String Length errors
            
            const writeStream = fs.createWriteStream(filePath);
            writeStream.write('[\n');
            
            let isFirst = true;
            let count = 0;
            
            request.query(`SELECT * FROM ${table} WITH (NOLOCK)`);
            
            request.on('row', row => {
                if (!isFirst) {
                    writeStream.write(',\n');
                } else {
                    isFirst = false;
                }
                writeStream.write(JSON.stringify(row));
                count++;
            });
            
            request.on('error', err => {
                console.error(`Error on table ${table}:`, err);
                reject(err);
            });
            
            request.on('done', () => {
                writeStream.write('\n]');
                writeStream.end();
                console.log(`Successfully backed up ${count} records to ${table}.json`);
                resolve();
            });
        });
    }

    console.log("Database Backup Complete!");
}

backupDatabase().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
