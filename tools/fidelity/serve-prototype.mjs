/**
 * Static file server for a local design-handoff prototype.
 *
 * Babel-in-the-browser (used by the prototypes) can't fetch `.jsx` modules over
 * `file://` — CORS blocks it — so the prototype must be served over HTTP. Run
 * this alongside `bun run dev` while doing visual-fidelity work.
 *
 *   bun run fidelity:serve
 *   PROTOTYPE_DIR=path/to/prototype PORT=8099 bun tools/fidelity/serve-prototype.mjs
 *
 * Env:
 *   PROTOTYPE_DIR    prototype folder (default: design_handoff_helpdesk_redesign/prototype)
 *   PROTOTYPE_INDEX  entry HTML filename (default: the first *.html in the folder)
 *   PORT             default 8099
 */

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { file } from "bun";

const DIR = resolve(
  process.env.PROTOTYPE_DIR ?? "design_handoff_helpdesk_redesign/prototype",
);

if (!existsSync(DIR)) {
  console.error(
    `[fidelity] prototype dir not found: ${DIR}\n` +
      `Drop the handoff there, or set PROTOTYPE_DIR to its location.`,
  );
  process.exit(1);
}

const INDEX =
  process.env.PROTOTYPE_INDEX ??
  readdirSync(DIR).find((f) => f.toLowerCase().endsWith(".html")) ??
  "index.html";

const PORT = Number(process.env.PORT ?? 8099);

Bun.serve({
  port: PORT,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path === "/") path = `/${INDEX}`;
    const f = file(join(DIR, path));
    if (await f.exists()) return new Response(f);
    return new Response("not found", { status: 404 });
  },
});

console.log(`[fidelity] serving "${INDEX}" from ${DIR}`);
console.log(`[fidelity] → http://localhost:${PORT}`);
