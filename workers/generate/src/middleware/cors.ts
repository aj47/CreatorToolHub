// CORS middleware for worker routes

export async function corsMiddleware(
  request: Request,
  env: any,
  next: () => Promise<Response>
): Promise<Response> {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return handlePreflight(request, env);
  }

  // Process the request
  const response = await next();

  // Add CORS headers to the response
  return addCorsHeaders(response, request, env);
}

function handlePreflight(request: Request, env: any): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') || 
                   (origin && allowedOrigins.includes(origin));

  if (!isAllowed) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return new Response(null, {
    status: 204,
    headers,
  });
}

function addCorsHeaders(response: Response, request: Request, env: any): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env);

  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') || 
                   (origin && allowedOrigins.includes(origin));

  if (!isAllowed) {
    return response;
  }

  // Clone response to modify headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  // Add CORS headers
  newResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  newResponse.headers.set('Vary', 'Origin');

  return newResponse;
}

function getAllowedOrigins(env: any): string[] {
  const origins: string[] = [];
  
  // Get from environment variable
  const envOrigins = env?.ALLOWED_ORIGINS || env?.ALLOWED_ORIGIN;
  if (envOrigins) {
    origins.push(...envOrigins.split(/[,\s]+/).filter(Boolean));
  }

  // Add default origins
  origins.push(
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://creatortoolhub.com',
    'https://www.creatortoolhub.com'
  );

  // Remove duplicates
  return Array.from(new Set(origins));
}

// Utility function to check if origin is allowed
export function isOriginAllowed(origin: string | null, env: any): boolean {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins(env);
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}
