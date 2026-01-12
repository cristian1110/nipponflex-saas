/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Marcar canvas como externo para evitar errores con pdfjs-dist
      config.externals = config.externals || []
      config.externals.push('canvas')
    }
    return config
  },
}

module.exports = nextConfig
