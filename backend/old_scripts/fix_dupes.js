const fs = require('fs');

let content = fs.readFileSync('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/services/marketDataSyncService.js', 'utf8');

// 1. remove ensureTaskForSeller duplicate
const chunk1Start = `    async ensureTaskForSeller(sellerId) {\n        const pool = await getPool();\n        const sellerResult = await pool.request()`;
const chunk1End = `        this.log('info', \`Created new Octoparse task \${newTaskId} for seller \${seller.Name}\`);\n        return newTaskId;\n    }\n\n`;
let startIndex = content.indexOf(chunk1Start);
let endIndex = content.indexOf(chunk1End) + chunk1End.length;
if (startIndex !== -1 && endIndex > startIndex) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log("Deleted ensureTaskForSeller duplicate");
}

// 2. remove fetchTaskResults duplicate
const chunk2Start = `    /**\n     * Fetch unexported results for a task.\n     */\n    async fetchTaskResults(taskId) {`;
const chunk2End = `    }\n\n    /**\n     * Map Octoparse JSON results to the ASIN model and update dashboard.\n     */`;
startIndex = content.indexOf(chunk2Start);
endIndex = content.indexOf(chunk2End);
if (startIndex !== -1 && endIndex > startIndex) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log("Deleted fetchTaskResults duplicate");
}

// 3. remove _isValidSellerName duplicate
const chunk3Start = `    _isValidSellerName(name) {\n        if (!name || typeof name !== 'string') return false;\n        const lower = name.toLowerCase().trim();`;
const chunk3End = `    }\n\n    /**\n     * Clean stock level\n     */`;
startIndex = content.indexOf(chunk3Start);
endIndex = content.indexOf(chunk3End);
if (startIndex !== -1 && endIndex > startIndex) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
    console.log("Deleted _isValidSellerName duplicate");
}

// 4. remove wait duplicate
const chunk4Start = `    /**\n     * Small utility to wait for a specified time.\n     */\n    wait(ms) {\n        return new Promise(resolve => setTimeout(resolve, ms));\n    }\n\n`;
startIndex = content.indexOf(chunk4Start);
if (startIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(startIndex + chunk4Start.length);
    console.log("Deleted wait duplicate");
}

fs.writeFileSync('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/services/marketDataSyncService.js', content, 'utf8');
console.log("Done");
