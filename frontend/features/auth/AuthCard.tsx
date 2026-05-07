"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogin, useSignup } from "@/features/auth/auth.hooks";
import { GoogleAuthButton } from "@/features/auth/GoogleAuthButton";

type Mode = "login" | "signup";

export function AuthCard({ initial = "login" }: { initial?: Mode }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const loginMutation = useLogin();
  const signupMutation = useSignup();

  const activeMutation = mode === "login" ? loginMutation : signupMutation;

  const errorMessage = useMemo(
    () => activeMutation.error?.message ?? null,
    [activeMutation.error]
  );

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    loginMutation.reset();
    signupMutation.reset();
    setMode(nextMode);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@")) return;
    if (password.length < 6) return;
    try {
      await activeMutation.mutateAsync({ email, password });
      router.push("/app");
    } catch {
      // errors are surfaced in mutation state
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl glass-strong p-7 shadow-elevated">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to continue exploring your repos."
            : "Get started in seconds — no credit card."}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-1 p-1">
        {(["login", "signup"] as Mode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleModeChange(item)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[active=true]:text-foreground"
            )}
            data-active={mode === item}
          >
            {mode === item ? (
              <motion.span
                layoutId="auth-toggle"
                className="absolute inset-0 rounded-lg bg-surface-3"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative">
              {item === "login" ? "Sign in" : "Sign up"}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.form
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          onSubmit={onSubmit}
          className="space-y-3.5"
        >
          <Field
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
          />
          <Field
            icon={<Lock className="h-3.5 w-3.5" />}
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />

          {errorMessage ? (
            <p className="text-xs text-destructive">{errorMessage}</p>
          ) : null}

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={activeMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-soft transition-all hover:shadow-glow disabled:opacity-50"
          >
            {activeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {mode === "login" ? "Sign in" : "Create account"}
          </motion.button>
        </motion.form>
      </AnimatePresence>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <GoogleAuthButton
        disabled={activeMutation.isPending}
        onSuccess={() => router.push("/app")}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 transition-colors focus-within:border-(--lovable-brand) focus-within:ring-2 focus-within:ring-(--lovable-ring)">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </label>
  );
}
