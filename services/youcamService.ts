/**
 * Step 2 — YouCam AI Nail Transfer (async S2S) integration.
 *
 * Flow:
 *   1. POST  {base}{path}            -> `{ code, data: { task_id } }`
 *   2. GET   {base}{path}/{task_id}  -> poll until `status === "SUCCESS"`
 *   3. Return `result_file_url` (the rendered nails on the client's hand photo).
 *
 * Every network dependency (fetch, clock, sleep) is injectable so the service can
 * be unit-tested without hitting the real provider.
 */

import { serverEnv } from "@/lib/env";

/* -------------------------------------------------------------------------- */
/* Mock fallback                                                               */
/* -------------------------------------------------------------------------- */

const MOCK_FALLBACK_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRTFFQjIwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjRjFGNTYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TW9jayB5b3VDYW0gRnJhbmtpbmc8L3RleHQ+PC9zdmc+";

function isMockMode(options: YouCamServiceOptions): boolean {
  if (options.mock === true) return true;
  try {
    const raw = String(serverEnv.mockYouCam);
    return raw === "true";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type YouCamErrorCode =
  | "MISSING_API_KEY"
  | "NETWORK"
  | "HTTP"
  | "PROVIDER"
  | "INVALID_RESPONSE"
  | "TASK_FAILED"
  | "TIMEOUT"
  | "ABORTED";

export class YouCamError extends Error {
  readonly code: YouCamErrorCode;
  readonly httpStatus?: number;
  readonly taskId?: string;
  readonly providerMessage?: string;

  constructor(
    code: YouCamErrorCode,
    message: string,
    options: { httpStatus?: number; taskId?: string; providerMessage?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "YouCamError";
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.taskId = options.taskId;
    this.providerMessage = options.providerMessage;
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface NailTransferRequest {
  /** Publicly/signedly reachable URL of the client's hand photo. */
  srcFileUrl: string;
  /** Reference design: the artist portfolio look the transfer is based on. */
  refFileUrl: string;
  effectType?: "nail_art";
  version?: string;
}

export type NailTaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE" | "CANCELLED";

export interface NailTaskState {
  taskId: string;
  status: NailTaskStatus;
  resultFileUrl?: string;
  errorMessage?: string;
}

interface ProviderEnvelope<T> {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: T;
  error?: { code?: number | string; msg?: string; message?: string };
  task_id?: string;
  status?: string;
  result_file_url?: string;
  result?: { file_url?: string; url?: string; result_file_url?: string };
}

interface CreateTaskData {
  task_id?: string;
  taskId?: string;
}

/* -------------------------------------------------------------------------- */
/* Service options                                                             */
/* -------------------------------------------------------------------------- */

export interface YouCamServiceOptions {
  apiKey?: string;
  baseUrl?: string;
  taskPath?: string;
  pollIntervalMs?: number;
  /** Hard deadline for the whole create + poll cycle. Default 30s. */
  pollTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Caller-controlled cancellation (e.g. HTTP request abort). */
  signal?: AbortSignal;
  /** Force mock mode: return a fallback image without calling the provider. */
  mock?: boolean;
}

interface ResolvedOptions {
  apiKey: string;
  baseUrl: string;
  taskPath: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  signal?: AbortSignal;
}

const TERMINAL_FAILURES: ReadonlySet<string> = new Set(["FAILURE", "FAILED", "FAIL", "CANCELLED", "CANCELED"]);
const TERMINAL_SUCCESS: ReadonlySet<string> = new Set(["SUCCESS", "SUCCEEDED", "COMPLETED", "DONE"]);

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function resolveOptions(options: YouCamServiceOptions): ResolvedOptions {
  let apiKey = options.apiKey;
  let baseUrl = options.baseUrl;
  let taskPath = options.taskPath;
  let pollIntervalMs = options.pollIntervalMs;
  let pollTimeoutMs = options.pollTimeoutMs;

  try {
    apiKey ??= serverEnv.youcamApiKey;
    baseUrl ??= serverEnv.youcamApiBaseUrl;
    taskPath ??= serverEnv.youcamAiNailPath;
    pollIntervalMs ??= serverEnv.youcamPollIntervalMs;
    pollTimeoutMs ??= serverEnv.youcamPollTimeoutMs;
  } catch (error) {
    if (apiKey === undefined) {
      throw error instanceof YouCamError
        ? error
        : new YouCamError("MISSING_API_KEY", "YOUCAM_API_KEY is not configured on the server.", { cause: error });
    }
  }

  if (!apiKey) {
    throw new YouCamError("MISSING_API_KEY", "YOUCAM_API_KEY is not configured on the server.");
  }

  return {
    apiKey,
    baseUrl: (baseUrl ?? "https://s2s.ai.makeupar.com").replace(/\/+$/, ""),
    taskPath: normalisePath(taskPath ?? "/s2s/v2.0/task/ai-nail"),
    pollIntervalMs: pollIntervalMs ?? 1_500,
    pollTimeoutMs: pollTimeoutMs ?? 30_000,
    fetch: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? defaultSleep,
    now: options.now ?? (() => Date.now()),
    signal: options.signal,
  };
}

function normalisePath(path: string): string {
  return path.startsWith("/") ? path.replace(/\/+$/, "") : `/${path.replace(/\/+$/, "")}`;
}

/**
 * Gentle exponential backoff between polls: 1.5s, 2.25s, 3.375s ... capped at 5s,
 * so we stay responsive early without hammering the provider on long renders.
 */
export function computePollDelay(attempt: number, baseIntervalMs: number, maxIntervalMs = 5_000): number {
  const delay = baseIntervalMs * 1.5 ** attempt;
  return Math.min(Math.round(delay), maxIntervalMs);
}

function assertHttpUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new YouCamError("INVALID_RESPONSE", `${field} must be an absolute URL, received "${value}".`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new YouCamError("INVALID_RESPONSE", `${field} must be http(s), received "${parsed.protocol}".`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* HTTP plumbing                                                               */
/* -------------------------------------------------------------------------- */

async function readJson(response: Response, taskId?: string): Promise<ProviderEnvelope<unknown>> {
  const text = await response.text();
  if (text.length === 0) return {};

  try {
    return JSON.parse(text) as ProviderEnvelope<unknown>;
  } catch (error) {
    throw new YouCamError("INVALID_RESPONSE", `YouCam returned non-JSON body (HTTP ${response.status}).`, {
      httpStatus: response.status,
      taskId,
      cause: error,
    });
  }
}

function providerErrorMessage(body: ProviderEnvelope<unknown>, fallback: string): string {
  return body.msg ?? body.message ?? body.error?.msg ?? body.error?.message ?? fallback;
}

function assertProviderOk(body: ProviderEnvelope<unknown>, httpStatus: number, taskId?: string): void {
  const code = body.code ?? body.error?.code;
  // The YouCam S2S API signals success with `code === 0`.
  if (code !== undefined && code !== 0 && code !== "0") {
    throw new YouCamError("PROVIDER", providerErrorMessage(body, "YouCam rejected the request."), {
      httpStatus,
      taskId,
      providerMessage: providerErrorMessage(body, "unknown provider error"),
    });
  }
}

async function sendRequest(
  options: ResolvedOptions,
  url: string,
  init: RequestInit,
  taskId?: string,
): Promise<{ response: Response; body: ProviderEnvelope<unknown> }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${options.apiKey}`);
  headers.set("Content-Type", "application/json");
  if (options.signal) {
    if (options.signal.aborted) {
      throw new YouCamError("ABORTED", "YouCam request aborted before dispatch.", { taskId });
    }
    init.signal = options.signal;
  }

  let response: Response;
  try {
    response = await options.fetch(url, { ...init, headers });
  } catch (error) {
    if (error instanceof YouCamError) throw error;
    const aborted = options.signal?.aborted === true;
    throw new YouCamError(
      aborted ? "ABORTED" : "NETWORK",
      aborted ? "YouCam request aborted by the caller." : `Network failure calling ${url}.`,
      { taskId, cause: error },
    );
  }

  const body = await readJson(response, taskId);
  if (!response.ok) {
    throw new YouCamError("HTTP", providerErrorMessage(body, `YouCam responded with HTTP ${response.status}.`), {
      httpStatus: response.status,
      taskId,
      providerMessage: providerErrorMessage(body, "unknown provider error"),
    });
  }

  assertProviderOk(body, response.status, taskId);
  return { response, body };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** Submits the transfer job and returns the provider task id. */
export async function createNailTransferTask(
  request: NailTransferRequest,
  options: YouCamServiceOptions = {},
): Promise<string> {
  const resolved = resolveOptions(options);

  const srcFileUrl = assertHttpUrl(request.srcFileUrl, "clientHandUrl");
  const refFileUrl = assertHttpUrl(request.refFileUrl, "referenceDesignUrl");

  const { body } = await sendRequest(
    resolved,
    `${resolved.baseUrl}${resolved.taskPath}`,
    {
      method: "POST",
      body: JSON.stringify({
        version: request.version ?? "1.0",
        src_file_url: srcFileUrl,
        effect_type: request.effectType ?? "nail_art",
        ref_file_url: refFileUrl,
      }),
    },
  );

  const data = body.data as CreateTaskData | undefined;
  const taskId = data?.task_id ?? data?.taskId ?? body.task_id;
  if (!taskId) {
    throw new YouCamError("INVALID_RESPONSE", "YouCam accepted the request but returned no task_id.");
  }
  return taskId;
}

/** Reads the current state of a transfer task. */
export async function getNailTransferTask(
  taskId: string,
  options: YouCamServiceOptions = {},
): Promise<NailTaskState> {
  const resolved = resolveOptions(options);
  const { body } = await sendRequest(
    resolved,
    `${resolved.baseUrl}${resolved.taskPath}/${encodeURIComponent(taskId)}`,
    { method: "GET" },
    taskId,
  );

  const data = (body.data ?? body) as ProviderEnvelope<unknown>;
  const rawStatus = String(data.status ?? body.status ?? "PROCESSING").toUpperCase();
  const resultFileUrl = data.result_file_url ?? data.result?.file_url ?? data.result?.url ?? data.result?.result_file_url ?? body.result_file_url;

  const status: NailTaskStatus = TERMINAL_SUCCESS.has(rawStatus)
    ? "SUCCESS"
    : TERMINAL_FAILURES.has(rawStatus)
      ? "FAILURE"
      : rawStatus === "PENDING"
        ? "PENDING"
        : "PROCESSING";

  const state: NailTaskState = { taskId, status };
  if (resultFileUrl) state.resultFileUrl = resultFileUrl;
  if (status === "FAILURE") {
    state.errorMessage = providerErrorMessage(body, "YouCam reported the render task as failed.");
  }
  return state;
}

/**
 * Runs the full create + poll cycle and resolves with the rendered image URL.
 *
 * @throws {YouCamError} `TIMEOUT` after `pollTimeoutMs` (default 30s),
 *         `TASK_FAILED` when the provider marks the task as failed.
 */
export async function transferNailArt(
  clientHandUrl: string,
  referenceDesignUrl: string,
  options: YouCamServiceOptions = {},
): Promise<string> {
  if (isMockMode(options)) {
    console.warn("[YouCam] API unavailable/mocked. Loaded local fallback render.");
    return MOCK_FALLBACK_URL;
  }

  const resolved = resolveOptions(options);
  const deadline = resolved.now() + resolved.pollTimeoutMs;

  const taskId = await createNailTransferTask(
    { srcFileUrl: clientHandUrl, refFileUrl: referenceDesignUrl },
    { ...options, apiKey: resolved.apiKey, baseUrl: resolved.baseUrl, taskPath: resolved.taskPath },
  );

  let attempt = 0;
  while (true) {
    if (resolved.now() >= deadline) {
      throw new YouCamError("TIMEOUT", `YouCam render task ${taskId} did not finish within ${resolved.pollTimeoutMs}ms.`, {
        taskId,
      });
    }

    const state = await getNailTransferTask(taskId, {
      ...options,
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      taskPath: resolved.taskPath,
    });

    if (state.status === "SUCCESS") {
      if (!state.resultFileUrl) {
        throw new YouCamError("INVALID_RESPONSE", `YouCam task ${taskId} succeeded without a result_file_url.`, {
          taskId,
        });
      }
      return state.resultFileUrl;
    }

    if (state.status === "FAILURE") {
      throw new YouCamError("TASK_FAILED", state.errorMessage ?? `YouCam render task ${taskId} failed.`, { taskId });
    }

    const delay = Math.min(computePollDelay(attempt, resolved.pollIntervalMs), Math.max(deadline - resolved.now(), 0));
    attempt += 1;
    if (delay <= 0) {
      throw new YouCamError("TIMEOUT", `YouCam render task ${taskId} did not finish within ${resolved.pollTimeoutMs}ms.`, {
        taskId,
      });
    }
    await resolved.sleep(delay);
  }
}

/** Maps a YouCamError to a client-safe message + HTTP status for API routes. */
export function toYouCamHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof YouCamError) {
    switch (error.code) {
      case "MISSING_API_KEY":
        return { status: 500, message: "Nail rendering is not configured on this server." };
      case "ABORTED":
        return { status: 499, message: "Render request cancelled." };
      case "TIMEOUT":
        return { status: 504, message: "Rendering took too long. Please try again." };
      case "INVALID_RESPONSE":
      case "PROVIDER":
      case "TASK_FAILED":
        return { status: 502, message: "The render service rejected the request. Please try again." };
      case "NETWORK":
      case "HTTP":
      default:
        return { status: 502, message: "The render service is unavailable right now." };
    }
  }
  return { status: 500, message: "Unexpected error while rendering the design." };
}
