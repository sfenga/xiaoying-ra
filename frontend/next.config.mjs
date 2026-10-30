/** @type {import('next').NextConfig} */

// 前端通过 Next rewrites 把 /api、/demo、/files 代理到 Java 后端，
// 浏览器只见单一来源，天然避免跨域；BACKEND_ORIGIN 可在部署时指定后端地址。
const API_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:8080";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/demo/:path*", destination: `${API_ORIGIN}/demo/:path*` },
      { source: "/files/:path*", destination: `${API_ORIGIN}/files/:path*` },
    ];
  },
};

export default nextConfig;
