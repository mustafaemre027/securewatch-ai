export function getSafeRedirect(path: string | undefined | null): string {
  if (!path || typeof path !== 'string') return '/';

  // Must start with exactly one slash. Reject protocol-relative // or \\
  if (path.startsWith('//') || path.startsWith('\\\\')) return '/';
  if (!path.startsWith('/')) return '/';

  try {
    const url = new URL(path, 'http://localhost'); // Dummy base to parse safely

    if (url.protocol !== 'http:' || url.host !== 'localhost') {
      return '/';
    }

    // Ensure no sensitive query params are leaked
    if (url.searchParams.has('access_token') || url.searchParams.has('password') || url.searchParams.has('token')) {
      url.searchParams.delete('access_token');
      url.searchParams.delete('password');
      url.searchParams.delete('token');
    }

    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
