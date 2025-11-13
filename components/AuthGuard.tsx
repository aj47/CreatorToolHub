"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
		<div className="my-8 flex items-start justify-center py-8">
			<div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm">
				<div className="mb-4">
					<h2 className="text-lg font-semibold tracking-tight text-slate-900">
						Sign in required
					</h2>
				</div>
				<div className="mb-6">
					<p className="text-sm text-muted-foreground">
						{message ||
							"You need to be signed in to access this feature. It's free after you sign up."}
					</p>
				</div>
				<div className="flex justify-center">
					<Button onClick={handleSignIn}>
						Sign in with Google
					</Button>
				</div>
			</div>
		</div>
	);
}

export default function AuthGuard({
	children,
	fallback,
	requireAuth = true,
	message,
}: AuthGuardProps) {
	const { user, loading } = useAuth();

		// Show loading state
		if (loading) {
			return (
				<div className="my-8 flex items-start justify-center py-8">
					<div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm">
						<p className="text-sm text-muted-foreground">Loading...</p>
					</div>
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
