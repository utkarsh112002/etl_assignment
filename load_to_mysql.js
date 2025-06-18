require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// reading the students.txt file , removing the first line, parsing the data and remving the whit spaces
function parseStudents() {
  const filePath = path.join(__dirname, "students.txt");
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const data = line.split(",").map(e => e.trim());
    return Object.fromEntries(headers.map((h, i) => [h, data[i]]));
  });
}

// reading the grade.txt file, removing the first line, parsing the data and removing the white spaces
function parseGrades() {
  const filePath = path.join(__dirname, "grade.txt");
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  const headers = lines.shift().split(",").map(h => h.trim());

  return lines.map(line => {
    const data = line.split(",").map(e => e.trim());
    const entry = Object.fromEntries(headers.map((h, i) => [h, data[i]]));
    const [min, max] = entry.percentage_range.split("-").map(Number);
    return {
      grade_id: parseInt(entry.grade_id),
      grade_code: entry.grade_code,
      grade_label: entry.grade_label,
      min_percentage: min,
      max_percentage: max,
      gpa: parseFloat(entry.gpa_equivalent),
    };
  });
}

async function loadData() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const students = parseStudents();
  const grades = parseGrades();

  const deptMap = new Map();
  const subjectMap = new Map();

  try {
   
    for (const s of students) {
      const dept = s.department.trim();
      if (!deptMap.has(dept)) {
        const [existing] = await conn.execute(
          `SELECT DEPARTMENT_ID FROM DEPARTMENTS WHERE DEPARTMENT_NAME = ?`,
          [dept]
        );

        if (existing.length > 0) {
          deptMap.set(dept, existing[0].DEPARTMENT_ID);
        } else {
          const [rows] = await conn.execute(
            `INSERT INTO DEPARTMENTS (DEPARTMENT_NAME) VALUES (?)`,
            [dept]
          );
          deptMap.set(dept, rows.insertId);
        }
      }
    }

    for (const s of students) {
      const deptId = deptMap.get(s.department.trim());
      const studentId = parseInt(s.student_id);
      const date = new Date(s.joining_date);
      if (isNaN(date)) {
        console.warn(`Skipping student ${studentId} due to invalid date: ${s.joining_date}`);
        continue;
      }

      const [existingStudent] = await conn.execute(
        `SELECT 1 FROM STUDENTS WHERE STUDENTS_ID = ?`,
        [studentId]
      );

      if (existingStudent.length === 0) {
        await conn.execute(
          `INSERT INTO STUDENTS (STUDENTS_ID, STUDENTS_FIRST_NAME, STUDENTS_LAST_NAME, STUDENTS_EMAIL, STUDENTS_DEPARTMENT_ID, STUDENTS_JOINING_DATE)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            studentId,
            s.first_name,
            s.last_name,
            s.email,
            deptId,
            date
          ]
        );
      }

      for (let i = 1; i <= 5; i++) {
        const subject = s[`subject${i}`];
        const marks = s[`subject${i}_marks`] || s[`subject${i}_mark`];
        if (!subject || !marks) continue;

        const key = `${subject}_${deptId}`;
        if (!subjectMap.has(key)) {
          const [existingSubject] = await conn.execute(
            `SELECT SUBJECTS_ID FROM SUBJECTS WHERE SUBJECTS_NAME = ? AND SUBJECTS_DEPARTMENT_ID = ?`,
            [subject, deptId]
          );

          if (existingSubject.length > 0) {
            subjectMap.set(key, existingSubject[0].SUBJECTS_ID);
          } else {
            const [rows] = await conn.execute(
              `INSERT INTO SUBJECTS (SUBJECTS_NAME, SUBJECTS_DEPARTMENT_ID)
               VALUES (?, ?)`,
              [subject, deptId]
            );
            subjectMap.set(key, rows.insertId);
          }
        }

        const subjectId = subjectMap.get(key);

        const [existingMark] = await conn.execute(
          `SELECT 1 FROM MARKS WHERE MARKS_STUDENT_ID = ? AND MARKS_SUBJECT_ID = ?`,
          [studentId, subjectId]
        );

        if (existingMark.length === 0) {
          await conn.execute(
            `INSERT INTO MARKS (MARKS_STUDENT_ID, MARKS_SUBJECT_ID, MARKS_SCORE)
             VALUES (?, ?, ?)`,
            [studentId, subjectId, parseInt(marks)]
          );
        }
      }

      
    }

    for (const g of grades) {
      const [existing] = await conn.execute(
        `SELECT 1 FROM GRADE WHERE GRADE_ID = ?`,
        [g.grade_id]
      );

      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO GRADE (GRADE_ID, GRADE_CODE, GRADE_LABEL, PERCENTAGE_MIN, PERCENTAGE_MAX, GPA)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            g.grade_id,
            g.grade_code,
            g.grade_label,
            g.min_percentage,
            g.max_percentage,
            g.gpa
          ]
        );
      }
    }

    console.log("Data loaded into MySQL successfully.");
  } catch (err) {
    console.error("MySQL Load Error:", err);
  } finally {
    await conn.end();
  }
}

loadData();
