import type { Metadata } from "next";

import { MotionProvider } from "@/components/motion/motion-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Motion Room",
  description: "A welcoming space for movement.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
