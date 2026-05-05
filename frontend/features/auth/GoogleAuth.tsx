"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api/client";

const SCRIPT_ID = "google-identity-service";

type GoogleAuthProps = {
  autoPrompt?: boolean;
  redirectTo?: string;
  checkSession?: boolean;
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
    }) => void;
    prompt: () => void;
    renderButton: (element: HTMLElement, options: {
      theme: "outline" | "filled_black" | "filled_blue";
      size: "large" | "medium" | "small";
      width: number | string;
    }) => void;
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

function getUserFromResponse(payload: unknown) {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object") return data;
  }
  return payload;
}

export function GoogleAuth({
  autoPrompt = true,
  redirectTo = "/app",
  checkSession = true
}: GoogleAuthProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const didInit = useRef(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [shouldInit, setShouldInit] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
    process.env.NEXT_APP_GOOGLE_CLIENT_ID ??
    "";

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
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
        router.push(redirectTo);
      } catch (error) {
        console.error("Google login failed", error);
      } finally {
        setIsAuthenticating(false);
      }
    },
    [queryClient, redirectTo, router]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!checkSession || typeof window === "undefined") return;

    const existingUser = queryClient.getQueryData(["current-user"]);
    if (existingUser) {
      setShouldInit(false);
      return;
    }

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/current-user`, {
          credentials: "include"
        });

        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const user = getUserFromResponse(data);
        queryClient.setQueryData(["current-user"], user);
        setShouldInit(false);
      } catch {
        // ignore auth check errors
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [checkSession, queryClient]);

  useEffect(() => {
    if (!clientId || !shouldInit || didInit.current) return;

    let cancelled = false;

    const setupGoogle = async () => {
      try {
        await loadGoogleScript();
        if (cancelled) return;

        const googleWindow = window as GoogleWindow;
        const accounts = googleWindow.google?.accounts;
        if (!accounts || !buttonRef.current) {
          setInitError("Google Sign-In unavailable.");
          return;
        }

        buttonRef.current.innerHTML = "";

        accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: true
        });

        accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: 300
        });

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
  }, [autoPrompt, clientId, handleCredentialResponse, shouldInit]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={buttonRef} id="googleSignInDiv" className="min-h-11 w-full" />
      {isMounted && !clientId ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
          Google Sign-In needs NEXT_PUBLIC_GOOGLE_CLIENT_ID.
        </div>
      ) : null}
      {isAuthenticating ? (
        <p className="text-xs text-muted">Signing in with Google...</p>
      ) : null}
      {!isAuthenticating && initError ? (
        <p className="text-xs text-red-300">{initError}</p>
      ) : null}
    </div>
  );
}
