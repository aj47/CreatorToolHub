"use client";

import { useEffect, useState } from "react";

interface User {
  email: string;
  name: string;
  picture: string;
}

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated by looking for auth cookie
    const checkAuth = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      const token = cookies['auth-token'];
      if (token) {
        try {
          const payload = JSON.parse(atob(token));
          if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
            setUser({
              email: payload.email,
              name: payload.name || '',
              picture: payload.picture || '',
            });
          }
        } catch (error) {
          // Invalid token
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signIn = () => {
    window.location.href = '/api/auth/signin';
  };

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setUser(null);
    window.location.reload();
  };

  if (loading) {
    return <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>Loading…</span>;
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
      {user ? (
        <>
          <span style={{ fontSize: 12, color: "#333" }}>{user.email}</span>
          <button onClick={signOut} style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 6 }}>Sign out</button>
        </>
      ) : (
        <button onClick={signIn} style={{ padding: "4px 8px", border: "1px solid #ccc", borderRadius: 6 }}>Sign in with Google</button>
      )}
    </div>
  );
}

