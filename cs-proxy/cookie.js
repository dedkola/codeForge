/**
 * Simple cookie parser — avoids adding a dependency for a trivial operation.
 * @param {string} header - The Cookie header value
 * @returns {Record<string, string>}
 */
function parse(header) {
  const result = {};
  if (!header) return result;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

module.exports = { parse };
