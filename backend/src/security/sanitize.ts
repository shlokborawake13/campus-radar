/**
 * Sanitizes text by encoding HTML special characters as entities.
 * This prevents XSS while preserving the original text meaning
 * (e.g., math expressions like "a < b" become "a &lt; b" instead of being silently corrupted).
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      result[key] = sanitizeArray(value);
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function sanitizeArray(arr: any[]): any[] {
  return arr.map((item) => {
    if (typeof item === 'string') {
      return sanitizeText(item);
    } else if (Array.isArray(item)) {
      return sanitizeArray(item);
    } else if (item && typeof item === 'object') {
      return sanitizeObject(item);
    }
    return item;
  });
}

