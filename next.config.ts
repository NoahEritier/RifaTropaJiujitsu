import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // Vinext examines multipart forms before route handlers. Keep its cap above our 5 MB file limit.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        {key:'X-Content-Type-Options',value:'nosniff'},
        {key:'X-Frame-Options',value:'DENY'},
        {key:'Referrer-Policy',value:'no-referrer'},
        {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
        {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      ],
    }, {
      source:'/admin',
      headers:[{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}],
    }, {
      source:'/consulta',
      headers:[{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}],
    }];
  },
};
export default nextConfig;