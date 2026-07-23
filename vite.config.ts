import {defineConfig, Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {promises as fs} from 'node:fs';
import path from 'node:path';

/**
 * Dev-only endpoint that writes an edited mini-app file back to disk at
 * src/<key>/<path> (e.g. python/library.py, types.ts, FooVisualization.tsx).
 *
 * This is what makes the workspace a true editor of the source of truth: a
 * curriculum developer (or the AI Assistant) can generate/edit any of a
 * mini-app's files in the browser and have them land in the actual files.
 * Only runs under `vite dev`; there is no server in a production build.
 */
function fileWriteBack(): Plugin {
  return {
    name: 'mini-app-file-write-back',
    configureServer(server) {
      server.middlewares.use('/__save_file', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', async () => {
          try {
            const {key, path: relPath, code} = JSON.parse(body || '{}');

            const validKey = typeof key === 'string' && /^[a-z0-9_-]+$/i.test(key);
            const validPath =
              typeof relPath === 'string' &&
              relPath.length > 0 &&
              !relPath.includes('..') &&
              !relPath.startsWith('/') &&
              !relPath.startsWith('\\') &&
              /^[A-Za-z0-9_./-]+$/.test(relPath);

            if (!validKey || !validPath || typeof code !== 'string') {
              res.statusCode = 400;
              res.end('Invalid payload');
              return;
            }

            const appDir = path.resolve(server.config.root, 'src', key);
            const target = path.resolve(appDir, relPath);

            // Guard against path traversal — target must stay inside the
            // mini-app's own folder.
            const rel = path.relative(appDir, target);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
              res.statusCode = 400;
              res.end('Invalid path');
              return;
            }

            // Create parent directories as needed (a brand-new mini-app folder
            // won't exist yet), then write the file.
            await fs.mkdir(path.dirname(target), {recursive: true});
            await fs.writeFile(target, code, 'utf8');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ok: true}));
          } catch (err) {
            res.statusCode = 500;
            res.end(err instanceof Error ? err.message : String(err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fileWriteBack()],
});
