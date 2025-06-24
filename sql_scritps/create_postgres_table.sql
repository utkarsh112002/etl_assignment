CREATE TABLE student_academics (
  student_academics_id INTEGER PRIMARY KEY,
  student_academics_first_name VARCHAR(50),
  student_academics_last_name VARCHAR(50),
  student_academics_email VARCHAR(100),
  student_academics_department VARCHAR(100),
  student_academics_joining_date DATE,
  student_academics_gpa NUMERIC(3,2)
);
