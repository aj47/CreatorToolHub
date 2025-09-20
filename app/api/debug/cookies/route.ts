export const runtime = "edge";

// Debug endpoint to see what cookies are being sent
export async function GET(request: Request) {
  const cookies = request.headers.get('cookie') || '';
  const userAgent = request.headers.get('user-agent') || '';
  
  return Response.json({
    cookies: cookies,
    cookiesParsed: cookies.split(';').map(c => c.trim()),
    userAgent: userAgent,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
