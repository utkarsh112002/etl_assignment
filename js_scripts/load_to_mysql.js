require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const { logToFile } = require("./log");

function ensureFileExists(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ File not found: ${filename}`);
  }
  return filePath;
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidName(name) {
  return /^[A-Za-z\s'-]+$/.test(name);
}

function parseStudents() {
  const filePath = ensureFileExists("../data/students.txt");
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  const seenIds = new Set();

  return lines.map(line => {
    const data = line.split(",").map(e => e.trim());
    const entry = Object.fromEntries(headers.map((h, i) => [h, data[i]]));
    if (seenIds.has(entry.student_id)) {
      throw new Error(`⚠️ Duplicate student_id in file: ${entry.student_id}`);
    }
    seenIds.add(entry.student_id);
    return entry;
  });
}

function parseGrades() {
  const filePath = ensureFileExists("../data/grade.txt");
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const data = line.split(",").map(e => e.trim());
    const entry = Object.fromEntries(headers.map((h, i) => [h, data[i]]));
    const [min, max] = entry.percentage_range.split("-").map(Number);
    const gpa = parseFloat(entry.gpa_equivalent);

    if (isNaN(min) || isNaN(max) || min < 0 || max > 100 || min > max) {
      throw new Error(`❌ Invalid percentage range: ${entry.percentage_range}`);
    }

    if (isNaN(gpa) || gpa < 0 || gpa > 4) {
      throw new Error(`❌ Invalid GPA value: ${entry.gpa_equivalent}`);
    }

    return {
      grade_id: parseInt(entry.grade_id),
      grade_code: entry.grade_code,
      grade_label: entry.grade_label,
      min_percentage: min,
      max_percentage: max,
      gpa
    };
  });
}

async function loadData() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    });
    logToFile("✅ Connected to MySQL database");
  } catch (err) {
    logToFile(`❌ Database connection failed: ${err.message}`);
    throw err;
  }

  const deptMap = new Map();
  const subjectMap = new Map();

  try {
    logToFile("🚀 Starting MySQL ETL Load");
    const students = parseStudents();
    const grades = parseGrades();

    for (const s of students) {
      const dept = s.department.trim();
      if (!dept) {
        throw new Error(`❌ Missing department for student ID ${s.student_id}`);
      }

      if (!deptMap.has(dept)) {
        try {
          const [result] = await conn.execute(
            `INSERT INTO DEPARTMENTS (DEPARTMENT_NAME) VALUES (?)`,
            [dept]
          );
          deptMap.set(dept, result.insertId);
          logToFile(`✅ Department added: ${dept}`);
        } catch (err) {
          if (err.code === "ER_DUP_ENTRY") {
            const [existing] = await conn.execute(
              `SELECT DEPARTMENT_ID FROM DEPARTMENTS WHERE DEPARTMENT_NAME = ?`,
              [dept]
            );
            if (existing.length > 0) {
              deptMap.set(dept, existing[0].DEPARTMENT_ID);
              logToFile(`⚠️ Department already exists: ${dept}`);
            }
          } else {
            throw new Error(`❌ Failed to add department ${dept}: ${err.message}`);
          }
        }
      }
    }

    for (const s of students) {
      const studentId = parseInt(s.student_id);
      const dept = s.department.trim();
      const deptId = deptMap.get(dept);
      const date = new Date(s.joining_date);

      if (!deptId || !studentId || isNaN(date.getTime())) {
        throw new Error(`⚠️ Skipping student ${s.student_id}: Invalid department/date/id`);
      }

      if (!isValidName(s.first_name) || !isValidName(s.last_name)) {
        throw new Error(`❌ Invalid name for student ${studentId}: ${s.first_name} ${s.last_name}`);
      }

      if (!isValidEmail(s.email)) {
        throw new Error(`❌ Invalid email for student ${studentId}: ${s.email}`);
      }

      try {
        await conn.execute(
          `INSERT INTO STUDENTS (STUDENTS_ID, STUDENTS_FIRST_NAME, STUDENTS_LAST_NAME, STUDENTS_EMAIL, STUDENTS_DEPARTMENT_ID, STUDENTS_JOINING_DATE)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [studentId, s.first_name, s.last_name, s.email, deptId, date]
        );
        logToFile(`✅ Student inserted: ${studentId}`);
      } catch {
        logToFile(`⚠️ Student already present: ${studentId}`);
        continue;
      }

      for (let i = 1; i <= 5; i++) {
        const subject = s[`subject${i}`];
        const marks = s[`subject${i}_marks`] || s[`subject${i}_mark`];
        if (!subject || !marks || isNaN(marks)) continue;

        const marksInt = parseInt(marks);
        if (marksInt < 0 || marksInt > 100) {
          throw new Error(`⚠️ Invalid marks for Student ${studentId} in ${subject}: ${marks}`);
        }

        const key = `${subject}_${deptId}`;
        if (!subjectMap.has(key)) {
          try {
            const [result] = await conn.execute(
              `INSERT INTO SUBJECTS (SUBJECTS_NAME, SUBJECTS_DEPARTMENT_ID) VALUES (?, ?)`,
              [subject, deptId]
            );
            subjectMap.set(key, result.insertId);
            logToFile(`✅ Subject added: ${subject} (Dept ID: ${deptId})`);
          } catch (err) {
            if (err.code === "ER_DUP_ENTRY") {
              const [existingSubject] = await conn.execute(
                `SELECT SUBJECTS_ID FROM SUBJECTS WHERE SUBJECTS_NAME = ? AND SUBJECTS_DEPARTMENT_ID = ?`,
                [subject, deptId]
              );
              if (existingSubject.length > 0) {
                subjectMap.set(key, existingSubject[0].SUBJECTS_ID);
                logToFile(`⚠️ Subject already exists: ${subject} (Dept ID: ${deptId})`);
              }
            } else {
              throw new Error(`❌ Failed to insert subject ${subject}: ${err.message}`);
            }
          }
        }

        const subjectId = subjectMap.get(key);
        try {
          await conn.execute(
            `INSERT INTO MARKS (MARKS_STUDENT_ID, MARKS_SUBJECT_ID, MARKS_SCORE)
             VALUES (?, ?, ?)`,
            [studentId, subjectId, marksInt]
          );
          logToFile(`✅ Marks inserted: Student ${studentId}, Subject ${subjectId}`);
        } catch (err) {
          throw new Error(`❌ Failed to insert marks: Student ${studentId}, reason: ${err.message}`);
        }
      }
    }
    for (const g of grades) {
      try {
        await conn.execute(
          `INSERT INTO GRADE (GRADE_ID, GRADE_CODE, GRADE_LABEL, PERCENTAGE_MIN, PERCENTAGE_MAX, GPA)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [g.grade_id, g.grade_code, g.grade_label, g.min_percentage, g.max_percentage, g.gpa]
        );
        logToFile(`✅ Grade added: ${g.grade_code}`);
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          logToFile(`⚠️ Grade already exists: ${g.grade_code}`);
        } else {
          throw new Error(`❌ Failed to insert grade ${g.grade_code}: ${err.message}`);
        }
      }
    }
    logToFile("✅ Data load completed successfully.");
    console.log("✅ Data loaded into MySQL successfully.");
  } catch (err) {
    logToFile(`❌ ETL process failed: ${err.message}`);
    console.error("❌ ETL error:", err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}
loadData();
