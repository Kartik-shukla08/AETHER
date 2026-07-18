const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Matches US and Indian phone formats (10 digits total, 5-5 split, 3-3-4 split, or standard parenthesis formats)
const PHONE_REGEX = /(?:\+?\d{1,3}[-\s]?)?(?:\b\d{10}\b|\b\d{5}[-\s]\d{5}\b|\b\d{3}[-\s.-]\d{3}[-\s.-]\d{4}\b|\(\d{3}\)[-\s.-]?\d{3}[-\s.-]?\d{4}\b)/g;

// Matches 13 to 16 digits with optional spaces or hyphens
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

// Matches 12 digits with optional spaces or hyphens (typical 4-4-4 Aadhaar format)
const AADHAAR_REGEX = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;

// Indian Permanent Account Number (PAN): 5 letters, 4 digits, 1 letter
const PAN_REGEX = /\b[a-zA-Z]{5}\d{4}[a-zA-Z]\b/g;

/**
 * Redacts a raw string by replacing email, credit card, Aadhaar, PAN, and phone number patterns
 */
export function redactString(val: string): string {
  if (!val) return val;

  // Ordering matters to prevent overlaps (e.g. replacing a 12-digit number as phone before Aadhaar)
  return val
    .replace(EMAIL_REGEX, '[EMAIL]')
    .replace(CREDIT_CARD_REGEX, '[CREDIT_CARD]')
    .replace(AADHAAR_REGEX, '[AADHAAR]')
    .replace(PAN_REGEX, '[PAN]')
    .replace(PHONE_REGEX, '[PHONE]');
}

/**
 * Recursively traverses a JSON object / primitive and redacts string values
 */
export function redactObject(obj: any): any {
  if (typeof obj === 'string') {
    return redactString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = redactObject(obj[key]);
    }
    return newObj;
  }
  return obj;
}

/**
 * Smart redaction that checks if the string is stringified JSON.
 * If yes, it parses, redacts recursively, and stringifies back.
 * If not, it redacts it directly as a raw string.
 */
export function redact(val: string): string {
  if (!val) return val;
  try {
    const parsed = JSON.parse(val);
    const redacted = redactObject(parsed);
    return JSON.stringify(redacted);
  } catch (e) {
    // If not valid JSON, treat as raw text
    return redactString(val);
  }
}
