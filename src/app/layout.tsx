import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Noto_Serif_Devanagari, Noto_Sans_Gujarati } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/components/MainLayout';
import { getAllClassesMetadata } from '@/lib/data';
import { FeedbackButton } from '@/components/FeedbackButton';
import { CursorGlow } from '@/components/CursorGlow';

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
};

export const viewport: Viewport = {
  themeColor: '#17171b',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const classesData = await getAllClassesMetadata();

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${manrope.variable} ${notoDevanagari.variable} ${notoGujarati.variable} font-sans antialiased`}
      >
        <CursorGlow />
        <MainLayout classes={classesData}>
          {children}
        </MainLayout>
        <FeedbackButton />
      </body>
    </html>
  );
}
