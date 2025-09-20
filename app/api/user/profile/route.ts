export const runtime = "edge";

// Test proxy route for user profile
export async function GET(request: Request) {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://creator-tool-hub.techfren.workers.dev';
  
  try {
    // Forward the request to the worker
    const workerResponse = await fetch(`${workerUrl}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'Authorization': request.headers.get('authorization') || '',
      },
    });
    
    // Get the response
    const responseBody = await workerResponse.text();
    
    return new Response(responseBody, {
      status: workerResponse.status,
      statusText: workerResponse.statusText,
      headers: {
        'Content-Type': workerResponse.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Proxy failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
