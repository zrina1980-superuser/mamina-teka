export interface CompressedImageResult {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64Index = dataUrl.indexOf(',');
  if (base64Index === -1) return dataUrl.length;
  const base64Length = dataUrl.length - (base64Index + 1);
  return Math.round((base64Length * 3) / 4);
}

/**
 * Processes any photo (handwritten manuscript or finished dish photo) via HTML5 Canvas
 * before saving to IndexedDB / Cloud Firestore:
 * - Maximum width/height: 1600 px (maintaining original aspect ratio)
 * - Format: WebP at 0.82 quality (with automatic fallback to JPEG at 0.82 quality if WebP is unsupported)
 * - Reduces 10+ MB camera photos to ~180–300 KB without losing handwriting sharpness.
 */
export async function compressImageToWebPOrJpeg(
  input: File | Blob | string,
  maxDimension = 1600,
  quality = 0.82
): Promise<CompressedImageResult> {
  let sourceUrl = '';
  let revokeAfter = false;
  let originalBytes = 0;

  if (typeof input === 'string') {
    sourceUrl = input;
    originalBytes = estimateDataUrlBytes(input);
    // Keep lightweight inline SVG data URIs as-is if they are already tiny (< 40 KB)
    if (input.startsWith('data:image/svg+xml') && originalBytes < 40_000) {
      return {
        dataUrl: input,
        mimeType: 'image/svg+xml',
        width: 800,
        height: 540,
        originalBytes,
        compressedBytes: originalBytes,
      };
    }
  } else {
    originalBytes = input.size;
    sourceUrl = URL.createObjectURL(input);
    revokeAfter = true;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = (err) => reject(err);
      el.src = sourceUrl;
    });

    const origW = img.naturalWidth || img.width || 1200;
    const origH = img.naturalHeight || img.height || 900;

    let targetW = origW;
    let targetH = origH;

    if (origW > maxDimension || origH > maxDimension) {
      if (origW >= origH) {
        targetW = maxDimension;
        targetH = Math.max(1, Math.round((origH * maxDimension) / origW));
      } else {
        targetH = maxDimension;
        targetW = Math.max(1, Math.round((origW * maxDimension) / origH));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    // Fill warm ivory background in case of transparent PNG inputs
    ctx.fillStyle = '#FAF6F0';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Try WebP first (0.82 quality), fallback to JPEG (0.82 quality) if browser doesn't encode WebP
    let dataUrl = canvas.toDataURL('image/webp', quality);
    let mimeType = 'image/webp';

    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      mimeType = 'image/jpeg';
    }

    const compressedBytes = estimateDataUrlBytes(dataUrl);

    return {
      dataUrl,
      mimeType,
      width: targetW,
      height: targetH,
      originalBytes: originalBytes || compressedBytes,
      compressedBytes,
    };
  } finally {
    if (revokeAfter && sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

export function formatBytesKb(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
