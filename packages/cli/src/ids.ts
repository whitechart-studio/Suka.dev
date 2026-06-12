export function createPointerId(prefix = "ptr", now = new Date()): string {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

