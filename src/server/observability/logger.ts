import { getEnvironment } from "../config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  errorCode?: string;
  component?: string;
}

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  try {
    return levelPriority[level] >= levelPriority[getEnvironment().LOG_LEVEL];
  } catch {
    return level !== "debug";
  }
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
  if (!shouldLog(level)) {
    return;
  }

  // The explicit allow-list keeps user content, credentials, and exception details
  // out of logs by construction. Add technical fields here only when they are safe.
  const {
    requestId,
    correlationId,
    method,
    path,
    status,
    durationMs,
    errorCode,
    component,
  } = context;
  const record = {
    timestamp: new Date().toISOString(),
    service: "taskfella",
    level,
    event,
    requestId,
    correlationId,
    method,
    path,
    status,
    durationMs,
    errorCode,
    component,
  };
  const serialized = JSON.stringify(record);

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug(event: string, context?: LogContext): void {
    write("debug", event, context);
  },
  info(event: string, context?: LogContext): void {
    write("info", event, context);
  },
  warn(event: string, context?: LogContext): void {
    write("warn", event, context);
  },
  error(event: string, context?: LogContext): void {
    write("error", event, context);
  },
};
