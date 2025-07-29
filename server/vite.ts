import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = process.cwd();

export async function createViteMiddleware() {
  if (process.env.NODE_ENV === 'production') {
    // In production, serve static files
    return null;
  }

  // In development, create Vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: path.resolve(__dirname, '../client'),
  });

  return vite.ssrFixStacktrace;
}