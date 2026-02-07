const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "../../logs");

// logs folder auto create
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, "weekly-payout.log");

function logMessage(message) {
  const time = new Date().toISOString(); // date + time
  const log = `[${time}] ${message}\n`;

  fs.appendFileSync(logFile, log, "utf8");
}

module.exports = logMessage;
