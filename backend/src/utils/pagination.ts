export function encodeCursor(date: Date, id: string): string {
  const payload = `${date.toISOString()}###${id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursorStr: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const [dateStr, id] = raw.split('###');
    if (!dateStr || !id) return null;
    const createdAt = new Date(dateStr);
    if (isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
