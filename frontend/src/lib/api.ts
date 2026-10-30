import { getToken } from "./token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") return body.message;
  } catch {
    // ignore body parse errors
  }
  return `请求失败（${response.status}）`;
}

/**
 * 统一请求封装：
 * - 自动附带 Bearer Token
 * - 非 2xx 抛出 ApiError（含状态码与后端 message）
 * - 401 时清除本地登录态，由调用方决定界面表现
 */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch {
    // 网络层异常：无法区分后端任务是否失败，调用方必须保留任务原状态
    throw new ApiError(0, "网络异常，暂时无法连接服务器");
  }

  if (!response.ok) {
    const message = await parseError(response);
    if (response.status === 401) {
      // 会话失效：交由监听器清理（避免与 authStore 循环依赖）
      unauthorizedListeners.forEach((fn) => fn());
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const unauthorizedListeners: Array<() => void> = [];

export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.push(fn);
  return () => {
    const index = unauthorizedListeners.indexOf(fn);
    if (index >= 0) unauthorizedListeners.splice(index, 1);
  };
}
