import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(resolve(dir, e.name)) : resolve(dir, e.name)))).flat();
}
const files = await walk(resolve(root, 'docs'));
let checked = 0;
const publishedText = new Map();
for (const file of files) {
  const isText = /\.(?:css|html|js|svg|txt)$/.test(file) || file.endsWith('_headers') || file.endsWith('.nojekyll');
  const content = isText ? await readFile(file, 'utf8') : '';
  if (isText) publishedText.set(file, content);
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
  }
  if (file.endsWith('.html')) {
    for (const [, link] of content.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(?:https?:|mailto:|data:)/.test(link)) continue;
      let target = resolve(dirname(file), link.split(/[?#]/)[0]);
      if (link === './') target = resolve(target, 'index.html');
      await access(target); checked++;
    }
  }
  // A static site must never include access tokens, private keys or dotenv files.
  if (/gh[pousr]_[a-zA-Z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) throw new Error(`Potential secret in ${file}`);
  if (/console\.(?:log|warn|error|debug|info)\s*\(/.test(content)) throw new Error(`Console output in ${file}`);
}

const headers = await readFile(resolve(root, 'docs', '_headers'), 'utf8');
for (const required of ['Content-Security-Policy:', 'frame-ancestors https://trello.com', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'Permissions-Policy:', 'Cache-Control: no-store']) {
  if (!headers.includes(required)) throw new Error(`Missing required response-header rule: ${required}`);
}
const scriptPolicy = headers.match(/script-src[^;]*/)?.[0] ?? '';
if (!scriptPolicy || /'unsafe-(?:inline|eval|hashes)'/.test(scriptPolicy)) throw new Error('CSP script-src is missing or unsafe.');

const runtimeFiles = files.filter(file => /\.(?:html|js|txt)$/.test(file));
const germanUi = /\b(?:Bitte|Verbinde|Verbinden|Verbindung|Warnschwellen|Phasenzeit|Speichern|Gespeichert|Einstellungen|Datenschutz|Zeiteinheit|Tage|Stunden)\b/;
for (const file of runtimeFiles) {
  if (germanUi.test(publishedText.get(file))) throw new Error(`German interface text remains in ${file}`);
}

console.log(`Static checks passed: ${files.length} published files, ${checked} local references, English UI, response-header policy, JavaScript syntax and secret-pattern check.`);
