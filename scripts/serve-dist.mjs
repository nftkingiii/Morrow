import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!existsSync(join(root, "index.html"))) {
  throw new Error("dist/index.html is missing. Run pnpm build before starting Morrow.");
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const candidate = resolve(root, `.${normalize(pathname)}`);
  const safeCandidate = candidate === root || candidate.startsWith(`${root}\\`) || candidate.startsWith(`${root}/`);
  if (!safeCandidate) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Invalid path");
    return;
  }
  const requestedFileExists = existsSync(candidate) && statSync(candidate).isFile();
  if (!requestedFileExists && extname(pathname)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end("Not found");
    return;
  }
  const filePath = requestedFileExists ? candidate : join(root, "index.html");
  const extension = extname(filePath).toLowerCase();
  const fileSize = statSync(filePath).size;
  const range = extension === ".mp4" ? request.headers.range : undefined;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const requestedEnd = match?.[2] ? Number(match[2]) : fileSize - 1;
    const end = Math.min(requestedEnd, fileSize - 1);
    if (!match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileSize) {
      response.writeHead(416, { "Content-Range": `bytes */${fileSize}`, "X-Content-Type-Options": "nosniff" });
      response.end();
      return;
    }
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Content-Length": String(fileSize),
    ...(extension === ".mp4" ? { "Accept-Ranges": "bytes" } : {}),
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`Morrow listening on port ${port}\n`);
});
