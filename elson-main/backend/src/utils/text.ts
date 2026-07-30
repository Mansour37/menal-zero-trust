/**
 * Decode the small set of HTML named/numeric entities that appear in our
 * scraped corpora (un_corpus, opus100). Not a full HTML decoder — just the
 * ones we've actually observed polluting source phrases.
 *
 * Replace order matters: handle &amp; LAST so we don't double-decode
 * sequences like `&amp;apos;`. None of our current data has those, but
 * keeping the order safe protects future imports.
 */
const NAMED: Record<string, string> = {
  "&apos;": "'",
  "&quot;": '"',
  "&lt;":   "<",
  "&gt;":   ">",
  "&nbsp;": " ",
};

export function decodeHtmlEntities(input: string): string {
  if (!input || input.indexOf("&") === -1) return input;
  let out = input;
  for (const [entity, char] of Object.entries(NAMED)) {
    if (out.indexOf(entity) !== -1) out = out.split(entity).join(char);
  }
  // Numeric: &#39;, &#x27;, etc. Limit codepoints to safe BMP range to avoid surprises.
  out = out.replace(/&#(\d{1,5});/g, (_, n) => {
    const code = parseInt(n, 10);
    return code > 0 && code < 0x10000 ? String.fromCharCode(code) : _;
  });
  out = out.replace(/&#x([0-9a-fA-F]{1,4});/g, (_, h) => {
    const code = parseInt(h, 16);
    return code > 0 && code < 0x10000 ? String.fromCharCode(code) : _;
  });
  // &amp; LAST
  if (out.indexOf("&amp;") !== -1) out = out.split("&amp;").join("&");
  return out;
}
