import { spawn } from 'child_process';
import { GeometryData } from '@shared/schema';
import path from 'path';
import fs from 'fs';

export class CADProcessor
{
  private readonly PYTHON_SCRIPT = path.join( process.cwd(), 'scripts', 'cad_processor.py' );
  private readonly TIMEOUT = parseInt( process.env.CAD_PROCESSING_TIMEOUT || '300000' );

  async processCADFile ( filePath: string, fileType: string, mode: 'full' | 'base' = 'full' ): Promise<GeometryData>
  {
    return new Promise( ( resolve, reject ) =>
    {
      const args = [ this.PYTHON_SCRIPT, filePath ];
      if ( mode === 'base' )
      {
        args.push( '--mode=base' );
      }

      const python = spawn( 'python', args, {
        timeout: this.TIMEOUT
      } );

      let stdout = '';
      let stderr = '';

      python.stdout.on( 'data', ( data ) =>
      {
        stdout += data.toString();
      } );

      python.stderr.on( 'data', ( data ) =>
      {
        stderr += data.toString();
      } );

      python.on( 'close', ( code ) =>
      {
        if ( code === 0 )
        {
          try
          {
            const result = JSON.parse( stdout );
            resolve( result );
          } catch ( error )
          {
            reject( new Error( `Failed to parse CAD processing result: ${ error }` ) );
          }
        } else
        {
          reject( new Error( `CAD processing failed: ${ stderr }` ) );
        }
      } );

      python.on( 'error', ( error ) =>
      {
        reject( new Error( `Failed to start CAD processor: ${ error.message }` ) );
      } );
    } );
  }

  async validateCADFile ( filePath: string ): Promise<boolean>
  {
    if ( !fs.existsSync( filePath ) )
    {
      return false;
    }

    const stats = fs.statSync( filePath );
    const maxSize = 50 * 1024 * 1024; // 50MB

    return stats.size <= maxSize;
  }

  async processImage(filePath: string): Promise<any> {
    return this.processCADFile(filePath, 'image');
  }

  async extractMeasurements(filePath: string): Promise<any> {
    return { measurements: [] };
  }

  async countArchitecturalElements(filePath: string): Promise<any> {
    return { count: 0 };
  }
}

export const cadProcessor = new CADProcessor();
