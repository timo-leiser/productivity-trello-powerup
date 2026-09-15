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
for (const file of files) {
  const content = await readFile(file, 'utf8');
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
}
console.log(`Static checks passed: ${files.length} published files, ${checked} local references, JavaScript syntax and secret-pattern check.`);
