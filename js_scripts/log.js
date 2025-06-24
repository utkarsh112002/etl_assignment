const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname,"..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const today = new Date().toISOString().split('T')[0];
const logFilePath = path.join(logDir, `etl_log_${today}.txt`);

function logToFile(message, level = 'info') {
  const timestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  }).replace(',', '');

  const fullMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, fullMessage);
  console.log(fullMessage.trim());
}

module.exports = { logToFile };