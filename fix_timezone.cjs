const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                processDir(fullPath);
            }
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Replace hardcoded SQL IST with UDF
            if (content.includes('DATEADD(minute, 330, GETUTCDATE())')) {
                content = content.replace(/DATEADD\(minute,\s*330,\s*GETUTCDATE\(\)\)/g, 'dbo.GetEnvDate()');
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'backend'));
console.log('Replacement complete.');
