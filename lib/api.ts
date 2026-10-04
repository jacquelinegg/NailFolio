/**
 * Small helpers shared by the client-facing API routes.
 * Keeps every route's error shape identical: `{ error: { code, message } }`.
 */

import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: { code: string; message: string };
}

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://192.168.0.100:3000",
  "http://192.168.0.100:8081",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])!;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function withCors(origin: string | null, response: NextResponse) {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => { if (value) response.headers.set(key, value); });
  return response;
}

export function corsPreflightResponse(origin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function jsonOk<T>(data: T, status = 200, origin?: string | null): NextResponse<ApiErrorBody | T> {
  const response = NextResponse.json(data as T, { status });
  if (origin) withCors(origin, response);
  return response;
}

export function jsonError(status: number, code: string, message: string, origin?: string | null): NextResponse<ApiErrorBody> {
  const response = NextResponse.json({ error: { code, message } }, { status });
  if (origin) withCors(origin, response);
  return response;
}

export class RequestValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "RequestValidationError";
    this.field = field;
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new RequestValidationError("body", "Request body must be valid JSON.");
  }
}

export function requireString(value: unknown, field: string, options: { max?: number; min?: number } = {}): string {
  const { max = 500, min = 1 } = options;
  if (typeof value !== "string") {
    throw new RequestValidationError(field, `"${field}" must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new RequestValidationError(field, `"${field}" is required.`);
  }
  if (trimmed.length > max) {
    throw new RequestValidationError(field, `"${field}" is too long (max ${max} characters).`);
  }
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 2_000): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, { max });
}

export function requireEmail(value: unknown, field = "email"): string {
  const email = requireString(value, field, { max: 320 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new RequestValidationError(field, "Enter a valid email address.");
  }
  return email;
}

export function requirePhone(value: unknown, field = "phone"): string {
  const phone = requireString(value, field, { max: 32 });
  if (!/^[+()\-.\s\d]{6,32}$/.test(phone)) {
    throw new RequestValidationError(field, "Enter a valid phone number.");
  }
  return phone;
}

export function requireFutureTimestamp(value: unknown, field: string): string {
  const iso = requireString(value, field, { max: 64 });
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    throw new RequestValidationError(field, "Use an ISO-8601 timestamp.");
  }
  if (timestamp <= Date.now()) {
    throw new RequestValidationError(field, "Appointment time must be in the future.");
  }
  return new Date(timestamp).toISOString();
}

export function requireUuid(value: unknown, field: string): string {
  const id = requireString(value, field, { max: 64 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new RequestValidationError(field, `"${field}" must be a UUID.`);
  }
  return id;
}

export function requireHttpUrl(value: unknown, field: string): string {
  const raw = requireString(value, field, { max: 2_048 });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RequestValidationError(field, `"${field}" must be an absolute URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new RequestValidationError(field, `"${field}" must be an http(s) URL.`);
  }
  return url.toString();
}

export function isSupabaseStorageError(error: unknown): error is Error {
  return error instanceof Error && error.name === "SupabaseStorageError";
}

/** Wraps a route handler body with uniform error handling. */
export async function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T> | NextResponse<ApiErrorBody>>,
  origin?: string | null,
): Promise<NextResponse<T | ApiErrorBody>> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonError(400, "INVALID_REQUEST", error.message, origin);
    }
    if (isSupabaseStorageError(error)) {
      return jsonError(400, "UPLOAD_FAILED", error.message, origin);
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, "INTERNAL_ERROR", message, origin);
  }
}
