import { describe, expect, it } from 'vitest';
import { isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';

describe('Ghana phone validation', () => {
  it('accepts local and international formats', () => {
    expect(normalizeGhanaPhone('0241234567')).toBe('+233241234567');
    expect(normalizeGhanaPhone('+233241234567')).toBe('+233241234567');
    expect(normalizeGhanaPhone('0201234567')).toBe('+233201234567');
    expect(isValidGhanaPhone('0551234567')).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(isValidGhanaPhone('+15551234567')).toBe(false);
    expect(isValidGhanaPhone('0111234567')).toBe(false);
    expect(isValidGhanaPhone('123')).toBe(false);
  });
});
