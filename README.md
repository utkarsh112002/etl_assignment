🧪 ETL Assignment – Node.js Based Data Integration Pipeline

📦 Overview

This project implements a complete ETL (Extract, Transform, Load) pipeline using Node.js, MySQL, and PostgreSQL. It performs the following steps:

📥 Extract student and grade data from .txt files

🔄 Transform the raw marks into GPA

📤 Load data into MySQL and then PostgreSQL

🧾 Maintains daily timestamped logs for transparency

⚙️ Setup Instructions

✅ Prerequisites

Node.js v18 or higher

MySQL 8+

PostgreSQL 13+

npm and Git

🛠 Installation Steps

1. Clone the Repository
   git clone <your-repo-url>

2. Install Dependencies
   npm install

3. Configure Environment Variables
   Create a .env file:
    # MySQL Config
    MYSQL_HOST=localhost
    MYSQL_USER=root
    MYSQL_PASSWORD=your_mysql_password
    MYSQL_DATABASE=etl_db

    # PostgreSQL Config
    PG_HOST=localhost
    PG_USER=postgres
    PG_PASSWORD=your_pg_password
    PG_DATABASE=etl_results
    PG_PORT=5432

4. Create Database Schemas
   MySQL:
     cd sql_scripts
     mysql -u root -p <db_name> < create_mysql_tables.sql
   PostgreSQL:
     cd sql_scripts
     psql -U postgres -d <db_name> -f create_postgres_table.sql


📄 Input Files

    File                    Purpose

    students.txt            Student data with subjects and marks

    grade.txt               Grade-to-GPA mapping by percentage range

✅ Ensure headers are properly defined and data is clean.

▶️ Running the Scripts

1. Load Student Data into MySQL
   node js_scripts\load_to_mysql.js

   Functionality:
   1. Parses and validates student & grade data
   2. Inserts into MySQL tables (Departments, Students, Subjects, Marks, Grades)
   3. Skips duplicate entries
   4. Logs all events

2. Transfer GPA to PostgreSQL
   node js_scrips\mysql_to_postgres.js

   Functionality:
   1. Calculates GPA using grade.txt mapping
   2. Validates and inserts student academics into PostgreSQL
   3. Logs all successful and failed operations

3. Purge Data from Both Databases
   node js_scripts\purge.js

   Functionality:
   1. Deletes all records from MySQL and PostgreSQL
   2. Useful for resetting the system

📝 Logging

   Daily log files in logs/

   Format: etl_log_YYYY-MM-DD.txt

   Each line: [timestamp] ✅/⚠️/❌ message

   Logs cover:

   File validations

   Record insertions

   Skipped entries

   DB errors
