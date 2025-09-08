"use client";

import { useEffect, useState } from "react";

interface DebugInfo {
  cookies: string;
  hasAuthToken: boolean;
  tokenValid: boolean;
  tokenPayload: any;
  userAgent: string;
  url: string;
  timestamp: string;
}

export default function AuthDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const gatherDebugInfo = () => {
      const cookies = document.cookie;
      const authToken = cookies.split(';').find(c => c.trim().startsWith('auth-token='));
      const hasAuthToken = !!authToken;

      let tokenValid = false;
      let tokenPayload = null;

      if (hasAuthToken) {
        try {
          const token = authToken.split('=')[1];
          tokenPayload = JSON.parse(atob(token));
          tokenValid = tokenPayload.exp && tokenPayload.exp > Math.floor(Date.now() / 1000);
        } catch (error) {
          console.error('Token parsing error:', error);
        }
      }

      setDebugInfo({
        cookies,
        hasAuthToken,
        tokenValid,
        tokenPayload,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    };

    gatherDebugInfo();
  }, []);

  // Only render on client side
  if (!isClient) {
    return null;
  }

  // Only show in development or when explicitly enabled
  const isDev = process.env.NODE_ENV === 'development';
  const showDebugParam = new URLSearchParams(window.location.search).has('debug');

  if (!isDev && !showDebugParam) {
    return null;
  }

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          padding: '8px 12px',
          background: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        🐛 Auth Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: '400px',
        maxHeight: '500px',
        overflow: 'auto',
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '16px',
        fontSize: '12px',
        fontFamily: 'monospace',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <strong>Auth Debug Info</strong>
        <button
          onClick={() => setShowDebug(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
        >
          ×
        </button>
      </div>
      
      {debugInfo && (
        <div style={{ lineHeight: '1.4' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Status:</strong>{' '}
            <span style={{ color: debugInfo.tokenValid ? 'green' : 'red' }}>
              {debugInfo.tokenValid ? '✅ Authenticated' : '❌ Not authenticated'}
            </span>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Has Auth Token:</strong> {debugInfo.hasAuthToken ? 'Yes' : 'No'}
          </div>
          
          {debugInfo.tokenPayload && (
            <div style={{ marginBottom: '8px' }}>
              <strong>User:</strong> {debugInfo.tokenPayload.email}
              <br />
              <strong>Expires:</strong> {new Date(debugInfo.tokenPayload.exp * 1000).toLocaleString()}
            </div>
          )}
          
          <div style={{ marginBottom: '8px' }}>
            <strong>All Cookies:</strong>
            <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '4px', wordBreak: 'break-all' }}>
              {debugInfo.cookies || '(none)'}
            </div>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>URL:</strong>
            <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '4px', wordBreak: 'break-all' }}>
              {debugInfo.url}
            </div>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>User Agent:</strong>
            <div style={{ background: '#f5f5f5', padding: '4px', borderRadius: '4px', wordBreak: 'break-all' }}>
              {debugInfo.userAgent.substring(0, 100)}...
            </div>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <strong>Timestamp:</strong> {debugInfo.timestamp}
          </div>
          
          <div style={{ marginTop: '12px', padding: '8px', background: '#f0f8ff', borderRadius: '4px' }}>
            <strong>Quick Actions:</strong>
            <br />
            <button
              onClick={() => window.location.href = '/api/auth/signin'}
              style={{ marginRight: '8px', marginTop: '4px', padding: '4px 8px', fontSize: '11px' }}
            >
              Test Sign In
            </button>
            <button
              onClick={() => window.location.href = '/api/auth/signout'}
              style={{ marginRight: '8px', marginTop: '4px', padding: '4px 8px', fontSize: '11px' }}
            >
              Test Sign Out
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '4px', padding: '4px 8px', fontSize: '11px' }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
