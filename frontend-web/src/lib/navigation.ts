/** Accept rooted, same-origin destinations only, including after URL normalization. */
export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const parsed = new URL(value, 'https://benefy.invalid');
    if (parsed.origin !== 'https://benefy.invalid' || parsed.pathname.startsWith('//')) return null;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}
