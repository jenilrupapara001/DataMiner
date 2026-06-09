require('dotenv').config();
const sql = require('mssql');
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(config).then(pool => {
  return pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'
  `);
}).then(result => {
  console.log(result.recordset.map(r => r.TABLE_NAME));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
