/**
 * Small XML helpers shared by the formatters
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape any value for XML text or attributes; empty or missing values become ''.
 * Matches the behaviour the formatters have always had (falsy values render empty).
 */
export function escapeXmlText(value: unknown): string {
  if (!value) return '';
  return escapeXml(typeof value === 'string' ? value : String(value));
}

type AttrValue = string | number | boolean | undefined | null;

/** Build an XML attribute string, skipping undefined and null values */
export function xmlAttrs(values: Record<string, AttrValue>): string {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
    .join('');
}
