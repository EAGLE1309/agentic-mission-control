import { ConvexError } from "convex/values";

// UI error codes (tech spec §11). Design §5.7 maps each code to its copy.
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "QUOTA_EXCEEDED",
  "CAPACITY_EXHAUSTED",
  "INVALID_INPUT",
  "MISSION_NOT_ACTIVE",
  "APP_NOT_CONFIGURED",
  "APP_CONNECT_FAILED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppErrorData = {
  code: ErrorCode;
  message?: string;
  resetAt?: number;
};

export function appError(code: ErrorCode, extra: Omit<AppErrorData, "code"> = {}) {
  const data: AppErrorData = { code };
  if (extra.message !== undefined) data.message = extra.message;
  if (extra.resetAt !== undefined) data.resetAt = extra.resetAt;
  return new ConvexError(data);
}

export function appErrorData(error: unknown): AppErrorData | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return null;
  const code = (data as { code: unknown }).code;
  if (!ERROR_CODES.includes(code as ErrorCode)) return null;
  return data as AppErrorData;
}

export function errorCode(error: unknown): ErrorCode | null {
  return appErrorData(error)?.code ?? null;
}
