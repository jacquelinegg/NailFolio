import { NextResponse } from "next/server";

import { jsonError, requireString, withErrorHandling } from "@/lib/api";
import { getSignedUrl, uploadHandPhoto } from "@/lib/supabase";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** YouCam must be able to fetch the photo, and the status page shows it for days. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

async function extractMultipartFile(formData: FormData): Promise<{ data: Buffer; fileName: string; mimeType: string } | null> {
  const fileEntry = formData.get("file");

  console.log("[hand-photo] formData entries", Array.from(formData.entries()).map(([key, value]) => {
    const blobValue = value as any;
    if (blobValue && typeof blobValue.arrayBuffer === "function" && "name" in blobValue) {
      return { key, type: "File", name: blobValue.name, size: blobValue.size, mimeType: blobValue.type };
    }
    if (blobValue && typeof blobValue.arrayBuffer === "function") {
      return { key, type: "Blob", size: blobValue.size, mimeType: blobValue.type };
    }
    return { key, type: typeof value, value: String(value).slice(0, 200) };
  }));

  const blobEntry = fileEntry as any;
  if (blobEntry && typeof blobEntry.arrayBuffer === "function" && "name" in blobEntry) {
    const buffer = Buffer.from(await blobEntry.arrayBuffer());
    console.log("[hand-photo] extracted File", { name: blobEntry.name, size: blobEntry.size, mimeType: blobEntry.type });
    return { data: buffer, fileName: blobEntry.name, mimeType: blobEntry.type };
  }

  if (blobEntry && typeof blobEntry.arrayBuffer === "function") {
    const buffer = Buffer.from(await blobEntry.arrayBuffer());
    const filenameField = formData.get("filename");
    const fileValue = filenameField as any;
    const fileName = fileValue && typeof fileValue.arrayBuffer === "function" && "name" in fileValue ? fileValue.name : "upload.jpg";
    const mimeType = blobEntry.type || "application/octet-stream";
    console.log("[hand-photo] extracted Blob", { size: buffer.length, fileName, mimeType });
    return { data: buffer, fileName, mimeType };
  }

  if (typeof fileEntry === "string") {
    const filenameField = formData.get("filename");
    const fileValue = filenameField as any;
    const fileName = fileValue && typeof fileValue.arrayBuffer === "function" && "name" in fileValue ? fileValue.name : "upload.jpg";
    const mimeTypeField = formData.get("mimeType");
    const mimeValue = mimeTypeField as any;
    const mimeType = mimeValue && typeof mimeValue.arrayBuffer === "function" && "name" in mimeValue ? mimeValue.name : "application/octet-stream";
    
    let base64 = fileEntry.replace(/\s/g, "");
    const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(base64);
    if (dataUrlMatch) {
      base64 = dataUrlMatch[2] ?? base64;
      console.log("[hand-photo] extracted data URL", { fileName, mimeType: dataUrlMatch[1] ?? "image/png", base64Length: base64.length });
      return { data: Buffer.from(base64, "base64"), fileName, mimeType: dataUrlMatch[1] ?? "image/png" };
    }
    
    console.log("[hand-photo] extracted base64 string", { fileName, mimeType, base64Length: base64.length });
    return { data: Buffer.from(base64, "base64"), fileName, mimeType };
  }

  console.log("[hand-photo] fileEntry is not File/Blob/string", typeof fileEntry);
  return null;
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    console.log("[hand-photo] request received", {
      method: request.method,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
    });

    const formData = await request.formData().catch((error) => {
      console.error("[hand-photo] Failed to parse FormData", error);
      return null;
    });

    if (!formData) {
      return jsonError(400, "INVALID_REQUEST", "Attach the hand photo as a `file` field.");
    }

    console.log("[hand-photo] formData keys", Array.from(formData.keys()));

    const extracted = await extractMultipartFile(formData);

    if (!extracted) {
      console.error("[hand-photo] extractMultipartFile returned null");
      return jsonError(400, "INVALID_REQUEST", "Attach the hand photo as a `file` field.");
    }

    console.log("[hand-photo] extracted file", { fileName: extracted.fileName, mimeType: extracted.mimeType, size: extracted.data.length });

    if (extracted.data.length > MAX_UPLOAD_BYTES) {
      console.error("[hand-photo] file too large", { size: extracted.data.length, max: MAX_UPLOAD_BYTES });
      return jsonError(400, "FILE_TOO_LARGE", "Hand photos must be under 12MB.");
    }

    const sessionToken = formData.get("sessionToken");
    const wrapped = new File([extracted.data.buffer as ArrayBuffer], extracted.fileName, { type: extracted.mimeType });

    try {
      const result = await uploadHandPhoto(
        wrapped,
        typeof sessionToken === "string" && sessionToken.length > 0
          ? sessionToken
          : undefined,
      );

      console.log("[hand-photo] uploadHandPhoto success", { bucket: result.bucket, path: result.path });
      const signedUrl = await getSignedUrl(result.bucket, result.path, SIGNED_URL_TTL_SECONDS);
      console.log("[hand-photo] signed url generated", { signedUrl });

      return NextResponse.json({
        url: signedUrl,
        path: result.path,
        bucket: result.bucket,
      });
    } catch (error) {
      console.error("[hand-photo] Upload or sign failed", error);
      throw error;
    }
  });
}
