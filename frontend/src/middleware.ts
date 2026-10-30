import { NextResponse, type NextRequest } from "next/server";

// 运行时反向代理：浏览器同源访问 /api、/demo、/files，由 Next 服务端转发到 Java 后端。
// 用 middleware 而非 next.config rewrites，保证 BACKEND_ORIGIN 在运行时（容器内）读取生效。
const API_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:8080";

export function middleware(request: NextRequest) {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, API_ORIGIN);
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/api/:path*", "/demo/:path*", "/files/:path*"],
};
