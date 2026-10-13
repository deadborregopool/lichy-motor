/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cqawsupdyywnloibeltk.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  devIndicators: false,
  allowedDevOrigins: ['192.168.1.42', '192.168.1.42:3000'],
};

export default nextConfig;
