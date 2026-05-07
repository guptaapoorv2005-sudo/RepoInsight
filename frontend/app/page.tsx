"use client";

import { AuthCard } from "@/features/auth/AuthCard";
import { AuthSplitLayout } from "@/features/auth/AuthSplitLayout";

export default function Home() {
  return (
    <div className="lovable-auth">
      <AuthSplitLayout>
        <AuthCard initial="login" />
      </AuthSplitLayout>
    </div>
  );
}
