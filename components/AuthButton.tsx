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
    // Check authentication status via session endpoint
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (data.authenticated && data.user) {
          setUser({
            email: data.user.email,
            name: data.user.name || '',
            picture: data.user.picture || '',
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
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
          <button onClick={signOut} className="nb-btn">Sign out</button>
        </>
      ) : (
        <button onClick={signIn} className="nb-btn nb-btn--accent">Sign in with Google</button>
      )}
    </div>
  );
}

