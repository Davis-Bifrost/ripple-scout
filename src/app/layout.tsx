import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ripple Scout",
  description: "Internal creator/channel discovery + CSV import",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
