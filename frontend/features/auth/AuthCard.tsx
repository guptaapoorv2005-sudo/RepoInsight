"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import { useLogin, useSignup } from "@/features/auth/auth.hooks";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type FormValues = z.infer<typeof schema>;

type Mode = "login" | "signup";

const modeCopy: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to continue exploring your repositories.",
    cta: "Login"
  },
  signup: {
    title: "Create your account",
    subtitle: "Start chatting with your codebase in minutes.",
    cta: "Create account"
  }
};

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();

  const loginMutation = useLogin();
  const signupMutation = useSignup();

  const activeMutation = mode === "login" ? loginMutation : signupMutation;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const errorMessage = useMemo(() => {
    if (!activeMutation.error) return null;
    return activeMutation.error.message;
  }, [activeMutation.error]);

  const copy = modeCopy[mode];

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return;
    loginMutation.reset();
    signupMutation.reset();
    setMode(nextMode);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await activeMutation.mutateAsync(values);
      router.push("/app");
    } catch {
      // errors are surfaced in mutation state
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <Tag>RepoInsight access</Tag>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-muted p-1">
          {(["login", "signup"] as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleModeChange(item)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                item === mode
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {item === "login" ? "Login" : "Signup"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          <h2 className="text-2xl font-semibold text-ink font-display">{copy.title}</h2>
          <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>
        </motion.div>
      </AnimatePresence>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">Email</label>
          <Input type="email" placeholder="you@repoinsight.ai" {...register("email")} />
          {errors.email ? (
            <p className="text-xs text-red-400">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">Password</label>
          <Input type="password" placeholder="Minimum 6 characters" {...register("password")} />
          {errors.password ? (
            <p className="text-xs text-red-400">{errors.password.message}</p>
          ) : null}
        </div>

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        <Button type="submit" size="lg" isLoading={activeMutation.isPending}>
          {copy.cta}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="secondary" size="lg">
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
