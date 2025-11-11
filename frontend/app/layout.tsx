import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "StreamSave - Stream Your Income, Save While You Earn",
  description: "Privacy-first income streaming and microcredits on Celo. Save as little as $0.10/hour using x402 micropayments. Build credit history, earn 3-5% APY, access mobile money.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
