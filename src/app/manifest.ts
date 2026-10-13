import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LICHY MOTOR - Taller & Punto de Venta',
    short_name: 'Lichy Motor',
    description: 'Sistema integral de taller, venta de repuestos y lubricantes a granel (Harley Edition)',
    start_url: '/pos',
    scope: '/',
    display: 'standalone',
    background_color: '#0A0C0F',
    theme_color: '#FF5E00',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
