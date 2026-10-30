import type { Metadata } from 'next';
import './globals.css';
import { DataHydrator } from '@/components/layout/DataHydrator';
import { CsrfProvider } from '@/components/layout/CsrfProvider';

export const metadata: Metadata = {
  title: 'AI Academic Digital Twin — Editorial LMS',
  description: 'AI Academic Digital Twin',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-paper-0 text-ink-0 antialiased min-h-screen font-inter selection:bg-terracotta/20 selection:text-terracotta">
        <script
          dangerouslySetInnerHTML={{
            __html: "fetch('/api/auth/csrf', { credentials: 'same-origin' }).catch(() => {});",
          }}
        />
        <CsrfProvider />
        <DataHydrator />
        {children}
      </body>
    </html>
  );
}
