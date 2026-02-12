import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Disable compression so SSE streams are not buffered by gzip.
  // This app runs locally behind a Cloudflare Tunnel, so compression is unnecessary.
  compress: false,
  devIndicators: false,
};

export default nextConfig;
