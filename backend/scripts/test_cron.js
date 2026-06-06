const cron = require('node-cron');
const options = { scheduled: true, timezone: 'Asia/Kolkata' };
const job = cron.schedule('* * * * * *', () => {
    console.log('Cron fired at:', new Date().toISOString(), new Date().toString());
    job.stop();
}, options);
console.log('Cron scheduled. Waiting 2 seconds...');
setTimeout(() => process.exit(0), 2000);
