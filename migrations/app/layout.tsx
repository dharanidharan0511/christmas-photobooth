import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Studio Enterprise",
  description: "AI Studio Enterprise — Run Minds, CodeFlo+, DocFlo+",
};

/**
 * Root layout — Server Component.
 *
 * The <html> element has suppressHydrationWarning so that the theme
 * attribute (data-theme) set by the client-side ThemeProvider does not
 * cause a hydration mismatch on first render.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Base path meta tag — read by goToSsoLogin() for sub-path deployments */}
        <meta name="base-path" content={process.env["NEXT_PUBLIC_BASE_PATH"] ?? ""} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oxygen:wght@300;400;700&family=Oxygen+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
