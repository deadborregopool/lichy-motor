import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'Lichy Motor | Repuestos & Aceites de Motos (Harley Edition)',
  description: 'Sistema integral de mostrador POS, inventario de lubricantes a granel y repuestos de motos.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Lichy Motor',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lichy Motor',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0C0F' },
    { media: '(prefers-color-scheme: light)', color: '#FF5E00' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="dark">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <PwaRegister />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

