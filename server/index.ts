import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { errorHandler } from "./middleware/errorHandler";
import { connectDB } from "./db";

const app = express();
const httpServer = createServer( app );
const io = new Server( httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || ( process.env.NODE_ENV === "development" ? "*" : "http://localhost:3001" ),
    methods: [ "GET", "POST" ]
  }
} );

// Production middleware
if ( app.get( "env" ) === "production" )
{
  app.use( helmet() );
}

app.use( cors( { origin: process.env.CORS_ORIGIN || "*" } ) );
app.use( compression() );
app.use( express.json( { limit: '50mb' } ) );
app.use( express.urlencoded( { extended: false, limit: '50mb' } ) );

// Make io available to routes
app.set( 'io', io );

app.use( ( req, res, next ) =>
{
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function ( bodyJson, ...args )
  {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply( res, [ bodyJson, ...args ] );
  };

  res.on( "finish", () =>
  {
    const duration = Date.now() - start;
    if ( path.startsWith( "/api" ) )
    {
      let logLine = `${ req.method } ${ path } ${ res.statusCode } in ${ duration }ms`;
      if ( capturedJsonResponse )
      {
        logLine += ` :: ${ JSON.stringify( capturedJsonResponse ) }`;
      }

      if ( logLine.length > 80 )
      {
        logLine = logLine.slice( 0, 79 ) + "…";
      }

      log( logLine );
    }
  } );

  next();
} );

( async () =>
{
  // Connect to database (non-blocking)
  connectDB();

  const server = await registerRoutes( app );

  app.use( errorHandler );

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if ( app.get( "env" ) === "development" )
  {
    await setupVite( app, server );
  } else
  {
    serveStatic( app );
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 3000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt( process.env.PORT || "3001", 10 );
  httpServer.listen( port, () =>
  {
    log( `serving on port ${ port }` );
    console.log( `Server is running on port ${ port }` );
  } );
} )();
