// Updates collateral/images/manifest.json in place.
//   node manifest.mjs screen <id,id>
//   node manifest.mjs det <id> '<alt>' <libraryKey | raw:<dir>>      marks ready + records the photo credit
//   node manifest.mjs complete
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const F = path.join(ROOT, 'collateral/images/manifest.json');
const m = JSON.parse(fs.readFileSync(F, 'utf8'));
const [cmd, ...a] = process.argv.slice(2);
const pickC = (c) => ({ author: c.author, source: c.source, url: c.url, license: c.license, licenseUrl: c.licenseUrl, title: c.title });
if (cmd === 'screen') for (const id of a[0].split(',')) m.screens[id].status = 'ready';
if (cmd === 'det') {
  const [id, alt, src] = a;
  let c, key;
  if (src.startsWith('raw:')) { key = src.slice(4); c = JSON.parse(fs.readFileSync(path.join(ROOT, 'collateral/assets/raw', key, 'credit.json'), 'utf8')); key = 'raw/' + key; }
  else { key = src; c = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/credits.json'), 'utf8')).find((x) => x.key === src); }
  if (!c) throw new Error('no credit for ' + src);
  const e = m.detections[id];
  e.status = 'ready'; e.alt = alt; e.credit = `${c.author} / ${c.source} (${c.license})`;
  e.photo = key;
  m.credits = m.credits.filter((x) => x.usedBy !== id);
  m.credits.push({ usedBy: id, photo: key, ...pickC(c) });
}
if (cmd === 'complete') m.complete = true;
fs.writeFileSync(F, JSON.stringify(m, null, 2) + '\n');
console.log(cmd, a[0] ?? '');
