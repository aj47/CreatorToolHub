export const runtime = "edge";

import { getUser } from "@/lib/auth";

export async function GET(request: Request) {
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
