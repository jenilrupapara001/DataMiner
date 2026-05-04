require('dotenv').config({ path: '/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/.env' });
const { seedRolesAndPermissions } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/controllers/roleController');

async function runSeed() {
    console.log('--- Seeding Script Started ---');
    console.log('DB Server:', process.env.DB_SERVER);
    console.log('DB Name:', process.env.DB_NAME);
    
    const req = {};
    const res = {
        status: (code) => {
            console.log(`HTTP Status: ${code}`);
            return {
                json: (data) => {
                    console.log('JSON Error Response:', JSON.stringify(data, null, 2));
                }
            };
        },
        json: (data) => {
            console.log('JSON Success Response:', JSON.stringify(data, null, 2));
        }
    };

    console.log('Calling seedRolesAndPermissions...');
    try {
        await seedRolesAndPermissions(req, res);
        console.log('--- Seeding Logic Execution Finished ---');
        // Give it a moment to flush logs and then exit
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('CRITICAL ERROR in seeding script:', error);
        process.exit(1);
    }
}

runSeed();
