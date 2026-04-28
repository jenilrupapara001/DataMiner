const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    // Assuming backend is at 3001
    // The frontend sends something like this
    // We don't have the auth token, so we can't test via axios directly.
    // Instead we test using asinController again
    const asinController = require('./controllers/asinController');
    const { getPool } = require('./database/db');
    const sql = require('mssql');
    
    const pool = await getPool();
    // find a category
    const catRes = await pool.request().query("SELECT TOP 1 value FROM Asins a CROSS APPLY OPENJSON(a.SubBsrCategories) WHERE a.SubBsrCategories IS NOT NULL AND ISJSON(a.SubBsrCategories) > 0");
    if(catRes.recordset.length === 0) return console.log("No cats");
    const category = catRes.recordset[0].value;
    console.log("Found category:", category);
    
    const req = {
      user: { role: { name: 'admin' } },
      query: {
        page: 1, limit: 25,
        subBsrCategory: category
      }
    };
    
    let result = null;
    const res = {
      json: function(data) { result = data; },
      status: function() { return this; }
    };
    
    await asinController.getAsins(req, res);
    console.log("Result ASIN count:", result.asins ? result.asins.length : 0);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
