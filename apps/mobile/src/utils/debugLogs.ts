type LogEntry = { timestamp: number; message: string; data?: unknown };
type Listener = () => void;

const MAX_LOGS = 200;
const STORAGE_KEY = "nailfolio_debug_logs";

let logs: LogEntry[] = [];
let listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

function truncate(value: unknown, maxLength = 300): unknown {
  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
  if (value && typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json.length > maxLength) {
        return { ...(value as Record<string, unknown>), _truncated: true };
      }
    } catch {
      // ignore JSON errors
    }
  }
  return value;
}

export function debugLog(message: string, data?: unknown) {
  const entry: LogEntry = { timestamp: Date.now(), message, data: truncate(data) };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
  try {
    console.log(`[DEBUG] ${message}`, data ?? "");
  } catch {
    // ignore console errors when bridge is down
  }
  notify();
}

export function getDebugLogs(): LogEntry[] {
  return [...logs];
}

export function clearDebugLogs() {
  logs = [];
  notify();
}

export async function persistDebugLogs() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore storage errors
  }
}

export async function restoreDebugLogs() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LogEntry[];
      if (Array.isArray(parsed)) {
        logs = parsed.slice(-MAX_LOGS);
        notify();
      }
    }
  } catch {
    // ignore restore errors
  }
}

export function onDebugLogsChanged(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function flushDebugLogs() {
  persistDebugLogs().catch(() => {
    // ignore flush errors
  });
}
