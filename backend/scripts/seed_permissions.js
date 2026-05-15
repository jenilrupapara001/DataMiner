const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const roleController = require('../controllers/roleController');

async function seed() {
    console.log('Seeding roles and permissions...');
    const req = {};
    const res = {
        json: (data) => {
            console.log('Success:', data);
        },
        status: (code) => {
            return {
                json: (data) => {
                    console.log(`Status ${code}:`, data);
                }
            };
        }
    };
    
    try {
        await roleController.seedRolesAndPermissions(req, res);
    } catch (err) {
        console.error('Error during seeding:', err);
    } finally {
        process.exit(0);
    }
}

seed();
