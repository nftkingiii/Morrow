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

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`Morrow listening on port ${port}\n`);
});
