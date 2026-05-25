const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function resolveLogLevel() {
  const configured = (process.env.LOG_LEVEL || "info").trim().toLowerCase();
  return LOG_LEVELS[configured] ? configured : "info";
}

const ACTIVE_LEVEL = resolveLogLevel();
const ACTIVE_WEIGHT = LOG_LEVELS[ACTIVE_LEVEL];
const SERVICE_NAME = process.env.SERVICE_NAME || "sweetstop-pos-server";

function safeSerialize(entry) {
  try {
    return JSON.stringify(entry);
  } catch {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: SERVICE_NAME,
      message: "Failed to serialize log entry."
    });
  }
}

function shouldLog(level) {
  const weight = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  return weight >= ACTIVE_WEIGHT;
}

function write(level, message, details = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    ...details
  };
  const serialized = safeSerialize(entry);

  if (level === "error" || level === "warn") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  debug(message, details) {
    write("debug", message, details);
  },
  info(message, details) {
    write("info", message, details);
  },
  warn(message, details) {
    write("warn", message, details);
  },
  error(message, details) {
    write("error", message, details);
  }
};
