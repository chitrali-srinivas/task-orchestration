import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mati Carbon Demo",
  description: "Mati Carbon Authentication Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
