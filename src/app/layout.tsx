import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanční Deník",
  description: "Osobní a firemní finanční deník",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="dark">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
