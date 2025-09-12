#!/usr/bin/env node

/**
 * Cloud Storage Testing Script
 * 
 * This script tests the cloud storage functionality by making API calls
 * to validate CRUD operations for templates, images, and settings.
 * 
 * Usage:
 *   node scripts/test-cloud-storage.js [base-url]
 * 
 * Example:
 *   node scripts/test-cloud-storage.js http://localhost:3000
 *   node scripts/test-cloud-storage.js https://creatortoolhub.com
 */

const baseUrl = process.argv[2] || 'http://localhost:3000';

// Mock authentication token for testing
// In real testing, you'd need a valid Google OAuth token
const mockAuthToken = 'mock-token-for-testing';

class CloudStorageTest {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'Cookie': `auth-token=${mockAuthToken}`
    };
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }

  async testTemplates() {
    console.log('\n🧪 Testing Templates...');
    
    try {
      // Create template
      console.log('  Creating template...');
      const template = await this.request('/api/user/templates', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Template',
          prompt: 'A test template for validation',
          colors: ['#ff0000', '#00ff00', '#0000ff']
        })
      });
      console.log('  ✅ Template created:', template.id);
      
      // List templates
      console.log('  Listing templates...');
      const templates = await this.request('/api/user/templates');
      console.log(`  ✅ Found ${templates.length} templates`);
      
      // Update template
      console.log('  Updating template...');
      await this.request(`/api/user/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Test Template',
          colors: ['#ffffff', '#000000']
        })
      });
      console.log('  ✅ Template updated');
      
      // Get specific template
      console.log('  Getting specific template...');
      const updatedTemplate = await this.request(`/api/user/templates/${template.id}`);
      console.log('  ✅ Template retrieved:', updatedTemplate.title);
      
      // Delete template
      console.log('  Deleting template...');
      await this.request(`/api/user/templates/${template.id}`, {
        method: 'DELETE'
      });
      console.log('  ✅ Template deleted');
      
    } catch (error) {
      console.log('  ❌ Template test failed:', error.message);
      return false;
    }
    
    return true;
  }

  async testImages() {
    console.log('\n🖼️  Testing Images...');
    
    try {
      // Create a test image blob
      const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const blob = await fetch(testImageData).then(r => r.blob());
      
      // Upload frame image
      console.log('  Uploading frame image...');
      const formData = new FormData();
      formData.append('file', blob, 'test-frame.png');
      formData.append('image_type', 'frame');
      
      const frameImage = await fetch(`${this.baseUrl}/api/user/images`, {
        method: 'POST',
        headers: { 'Cookie': `auth-token=${mockAuthToken}` },
        body: formData
      }).then(r => r.json());
      console.log('  ✅ Frame image uploaded:', frameImage.id);
      
      // Upload reference image
      console.log('  Uploading reference image...');
      const refFormData = new FormData();
      refFormData.append('file', blob, 'test-ref.png');
      refFormData.append('image_type', 'reference');
      
      const refImage = await fetch(`${this.baseUrl}/api/user/images`, {
        method: 'POST',
        headers: { 'Cookie': `auth-token=${mockAuthToken}` },
        body: refFormData
      }).then(r => r.json());
      console.log('  ✅ Reference image uploaded:', refImage.id);
      
      // List all images
      console.log('  Listing all images...');
      const allImages = await this.request('/api/user/images');
      console.log(`  ✅ Found ${allImages.length} total images`);
      
      // List frame images only
      console.log('  Listing frame images...');
      const frameImages = await this.request('/api/user/images?type=frame');
      console.log(`  ✅ Found ${frameImages.length} frame images`);
      
      // List reference images only
      console.log('  Listing reference images...');
      const refImages = await this.request('/api/user/images?type=reference');
      console.log(`  ✅ Found ${refImages.length} reference images`);
      
      // Delete images
      console.log('  Deleting frame image...');
      await this.request(`/api/user/images/${frameImage.id}`, {
        method: 'DELETE'
      });
      console.log('  ✅ Frame image deleted');
      
      console.log('  Deleting reference image...');
      await this.request(`/api/user/images/${refImage.id}`, {
        method: 'DELETE'
      });
      console.log('  ✅ Reference image deleted');
      
    } catch (error) {
      console.log('  ❌ Image test failed:', error.message);
      return false;
    }
    
    return true;
  }

  async testSettings() {
    console.log('\n⚙️  Testing Settings...');
    
    try {
      // Get initial settings
      console.log('  Getting initial settings...');
      const initialSettings = await this.request('/api/user/settings');
      console.log('  ✅ Initial settings retrieved');
      
      // Update settings
      console.log('  Updating settings...');
      const updatedSettings = await this.request('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({
          favorites: { 'template1': true, 'template2': false },
          show_only_favs: true
        })
      });
      console.log('  ✅ Settings updated');
      
      // Verify settings
      console.log('  Verifying settings...');
      const verifySettings = await this.request('/api/user/settings');
      if (verifySettings.show_only_favs === true) {
        console.log('  ✅ Settings verified');
      } else {
        throw new Error('Settings not properly saved');
      }
      
    } catch (error) {
      console.log('  ❌ Settings test failed:', error.message);
      return false;
    }
    
    return true;
  }

  async testMigration() {
    console.log('\n🔄 Testing Migration...');
    
    try {
      const migrationData = {
        templates: {
          'old-template-1': {
            title: 'Migrated Template',
            prompt: 'This template was migrated from localStorage',
            colors: ['#123456']
          }
        },
        frames: [
          {
            dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            filename: 'migrated-frame.png',
            kind: 'image'
          }
        ],
        settings: {
          favorites: { 'old-fav': true },
          show_only_favs: false
        }
      };
      
      console.log('  Running migration...');
      const result = await this.request('/api/user/migrate', {
        method: 'POST',
        body: JSON.stringify(migrationData)
      });
      
      console.log(`  ✅ Migration completed:`);
      console.log(`    - Templates: ${result.templates}`);
      console.log(`    - Frames: ${result.frames}`);
      console.log(`    - Settings: ${result.settings ? 'Yes' : 'No'}`);
      
      if (result.errors.length > 0) {
        console.log(`    - Errors: ${result.errors.length}`);
        result.errors.forEach(error => console.log(`      • ${error}`));
      }
      
    } catch (error) {
      console.log('  ❌ Migration test failed:', error.message);
      return false;
    }
    
    return true;
  }

  async runAllTests() {
    console.log(`🚀 Starting Cloud Storage Tests for ${this.baseUrl}`);
    
    const results = {
      templates: await this.testTemplates(),
      images: await this.testImages(),
      settings: await this.testSettings(),
      migration: await this.testMigration()
    };
    
    console.log('\n📊 Test Results:');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(Boolean);
    console.log(`\n${allPassed ? '🎉' : '💥'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    return allPassed;
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new CloudStorageTest(baseUrl);
  tester.runAllTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = CloudStorageTest;
