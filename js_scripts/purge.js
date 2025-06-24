// require('dotenv').config();
// const mysql = require('mysql2/promise');
// const { Client } = require('pg');
// const { logToFile } = require('./log'); // ✅ import logger

// async function purgeData() {
//   let mysqlConn, pgClient;

//   try {
//     logToFile("🧹 Starting purge process for MySQL and PostgreSQL...");

//     // Connect to MySQL
//     mysqlConn = await mysql.createConnection({
//       host: process.env.MYSQL_HOST,
//       user: process.env.MYSQL_USER,
//       password: process.env.MYSQL_PASSWORD,
//       database: process.env.MYSQL_DATABASE
//     });

//     // Connect to PostgreSQL
//     pgClient = new Client({
//       user: process.env.PG_USER,
//       host: process.env.PG_HOST,
//       database: process.env.PG_DATABASE,
//       password: process.env.PG_PASSWORD,
//       port: process.env.PG_PORT
//     });
//     await pgClient.connect();

//     // Purge MySQL
//     logToFile("🔄 Purging MySQL tables...");
//     await mysqlConn.execute(`SET FOREIGN_KEY_CHECKS = 0`);
//     await mysqlConn.execute(`DELETE FROM MARKS`);
//     await mysqlConn.execute(`DELETE FROM STUDENTS`);
//     await mysqlConn.execute(`DELETE FROM SUBJECTS`);
//     await mysqlConn.execute(`DELETE FROM DEPARTMENTS`);
//     await mysqlConn.execute(`DELETE FROM GRADE`);
//     await mysqlConn.execute(`SET FOREIGN_KEY_CHECKS = 1`);
//     logToFile("✅ MySQL tables purged successfully.");

//     // Purge PostgreSQL
//     logToFile("🔄 Purging PostgreSQL table student_academics...");
//     await pgClient.query(`DELETE FROM student_academics`);
//     logToFile("✅ PostgreSQL tables purged successfully.");

//     logToFile("🧹 Data purge completed.");
//     console.log("✅ Data purged from both MySQL and PostgreSQL.");
//   } catch (err) {
//     logToFile(`❌ Purge Error: ${err.message}`, "error");
//     console.error("❌ Purge Error:", err.message);
//   } finally {
//     if (mysqlConn) await mysqlConn.end();
//     if (pgClient) await pgClient.end();
//   }
// }

// purgeData();


require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const { logToFile } = require('./log');

// Ensure all required environment variables are present
function validateEnv() {
  const requiredEnv = [
    "MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
    "PG_USER", "PG_HOST", "PG_DATABASE", "PG_PASSWORD", "PG_PORT"
  ];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      logToFile(`❌ Missing environment variable: ${key}`);
      process.exit(1);
    }
  }
}

async function purgeData() {
  let mysqlConn, pgClient;

  validateEnv();
  logToFile("🧹 Starting purge process for MySQL and PostgreSQL...");

  // Connect to MySQL
  try {
    mysqlConn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    logToFile("✅ Connected to MySQL database");
  } catch (err) {
    logToFile(`❌ MySQL connection failed: ${err.message}`);
    return;
  }

  // Connect to PostgreSQL
  try {
    pgClient = new Client({
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT
    });
    await pgClient.connect();
    logToFile("✅ Connected to PostgreSQL database");
  } catch (err) {
    logToFile(`❌ PostgreSQL connection failed: ${err.message}`);
    if (mysqlConn) await mysqlConn.end();
    return;
  }

  // Purge MySQL Tables
  try {
    logToFile("🔄 Purging MySQL tables...");
    await mysqlConn.execute(`SET FOREIGN_KEY_CHECKS = 0`);

    let result;

    [result] = await mysqlConn.execute(`DELETE FROM MARKS`);
    logToFile(`✅ Rows deleted from MARKS: ${result.affectedRows}`);

    [result] = await mysqlConn.execute(`DELETE FROM STUDENTS`);
    logToFile(`✅ Rows deleted from STUDENTS: ${result.affectedRows}`);

    [result] = await mysqlConn.execute(`DELETE FROM SUBJECTS`);
    logToFile(`✅ Rows deleted from SUBJECTS: ${result.affectedRows}`);

    [result] = await mysqlConn.execute(`DELETE FROM DEPARTMENTS`);
    logToFile(`✅ Rows deleted from DEPARTMENTS: ${result.affectedRows}`);

    [result] = await mysqlConn.execute(`DELETE FROM GRADE`);
    logToFile(`✅ Rows deleted from GRADE: ${result.affectedRows}`);

    await mysqlConn.execute(`SET FOREIGN_KEY_CHECKS = 1`);
    logToFile("✅ MySQL tables purged successfully.");
  } catch (err) {
    logToFile(`❌ MySQL purge failed: ${err.message}`);
  }

  // Purge PostgreSQL Table
  try {
    logToFile("🔄 Purging PostgreSQL table student_academics...");
    const pgResult = await pgClient.query(`DELETE FROM student_academics`);
    logToFile(`✅ Rows deleted from student_academics: ${pgResult.rowCount}`);
    logToFile("✅ PostgreSQL table purged successfully.");
  } catch (err) {
    logToFile(`❌ PostgreSQL purge failed: ${err.message}`);
  }

  logToFile("🧹 Data purge completed.");
  console.log("✅ Data purged from both MySQL and PostgreSQL.");

  // Cleanup
  if (mysqlConn) await mysqlConn.end();
  if (pgClient) await pgClient.end();
}

purgeData();
