import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { setupVite } from './vite';
import { registerRoutes } from './routes';
import { connectDB } from './db';

const app = express();
const port = parseInt( process.env.PORT || '3001', 10 );

async function startServer ()
{
  const isDbConnected = await connectDB();

  if ( !isDbConnected && process.env.NODE_ENV !== 'development' )
  {
    console.error( 'Database connection is required. Exiting.' );
    process.exit( 1 );
  }

  app.use( express.json() );
  const server = await registerRoutes( app );

  if ( process.env.NODE_ENV === 'production' )
  {
    // In production, serve the static files from the build folder.
  } else
  {
    await setupVite( app, server );
  }

  server.listen( port, () =>
  {
    console.log( `🚀 Server listening on http://localhost:${ port }` );
  } );
}

startServer();
