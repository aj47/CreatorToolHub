import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Query the remote D1 database directly using wrangler
    const { stdout } = await execAsync(
      `cd workers/generate && npx wrangler d1 execute creator-tool-hub-db --remote --json --command "SELECT g.id, g.created_at, g.prompt, go.r2_key FROM generations g JOIN generation_outputs go ON g.id = go.generation_id WHERE g.created_at > '2025-11-05' ORDER BY g.created_at DESC LIMIT 100"`,
      { cwd: process.cwd() }
    );

    const result = JSON.parse(stdout);
    const generations = result[0]?.results || [];

    return NextResponse.json({ generations });
  } catch (error) {
    console.error('Failed to fetch generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generations', details: String(error) },
      { status: 500 }
    );
  }
}

