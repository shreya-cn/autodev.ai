'use client';

import "./globals.css";
import Header from "@/components/Header";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="en">
      <head>
        <title>AutoDev.ai - Intelligent Development Platform</title>
        <meta name="description" content="AI-powered development assistant with Jira integration and automated workflows" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <SessionProvider>
          {!isLoginPage && <Header />}
          <main className="min-h-screen bg-white">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
