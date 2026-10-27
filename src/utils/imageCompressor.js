/**
 * Utility for client-side image compression and resizing before upload
 * Prevents Vercel Serverless Function 4.5MB Payload Limit (413 Payload Too Large)
 * Optimizes network transfer speed and reduces image upload/network transfer.
 */

const MAX_DIMENSION = 1600; // Max width or height in px (optimal for full HD / 2K displays)
const JPEG_QUALITY = 0.82;   // 82% quality yields high fidelity with ~85% file size reduction
const MAX_ORIGINAL_SIZE_BYTES = 25 * 1024 * 1024; // 25MB max raw file

/**
 * Compresses an image File or Blob into a lightweight base64 JPEG string
 * @param {File|Blob} file - Original image file from input
 * @param {Object} options - { maxDimension, quality }
 * @returns {Promise<{ base64: string, width: number, height: number, sizeBytes: number }>}
 */
export async function compressImageClientSide(file, options = {}) {
  const maxDim = options.maxDimension || MAX_DIMENSION;
  const quality = options.quality || JPEG_QUALITY;

  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Tập tin không phải là hình ảnh hợp lệ.');
  }

  if (file.size > MAX_ORIGINAL_SIZE_BYTES) {
    throw new Error('Dung lượng ảnh gốc quá lớn (tối đa 25MB mỗi ảnh).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Không thể đọc tập tin hình ảnh.'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể giải mã hình ảnh để nén.'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional dimensions
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original base64 if canvas is unavailable
          return resolve({
            base64: e.target.result,
            width: img.width,
            height: img.height,
            sizeBytes: file.size
          });
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        const approxBytes = Math.round((compressedBase64.length * 3) / 4);

        resolve({
          base64: compressedBase64,
          width,
          height,
          sizeBytes: approxBytes
        });
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
