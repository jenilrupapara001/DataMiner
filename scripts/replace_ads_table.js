const fs = require('fs');

const path = 'src/pages/AdsManagerPage.jsx';
let code = fs.readFileSync(path, 'utf8');

// I will just locate the table container and replace it with <Table ... />
// Also remove renderSubHeaders, renderCells, renderHeaderGroup etc.
