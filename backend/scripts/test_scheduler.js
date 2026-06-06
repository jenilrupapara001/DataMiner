require('dotenv').config();
const { getPool } = require('../database/db');
const schedulerService = require('../services/schedulerService');

async function test() {
    await getPool();
    await schedulerService.scheduleJobs();
    console.log("Enterprise Pipeline Job Status:", !!schedulerService.jobs.enterprisePipeline);
    process.exit(0);
}
test().catch(console.error);
