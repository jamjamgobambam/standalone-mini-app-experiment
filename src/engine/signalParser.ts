/**
 * Generic parser for the mini-app signal wire format:
 *   [TYPE] KEY {"optional": "json"}
 *
 * e.g. "[KMEANS] ADD_POINT {"x":1.0,"y":2.0,"id":0}"
 *
 * No mini-app-specific logic lives here — any mini-app's signals pass through
 * this same function.
 */

export interface ParsedSignal {
  type: string;
  key: string;
  detail: Record<string, unknown> | null;
}

const SIGNAL_RE = /^\[(\w+)\]\s+(\S+)(?:\s+(\{.*\}))?$/;

export function parseSignal(line: string): ParsedSignal | null {
  const match = SIGNAL_RE.exec(line.trim());
  if (!match) return null;

  const [, type, key, jsonStr] = match;
  let detail: Record<string, unknown> | null = null;

  if (jsonStr) {
    try {
      detail = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return {type, key, detail};
}
