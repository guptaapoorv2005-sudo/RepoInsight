"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
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
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      confirm: ""
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Settings</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink font-display">
              Account preferences
            </h2>
            <p className="mt-2 text-sm text-muted">
              Manage your account security and access.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            className="flex flex-col gap-4"
            onSubmit={changeForm.handleSubmit(handleChangePassword)}
          >
            <div>
              <h3 className="text-sm font-semibold text-ink">Change password</h3>
              <p className="mt-1 text-xs text-muted">
                Choose a strong password you do not use elsewhere.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">Current password</label>
              <Input
                type="password"
                placeholder="Current password"
                {...changeForm.register("currentPassword")}
              />
              {changeForm.formState.errors.currentPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">New password</label>
              <Input
                type="password"
                placeholder="New password"
                {...changeForm.register("newPassword")}
              />
              {changeForm.formState.errors.newPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">Confirm new password</label>
              <Input
                type="password"
                placeholder="Confirm new password"
                {...changeForm.register("confirmPassword")}
              />
              {changeForm.formState.errors.confirmPassword ? (
                <p className="text-xs text-red-400">
                  {changeForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {changePassword.error ? (
              <p className="text-sm text-red-400">{changePassword.error.message}</p>
            ) : null}

            {successMessage ? (
              <p className="text-sm text-emerald-400">{successMessage}</p>
            ) : null}

            <Button type="submit" isLoading={changePassword.isPending}>
              Update password
            </Button>
          </form>

          <form
            className="flex flex-col gap-4 rounded-2xl border border-red-500/40 bg-[#190f14] p-5"
            onSubmit={deleteForm.handleSubmit(handleDelete)}
          >
            <div>
              <h3 className="text-sm font-semibold text-red-700">Delete account</h3>
              <p className="mt-1 text-xs text-red-600">
                This will permanently remove your data and conversations.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-red-300">
                Type DELETE to confirm
              </label>
              <Input
                className="border-red-500/40 focus:border-red-400 focus:ring-red-400/30"
                placeholder="DELETE"
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

            <Button
              type="submit"
              variant="secondary"
              isLoading={deleteAccount.isPending}
              className="border-red-500/40 text-red-300 hover:border-red-400"
            >
              Delete account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
