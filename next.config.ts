import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  // Production optimizations
  output: 'standalone', // Smaller Docker images, faster cold starts
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  
  // Enable console logs in production for debugging
  // Remove this or set to true to remove console logs in production
  compiler: {
    removeConsole: false, // Keep console logs in production
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Modern formats
    minimumCacheTTL: 60 * 60 * 24 * 30, // Cache images for 30 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Caching and performance
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'recharts',
      'date-fns',
      'lucide-react',
    ],
    
    // Server actions optimization
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Production optimizations only
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    
    // Ensure console logs are not removed in production
    // This is a fallback if compiler.removeConsole doesn't work
    if (!dev && config.optimization?.minimizer) {
      config.optimization.minimizer = config.optimization.minimizer.map((plugin: { constructor: { name: string }; options?: { terserOptions?: { compress?: { drop_console?: boolean } } } }) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options = plugin.options || {};
          plugin.options.terserOptions = {
            ...plugin.options.terserOptions,
            compress: {
              ...plugin.options.terserOptions?.compress,
              drop_console: false, // Keep console logs
            },
          };
        }
        return plugin;
      });
    }
    
    return config;
  },
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
