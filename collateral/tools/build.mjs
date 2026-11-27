// Builds the finished collateral: for each document, a full-resolution print PDF and a lighter email PDF,
// both with document properties and one bookmark per page, plus review PNGs.
//   node collateral/tools/build.mjs [profile|deck ...] [--port=4509]
// Starts its own static server on --port unless one is already answering there. Needs PyMuPDF for finish.py.
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const port = Number(args.find((a) => a.startsWith('--port='))?.slice(7) ?? 4509);
const DOCS = {
  profile: { file: 'infraglance-company-profile', title: 'Infraglance — Company profile', dpi: 200 },
  deck: { file: 'infraglance-presentation', title: 'Infraglance — Company presentation', dpi: 180 },
  trident: { file: 'infraglance-for-trident-packaging', title: 'Infraglance — Proposal for Trident Packaging Limited', dpi: 180 },
};
// Only the standard documents build by default; prospect decks are built by name (node build.mjs trident).
const DEFAULT = ['profile', 'deck'];
const pick = args.filter((a) => !a.startsWith('--'));
const which = pick.length ? pick : DEFAULT;

const up = async () => fetch(`http://localhost:${port}/collateral/CONTRACT.md`).then((r) => r.ok, () => false);
let server = null;
if (!(await up())) {
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
}
const py = process.platform === 'win32' ? 'py' : 'python3';
let failed = false;
try {
  for (const key of which) {
    const d = DOCS[key];
    if (!d) throw new Error(`unknown document "${key}" (use: ${Object.keys(DOCS).join(', ')})`);
    const out = (s) => path.join(ROOT, 'collateral/out', `${d.file}${s}.pdf`);
    const toc = path.join(ROOT, 'collateral/review', `${key}.toc.json`);
    console.log(`\n== ${key}`);
    try {
      execFileSync(process.execPath, [path.join(HERE, 'pdf.mjs'), `http://localhost:${port}/collateral/${key}/`, out('-print'),
        `--shots=${path.join(ROOT, 'collateral/review', key)}`, '--scale=1.5', `--toc=${toc}`], { stdio: 'inherit' });
    } catch {
      failed = true; // pdf.mjs exits 1 on request or console problems but still writes the PDF; keep going.
    }
    execFileSync(py, [path.join(HERE, 'finish.py'), out('-print'), out(''), '--title', d.title, '--dpi', String(d.dpi), '--toc', toc],
      { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  }
} finally {
  server?.kill();
}
process.exitCode = failed ? 1 : 0;
