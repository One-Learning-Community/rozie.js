/**
 * Multi-process static host for the visual-regression `dist/` tree.
 *
 * WHY THIS EXISTS
 * ---------------
 * `vite preview` is single-threaded and was the measured ceiling on VR wall
 * clock: it pegs at 79-84% of ONE core while the container sits at ~320% of
 * 600%. Vite BUNDLES sirv as its static handler, so swapping to `sirv-cli`
 * does not bypass that path — same core, minus middleware. Only a genuinely
 * multi-process server moves the ceiling.
 *
 * Caddy/nginx would also do it, but CI runs inside the pinned upstream image
 * (`mcr.microsoft.com/playwright:...@sha256:...`, referenced by digest from
 * .github/workflows/visual-regression.yml `container:`). That digest pin is a
 * deliberate threat mitigation (T-07-05), and neither server is in the image —
 * adding one means a per-run network install in both vr.sh and CI, or a derived
 * image that dissolves the pin. Node is already there, so `cluster` buys the
 * same multi-core win at zero image cost and keeps local == CI trivially.
 *
 * THE GZIP DESIGN, AND WHY IT IS NOT A RETRY OF A BURNED EXPERIMENT
 * ----------------------------------------------------------------
 * Removing the preview server's gzip was tried and REVERTED: the full suite got
 * SLOWER (21.2m uncompressed vs 19.3m compressed, mean test duration 3.16s ->
 * 3.49s). Mechanism: gzip trades *server* CPU (saturated) for *browser*
 * receive+parse (which had headroom) — a favourable trade. A curl microbenchmark
 * said the opposite because it never paid the browser-side receive cost, which
 * is exactly the term that flips the sign.
 *
 * So this server keeps the browser on compressed bytes, but PRE-compresses each
 * asset once at startup instead of per request. That removes the server-CPU term
 * without touching the browser-side term that made compression win. It is the
 * combination neither prior configuration tested.
 *
 * Contract is deliberately tiny — see vite.preview.config.ts for the tree shape:
 *   - `/` (and any path without a file extension) -> dist/index.html; every
 *     Playwright navigation is `/?example=<Name>&target=<target>`, and the
 *     router in index.html reads those query params client-side.
 *   - everything else -> the file at that path under dist/.
 * No SPA rewrite beyond that, no API, no range requests.
 */
import cluster from 'node:cluster';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { availableParallelism, cpus } from 'node:os';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip as gzipCb } from 'node:zlib';

const gzip = promisify(gzipCb);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'dist');
const GZ_CACHE = resolve(__dirname, '..', '.preview-gz');
const PORT = Number(process.env.VR_PREVIEW_PORT ?? 4180);

/**
 * `availableParallelism()` reflects the cgroup CPU budget the container was
 * actually given; `cpus().length` reports the HOST's core count and would
 * over-fork inside Docker. Prefer the former, fall back for older Node.
 */
const PARALLELISM =
  typeof availableParallelism === 'function' ? availableParallelism() : cpus().length;
const WORKERS = Math.max(1, Number(process.env.VR_PREVIEW_WORKERS ?? PARALLELISM));

// Wrong MIME on .js breaks ES module loading outright (the browser refuses the
// script), so this map is correctness-critical, not cosmetic.
const MIME = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
  }),
);

// Already-compressed payloads: gzipping these burns CPU for ~nothing.
const INCOMPRESSIBLE = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.gz',
]);

const MIN_GZIP_BYTES = 1024;

/** Recursively list every file under `dir`, as absolute paths. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * Pre-compress every compressible asset into `.preview-gz/`, mirroring the
 * dist/ layout. Runs ONCE in the primary before any worker starts listening, so
 * no request ever pays compression. Cache lives outside dist/ so it cannot
 * pollute build output or be mistaken for an emitted artifact.
 */
