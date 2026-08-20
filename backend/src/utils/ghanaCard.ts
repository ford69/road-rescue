const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/;

export const ghanaCardMessage = 'Use Ghana Card format GHA-123456789-0';

export function normalizeGhanaCard(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGhanaCard(value: string): boolean {
  return GHANA_CARD_PATTERN.test(normalizeGhanaCard(value));
}
