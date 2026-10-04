import { describe, expect, it, vi } from "vitest";

import {
  computePollDelay,
  createNailTransferTask,
  getNailTransferTask,
  toYouCamHttpError,
  transferNailArt,
  YouCamError,
} from "@/services/youcamService";

const BASE = { apiKey: "test-key", baseUrl: "https://s2s.example", taskPath: "/s2s/v2.0/task/ai-nail" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function makeFetch(handlers: { post: () => Response; get: (call: number) => Response }) {
  const calls: RecordedCall[] = [];
  let getCalls = 0;
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (init?.method === "POST") {
      return handlers.post();
    }
    getCalls += 1;
    return handlers.get(getCalls);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, getCalls: () => getCalls };
}

describe("transferNailArt", () => {
  it("creates a task, polls, and returns the rendered URL", async () => {
    const { fetchImpl, calls } = makeFetch({
      post: () => jsonResponse({ code: 0, data: { task_id: "task-123" } }),
      get: (call) =>
        jsonResponse(
          call < 3
            ? { code: 0, data: { task_id: "task-123", status: "PROCESSING" } }
            : { code: 0, data: { task_id: "task-123", status: "SUCCESS", result_file_url: "https://cdn/result.jpg" } },
        ),
    });

    const sleep = vi.fn(async (_ms: number) => {});
    const result = await transferNailArt("https://cdn/hand.jpg", "https://cdn/ref.jpg", {
      ...BASE,
      fetchImpl,
      sleep,
    });

    expect(result).toBe("https://cdn/result.jpg");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1_500, 2_250]);

    const createCall = calls[0]!;
    expect(createCall.url).toBe("https://s2s.example/s2s/v2.0/task/ai-nail");
    expect(JSON.parse(String(createCall.init?.body))).toEqual({
      version: "1.0",
      src_file_url: "https://cdn/hand.jpg",
      effect_type: "nail_art",
      ref_file_url: "https://cdn/ref.jpg",
    });
  });

  it("sends the bearer token", async () => {
    const { fetchImpl, calls } = makeFetch({
      post: () => jsonResponse({ code: 0, data: { task_id: "t1" } }),
      get: () => jsonResponse({ code: 0, data: { status: "SUCCESS", result_file_url: "https://cdn/r.jpg" } }),
    });

    await transferNailArt("https://cdn/hand.jpg", "https://cdn/ref.jpg", { ...BASE, fetchImpl, sleep: async () => {} });

    const headers = calls[0]!.init?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-key");
  });

  it("throws TASK_FAILED when the provider fails the task", async () => {
    const { fetchImpl } = makeFetch({
      post: () => jsonResponse({ code: 0, data: { task_id: "t2" } }),
      get: () => jsonResponse({ code: 0, msg: "model error", data: { status: "FAILURE" } }),
    });

    const error = await transferNailArt("https://cdn/hand.jpg", "https://cdn/ref.jpg", {
      ...BASE,
      fetchImpl,
      sleep: async () => {},
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(YouCamError);
    expect((error as YouCamError).code).toBe("TASK_FAILED");
    expect((error as YouCamError).taskId).toBe("t2");
  });

  it("throws TIMEOUT once the budget is exhausted", async () => {
    let clock = 0;
    const { fetchImpl } = makeFetch({
      post: () => jsonResponse({ code: 0, data: { task_id: "t3" } }),
      get: () => jsonResponse({ code: 0, data: { status: "PROCESSING" } }),
    });

    const error = await transferNailArt("https://cdn/hand.jpg", "https://cdn/ref.jpg", {
      ...BASE,
      fetchImpl,
      now: () => clock,
      pollTimeoutMs: 5_000,
      sleep: async (ms) => {
        clock += ms;
      },
    }).catch((e: unknown) => e);

    expect((error as YouCamError).code).toBe("TIMEOUT");
    expect(clock).toBeLessThanOrEqual(5_000);
  });

  it("surfaces provider errors on the create call", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 1001, msg: "invalid api key" }, 200));

    const error = await createNailTransferTask(
      { srcFileUrl: "https://cdn/hand.jpg", refFileUrl: "https://cdn/ref.jpg" },
      { ...BASE, fetchImpl: fetchImpl as unknown as typeof fetch },
    ).catch((e: unknown) => e);

    expect((error as YouCamError).code).toBe("PROVIDER");
    expect((error as YouCamError).providerMessage).toBe("invalid api key");
  });

  it("maps HTTP errors and aborts", async () => {
    const httpError = await createNailTransferTask(
      { srcFileUrl: "https://cdn/hand.jpg", refFileUrl: "https://cdn/ref.jpg" },
      { ...BASE, fetchImpl: (async () => jsonResponse({ msg: "boom" }, 502)) as unknown as typeof fetch },
    ).catch((e: unknown) => e);
    expect((httpError as YouCamError).code).toBe("HTTP");
    expect(toYouCamHttpError(httpError)).toEqual({ status: 502, message: "The render service is unavailable right now." });

    const controller = new AbortController();
    controller.abort();
    const abortError = await getNailTransferTask("t4", { ...BASE, signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect((abortError as YouCamError).code).toBe("ABORTED");
  });

  it("rejects relative image urls before calling the provider", async () => {
    const fetchImpl = vi.fn();
    const error = await transferNailArt("/local/hand.jpg", "https://cdn/ref.jpg", {
      ...BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect((error as YouCamError).code).toBe("INVALID_RESPONSE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("computePollDelay", () => {
  it("backs off exponentially and caps", () => {
    expect(computePollDelay(0, 1_500)).toBe(1_500);
    expect(computePollDelay(1, 1_500)).toBe(2_250);
    expect(computePollDelay(5, 1_500)).toBe(5_000);
  });
});
