import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HandPhotoUpload } from "@/components/client/HandPhotoUpload";
import { renderWithLocale } from "@/test/renderWithLocale";

function handFile(name = "hand.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function selectFile(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

describe("HandPhotoUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads a chosen photo and emits the returned URL", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://signed/hand.jpg", path: "hand-photos/a.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={onChange} />);

    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    selectFile(fileInput, handFile());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://signed/hand.jpg"));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/hand-photo");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("previews the uploaded photo and offers a retake", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ url: "https://signed/hand.jpg" }), { status: 200 })),
    );

    renderWithLocale(<HandPhotoUpload value="https://signed/hand.jpg" onChange={vi.fn()} />);

    expect(screen.getByAltText("Your uploaded hand")).toHaveAttribute("src", "https://signed/hand.jpg");
    expect(screen.getByRole("button", { name: /retake photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /take a photo/i })).not.toBeInTheDocument();
  });

  it("rejects unsupported file types before uploading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={onChange} />);
    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    selectFile(fileInput, handFile("notes.pdf", "application/pdf"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG or WebP/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("surfaces server upload errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Storage unavailable" } }), { status: 500 })),
    );

    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    selectFile(fileInput, handFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("Storage unavailable");
  });

  it("accepts a dropped file", async () => {
    const onChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ url: "https://signed/drop.jpg" }), { status: 200 })),
    );

    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={onChange} />);
    const dropzone = container.querySelector("div.rounded-2xl") as HTMLElement;

    fireEvent.drop(dropzone, { dataTransfer: { files: [handFile()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://signed/drop.jpg"));
  });

  it("shows an example hand shot in the empty dropzone", () => {
    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={vi.fn()} />);

    const shot = container.querySelector('img[src="/hand.png"]') as HTMLImageElement;
    expect(shot).toBeInTheDocument();
    // Decorative: the surrounding copy already says what to do.
    expect(shot).toHaveAttribute("alt", "");
  });

  it("no longer renders a drawn hand or an emoji", () => {
    const { container } = renderWithLocale(<HandPhotoUpload value={null} onChange={vi.fn()} />);

    // A hand sketched in SVG was tried here and read as a scribble at this
    // size; the photograph replaced it and the geometry module went with it.
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).not.toContain("🤚");
  });
});
