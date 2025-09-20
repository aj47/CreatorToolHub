#!/usr/bin/env node

/**
 * Comprehensive Full Stack Testing Script
 * Tests all API endpoints and frontend integration locally
 */

const fs = require('fs');
const path = require('path');

// Configuration
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();
      console.log(`✅ PASS: ${name}`);
      this.passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.failed++;
    }
  }

  async runAll() {
    console.log('🚀 Starting Full Stack Tests');
    console.log('============================');
    
    await this.testWorkerHealth();
    await this.testDatabaseConnection();
    await this.testUserAPI();
    await this.testImageUpload();
    await this.testTemplateOperations();
    await this.testFrontendIntegration();
    
    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }

  async testWorkerHealth() {
    await this.test('Worker Health Check', async () => {
      const response = await fetch(`${WORKER_URL}/api/user/profile`);
      if (!response.ok && response.status !== 401) {
        throw new Error(`Worker not responding: ${response.status}`);
      }
    });
  }

  async testDatabaseConnection() {
    await this.test('Database Connection', async () => {
      // Test with mock auth header
      const response = await fetch(`${WORKER_URL}/api/user/templates`, {
        headers: {
          'Authorization': 'Bearer mock-token-for-testing'
        }
      });
      
      // Should get 401 (unauthorized) but not 500 (database error)
      if (response.status === 500) {
        const error = await response.text();
        throw new Error(`Database connection failed: ${error}`);
      }
    });
  }

  async testUserAPI() {
    const endpoints = [
      { path: '/api/user/profile', method: 'GET' },
      { path: '/api/user/templates', method: 'GET' },
      { path: '/api/user/images', method: 'GET' },
      { path: '/api/user/settings', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      await this.test(`${endpoint.method} ${endpoint.path}`, async () => {
        const response = await fetch(`${WORKER_URL}${endpoint.path}`, {
          method: endpoint.method
        });
        
        // Should get 401 (needs auth) not 404 or 500
        if (response.status === 404) {
          throw new Error('Endpoint not found');
        }
        if (response.status === 500) {
          const error = await response.text();
          throw new Error(`Server error: ${error}`);
        }
      });
    }
  }

  async testImageUpload() {
    await this.test('Image Upload Endpoint', async () => {
      // Create a small test image (1x1 PNG)
      const testImageData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
        0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const formData = new FormData();
      formData.append('image', new Blob([testImageData], { type: 'image/png' }), 'test.png');
      formData.append('type', 'frame');

      const response = await fetch(`${WORKER_URL}/api/user/images`, {
        method: 'POST',
        body: formData
      });

      // Should get 401 (needs auth) not 400 or 500
      if (response.status === 400) {
        const error = await response.text();
        throw new Error(`Bad request: ${error}`);
      }
      if (response.status === 500) {
        const error = await response.text();
        throw new Error(`Server error: ${error}`);
      }
    });
  }

  async testTemplateOperations() {
    const testTemplate = {
      name: 'Test Template',
      prompt: 'A test template for automated testing',
      referenceImageUrl: null
    };

    await this.test('Template Creation Endpoint', async () => {
      const response = await fetch(`${WORKER_URL}/api/user/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testTemplate)
      });

      // Should get 401 (needs auth) not 400 or 500
      if (response.status === 400) {
        const error = await response.text();
        throw new Error(`Bad request: ${error}`);
      }
      if (response.status === 500) {
        const error = await response.text();
        throw new Error(`Server error: ${error}`);
      }
    });
  }

  async testFrontendIntegration() {
    await this.test('Frontend Accessibility', async () => {
      const response = await fetch(`${FRONTEND_URL}/thumbnails`);
      if (!response.ok) {
        throw new Error(`Frontend not accessible: ${response.status}`);
      }
      
      const html = await response.text();
      if (!html.includes('Thumbnail Creator')) {
        throw new Error('Frontend not loading correctly');
      }
    });

    await this.test('Frontend API Integration', async () => {
      // Check if frontend can reach the worker
      const response = await fetch(`${FRONTEND_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'test',
          images: []
        })
      });

      // Should get some response (not network error)
      if (response.status === 0) {
        throw new Error('Frontend cannot reach API endpoints');
      }
    });
  }
}

// Performance testing
class PerformanceTest {
  static async measureResponseTime(url, options = {}) {
    const start = Date.now();
    const response = await fetch(url, options);
    const end = Date.now();
    return {
      responseTime: end - start,
      status: response.status,
      ok: response.ok
    };
  }

  static async runPerformanceTests() {
    console.log('\n⚡ Performance Tests');
    console.log('===================');

    const tests = [
      { name: 'Worker Health', url: `${WORKER_URL}/api/user/profile` },
      { name: 'Frontend Load', url: `${FRONTEND_URL}/thumbnails` },
      { name: 'API Templates', url: `${WORKER_URL}/api/user/templates` }
    ];

    for (const test of tests) {
      try {
        const result = await this.measureResponseTime(test.url);
        const status = result.responseTime < 1000 ? '✅' : '⚠️';
        console.log(`${status} ${test.name}: ${result.responseTime}ms`);
      } catch (error) {
        console.log(`❌ ${test.name}: Failed (${error.message})`);
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log('Full Stack Testing Script');
    console.log('Usage: node scripts/test-full-stack.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --perf-only    Run only performance tests');
    console.log('  --help         Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  WORKER_URL     Worker URL (default: http://localhost:8787)');
    console.log('  FRONTEND_URL   Frontend URL (default: http://localhost:3000)');
    return;
  }

  if (args.includes('--perf-only')) {
    await PerformanceTest.runPerformanceTests();
    return;
  }

  const runner = new TestRunner();
  await runner.runAll();
  await PerformanceTest.runPerformanceTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestRunner, PerformanceTest };
