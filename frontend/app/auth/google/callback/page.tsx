"use client";

import { useEffect, useMemo } from "react";

function readIdTokenFromLocation() {
  if (typeof window === "undefined") return null;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("id_token");
}

export default function GoogleCallbackPage() {
  const credential = useMemo(() => readIdTokenFromLocation(), []);

  useEffect(() => {
    const payload = credential
      ? { type: "google-auth", credential }
      : { type: "google-auth", error: "Google sign-in failed." };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
    }

    window.close();
  }, [credential]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
      Completing Google sign-in...
    </div>
  );
}
