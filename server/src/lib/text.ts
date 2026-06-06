/**
 * Truncate text to `max` characters, appending an ellipsis when clipped. Used
 * to keep attacker-controllable ticket text from bloating (and inflating the
 * cost of) AI prompts. Shared by the draft/auto-resolve prompt and the KB
 * gap-analysis prompt.
 */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Escape XML metacharacters so attacker-controlled text can't break out of the
 * <tag> delimiters used to fence untrusted content in AI prompts. Without this a
 * ticket body containing a literal `</message>` could close the data context and
 * smuggle instructions into the model. Escapes the five XML predefined entities;
 * `"`/`'` matter because some prompts place untrusted values in tag attributes
 * (e.g. <message name="...">). `&` must be replaced first.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
