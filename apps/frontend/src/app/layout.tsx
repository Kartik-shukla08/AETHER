import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether - LLM Observability & Chat",
  description: "Real-time LLM inference logger, latency analytics, and chatbot console.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
