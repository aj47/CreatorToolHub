/**
 * Fal AI Client Utilities
 *
 * This module provides utilities for interacting with the Fal AI API
 * for image editing.
 */

import { fal } from "@fal-ai/client";
import { FAL_MODEL_FLUX, FalModel } from "./types/refinement";

export interface FalEditImageInput {
  prompt: string;
  image_urls: string[];
  model?: FalModel;
  image_size?: 
    | "auto" 
    | "square_hd" 
    | "square" 
    | "portrait_4_3" 
    | "portrait_16_9" 
    | "landscape_4_3" 
    | "landscape_16_9"
    | { width: number; height: number };
  enable_prompt_expansion?: boolean;
  seed?: number;
  output_format?: "jpeg" | "png" | "webp";
  sync_mode?: boolean;
}

export interface FalImageFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface FalEditImageOutput {
  images: FalImageFile[];
  seed: number;
}

/**
 * Initialize Fal client with API key
 */
export function initializeFalClient(apiKey: string) {
  fal.config({
    credentials: apiKey
  });
}

/**
 * Edit an image using the Fal AI model
 *
 * @param input - The input parameters for image editing
 * @returns Promise with the edited images and seed
 */
export async function editImageWithFal(
  input: FalEditImageInput
): Promise<{ data: FalEditImageOutput; requestId: string }> {
  // Use the specified model or default to Flux
  const modelToUse = input.model || FAL_MODEL_FLUX;
  const result = await fal.subscribe(modelToUse, {
    input: {
      prompt: input.prompt,
      image_urls: input.image_urls,
      image_size: input.image_size || "auto",
      enable_prompt_expansion: input.enable_prompt_expansion || false,
      seed: input.seed,
      output_format: input.output_format || "png",
      sync_mode: input.sync_mode || false
    },
    logs: false,
  });

  return result as { data: FalEditImageOutput; requestId: string };
}

/**
 * Upload a file to Fal storage and get a URL
 *
 * @param file - The file to upload (File or Blob)
 * @returns Promise with the uploaded file URL
 */
export async function uploadToFalStorage(file: File | Blob): Promise<string> {
  return await fal.storage.upload(file);
}

/**
 * Convert a base64 data URI to a File object
 * 
 * @param dataUri - Base64 data URI (e.g., "data:image/png;base64,...")
 * @param filename - Optional filename
 * @returns File object
 */
export function dataUriToFile(dataUri: string, filename: string = "image.png"): File {
  const arr = dataUri.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

