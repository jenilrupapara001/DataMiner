require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const { seedRolesAndPermissions } = require('../controllers/roleController');

async function run() {
    console.log('🔄 Executing Seeding...');
    const fakeReq = {};
    const fakeRes = {
        json: (data) => {
            console.log('✅ Seeding completed successfully:', data);
            process.exit(0);
        },
        status: (code) => {
            return {
                json: (data) => {
                    console.error(`❌ Seeding failed with status ${code}:`, data);
                    process.exit(1);
                }
            }
        }
    };
    try {
        await seedRolesAndPermissions(fakeReq, fakeRes);
    } catch (err) {
        console.error('❌ Exception during seeding:', err);
        process.exit(1);
    }
}

run();
