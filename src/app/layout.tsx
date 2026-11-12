import type { Metadata, Viewport } from 'next';
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono, Mukta_Vaani, Noto_Serif_Devanagari } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/components/MainLayout';
import { getAllClassesMetadata } from '@/lib/data';
import { CursorGlow } from '@/components/CursorGlow';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });
const notoDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari'],
  weight: ['500', '600', '700'],
  variable: '--font-noto-devanagari',
});
// Gujarati: Mukta Vaani (Ek Type), a calm humanist face that sits well beside Geist.
const gujarati = Mukta_Vaani({
  subsets: ['gujarati'], // Gujarati glyphs only; Latin falls through to Geist
  weight: ['400', '500', '600', '700'],
  variable: '--font-gujarati-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Visharad Sahayak',
  description: 'Study support for Vidvans — Satsang Diksha shlok reading, references, audio and quizzes.',
  icons: { icon: '/pathshala-seal.svg' },
};

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const classesData = await getAllClassesMetadata();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${notoDevanagari.variable} ${gujarati.variable} font-sans antialiased`}
      >
        <CursorGlow />
        <MainLayout classes={classesData}>
          {children}
        </MainLayout>
        <Analytics />
      </body>
    </html>
  );
}
