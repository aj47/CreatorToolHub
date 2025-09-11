export const runtime = "edge";

import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
  // In development, return a mock authenticated user
  if (process.env.NODE_ENV === 'development') {
    return Response.json({
      authenticated: true,
      user: {
        email: 'dev@example.com',
        name: 'Dev User',
        picture: '',
      }
    });
  }

  const user = getUser(request);

  if (user) {
    return Response.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      }
    });
  } else {
    return Response.json({
      authenticated: false,
      user: null
    });
  }
}
