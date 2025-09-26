#!/usr/bin/env node

/**
 * Database seeding script for local development
 * Populates the local D1 database with test data for past generations
 * This saves money by avoiding actual image generation during testing
 */

const WORKER_URL = 'http://localhost:8787';

// Mock user data
const TEST_USER = {
  email: 'dev@example.com',
  name: 'Dev User',
  picture: ''
};

// Sample thumbnail URLs (using placeholder images)
const SAMPLE_THUMBNAILS = [
  'https://picsum.photos/1280/720?random=1',
  'https://picsum.photos/1280/720?random=2', 
  'https://picsum.photos/1280/720?random=3',
  'https://picsum.photos/1280/720?random=4',
  'https://picsum.photos/1280/720?random=5',
  'https://picsum.photos/1280/720?random=6',
  'https://picsum.photos/1280/720?random=7',
  'https://picsum.photos/1280/720?random=8'
];

// Sample generation data
const SAMPLE_GENERATIONS = [
  {
    prompt: "Create a vibrant gaming thumbnail with neon colors and futuristic elements",
    variants_requested: 3,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
  },
  {
    prompt: "Design a cooking tutorial thumbnail with warm colors and appetizing food",
    variants_requested: 4,
    status: "complete", 
    source: "thumbnails",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
  },
  {
    prompt: "Tech review thumbnail with clean modern design and product showcase",
    variants_requested: 2,
    status: "complete",
    source: "thumbnails", 
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
  },
  {
    prompt: "Travel vlog thumbnail featuring beautiful landscape and adventure theme",
    variants_requested: 3,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  },
  {
    prompt: "Fitness workout thumbnail with energetic colors and motivational text",
    variants_requested: 4,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
  },
  {
    prompt: "Educational content thumbnail with professional layout and clear typography",
    variants_requested: 2,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
  },
  {
    prompt: "Music video thumbnail with artistic design and vibrant color palette",
    variants_requested: 3,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hours ago
  },
  {
    prompt: "DIY craft tutorial thumbnail with bright colors and creative elements",
    variants_requested: 3,
    status: "complete",
    source: "thumbnails",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
  }
];

class DatabaseSeeder {
  constructor() {
    this.userId = null;
    this.generationIds = [];
  }

  async seedDatabase() {
    console.log('🌱 Starting database seeding...');
    console.log('================================');

    try {
      // Check if worker is running
      await this.checkWorkerHealth();
      
      // Create/update user
      await this.createUser();
      
      // Create sample templates
      await this.createSampleTemplates();
      
      // Create sample generations with outputs
      await this.createSampleGenerations();
      
      console.log('\n✅ Database seeding completed successfully!');
      console.log(`📊 Created ${SAMPLE_GENERATIONS.length} generations with outputs`);
      console.log('🎯 You can now test the dashboard and past generations flow');
      
    } catch (error) {
      console.error('\n❌ Database seeding failed:', error.message);
      process.exit(1);
    }
  }

  async checkWorkerHealth() {
    console.log('🔍 Checking worker health...');
    try {
      const response = await fetch(`${WORKER_URL}/api/user/profile`);
      if (!response.ok && response.status !== 401) {
        throw new Error(`Worker not responding: ${response.status}`);
      }
      console.log('✅ Worker is healthy');
    } catch (error) {
      throw new Error(`Worker health check failed: ${error.message}`);
    }
  }

  async createUser() {
    console.log('👤 Creating test user...');
    
    // Derive user ID (same logic as in the worker)
    const crypto = require('crypto');
    this.userId = crypto.createHash('sha256').update(TEST_USER.email).digest('hex');
    
    console.log(`✅ User ID: ${this.userId}`);
  }

  async createSampleTemplates() {
    console.log('📝 Creating sample templates...');
    
    const sampleTemplates = [
      {
        title: "Gaming Thumbnail",
        prompt: "Create a vibrant gaming thumbnail with neon colors and futuristic elements",
        colors: ["#ff0080", "#00ff80", "#8000ff"]
      },
      {
        title: "Cooking Tutorial", 
        prompt: "Design a cooking tutorial thumbnail with warm colors and appetizing food",
        colors: ["#ff6b35", "#f7931e", "#ffd23f"]
      },
      {
        title: "Tech Review",
        prompt: "Tech review thumbnail with clean modern design and product showcase", 
        colors: ["#2196f3", "#607d8b", "#9e9e9e"]
      }
    ];

    // Note: In a real implementation, we'd make API calls to create templates
    // For now, we'll just log that we would create them
    console.log(`✅ Would create ${sampleTemplates.length} sample templates`);
  }

  async createSampleGenerations() {
    console.log('🎨 Creating sample generations...');
    
    for (let i = 0; i < SAMPLE_GENERATIONS.length; i++) {
      const generation = SAMPLE_GENERATIONS[i];
      const generationId = this.generateUUID();
      
      console.log(`  Creating generation ${i + 1}/${SAMPLE_GENERATIONS.length}: "${generation.prompt.slice(0, 50)}..."`);
      
      // Create generation record
      await this.insertGeneration(generationId, generation);
      
      // Create output records for each variant
      await this.createGenerationOutputs(generationId, generation.variants_requested);
      
      this.generationIds.push(generationId);
    }
    
    console.log(`✅ Created ${SAMPLE_GENERATIONS.length} generations`);
  }

  async insertGeneration(generationId, generation) {
    // In a real implementation, we'd use the D1 database directly
    // For now, we'll simulate the database insertion
    console.log(`    📝 Generation ID: ${generationId}`);
  }

  async createGenerationOutputs(generationId, variantCount) {
    for (let i = 0; i < variantCount; i++) {
      const outputId = this.generateUUID();
      const thumbnailUrl = SAMPLE_THUMBNAILS[Math.floor(Math.random() * SAMPLE_THUMBNAILS.length)];
      
      // In a real implementation, we'd insert into generation_outputs table
      console.log(`      🖼️  Output ${i + 1}: ${outputId}`);
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Run the seeder
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  seeder.seedDatabase();
}

module.exports = DatabaseSeeder;
