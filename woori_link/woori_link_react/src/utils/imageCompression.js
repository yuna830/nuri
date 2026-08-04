const MB = 1024 * 1024;

export const TARGET_IMAGE_BYTES = 8 * MB;
export const MAX_SOURCE_IMAGE_BYTES = 50 * MB;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('이미지를 압축하지 못했습니다. 다른 사진을 선택해 주세요.'));
    }, type, quality);
  });
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
      image.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function compressedFileName(fileName = 'product-label') {
  const stem = fileName.replace(/\.[^/.]+$/, '') || 'product-label';
  return `${stem}-compressed.jpg`;
}

/**
 * 서버 업로드 전에 이미지 크기를 제한한다.
 * 8MB 이하는 원본을 유지하고, 초과 이미지는 JPEG로 리사이즈·압축한다.
 */
export async function prepareImageForUpload(file, {
  targetBytes = TARGET_IMAGE_BYTES,
  maxSourceBytes = MAX_SOURCE_IMAGE_BYTES,
  maxDimension = 2560,
} = {}) {
  if (!(file instanceof Blob) || !file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('JPG, PNG 또는 WEBP 이미지 파일을 선택해 주세요.');
  }

  if (file.size > maxSourceBytes) {
    throw new Error('원본 이미지는 50MB 이하여야 합니다. 더 작은 사진을 선택해 주세요.');
  }

  if (file.size <= targetBytes) {
    return file;
  }

  const loaded = await loadImage(file);

  try {
    if (!loaded.width || !loaded.height) {
      throw new Error('이미지 크기를 확인하지 못했습니다.');
    }

    const initialScale = Math.min(1, maxDimension / Math.max(loaded.width, loaded.height));
    let width = Math.max(1, Math.round(loaded.width * initialScale));
    let height = Math.max(1, Math.round(loaded.height * initialScale));
    let quality = 0.88;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('이 브라우저에서는 이미지 압축을 사용할 수 없습니다.');
    }

    let compressedBlob;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(loaded.source, 0, 0, width, height);

      compressedBlob = await canvasToBlob(canvas, 'image/jpeg', quality);

      if (compressedBlob.size <= targetBytes) {
        return new File(
          [compressedBlob],
          compressedFileName(file.name),
          {
            type: 'image/jpeg',
            lastModified: Date.now(),
          },
        );
      }

      if (quality > 0.58) {
        quality = Math.max(0.58, quality - 0.1);
      } else {
    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
        quality = 0.82;
      }
    }

    throw new Error('사진 용량을 8MB 이하로 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.');
  } finally {
    loaded.cleanup();
  }
}
