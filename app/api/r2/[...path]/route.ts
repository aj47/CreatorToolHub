import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await the params promise
    const { path } = await params;

    // Reconstruct the file path from the params
    const filePath = path.join("/");

    // Proxy the request to the worker
    const workerUrl = `https://creator-tool-hub.techfren.workers.dev/api/r2/${filePath}`;

    const response = await fetch(workerUrl, {
      method: "GET",
      headers: {
        "Accept": request.headers.get("Accept") || "*/*",
      },
    });

    if (!response.ok) {
      return new Response("File not found", { status: 404 });
    }

    // Return the file with appropriate headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error proxying R2 request:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

