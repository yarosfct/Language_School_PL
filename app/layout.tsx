import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { TTSInitializer } from "@/components/TTSInitializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PolskiOdZera - Learn Polish from Zero",
  description: "Structured Polish language learning with adaptive review and spaced repetition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TTSInitializer />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
