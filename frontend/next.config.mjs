/** @type {import('next').NextConfig} */

// 前后端代理统一由 src/middleware.ts 在运行时实现（BACKEND_ORIGIN 可在容器环境变量中指定）。
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
