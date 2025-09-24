"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAuth?: boolean;
  message?: string;
}

interface AuthPromptProps {
  message?: string;
  onSignIn?: () => void;
}

function AuthPrompt({ message, onSignIn }: AuthPromptProps) {
  const { signIn } = useAuth();
  
  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      signIn();
    }
  };

  return (
    <div className="auth-guard-prompt">
      <div className="auth-guard-content">
        <div className="auth-guard-header">
          <h2>Sign in required</h2>
        </div>
        <div className="auth-guard-message">
          <p>
            {message || "You need to be signed in to access this feature. It's free after you sign up."}
          </p>
        </div>
        <div className="auth-guard-actions">
          <button 
            onClick={handleSignIn}
            className="nb-btn nb-btn--accent"
          >
            Sign in with Google
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .auth-guard-prompt {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 2rem 0;
          margin: 2rem 0;
        }

        .auth-guard-content {
          background: #fff;
          color: #111;
          padding: 2rem;
          border-radius: 12px;
          border: 3px solid var(--nb-border, #333);
          box-shadow: 8px 8px 0 var(--nb-border, #333);
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .auth-guard-header h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          font-weight: 800;
        }

        .auth-guard-message {
          margin-bottom: 1.5rem;
        }

        .auth-guard-message p {
          margin: 0;
          line-height: 1.5;
          font-size: 1.1rem;
        }

        .auth-guard-actions {
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}

export default function AuthGuard({ 
  children, 
  fallback, 
  requireAuth = true, 
  message 
}: AuthGuardProps) {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="auth-guard-loading">
        <div className="auth-guard-content">
          <p>Loading...</p>
        </div>
        <style jsx>{`
          .auth-guard-loading {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 2rem 0;
            margin: 2rem 0;
          }

          .auth-guard-content {
            background: #fff;
            color: #111;
            padding: 2rem;
            border-radius: 12px;
            border: 3px solid var(--nb-border, #333);
            box-shadow: 8px 8px 0 var(--nb-border, #333);
            max-width: 600px;
            width: 100%;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  // If authentication is not required, always show children
  if (!requireAuth) {
    return <>{children}</>;
  }

  // If user is authenticated, show children
  if (user) {
    return <>{children}</>;
  }

  // If user is not authenticated, show fallback or default auth prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return <AuthPrompt message={message} />;
}

// Export AuthPrompt for standalone use
export { AuthPrompt };
