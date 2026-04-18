import type { Metadata } from "next";
import {
  Instrument_Serif,
  Geist,
  Geist_Mono,
  Noto_Serif_TC,
  Noto_Sans_TC,
} from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const sans = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

const notoSerif = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-serif-tc",
});

const notoSans = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans-tc",
});

export const metadata: Metadata = {
  title: "Quillo",
  description: "Editorial content graph for writers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${serif.variable} ${sans.variable} ${mono.variable} ${notoSerif.variable} ${notoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-ink font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
