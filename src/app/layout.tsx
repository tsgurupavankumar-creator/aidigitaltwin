import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Academic Digital Twin — Editorial LMS',
  description: 'Human-crafted Academic Digital Twin Intelligence Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-paper-0 text-ink-0 antialiased min-h-screen font-inter selection:bg-terracotta/20 selection:text-terracotta">
        {children}
      </body>
    </html>
  );
}
