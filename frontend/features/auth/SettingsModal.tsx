"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { useChangePassword, useDeleteAccount } from "@/features/auth/auth.hooks";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm the new password")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

const deleteSchema = z.object({
  confirm: z
    .string()
    .min(1, "Type DELETE to confirm")
    .refine((value) => value === "DELETE", "Type DELETE to confirm")
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

type DeleteValues = z.infer<typeof deleteSchema>;

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();

  const changeForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  const deleteForm = useForm<DeleteValues>({
    resolver: zodResolver(deleteSchema) as any,
    defaultValues: {
      confirm: "" as any
    }
  });

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSuccessMessage(null);
    changeForm.reset();
    deleteForm.reset();
    changePassword.reset();
    deleteAccount.reset();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleChangePassword = async (values: ChangePasswordValues) => {
    try {
      setSuccessMessage(null);
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      setSuccessMessage("Password updated successfully.");
      changeForm.reset();
    } catch {
      // errors handled via mutation state
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount.mutateAsync();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch {
      // errors handled via mutation state
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl glass-strong p-6 shadow-elevated"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Settings</p>
            <h2 className="mt-3 text-lg font-medium text-foreground">Account preferences</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Manage your account security and access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            className="flex flex-col gap-4"
            onSubmit={changeForm.handleSubmit(handleChangePassword)}
          >
            <div>
              <h3 className="text-sm font-medium text-foreground">Change password</h3>
              <p className="mt-3 text-xs text-muted-foreground">
                Choose a strong password you do not use elsewhere.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">Current password</label>
              <Input
                type="password"
                placeholder="Current password"
                variant="lovable"
                {...changeForm.register("currentPassword")}
              />
              {changeForm.formState.errors.currentPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">New password</label>
              <Input
                type="password"
                placeholder="New password"
                variant="lovable"
                {...changeForm.register("newPassword")}
              />
              {changeForm.formState.errors.newPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">Confirm new password</label>
              <Input
                type="password"
                placeholder="Confirm new password"
                variant="lovable"
                {...changeForm.register("confirmPassword")}
              />
              {changeForm.formState.errors.confirmPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {changePassword.error ? (
              <p className="text-xs text-destructive">{changePassword.error.message}</p>
            ) : null}

            {successMessage ? (
              <p className="text-xs text-emerald-400">{successMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-soft transition-all hover:shadow-glow disabled:opacity-50"
            >
              Update password
            </button>
          </form>

          <form
            className="flex flex-col gap-4 rounded-2xl border border-red-500/40 bg-surface-1 p-4"
            onSubmit={deleteForm.handleSubmit(handleDelete)}
          >
            <div>
              <h3 className="text-sm font-medium text-red-300">Delete account</h3>
              <p className="mt-3 text-xs text-red-300">
                This will permanently remove your data and conversations.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-red-300">Type DELETE to confirm</label>
              <Input
                className="border-red-500/40 focus:border-red-400 focus:ring-red-400/30"
                placeholder="DELETE"
                variant="lovable"
                {...deleteForm.register("confirm")}
              />
              {deleteForm.formState.errors.confirm ? (
                <p className="text-xs text-red-400">
                  {deleteForm.formState.errors.confirm.message}
                </p>
              ) : null}
            </div>

            {deleteAccount.error ? (
              <p className="text-xs text-red-300">{deleteAccount.error.message}</p>
            ) : null}

            <button
              type="submit"
              disabled={deleteAccount.isPending}
              className="flex w-full items-center justify-center rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-300 transition-colors hover:border-red-400 disabled:opacity-50"
            >
              Delete account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
