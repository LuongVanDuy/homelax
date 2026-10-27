export function affiliateShareUrl(href: string, token: string) {
  const url = new URL(href);
  url.searchParams.set('ref', token);
  return url.toString();
}

export async function sharePublicUrl(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      // Dismissing the native sheet must not copy or show an error.
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
