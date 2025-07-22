
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
      throw new Error(`Failed to process DXF file: ${error}`);
    }
  }

  async processDWG(filePath: string): Promise<GeometryData> {
    try {
      const result = await this.executePythonProcessor('dwg', filePath);
      return this.parseGeometryData(result);
    } catch (error) {
      throw new Error(`Failed to process DWG file: ${error}`);
    }
  }

  async processPDF(filePath: string): Promise<GeometryData> {
    try {
      const result = await this.executePythonProcessor('pdf', filePath);
      return this.parseGeometryData(result);
    } catch (error) {
      throw new Error(`Failed to process PDF file: ${error}`);
    }
  }

  private async executePythonProcessor(fileType: string, filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'cad_processor.py');
      
      // Set timeout based on file type (PDF files need more time for image processing)
      const timeout = fileType === 'pdf' ? 120000 : 60000; // 2 minutes for PDF, 1 minute for others
      
      const pythonProcess = spawn('python3', [
        scriptPath,
        fileType,
        filePath
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });

      let output = '';
      let error = '';
      let timeoutHandle: NodeJS.Timeout;

      // Set up timeout handler
      timeoutHandle = setTimeout(() => {
        pythonProcess.kill('SIGKILL');
        reject(new Error(`Processing timed out after ${timeout/1000} seconds. File may be too large or complex.`));
      }, timeout);

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log(`[CAD Processor] Processing ${fileType} file: ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
        console.error(`[CAD Processor] Error: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        
        if (code !== 0) {
          const errorMsg = error.includes('timeout') 
            ? `Processing timed out. File may be too large or complex.`
            : `Python process failed with code ${code}: ${error}`;
          reject(new Error(errorMsg));
        } else {
          try {
            const result = JSON.parse(output);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              console.log(`[CAD Processor] Successfully processed ${fileType} file: ${result.entity_count || 0} entities`);
              resolve(result);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${parseError}\nOutput: ${output}`));
          }
        }
      });

      pythonProcess.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to start Python process: ${err.message}`));
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
