"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>Loading…</span>;
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
      {session?.user ? (
        <>
          <span style={{ fontSize: 12, color: "#333" }}>{session.user.email}</span>
          <button onClick={() => signOut()} style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 6 }}>Sign out</button>
        </>
      ) : (
        <button onClick={() => signIn("google")} style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 6 }}>Sign in with Google</button>
      )}
    </div>
  );
}

