/**
 * Lightweight structured logger for server-side code.
 * Outputs JSON lines in production, readable format in dev.
 * Zero dependencies.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

type Level = "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

function format(level: Level, message: string, payload?: LogPayload): string {
  if (IS_PRODUCTION) {
    return JSON.stringify({
      level,
      msg: message,
      ts: new Date().toISOString(),
      ...payload,
    });
  }
  const prefix = { info: "ℹ️", warn: "⚠️", error: "❌" }[level];
  const extra = payload ? ` ${JSON.stringify(payload)}` : "";
  return `${prefix} [${level.toUpperCase()}] ${message}${extra}`;
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    console.log(format("info", message, payload));
  },
  warn(message: string, payload?: LogPayload) {
    console.warn(format("warn", message, payload));
  },
  error(message: string, payload?: LogPayload) {
    console.error(format("error", message, payload));
  },
};
