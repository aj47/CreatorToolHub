export const runtime = "edge";

// Proxy API route to forward requests to the worker
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToWorker(request, path);
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToWorker(request, path);
}

export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToWorker(request, path);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToWorker(request, path);
}

async function proxyToWorker(request: Request, pathSegments: string[]) {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://creator-tool-hub.techfren.workers.dev';
  const path = pathSegments.join('/');
  const url = new URL(request.url);
  
  // Build the worker URL
  const workerApiUrl = `${workerUrl}/api/user/${path}${url.search}`;
  
  // Get the request body if it exists
  let body: string | FormData | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.text();
    } else if (contentType.includes('multipart/form-data')) {
      body = await request.formData();
    } else {
      body = await request.text();
    }
  }
  
  // Forward the request to the worker
  const workerResponse = await fetch(workerApiUrl, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'Cookie': request.headers.get('cookie') || '',
      'Authorization': request.headers.get('authorization') || '',
    },
    body: body,
  });
  
  // Return the worker response
  const responseBody = await workerResponse.text();
  
  return new Response(responseBody, {
    status: workerResponse.status,
    statusText: workerResponse.statusText,
    headers: {
      'Content-Type': workerResponse.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
