/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static generation — all pages are dynamic (required for Clerk auth)
  output: undefined,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // Suppress Clerk build warnings that aren't real errors
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

module.exports = nextConfig;
