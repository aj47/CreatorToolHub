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

        // Calculate scaling to maintain aspect ratio while filling the canvas
        const sourceAspect = img.width / img.height;
        const targetAspect = YOUTUBE_THUMBNAIL.ASPECT_RATIO;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (sourceAspect > targetAspect) {
          // Source is wider - fit to height, crop width
          drawHeight = YOUTUBE_THUMBNAIL.HEIGHT;
          drawWidth = drawHeight * sourceAspect;
          offsetX = (YOUTUBE_THUMBNAIL.WIDTH - drawWidth) / 2;
          offsetY = 0;
        } else {
          // Source is taller - fit to width, crop height
          drawWidth = YOUTUBE_THUMBNAIL.WIDTH;
          drawHeight = drawWidth / sourceAspect;
          offsetX = 0;
          offsetY = (YOUTUBE_THUMBNAIL.HEIGHT - drawHeight) / 2;
        }

        // Fill with black background (in case of letterboxing)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, YOUTUBE_THUMBNAIL.WIDTH, YOUTUBE_THUMBNAIL.HEIGHT);
        
        // Draw the image scaled and centered
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
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


