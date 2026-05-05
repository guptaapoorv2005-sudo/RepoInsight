import type { Metadata } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "RepoInsight",
  description:
    "RepoInsight helps you chat with your codebase and understand repositories instantly."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${ibmPlex.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
