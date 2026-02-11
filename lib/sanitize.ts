const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Sanitize a user-provided string by escaping HTML entities.
 * Also trims whitespace and limits length.
 */
export function sanitize(input: string, maxLength = 50): string {
  const trimmed = input.trim().slice(0, maxLength);
  return trimmed.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Validate a display name: must be 1-30 chars, alphanumeric + spaces + common punctuation.
 */
export function isValidDisplayName(name: string): boolean {
  if (name.trim().length < 1 || name.trim().length > 30) return false;
  return /^[\w\s\-'.!?]+$/.test(name.trim());
}

/**
 * Validate a team name: must be 1-30 chars.
 */
export function isValidTeamName(name: string): boolean {
  if (name.trim().length < 1 || name.trim().length > 30) return false;
  return /^[\w\s\-'.!?]+$/.test(name.trim());
}
