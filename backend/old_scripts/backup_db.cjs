const fs = require('fs');
const path = require('path');
const { getPool } = require('./database/db');
require('dotenv').config({ path: './.env' });

const zlib = require('zlib');

async function backupDatabase() {
    console.log("Connecting to database using database/db.js...");
    const pool = await getPool();
    
    // Create a timestamped folder for each backup
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupBaseDir = path.join(__dirname, 'database_backups');
    const backupDir = path.join(backupBaseDir, `backup_${dateStr}`);
    
    if (!fs.existsSync(backupBaseDir)) {
        fs.mkdirSync(backupBaseDir);
    }
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const tables = ['Sellers', 'Asins', 'AsinHistory', 'AsinWeekHistory', 'AdsPerformance'];

    for (const table of tables) {
        console.log(`Backing up ${table}...`);
        const filePath = path.join(backupDir, `${table}.json.gz`);
        
        await new Promise((resolve, reject) => {
            const request = pool.request();
            request.stream = true; // Use streaming to prevent OOM / Invalid String Length errors
            
            const writeStream = fs.createWriteStream(filePath);
            const gzip = zlib.createGzip();
            gzip.pipe(writeStream);
            
            gzip.write('[\n');
            
            let isFirst = true;
            let count = 0;
            
            request.query(`SELECT * FROM ${table} WITH (NOLOCK)`);
            
            request.on('row', row => {
                if (!isFirst) {
                    gzip.write(',\n');
                } else {
                    isFirst = false;
                }
                gzip.write(JSON.stringify(row));
                count++;
            });
            
            request.on('error', err => {
                console.error(`Error on table ${table}:`, err);
                reject(err);
            });
            
            request.on('done', () => {
                gzip.write('\n]');
                gzip.end();
                
                writeStream.on('finish', () => {
                    console.log(`Successfully backed up ${count} records to ${table}.json.gz`);
                    resolve();
                });
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
