require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const { logToFile } = require('./log');

async function transferData() {
  let mysqlConn, pgClient;

  try {
    logToFile("🚀 Starting MySQL to PostgreSQL transfer...");

    mysqlConn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    logToFile("✅ Connected to MySQL");

    pgClient = new Client({
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT
    });
    await pgClient.connect();
    logToFile("✅ Connected to PostgreSQL");

    const [rows] = await mysqlConn.execute(`
      SELECT s.STUDENTS_ID AS student_id,
             s.STUDENTS_FIRST_NAME AS first_name,
             s.STUDENTS_LAST_NAME AS last_name,
             s.STUDENTS_EMAIL AS email,
             d.DEPARTMENT_NAME AS department,
             s.STUDENTS_JOINING_DATE AS joining_date,
             ROUND(AVG(g.GPA), 2) AS gpa
      FROM STUDENTS s
      JOIN DEPARTMENTS d ON s.STUDENTS_DEPARTMENT_ID = d.DEPARTMENT_ID
      JOIN MARKS m ON s.STUDENTS_ID = m.MARKS_STUDENT_ID
      JOIN SUBJECTS sub ON m.MARKS_SUBJECT_ID = sub.SUBJECTS_ID
      JOIN GRADE g ON m.MARKS_SCORE BETWEEN g.PERCENTAGE_MIN AND g.PERCENTAGE_MAX
      GROUP BY s.STUDENTS_ID
    `);

    if (!rows.length) {
      logToFile("⚠️ No data found in MySQL to transfer.", "warn");
      return;
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    let processedCount = 0;

    for (const row of rows) {
      if (!row.student_id || !row.first_name || !row.last_name || !row.email || !row.joining_date || row.gpa == null) {
        logToFile(`❌ Missing required fields for student: ${JSON.stringify(row)}`, "error");
        continue;
      }

      if (!emailRegex.test(row.email)) {
        logToFile(`❌ Invalid email format for student ${row.student_id}: ${row.email}`, "error");
        continue;
      }

      if (isNaN(row.gpa) || row.gpa < 0 || row.gpa > 4.0) {
        logToFile(`❌ Invalid GPA for student ${row.student_id}: ${row.gpa}`, "error");
        continue;
      }

      const dateObj = new Date(row.joining_date);
      if (isNaN(dateObj.getTime())) {
        logToFile(`❌ Invalid joining date for student ${row.student_id}: ${row.joining_date}`, "error");
        continue;
      }

      try {
        await pgClient.query(
          `INSERT INTO student_academics (
            student_academics_id,
            student_academics_first_name,
            student_academics_last_name,
            student_academics_email,
            student_academics_department,
            student_academics_joining_date,
            student_academics_gpa
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (student_academics_id) DO NOTHING`,
          [
            row.student_id,
            row.first_name,
            row.last_name,
            row.email,
            row.department,
            row.joining_date,
            parseFloat(row.gpa)
          ]
        );
        logToFile(`✅ Transferred student ${row.student_id} to PostgreSQL.`);
        processedCount++;
      } catch (insertErr) {
        logToFile(`❌ Failed to insert student ${row.student_id}: ${insertErr.message}`, "error");
      }
    }

    logToFile(`✅ Data transfer to PostgreSQL completed. Total processed: ${processedCount}`);
    console.log("✅ Data transferred to PostgreSQL successfully.");
  } catch (err) {
    logToFile(`❌ Transfer Error: ${err.message}`, "error");
    console.error("❌ Transfer Error:", err);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    if (pgClient) await pgClient.end();
  }
}

transferData();