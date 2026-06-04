import { createReadStream, statSync } from "node:fs";
import type { Stats } from "node:fs";
import { NextResponse } from "next/server";

type VideoResponseInput = {
  request: Request;
  filePath: string;
  contentDisposition: string;
  contentType?: string;
};

export function statVideoFile(filePath: string): Stats {
  return statSync(filePath);
}

export function createVideoResponse({
  request,
  filePath,
  contentDisposition,
  contentType = "video/mp4"
}: VideoResponseInput) {
  const stat = statVideoFile(filePath);
  const rangeHeader = request.headers.get("range");

  if (!rangeHeader) {
    const stream = createReadStream(filePath);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Content-Disposition": contentDisposition
      }
    });
  }

  const range = parseRangeHeader(rangeHeader, stat.size);
  if (!range) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${stat.size}`
      }
    });
  }

  const stream = createReadStream(filePath, { start: range.start, end: range.end });
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
      "Content-Length": String(range.end - range.start + 1),
      "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
      "Content-Disposition": contentDisposition
    }
  });
}

function parseRangeHeader(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) return null;

  if (!startText) {
    const suffixLength = Number.parseInt(endText, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    const start = Math.max(0, size - suffixLength);
    return { start, end: Math.max(start, size - 1) };
  }

  const start = Number.parseInt(startText, 10);
  const requestedEnd = endText ? Number.parseInt(endText, 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(requestedEnd)) return null;
  if (start < 0 || start >= size) return null;

  const end = Math.min(requestedEnd, size - 1);
  if (end < start) return null;
  return { start, end };
}
