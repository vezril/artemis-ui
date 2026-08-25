import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Artemis UI",
    template: "%s · Artemis UI",
  },
  description:
    "The per-service management console for Artemis — operations (health, metrics, reprocessing, GC) and catalog (search, posts, uploads, tags, pools).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Dark by default: the `dark` class is set here so shadcn-style `dark:`
  // variants resolve, and `color-scheme` keeps native UI (scrollbars) dark.
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
