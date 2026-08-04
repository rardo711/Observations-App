import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';

const walk = (dir, base = dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full)];
  });

/* Writes dist/sw.js after the build, with the precache list taken from what
   was actually emitted. Doing it here rather than by hand means a new hashed
   bundle can never ship alongside a worker that still lists the old one. */
function serviceWorker() {
  let outDir;
  return {
    name: 'observations-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => f.split(/[\\/]/).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();

      // Version tracks content, so an unchanged build won't churn the cache
      // and a changed one always will.
      const version = createHash('sha256')
        .update(files.map((f) => `${f}:${statSync(join(outDir, f)).size}`).join('\n'))
        .digest('hex')
        .slice(0, 12);

      const template = readFileSync(resolve(__dirname, 'src/sw-template.js'), 'utf8');
      // replaceAll, not replace: a single replace only swaps the first match,
      // which silently leaves the real declarations holding placeholders.
      const sw = template
        .replaceAll('__VERSION__', version)
        .replaceAll('__PRECACHE__', JSON.stringify(files, null, 2));

      if (sw.includes('__VERSION__') || sw.includes('__PRECACHE__')) {
        this.error('service worker still contains unsubstituted placeholders');
      }

      writeFileSync(join(outDir, 'sw.js'), sw);
      console.log(`  service worker  ${files.length} files precached, version ${version}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
});
