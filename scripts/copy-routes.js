#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const source = path.join(process.cwd(), 'public', '_routes.json');
const dest = path.join(process.cwd(), '.next', '_routes.json');

try {
  fs.copyFileSync(source, dest);
  console.log('✓ Copied _routes.json to .next directory');

  // Also verify the file exists and has content
  const content = fs.readFileSync(dest, 'utf-8');
  console.log('✓ _routes.json content verified:', content.substring(0, 50) + '...');
} catch (error) {
  console.warn('⚠ Failed to copy _routes.json:', error.message);
  process.exit(1);
}

