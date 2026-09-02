import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/search/rerank': ['./search-proxy/**/*'],
    '/api/v1/[...mlma]': ['./spec/track-architecture/**/*'],
  },
  async redirects() {
    return [
      // Старые публичные адреса каталога ведут в оболочку без потери Track ID.
      { source: '/tracks/:trackId', destination: '/track/:trackId', permanent: true },
      { source: '/catalog', destination: '/library', permanent: true },
    ];
  },
};

export default nextConfig;
