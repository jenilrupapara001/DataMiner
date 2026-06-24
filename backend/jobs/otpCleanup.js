const cron = require('node-cron');
const { getPool } = require('../database/db');

async function cleanupExpiredOtps() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`DELETE FROM OtpVerifications WHERE ExpiresAt < DATEADD(DAY, -7, GETUTCDATE())`);
    console.log(`🧹 Cleaned ${result.rowsAffected[0]} expired OTP records`);
    
    // Also clean expired trusted devices
    await pool.request().query(`DELETE FROM TrustedDevices WHERE ExpiresAt < GETDATE() AND IsRevoked = 1`);
  } catch (e) {
    console.error('OTP cleanup failed:', e.message);
  }
}

// Schedule: daily at 3 AM
cron.schedule('0 3 * * *', () => {
  console.log('⏰ Running OTP cleanup...');
  cleanupExpiredOtps();
});

console.log('✅ OTP cleanup job scheduled (daily at 3 AM)');
