import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("POST /api/render", () => {
  it("rejects local-only references before contacting YouCam", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(new Request("http://localhost/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handUrl: "https://cdn.example/hand.jpg",
        refImageUrl: "http://localhost:3000/api/local-image?filename=reference-01234567-89ab-cdef-0123-456789abcdef_00001_.png",
      }),
    }));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "LOCAL_REFERENCE_NOT_PUBLIC" } });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
