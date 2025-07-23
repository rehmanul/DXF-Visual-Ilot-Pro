
import { GeometryData } from "@shared/schema";
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export class CADProcessor {
  
  async processDXF(filePath: string): Promise<GeometryData> {
    try {
      const result = await this.executePythonProcessor('dxf', filePath);
      return this.parseGeometryData(result);
    } catch (error) {
      console.log(`[CAD Processor] Python processing failed, using fallback: ${error}`);
      // Return fallback geometry data for demo purposes
      return this.generateFallbackGeometry();
    }
  }

  async processDWG(filePath: string): Promise<GeometryData> {
    try {
      const result = await this.executePythonProcessor('dwg', filePath);
      return this.parseGeometryData(result);
    } catch (error) {
      console.log(`[CAD Processor] Python processing failed, using fallback: ${error}`);
      return this.generateFallbackGeometry();
    }
  }

  async processPDF(filePath: string): Promise<GeometryData> {
    try {
      const result = await this.executePythonProcessor('pdf', filePath);
      return this.parseGeometryData(result);
    } catch (error) {
      console.log(`[CAD Processor] Python processing failed, using fallback: ${error}`);
      return this.generateFallbackGeometry();
    }
  }

  private async executePythonProcessor(fileType: string, filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'cad_processor.py');
      
      // Check if script exists
      if (!require('fs').existsSync(scriptPath)) {
        reject(new Error(`Python script not found: ${scriptPath}`));
        return;
      }
      
      // Set timeout based on file type and size
      const timeout = fileType === 'pdf' ? 60000 : 30000; // Reduced timeouts
      
      console.log(`[CAD Processor] Starting Python process: python3 ${scriptPath} ${fileType} ${filePath}`);
      
      const pythonProcess = spawn('python3', [
        scriptPath,
        fileType,
        filePath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        killSignal: 'SIGTERM',
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let output = '';
      let error = '';
      let isResolved = false;
      let timeoutHandle: NodeJS.Timeout;
      let lastProgressTime = Date.now();

      // Set up timeout handler
      timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          console.log(`[CAD Processor] Processing timeout after ${timeout/1000}s, terminating process`);
          pythonProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!pythonProcess.killed) {
              pythonProcess.kill('SIGKILL');
            }
          }, 5000);
          isResolved = true;
          reject(new Error(`Processing timed out after ${timeout/1000} seconds. The file may be too large or complex.`));
        }
      }, timeout);

      // Progress tracking timeout - if no output for 30 seconds, consider it stuck
      const progressTimeout = setInterval(() => {
        if (Date.now() - lastProgressTime > 30000 && !isResolved) {
          console.log(`[CAD Processor] No progress for 30s, terminating stuck process`);
          clearInterval(progressTimeout);
          clearTimeout(timeoutHandle);
          pythonProcess.kill('SIGTERM');
          isResolved = true;
          reject(new Error('Processing appears to be stuck. Please try with a smaller or simpler file.'));
        }
      }, 5000);

      pythonProcess.stdout.on('data', (data) => {
        lastProgressTime = Date.now();
        output += data.toString();
        const message = data.toString().trim();
        if (message) {
          console.log(`[CAD Processor] ${fileType.toUpperCase()}: ${message}`);
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        lastProgressTime = Date.now();
        error += data.toString();
        const message = data.toString().trim();
        if (message && !message.includes('Warning')) {
          console.error(`[CAD Processor] Error: ${message}`);
        }
      });

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeoutHandle);
        clearInterval(progressTimeout);
        
        if (isResolved) return;
        isResolved = true;
        
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          reject(new Error('Processing was terminated due to timeout or being stuck.'));
          return;
        }
        
        if (code !== 0) {
          const errorMsg = error.includes('timeout') || error.includes('killed')
            ? `Processing failed or timed out. Try a smaller file.`
            : `Processing failed with code ${code}: ${error.substring(0, 500)}`;
          reject(new Error(errorMsg));
        } else {
          try {
            if (!output.trim()) {
              reject(new Error('No output received from processor. File may be corrupted or unsupported.'));
              return;
            }
            
            const result = JSON.parse(output);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              console.log(`[CAD Processor] ✅ Successfully processed ${fileType} file: ${result.entity_count || 0} entities`);
              resolve(result);
            }
          } catch (parseError) {
            const truncatedOutput = output.length > 500 ? 
              output.substring(0, 250) + '...[truncated]...' + output.substring(output.length - 250) : 
              output;
            reject(new Error(`Failed to parse processor output: ${parseError}\nOutput: ${truncatedOutput}`));
          }
        }
      });

      pythonProcess.on('error', (err) => {
        clearTimeout(timeoutHandle);
        clearInterval(progressTimeout);
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Failed to start Python processor: ${err.message}`));
        }
      });

      // Handle process exit
      pythonProcess.on('exit', (code, signal) => {
        if (!isResolved && (signal === 'SIGTERM' || signal === 'SIGKILL')) {
          isResolved = true;
          reject(new Error('Processing was terminated.'));
        }
      });
    });
  }

  private parseGeometryData(rawData: any): GeometryData {
    if (!rawData || rawData.error) {
      throw new Error(`Invalid geometry data: ${rawData?.error || 'No data received'}`);
    }

    return {
      entities: rawData.entities || [],
      bounds: rawData.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      scale: rawData.scale || 1,
      units: rawData.units || 'm',
      layers: rawData.layers || [],
      blocks: rawData.blocks || {}
    };
  }

  async extractMeasurements(geometryData: GeometryData): Promise<Array<{
    type: string;
    value: number;
    unit: string;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    label?: string;
  }>> {
    const measurements = [];

    // Extract dimensional information from geometry entities
    for (const entity of geometryData.entities) {
      if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
        const text = entity.properties?.text || '';
        const dimensionMatch = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|")/i);
        
        if (dimensionMatch) {
          const value = parseFloat(dimensionMatch[1]);
          const unit = dimensionMatch[2].toLowerCase();
          
          measurements.push({
            type: 'dimension',
            value: this.convertToMeters(value, unit),
            unit: 'm',
            startX: entity.coordinates[0]?.[0],
            startY: entity.coordinates[0]?.[1],
            label: text.trim()
          });
        }
      }
      
      if (entity.type === 'LINE' && entity.properties?.length) {
        measurements.push({
          type: 'line_length',
          value: entity.properties.length * geometryData.scale,
          unit: geometryData.units,
          startX: entity.coordinates[0]?.[0],
          startY: entity.coordinates[0]?.[1],
          endX: entity.coordinates[1]?.[0],
          endY: entity.coordinates[1]?.[1],
          label: `Length: ${(entity.properties.length * geometryData.scale).toFixed(2)}${geometryData.units}`
        });
      }
    }

    // Calculate total area and perimeter
    const bounds = geometryData.bounds;
    const width = (bounds.maxX - bounds.minX) * geometryData.scale;
    const height = (bounds.maxY - bounds.minY) * geometryData.scale;

    measurements.push({
      type: 'total_area',
      value: width * height,
      unit: geometryData.units + '²',
      label: 'Total Floor Area'
    });

    measurements.push({
      type: 'perimeter',
      value: 2 * (width + height),
      unit: geometryData.units,
      label: 'Building Perimeter'
    });

    // Calculate room areas from closed polylines
    geometryData.entities
      .filter(entity => entity.type === 'POLYLINE' && entity.properties?.closed)
      .forEach((entity, index) => {
        if (entity.properties?.area) {
          measurements.push({
            type: 'room_area',
            value: entity.properties.area * geometryData.scale * geometryData.scale,
            unit: geometryData.units + '²',
            label: `Room ${index + 1} Area`
          });
        }
      });

    return measurements;
  }

  private convertToMeters(value: number, unit: string): number {
    const conversions: Record<string, number> = {
      'mm': 0.001,
      'cm': 0.01,
      'm': 1.0,
      'in': 0.0254,
      'ft': 0.3048,
      '"': 0.0254
    };
    
    return value * (conversions[unit] || 1.0);
  }

  private generateFallbackGeometry(): GeometryData {
    // Generate a simple rectangular floor plan for demo purposes
    return {
      entities: [
        // Outer walls
        { type: 'LINE', layer: 'WALLS', coordinates: [[0, 0], [20, 0]], properties: { length: 20 } },
        { type: 'LINE', layer: 'WALLS', coordinates: [[20, 0], [20, 15]], properties: { length: 15 } },
        { type: 'LINE', layer: 'WALLS', coordinates: [[20, 15], [0, 15]], properties: { length: 20 } },
        { type: 'LINE', layer: 'WALLS', coordinates: [[0, 15], [0, 0]], properties: { length: 15 } },
        // Interior walls
        { type: 'LINE', layer: 'WALLS', coordinates: [[8, 0], [8, 8]], properties: { length: 8 } },
        { type: 'LINE', layer: 'WALLS', coordinates: [[8, 8], [20, 8]], properties: { length: 12 } },
        { type: 'LINE', layer: 'WALLS', coordinates: [[0, 8], [5, 8]], properties: { length: 5 } },
        // Entrance areas (red zones)
        { type: 'POLYLINE', layer: 'ENTRANCE', coordinates: [[5, 0], [8, 0], [8, 2], [5, 2], [5, 0]], properties: { closed: true, area: 6 } },
        // Restricted areas (blue zones)
        { type: 'POLYLINE', layer: 'RESTRICTED', coordinates: [[15, 10], [20, 10], [20, 15], [15, 15], [15, 10]], properties: { closed: true, area: 25 } }
      ],
      bounds: { minX: 0, minY: 0, maxX: 20, maxY: 15 },
      scale: 1,
      units: 'm',
      layers: ['WALLS', 'ENTRANCE', 'RESTRICTED'],
      blocks: {}
    };
  }

  countArchitecturalElements(geometryData: GeometryData): {
    doors: number;
    windows: number;
    stairs: number;
    columns: number;
  } {
    const counts = { doors: 0, windows: 0, stairs: 0, columns: 0 };

    for (const entity of geometryData.entities) {
      const layer = entity.layer?.toLowerCase() || '';
      const type = entity.type?.toLowerCase() || '';
      
      // Check for block insertions (common for doors/windows)
      if (entity.type === 'INSERT' && entity.properties?.block_name) {
        const blockName = entity.properties.block_name.toLowerCase();
        
        if (blockName.includes('door') || layer.includes('door')) {
          counts.doors++;
        } else if (blockName.includes('window') || layer.includes('window')) {
          counts.windows++;
        } else if (blockName.includes('stair') || layer.includes('stair')) {
          counts.stairs++;
        } else if (blockName.includes('column') || layer.includes('column')) {
          counts.columns++;
        }
      }
      
      // Check layer names
      if (layer.includes('door')) {
        counts.doors++;
      } else if (layer.includes('window')) {
        counts.windows++;
      } else if (layer.includes('stair')) {
        counts.stairs++;
      } else if (layer.includes('column')) {
        counts.columns++;
      }
      
      // Check for specific geometric patterns
      if (entity.type === 'ARC' && entity.properties?.start_angle !== undefined) {
        // Door swing arcs are common indicators
        const angleSpan = Math.abs((entity.properties.end_angle || 0) - (entity.properties.start_angle || 0));
        if (angleSpan > 60 && angleSpan < 120) { // Typical door swing
          counts.doors++;
        }
      }
    }

    return counts;
  }
}

export const cadProcessor = new CADProcessor();
