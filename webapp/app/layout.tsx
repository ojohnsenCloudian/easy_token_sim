import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HyperStore Expansion Simulator",
  description: "Cloudian HyperStore Cluster Expansion Simulator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">H</div>
              <div>
                <h1 className="text-sm font-semibold leading-none">HyperStore Expansion Simulator</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Cloudian cluster planning tool</p>
              </div>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/docs"
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                Docs
              </Link>
            </nav>
          </header>
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