async function precompress() {
  const files = await walk(ROOT);
  let count = 0;
  let rawBytes = 0;
  let gzBytes = 0;
  let cursor = 0;

  // zlib's ASYNC gzip runs on the libuv threadpool, so N in-flight calls
  // genuinely use N threads — unlike gzipSync, which would serialize the whole
  // 1.8GB tree on one core. The dist is large enough that this is the
  // difference between a startup that fits inside Playwright's 240s
  // `webServer.timeout` and one that races it on a 6-CPU container.
  // UV_THREADPOOL_SIZE is set at the top of the primary branch, before any
  // threadpool work is queued (raising it later has no effect).
  async function drain() {
    for (;;) {
      const i = cursor++;
      if (i >= files.length) return;
      const file = files[i];
      const ext = extname(file).toLowerCase();
      if (INCOMPRESSIBLE.has(ext)) continue;
      const raw = readFileSync(file);
      if (raw.byteLength < MIN_GZIP_BYTES) continue;
      const gz = await gzip(raw, { level: 6 });
      // A "compressed" file larger than the original is worth neither the disk
      // nor the Content-Encoding round trip.
      if (gz.byteLength >= raw.byteLength) continue;
      const dest = join(GZ_CACHE, relative(ROOT, file)) + '.gz';
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, gz);
      count += 1;
      rawBytes += raw.byteLength;
      gzBytes += gz.byteLength;
    }
  }

  await Promise.all(Array.from({ length: PARALLELISM }, drain));
  return { count, rawBytes, gzBytes };
}

/** Resolve a URL path to an on-disk file, or null if it escapes the root. */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  // Any extensionless path is the router entry point; every Playwright
  // navigation is `/?example=...&target=...`, which lands here.
  const rel = extname(decoded) === '' ? 'index.html' : normalize(decoded).replace(/^\/+/, '');
  const abs = resolve(ROOT, rel);
  // Directory-traversal guard: the resolved path must stay under ROOT.
  if (abs !== ROOT && !abs.startsWith(ROOT + '/')) return null;
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  return abs;
}

function handle(req, res) {
  const file = resolveFile(req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const type = MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    // Screenshots must reflect the bytes just built. A stale 304 from a prior
    // run would silently diff against the wrong output.
    'Cache-Control': 'no-store',
  };

  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  const gzPath = join(GZ_CACHE, relative(ROOT, file)) + '.gz';
  if (wantsGzip && existsSync(gzPath)) {
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = statSync(gzPath).size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return void res.end();
    createReadStream(gzPath).pipe(res);
    return;
  }

  headers['Content-Length'] = statSync(file).size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file).pipe(res);
}

if (cluster.isPrimary) {
  if (!existsSync(ROOT)) {
    console.error(`[vr-preview] no dist/ at ${ROOT} — run \`pnpm build\` first.`);
    process.exit(1);
  }

  // Must be set before the first threadpool task is queued — Node reads it when
  // the pool is lazily created, and mutating it afterwards is a no-op.
  process.env.UV_THREADPOOL_SIZE ||= String(PARALLELISM);

  const t0 = Date.now();
  const { count, rawBytes, gzBytes } = await precompress();
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `[vr-preview] pre-compressed ${count} files ` +
      `(${mb(rawBytes)}MB -> ${mb(gzBytes)}MB) in ${Date.now() - t0}ms`,
  );

  for (let i = 0; i < WORKERS; i += 1) cluster.fork();

  // A worker that dies mid-suite would silently shrink capacity and could hang
  // in-flight navigations; replace it rather than limping.
  cluster.on('exit', (worker, code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;
    console.error(`[vr-preview] worker ${worker.process.pid} died (${signal ?? code}); restarting`);
    cluster.fork();
  });

  // Workers share one listening socket, so the port is bound by the time the
  // first worker is up; Playwright's `webServer.port` probe gates on that.
  console.log(`[vr-preview] serving ${ROOT} on http://localhost:${PORT} with ${WORKERS} workers`);
} else {
  createServer(handle).listen(PORT);
}
