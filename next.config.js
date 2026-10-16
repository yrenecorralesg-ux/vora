/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

module.exports = nextConfig;
