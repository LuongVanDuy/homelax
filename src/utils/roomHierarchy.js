// Shared image URL helper; inventory counts and relationships belong to the API.
const FALLBACK_IMAGE = '';

export function getValidImageUrl(url, fallback = FALLBACK_IMAGE) {
  if (typeof url === 'string') {
    const trimmed = url.trim();
    if (
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      trimmed.startsWith('/') ||
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }
  }
  return fallback;
}

