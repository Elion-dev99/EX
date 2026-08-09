import type { Metadata } from "next";
import { Noto_Sans_JP, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "EX Shift | 幹部シフトカレンダー",
  description: "男子学園プロフィールの出勤スケジュールを横断表示するカレンダー",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${outfit.variable} ${notoSansJp.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
