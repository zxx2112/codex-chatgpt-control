import { compactVisibleText } from "./safety/redaction.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  event: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type Logger = {
  log(event: LogEvent): void;
};

export function createMemoryLogger(): Logger & { events: LogEvent[] } {
  const events: LogEvent[] = [];
  return {
    events,
    log(event) {
      events.push(redactLogEvent(event));
    }
  };
}

export function redactLogEvent(event: LogEvent): LogEvent {
  const redacted: LogEvent = {
    level: event.level,
    event: event.event,
    message: compactVisibleText(event.message),
    timestamp: event.timestamp
  };

  if (event.data !== undefined) {
    redacted.data = Object.fromEntries(
      Object.entries(event.data).map(([key, value]) => [
        key,
        typeof value === "string" ? compactVisibleText(value) : value
      ])
    );
  }

  return redacted;
}
