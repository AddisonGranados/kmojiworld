import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kmoji.world studio",
  description: "Pick an emoji, choose a size, and draw anywhere. A simple creative studio with color matching, photo backdrops, and layers.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
