import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kawalerski Mundial 2026",
  description: "Typowanie meczów Mundialu 2026 — wspólna liga znajomych.",
};

export const viewport: Viewport = {
  themeColor: "#050a16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" data-theme="clash">
      <body>
        <div className="root-shell">{children}</div>
      </body>
    </html>
  );
}
