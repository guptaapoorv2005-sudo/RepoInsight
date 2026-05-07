"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api/client";

function getUserFromResponse(payload: unknown) {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object") return data;
  }
  return payload;
}

export function GoogleAuthButton({
  onSuccess,
  disabled
}: {
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.NEXT_APP_GOOGLE_CLIENT_ID ??
    "";

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      const credential = response.credential;
      if (!credential) return;

      setIsAuthenticating(true);

      try {
        const res = await fetch(`${API_BASE_URL}/users/google-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ credential })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Login failed (${res.status})${errorText ? `: ${errorText}` : ""}`
          );
        }

        const data = await res.json();
        const user = getUserFromResponse(data);
        queryClient.setQueryData(["current-user"], user);
        onSuccess?.();
      } catch (error) {
        console.error("Google login failed", error);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [onSuccess, queryClient]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as
        | { type?: string; credential?: string; error?: string }
        | undefined;

      if (data?.type !== "google-auth") return;

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;

      if (data.error) {
        setInitError(data.error);
        setIsAuthenticating(false);
        return;
      }

      if (data.credential) {
        void handleCredentialResponse({ credential: data.credential });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleCredentialResponse]);

  const handleClick = () => {
    if (!clientId || disabled || isAuthenticating || typeof window === "undefined") return;

    setInitError(null);
    setIsAuthenticating(true);

    const nonce = window.crypto.randomUUID();
    const redirectUri =
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ??
      `${window.location.origin}/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account"
    });

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "google-auth-popup",
      "width=500,height=640,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!popup) {
      setIsAuthenticating(false);
      setInitError("Popup blocked. Please allow popups and try again.");
      return;
    }

    popupRef.current = popup;
    popup.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isAuthenticating || !clientId}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {!clientId ? (
        <div className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-xs text-muted-foreground">
          Google Sign-In needs NEXT_PUBLIC_GOOGLE_CLIENT_ID.
        </div>
      ) : null}

      {isAuthenticating ? (
        <p className="text-xs text-muted-foreground">Signing in with Google...</p>
      ) : null}

      {!isAuthenticating && initError ? (
        <p className="text-xs text-muted-foreground">{initError}</p>
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
