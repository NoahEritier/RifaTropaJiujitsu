import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1','localhost'],
  serverExternalPackages: ['@libsql/client'],
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'}, {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    ]},...['/admin','/consulta'].map(source=>({source,headers:[
      {key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'},
    ]}))];
  },
};
export default nextConfig;