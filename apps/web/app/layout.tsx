import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { MockProvider } from "@/lib/mock/store";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PIQ — ระบบจัดการคิวผู้ป่วย",
  description: "Patient Intelligent Queuing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <MockProvider>{children}</MockProvider>
      </body>
    </html>
  );
}
