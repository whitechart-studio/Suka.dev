export type LogLevel = "info" | "warn" | "error";

export interface SukaLogger {
  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void;
}

export function createJsonLogger(write: (value: string) => void = (value) => process.stdout.write(value)): SukaLogger {
  return {
    log(level, message, fields = {}) {
      write(`${JSON.stringify({
        ...fields,
        level,
        message,
        service: "suka-server",
        timestamp: new Date().toISOString()
      })}\n`);
    }
  };
}
