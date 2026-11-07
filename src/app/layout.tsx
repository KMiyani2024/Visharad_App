import type { Metadata, Viewport } from 'next';
import { Analytics } from "@vercel/analytics/next";
import { Inter, Manrope, Noto_Serif_Devanagari, Noto_Sans_Gujarati } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/components/MainLayout';
import { getAllClassesMetadata } from '@/lib/data';
import { CursorGlow } from '@/components/CursorGlow';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const notoDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari'],
  weight: ['500', '600', '700'],
  variable: '--font-noto-devanagari',
});
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '500', '600'],
  variable: '--font-noto-gujarati',
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
        className={`${inter.variable} ${manrope.variable} ${notoDevanagari.variable} ${notoGujarati.variable} font-sans antialiased`}
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
