#!/usr/bin/env node

/**
 * Test script for Fal AI Flux and Qwen thumbnail generation models
 *
 * Tests:
 * - fal-ai/flux-2-pro/edit (Flux model)
 * - fal-ai/qwen-image-edit/image-to-image (Qwen model)
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  } catch (e) {
    console.warn('Could not load .env.local:', e.message);
  }
}
loadEnv();

const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL_FLUX = "fal-ai/flux-2-pro/edit";
const FAL_MODEL_QWEN = "fal-ai/qwen-image-edit/image-to-image";

// Load a real image from the repo's template-previews
function loadTestImage() {
  const testImagePath = path.join(__dirname, '..', 'public', 'template-previews', 'cinematic.png');
  try {
    const imageBuffer = fs.readFileSync(testImagePath);
    console.log(`✅ Loaded test image: ${testImagePath} (${imageBuffer.length} bytes)`);
    return imageBuffer.toString('base64');
  } catch (e) {
    console.error(`❌ Failed to load test image: ${e.message}`);
    process.exit(1);
  }
}

const TEST_IMAGE_BASE64 = loadTestImage();

async function uploadToFalStorage(apiKey, base64Image, contentType = 'image/png') {
  console.log('📤 Uploading image to Fal storage...');

  // Normalize content type
  const normalizedContentType = contentType.includes(';')
    ? contentType.split(';')[0].trim()
    : contentType || 'image/png';

  // Determine file extension
  const ext = normalizedContentType.split('/')[1] || 'png';
  const fileName = `test-image-${Date.now()}.${ext}`;

  // Step 1: Initiate the upload with JSON body
  const initiateResponse = await fetch(
    'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
    {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content_type: normalizedContentType,
        file_name: fileName,
      })
    }
  );

  if (!initiateResponse.ok) {
    const text = await initiateResponse.text();
    throw new Error(`Fal storage initiate error ${initiateResponse.status}: ${text.substring(0, 200)}`);
  }

  const { upload_url: uploadUrl, file_url: fileUrl } = await initiateResponse.json();

  // Step 2: Upload the image
  const binaryData = Buffer.from(base64Image, 'base64');

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': normalizedContentType },
    body: binaryData,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Fal storage upload error ${uploadResponse.status}: ${text.substring(0, 200)}`);
  }

  console.log(`✅ Image uploaded to: ${fileUrl}`);
  return fileUrl;
}

async function testFalModel(modelName, model) {
  console.log(`\n🧪 Testing ${modelName}...`);
  console.log(`   Model: ${model}`);
  
  try {
    // Upload image first
    const imageUrl = await uploadToFalStorage(FAL_KEY, TEST_IMAGE_BASE64);
    
    const isQwen = model === FAL_MODEL_QWEN;
    const requestBody = isQwen
      ? { prompt: 'A colorful abstract painting', image_url: imageUrl, output_format: 'png' }
      : { prompt: 'A colorful abstract painting', image_urls: [imageUrl], image_size: 'landscape_16_9', output_format: 'png', sync_mode: false };

    console.log('📡 Submitting to Fal queue...');
    const submitResp = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${FAL_KEY}` },
      body: JSON.stringify(requestBody)
    });

    if (!submitResp.ok) {
      const text = await submitResp.text();
      throw new Error(`Submit error ${submitResp.status}: ${text.substring(0, 300)}`);
    }

    const submitResult = await submitResp.json();
    const requestId = submitResult.request_id;
    console.log(`📋 Request ID: ${requestId}`);
    console.log(`📋 Submit Response:`, JSON.stringify(submitResult, null, 2));

    // Use URLs from response if available, otherwise construct them
    // For models with subpaths, extract base model for status/result URLs
    const modelParts = model.split('/');
    const baseModelId = modelParts.length > 2 ? `${modelParts[0]}/${modelParts[1]}` : model;
    const statusUrl = submitResult.status_url || `https://queue.fal.run/${baseModelId}/requests/${requestId}/status`;
    const resultUrl = submitResult.response_url || `https://queue.fal.run/${baseModelId}/requests/${requestId}`;
    console.log(`   Status URL: ${statusUrl}`);
    console.log(`   Result URL: ${resultUrl}`);

    // Poll for completion
    console.log('⏳ Waiting for generation...');
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const statusResp = await fetch(statusUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
      if (!statusResp.ok) {
        console.log(`   Status check failed: ${statusResp.status}`);
        continue;
      }
      
      const statusData = await statusResp.json();
      console.log(`   Status: ${statusData.status} (attempt ${attempts}/${maxAttempts})`);
      
      if (statusData.status === 'COMPLETED') {
        const resultResp = await fetch(resultUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
        if (!resultResp.ok) {
          const errorText = await resultResp.text();
          console.log(`   Result fetch failed: ${resultResp.status} - ${errorText}`);
          throw new Error(`Failed to get result: ${resultResp.status} - ${errorText.substring(0, 200)}`);
        }

        const result = await resultResp.json();
        console.log(`   Result:`, JSON.stringify(result, null, 2).substring(0, 500));
        if (result.images && result.images.length > 0) {
          console.log(`✅ ${modelName} SUCCESS!`);
          console.log(`   Generated image: ${result.images[0].url}`);
          console.log(`   Dimensions: ${result.images[0].width}x${result.images[0].height}`);
          return true;
        }
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Generation failed: ${JSON.stringify(statusData)}`);
      }
    }
    throw new Error('Timeout waiting for generation');
  } catch (error) {
    console.error(`❌ ${modelName} FAILED: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Fal AI Model Test Suite');
  console.log('==========================');
  
  if (!FAL_KEY) {
    console.error('❌ FAL_KEY not found in environment. Set it in .env.local');
    process.exit(1);
  }
  console.log('✅ FAL_KEY found');

  const results = { flux: await testFalModel('Flux', FAL_MODEL_FLUX), qwen: await testFalModel('Qwen', FAL_MODEL_QWEN) };

  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Flux (fal-ai/flux-2-pro/edit): ${results.flux ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Qwen (fal-ai/qwen-image-edit): ${results.qwen ? '✅ PASS' : '❌ FAIL'}`);
  
  process.exit(results.flux && results.qwen ? 0 : 1);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });

