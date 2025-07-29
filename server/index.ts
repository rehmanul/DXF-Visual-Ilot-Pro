import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer } from 'http';
// import { setupVite } from './vite';
import { registerRoutes } from './routes.js';
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
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else
  {
    // await setupVite( app, server );
  }

  server.listen( port, () =>
  {
    console.log( `🚀 Server listening on http://localhost:${ port }` );
  } );
}

startServer();
