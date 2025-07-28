import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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