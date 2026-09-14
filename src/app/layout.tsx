import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motion Room",
  description: "A welcoming space for movement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
