/**
 * Proxy endpoint for serving files from the Cloudflare Worker
 * This allows the Next.js app to serve files from R2 storage via the worker
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join('/');
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL || '';

    if (!workerUrl) {
      return new Response(
        JSON.stringify({ error: 'Worker API URL not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construct the worker URL
    const url = `${workerUrl}/api/files/${encodeURIComponent(filePath)}`;

    // Forward the request to the worker
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    // Return the response from the worker
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
  } catch (error) {
    console.error('File proxy error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch file',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

