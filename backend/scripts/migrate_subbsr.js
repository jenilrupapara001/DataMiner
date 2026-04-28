const { sql, getPool } = require('../database/db');

async function run() {
  try {
    const pool = await getPool();
    console.log('Connected to DB');

    try {
      await pool.request().query(`
        ALTER TABLE Asins ADD SubBsrCategories NVARCHAR(MAX);
      `);
      console.log('Added SubBsrCategories column.');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('SubBsrCategories column already exists.');
      } else {
        console.error('Error adding column:', err.message);
      }
    }

    const result = await pool.request().query('SELECT Id, SubBsr FROM Asins WHERE SubBsr IS NOT NULL AND SubBsr != \'\'');
    const asins = result.recordset;
    console.log(`Found ${asins.length} ASINs with SubBsr data.`);

    let updatedCount = 0;
    for (const asin of asins) {
      const rawSubBsr = asin.SubBsr;
      let categories = [];
      
      try {
        if (rawSubBsr.startsWith('[')) {
            const arr = JSON.parse(rawSubBsr);
            categories = arr.map(item => {
                const match = item.match(/in\s+(.+)$/i);
                return match ? match[1].trim() : item;
            });
        } else {
            const matches = [...rawSubBsr.matchAll(/(?:#[\d,]+\s+in\s+)(.+?)(?=\s+#|$)/g)];
            if (matches.length > 0) {
                categories = matches.map(m => m[1].trim());
            } else {
                const match = rawSubBsr.match(/in\s+(.+)$/i);
                if (match) categories = [match[1].trim()];
            }
        }
      } catch(e) {}
      
      const uniqueCats = [...new Set(categories.filter(c => c))];
      
      await pool.request()
        // Ensure the ID parameter matches the actual database type (NVARCHAR for mongo ids)
        .input('id', sql.NVarChar, asin.Id.toString())
        .input('cats', sql.NVarChar, JSON.stringify(uniqueCats))
        .query('UPDATE Asins SET SubBsrCategories = @cats WHERE Id = @id');
      
      updatedCount++;
      if (updatedCount % 50 === 0) console.log(`Updated ${updatedCount} ASINs`);
    }

    console.log(`Successfully updated ${updatedCount} ASINs with parsed SubBsrCategories.`);
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    process.exit(0);
  }
}

run();
