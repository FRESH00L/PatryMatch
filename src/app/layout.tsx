import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PartyMatch — poznaj kogoś na tej imprezie',
  description:
    'Zeskanuj kod QR imprezy, zrób selfie i swipuj ludzi, którzy są tu teraz. Profile znikają po zakończeniu imprezy.',
  applicationName: 'PartyMatch',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PartyMatch' },
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
