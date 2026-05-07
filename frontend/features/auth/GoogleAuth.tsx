"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@/features/auth/auth.hooks";

const SCRIPT_ID = "google-identity-service";

type GoogleAuthProps = {
  autoPrompt?: boolean;
  redirectTo?: string;
  checkSession?: boolean;
  disabled?: boolean;
};

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
      use_fedcm_for_prompt?: boolean;
    }) => void;
    prompt: () => void;
    renderButton: (
      element: HTMLElement,
      options: {
        theme: "outline" | "filled_black" | "filled_blue";
        size: "large" | "medium" | "small";
        width: number;
      }
    ) => void;
  };
};

type GoogleWindow = Window & {
  google?: { accounts: GoogleAccounts };
};

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const existing = document.getElementById(SCRIPT_ID);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function GoogleAuth({
  autoPrompt = true,
  redirectTo = "/app",
  checkSession = true,
  disabled
}: GoogleAuthProps) {
  const router = useRouter();
  const didInit = useRef(false);
  const accountsRef = useRef<GoogleAccounts | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.NEXT_APP_GOOGLE_CLIENT_ID ??
    "";

  const googleLoginMutation = useGoogleLogin();

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const credential = response.credential;
      if (!credential) return;

      try {
        await googleLoginMutation.mutateAsync({ credential });
        router.push(redirectTo);
      } catch {
        // errors are handled in mutation state
      }
    },
    [googleLoginMutation, redirectTo, router]
  );

  useEffect(() => {
    if (!checkSession || typeof window === "undefined") return;

    return () => {
      // cleanup
    };
  }, [checkSession]);

  useEffect(() => {
    if (!clientId || didInit.current) return;

    let cancelled = false;

    const setupGoogle = async () => {
      try {
        await loadGoogleScript();
        if (cancelled) return;

        const googleWindow = window as GoogleWindow;
        const accounts = googleWindow.google?.accounts;
        if (!accounts) {
          setInitError("Google Sign-In unavailable.");
          return;
        }

        accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: true,
          use_fedcm_for_prompt: false
        });

        accountsRef.current = accounts;

        if (buttonRef.current) {
          buttonRef.current.innerHTML = "";
          accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            width: 300
          });
        }

        if (autoPrompt) {
          accounts.id.prompt();
        }

        didInit.current = true;
      } catch (error) {
        console.error("Google Identity Services failed to initialize", error);
        setInitError("Google Sign-In unavailable.");
      }
    };

    setupGoogle();

    return () => {
      cancelled = true;
    };
  }, [autoPrompt, clientId, handleCredentialResponse]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={buttonRef}
        className={disabled || !clientId || googleLoginMutation.isPending ? "opacity-50" : undefined}
      />

      {!clientId ? (
        <div className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-xs text-muted-foreground">
          Google Sign-In needs NEXT_PUBLIC_GOOGLE_CLIENT_ID.
        </div>
      ) : null}

      {googleLoginMutation.isPending ? (
        <p className="text-xs text-muted-foreground">Signing in with Google...</p>
      ) : null}

      {!googleLoginMutation.isPending && initError ? (
        <p className="text-xs text-muted-foreground">{initError}</p>
      ) : null}

      {googleLoginMutation.error ? (
        <p className="text-xs text-destructive">{googleLoginMutation.error.message}</p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.1 0 9.8-1.9 13.3-5l-6.1-5.2C29.2 35.7 26.7 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.1 5.2C40.7 35.6 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
