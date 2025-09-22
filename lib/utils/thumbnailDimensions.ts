/**
 * YouTube Thumbnail Dimension Utilities
 * Ensures all generated thumbnails conform to YouTube's official specifications
 */

// YouTube's official thumbnail specifications
export const YOUTUBE_THUMBNAIL = {
  WIDTH: 1280,
  HEIGHT: 720,
  ASPECT_RATIO: 16 / 9,
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
  MIME_TYPE: 'image/jpeg' as const,
  QUALITY: 0.9
} as const;



/**
 * Enforces YouTube thumbnail dimensions on any image
 * @param imageData Base64 image data or data URL
 * @param quality JPEG quality (0-1), defaults to 0.9
 * @returns Promise<string> Base64 encoded JPEG at exactly 1280x720
 */
export async function enforceYouTubeDimensions(
  imageData: string,
  quality: number = YOUTUBE_THUMBNAIL.QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Create canvas with exact YouTube dimensions
        const canvas = document.createElement('canvas');
        canvas.width = YOUTUBE_THUMBNAIL.WIDTH;
        canvas.height = YOUTUBE_THUMBNAIL.HEIGHT;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        const targetWidth = YOUTUBE_THUMBNAIL.WIDTH;
        const targetHeight = YOUTUBE_THUMBNAIL.HEIGHT;

        // Prefill canvas in case filters leave transparent edges
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw a blurred background using cover scaling so edges are filled
        const coverScale = Math.max(targetWidth / img.width, targetHeight / img.height);
        const coverWidth = img.width * coverScale;
        const coverHeight = img.height * coverScale;
        const coverX = (targetWidth - coverWidth) / 2;
        const coverY = (targetHeight - coverHeight) / 2;

        ctx.save();
        ctx.filter = 'blur(40px)';
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, 0, 0, img.width, img.height, coverX, coverY, coverWidth, coverHeight);
        ctx.restore();

        // Now draw the original image using contain scaling so nothing is cropped
        const containScale = Math.min(targetWidth / img.width, targetHeight / img.height);
        const drawWidth = img.width * containScale;
        const drawHeight = img.height * containScale;
        const offsetX = (targetWidth - drawWidth) / 2;
        const offsetY = (targetHeight - drawHeight) / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight);

        // Convert to JPEG with specified quality
        const dataUrl = canvas.toDataURL(YOUTUBE_THUMBNAIL.MIME_TYPE, quality);
        const base64Data = dataUrl.split(',')[1];

        if (!base64Data) {
          reject(new Error('Failed to extract base64 data'));
          return;
        }

        resolve(base64Data);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    // Handle different input formats
    if (imageData.startsWith('data:')) {
      img.src = imageData;
    } else {
      // Assume it's base64 data
      img.src = `data:image/png;base64,${imageData}`;
    }
  });
}

/**
 * Fits an image into the YouTube canvas using contain scaling with transparent padding.
 * Returns a PNG data URL sized exactly 1280x720 without introducing background blur.
 */
export async function fitImageToYouTubeTransparent(imageData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        if (!img.width || !img.height) {
          reject(new Error('Invalid image dimensions'));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = YOUTUBE_THUMBNAIL.WIDTH;
        canvas.height = YOUTUBE_THUMBNAIL.HEIGHT;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawWidth, drawHeight);

        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    if (imageData.startsWith('data:')) {
      img.src = imageData;
    } else {
      img.src = `data:image/png;base64,${imageData}`;
    }
  });
}


/**
 * Enforces YouTube dimensions on multiple images in parallel
 * @param imageDataArray Array of base64 image data or data URLs
 * @param quality JPEG quality (0-1), defaults to 0.9
 * @returns Promise<string[]> Array of base64 encoded JPEGs at exactly 1280x720
 */
export async function enforceYouTubeDimensionsBatch(
  imageDataArray: string[],
  quality: number = YOUTUBE_THUMBNAIL.QUALITY
): Promise<string[]> {
  const promises = imageDataArray.map(imageData =>
    enforceYouTubeDimensions(imageData, quality)
  );

  return Promise.all(promises);
}

/**
 * Validates if an image meets YouTube thumbnail requirements
 * @param imageData Base64 image data or data URL
 * @returns Promise<{isValid: boolean, width: number, height: number, aspectRatio: number}>
 */
export async function validateYouTubeDimensions(imageData: string): Promise<{
  isValid: boolean;
  width: number;
  height: number;
  aspectRatio: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const isValid = img.width === YOUTUBE_THUMBNAIL.WIDTH &&
                     img.height === YOUTUBE_THUMBNAIL.HEIGHT;

      resolve({
        isValid,
        width: img.width,
        height: img.height,
        aspectRatio
      });
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    if (imageData.startsWith('data:')) {
      img.src = imageData;
    } else {
      img.src = `data:image/png;base64,${imageData}`;
    }
  });
}


