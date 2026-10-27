import { getValidImageUrl } from './roomHierarchy.js';

const VARIANT_CONFIGS = {
  thumbnail: {
    width: 600,
    quality: 80,
    format: 'webp',
  },
  thumbnail_small: {
    width: 400,
    quality: 75,
    format: 'webp',
  },
  detail: {
    width: 1200,
    quality: 85,
    format: 'webp',
  },
  fullscreen: {
    width: 1600,
    quality: 80,
    format: 'webp',
  },
  original: {
    width: null,
    quality: null,
    format: null,
  }
};

/**
 * Transforms an image URL to a lightweight, responsive WebP variant on-the-fly.
 * Preserves the original file untouched on the server/storage.
 * 
 * @param {string} rawUrl - Source image URL
 * @param {Object} options - { variant: 'thumbnail' | 'detail' | 'fullscreen' | 'original', width, quality, format }
 * @returns {string} Transformed image URL
 */
export function getTransformedImageUrl(rawUrl, options = {}) {
  const validUrl = getValidImageUrl(rawUrl);
  if (!validUrl) return '';

  const variant = options.variant || 'thumbnail';
  if (variant === 'original' || variant === 'fullscreen_raw') {
    return validUrl;
  }

  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.thumbnail;
  const targetWidth = options.width || config.width;
  const targetQuality = options.quality || config.quality || 80;
  const targetFormat = options.format || config.format || 'webp';
  const targetResize = options.resize || 'contain';

  // 1. Data URLs (base64) & Blob URLs - cannot transform via CDN/Server URL
  if (validUrl.startsWith('data:') || validUrl.startsWith('blob:')) {
    return validUrl;
  }

  // 2. Historical Supabase image URL compatibility (read-only)
  // Replaces /storage/v1/object/public/ with /storage/v1/render/image/public/
  // Ensures clean query params and WebP output
  if (validUrl.includes('supabase.co/storage/v1/object/public/') || validUrl.includes('supabase.co/storage/v1/render/image/public/')) {
    const cleanUrl = validUrl.split('?')[0];
    const transformedBase = cleanUrl.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    );
    return `${transformedBase}?width=${targetWidth}&resize=${targetResize}&quality=${targetQuality}&format=${targetFormat}`;
  }

  // 3. Local Uploads (/uploads/...) - Handled by local backend transform endpoint
  if (validUrl.startsWith('/uploads/') || validUrl.includes('/uploads/upload_')) {
    const cleanPath = validUrl.startsWith('http') 
      ? new URL(validUrl).pathname 
      : validUrl;
    return `/api/v2/images/transform?url=${encodeURIComponent(cleanPath)}&w=${targetWidth}&q=${targetQuality}&fmt=${targetFormat}`;
  }

  // 4. Unsplash Images
  if (validUrl.includes('images.unsplash.com')) {
    try {
      const u = new URL(validUrl);
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', String(targetQuality));
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    } catch {
      return validUrl;
    }
  }

  return validUrl;
}

/**
 * Generates standard srcset for responsive image tags
 */
export function getImageSrcSet(rawUrl, variant = 'thumbnail') {
  const validUrl = getValidImageUrl(rawUrl);
  if (!validUrl || validUrl.startsWith('data:') || validUrl.startsWith('blob:')) {
    return undefined;
  }

  if (variant === 'original') return undefined;

  const w400 = getTransformedImageUrl(validUrl, { width: 400, quality: 75 });
  const w600 = getTransformedImageUrl(validUrl, { width: 600, quality: 80 });
  const w1200 = getTransformedImageUrl(validUrl, { width: 1200, quality: 85 });

  return `${w400} 400w, ${w600} 600w, ${w1200} 1200w`;
}
