const scheduler = require('./services/schedulerService');
require('dotenv').config();

async function forceTrigger() {
  console.log('🚀 [FORCE] Manually triggering Enterprise Pipeline...');
  
  if (process.env.AUTOMATION_ENABLED !== 'true') {
    console.warn('⚠️ [WARNING] AUTOMATION_ENABLED is set to false in .env. Force running anyway...');
  }

  try {
    const result = await scheduler.runEnterprisePipeline();
    console.log('\n✅ [FORCE] Pipeline execution triggered successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ [FORCE] Pipeline failed to start:', err.message);
  }
  
  console.log('\nℹ️ Note: Tasks are now running in Octoparse. You can monitor them in your Octoparse dashboard.');
  process.exit(0);
}

forceTrigger();
