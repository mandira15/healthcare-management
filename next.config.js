/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for node-cron and googleapis which use Node.js APIs
  experimental: {
    serverComponentsExternalPackages: ['node-cron', 'nodemailer', 'googleapis'],
  },
  images: {
    remotePatterns: []
  }
};

module.exports = nextConfig;
