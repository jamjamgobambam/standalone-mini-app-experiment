/** Tracks all active timeouts so they can be cleared in bulk (e.g. on reset). */

const timeoutIds: ReturnType<typeof window.setTimeout>[] = [];

export function setTimeout(
  fn: () => void,
  delay: number
): ReturnType<typeof window.setTimeout> {
  const id = window.setTimeout(fn, delay);
  timeoutIds.push(id);
  return id;
}

export function clearTimeouts(): void {
  timeoutIds.forEach(id => window.clearTimeout(id));
  timeoutIds.length = 0;
}

export function clearTimeout(
  id: ReturnType<typeof window.setTimeout>
): void {
  window.clearTimeout(id);
  const index = timeoutIds.indexOf(id);
  if (index > -1) timeoutIds.splice(index, 1);
}
