
import { FloorPlan, Room, Measurement } from "@shared/schema";
import fs from 'fs/promises';
import path from 'path';

export class ExportService {
  
  async exportToPDF(floorPlan: FloorPlan, rooms: Room[], measurements: Measurement[], options: ExportOptions): Promise<Buffer> {
    try {
      // Generate comprehensive HTML report
      const htmlContent = this.generateHTMLReport(floorPlan, rooms, measurements, options);
      
      // For now, return HTML as text (in production, use puppeteer to convert to PDF)
      const reportContent = `
FLOOR PLAN ANALYSIS REPORT
=========================

Project: ${floorPlan.originalName}
Generated: ${new Date().toLocaleDateString()}

SUMMARY
-------
Total Area: ${floorPlan.totalArea?.toFixed(2)} m²
Perimeter: ${floorPlan.perimeter?.toFixed(2)} m
Number of Rooms: ${rooms.length}
Doors: ${floorPlan.doors || 0}
Windows: ${floorPlan.windows || 0}

ROOM DETAILS
-----------
${rooms.map(room => `
${room.name}:
  Type: ${room.type}
  Area: ${room.area?.toFixed(2)} m²
  Dimensions: ${room.width?.toFixed(2)} × ${room.height?.toFixed(2)} m
  Shape: ${room.shape}
`).join('')}

MEASUREMENTS
-----------
${measurements.map(m => `
${m.label || m.type}: ${m.value.toFixed(2)} ${m.unit}
`).join('')}

ARCHITECTURAL ELEMENTS
---------------------
Layers Detected: ${floorPlan.layers || 0}
Geometric Objects: ${floorPlan.geometricObjects || 0}
Wall Thickness: ${floorPlan.wallThickness?.toFixed(2)} m
Ceiling Height: ${floorPlan.ceilingHeight?.toFixed(2)} m
`;
      
      return Buffer.from(reportContent, 'utf-8');
    } catch (error) {
      throw new Error(`PDF export failed: ${error}`);
    }
  }

  async exportToExcel(floorPlan: FloorPlan, rooms: Room[], measurements: Measurement[]): Promise<Buffer> {
    try {
      // Generate CSV-like content (can be opened in Excel)
      const data = this.prepareExcelData(floorPlan, rooms, measurements);
      
      let csvContent = '';
      
      // Floor Plan Summary
      csvContent += 'FLOOR PLAN SUMMARY\n';
      csvContent += 'Property,Value\n';
      csvContent += `File Name,${floorPlan.originalName}\n`;
      csvContent += `Total Area,${floorPlan.totalArea?.toFixed(2)} m²\n`;
      csvContent += `Perimeter,${floorPlan.perimeter?.toFixed(2)} m\n`;
      csvContent += `Number of Rooms,${rooms.length}\n`;
      csvContent += `Doors,${floorPlan.doors || 0}\n`;
      csvContent += `Windows,${floorPlan.windows || 0}\n`;
      csvContent += `Processed Date,${floorPlan.processedAt?.toISOString().split('T')[0] || 'N/A'}\n`;
      csvContent += '\n';
      
      // Room Details
      csvContent += 'ROOM DETAILS\n';
      csvContent += 'Room Name,Type,Area (m²),Width (m),Height (m),Shape\n';
      rooms.forEach(room => {
        csvContent += `"${room.name}","${room.type}",${room.area?.toFixed(2) || 0},${room.width?.toFixed(2) || 0},${room.height?.toFixed(2) || 0},"${room.shape}"\n`;
      });
      csvContent += '\n';
      
      // Measurements
      csvContent += 'MEASUREMENTS\n';
      csvContent += 'Type,Value,Unit,Label\n';
      measurements.forEach(measurement => {
        csvContent += `"${measurement.type}",${measurement.value.toFixed(2)},"${measurement.unit}","${measurement.label || ''}"\n`;
      });
      
      return Buffer.from(csvContent, 'utf-8');
    } catch (error) {
      throw new Error(`Excel export failed: ${error}`);
    }
  }

  async exportToCAD(floorPlan: FloorPlan, geometryData: any): Promise<Buffer> {
    try {
      const dxfContent = this.generateDXFContent(geometryData);
      return Buffer.from(dxfContent, 'utf-8');
    } catch (error) {
      throw new Error(`CAD export failed: ${error}`);
    }
  }

  async exportToPNG(floorPlan: FloorPlan, canvasData: string, options: ExportOptions): Promise<Buffer> {
    try {
      if (!canvasData.startsWith('data:image/png;base64,')) {
        throw new Error('Invalid canvas data format');
      }
      
      const base64Data = canvasData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Validate that it's a valid PNG
      if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error('Invalid PNG data');
      }
      
      return buffer;
    } catch (error) {
      throw new Error(`PNG export failed: ${error}`);
    }
  }

  private generateHTMLReport(floorPlan: FloorPlan, rooms: Room[], measurements: Measurement[], options: ExportOptions): string {
    const roomsTable = rooms.map(room => `
      <tr>
        <td>${room.name}</td>
        <td>${room.type}</td>
        <td>${room.area?.toFixed(2)} m²</td>
        <td>${room.width?.toFixed(2)} × ${room.height?.toFixed(2)} m</td>
        <td>${room.shape}</td>
      </tr>
    `).join('');

    const measurementsTable = measurements.map(m => `
      <tr>
        <td>${m.type}</td>
        <td>${m.value.toFixed(2)}</td>
        <td>${m.unit}</td>
        <td>${m.label || ''}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Floor Plan Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .summary { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
          .summary-item { background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #007bff; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .section { margin: 30px 0; }
          h1 { color: #333; margin-bottom: 10px; }
          h2 { color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          h3 { color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Floor Plan Analysis Report</h1>
          <h2>${floorPlan.originalName}</h2>
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <div class="section">
          <h3>Executive Summary</h3>
          <div class="summary">
            <div class="summary-grid">
              <div class="summary-item">
                <strong>Total Area</strong><br>
                ${floorPlan.totalArea?.toFixed(2)} m²
              </div>
              <div class="summary-item">
                <strong>Perimeter</strong><br>
                ${floorPlan.perimeter?.toFixed(2)} m
              </div>
              <div class="summary-item">
                <strong>Rooms</strong><br>
                ${rooms.length} identified
              </div>
              <div class="summary-item">
                <strong>Doors & Windows</strong><br>
                ${floorPlan.doors || 0} doors, ${floorPlan.windows || 0} windows
              </div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h3>Room Analysis</h3>
          <table>
            <thead>
              <tr>
                <th>Room Name</th>
                <th>Type</th>
                <th>Area</th>
                <th>Dimensions</th>
                <th>Shape</th>
              </tr>
            </thead>
            <tbody>
              ${roomsTable}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Measurements & Calculations</h3>
          <table>
            <thead>
              <tr>
                <th>Measurement Type</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${measurementsTable}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h3>Technical Details</h3>
          <div class="summary">
            <p><strong>File Type:</strong> ${floorPlan.fileType?.toUpperCase()}</p>
            <p><strong>File Size:</strong> ${(floorPlan.fileSize! / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Processing Status:</strong> ${floorPlan.status}</p>
            <p><strong>Layers Detected:</strong> ${floorPlan.layers || 0}</p>
            <p><strong>Geometric Objects:</strong> ${floorPlan.geometricObjects || 0}</p>
            <p><strong>Wall Thickness:</strong> ${floorPlan.wallThickness?.toFixed(2)} m</p>
            <p><strong>Ceiling Height:</strong> ${floorPlan.ceilingHeight?.toFixed(2)} m</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private prepareExcelData(floorPlan: FloorPlan, rooms: Room[], measurements: Measurement[]) {
    return {
      floorPlan: {
        name: floorPlan.originalName,
        fileType: floorPlan.fileType,
        fileSize: floorPlan.fileSize,
        totalArea: floorPlan.totalArea,
        perimeter: floorPlan.perimeter,
        doors: floorPlan.doors,
        windows: floorPlan.windows,
        layers: floorPlan.layers,
        geometricObjects: floorPlan.geometricObjects,
        wallThickness: floorPlan.wallThickness,
        ceilingHeight: floorPlan.ceilingHeight,
        processedAt: floorPlan.processedAt
      },
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        type: room.type,
        area: room.area,
        width: room.width,
        height: room.height,
        shape: room.shape,
        color: room.color
      })),
      measurements: measurements.map(measurement => ({
        type: measurement.type,
        value: measurement.value,
        unit: measurement.unit,
        label: measurement.label,
        startX: measurement.startX,
        startY: measurement.startY,
        endX: measurement.endX,
        endY: measurement.endY
      }))
    };
  }

  private generateDXFContent(geometryData: any): string {
    if (!geometryData || !geometryData.entities) {
      throw new Error('No geometry data available for DXF export');
    }

    // Generate comprehensive DXF file
    let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$DWGCODEPAGE
3
ANSI_1252
9
$INSBASE
10
0.0
20
0.0
30
0.0
9
$EXTMIN
10
${geometryData.bounds?.minX || 0}
20
${geometryData.bounds?.minY || 0}
30
0.0
9
$EXTMAX
10
${geometryData.bounds?.maxX || 100}
20
${geometryData.bounds?.maxY || 100}
30
0.0
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
5
2
100
AcDbSymbolTable
70
${geometryData.layers?.length || 1}
`;

    // Add layer table entries
    if (geometryData.layers) {
      geometryData.layers.forEach((layer: string, index: number) => {
        dxf += `0
LAYER
5
${10 + index}
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
2
${layer}
70
0
62
${(index % 7) + 1}
6
CONTINUOUS
`;
      });
    }

    dxf += `0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

    // Add entities
    if (geometryData.entities) {
      geometryData.entities.forEach((entity: any, index: number) => {
        dxf += this.generateDXFEntity(entity, index + 1);
      });
    }

    dxf += `0
ENDSEC
0
EOF`;

    return dxf;
  }

  private generateDXFEntity(entity: any, handle: number): string {
    let entityDXF = '';

    switch (entity.type) {
      case 'LINE':
        if (entity.coordinates && entity.coordinates.length >= 2) {
          entityDXF = `0
LINE
5
${handle.toString(16).toUpperCase()}
100
AcDbEntity
8
${entity.layer || '0'}
100
AcDbLine
10
${entity.coordinates[0][0]}
20
${entity.coordinates[0][1]}
30
0.0
11
${entity.coordinates[1][0]}
21
${entity.coordinates[1][1]}
31
0.0
`;
        }
        break;

      case 'POLYLINE':
      case 'LWPOLYLINE':
        if (entity.coordinates && entity.coordinates.length > 2) {
          entityDXF = `0
LWPOLYLINE
5
${handle.toString(16).toUpperCase()}
100
AcDbEntity
8
${entity.layer || '0'}
100
AcDbPolyline
90
${entity.coordinates.length}
70
${entity.properties?.closed ? 1 : 0}
`;
          entity.coordinates.forEach((coord: number[]) => {
            entityDXF += `10
${coord[0]}
20
${coord[1]}
`;
          });
        }
        break;

      case 'CIRCLE':
        if (entity.coordinates && entity.coordinates.length > 0 && entity.properties?.radius) {
          entityDXF = `0
CIRCLE
5
${handle.toString(16).toUpperCase()}
100
AcDbEntity
8
${entity.layer || '0'}
100
AcDbCircle
10
${entity.coordinates[0][0]}
20
${entity.coordinates[0][1]}
30
0.0
40
${entity.properties.radius}
`;
        }
        break;

      case 'ARC':
        if (entity.coordinates && entity.coordinates.length > 0 && entity.properties?.radius) {
          entityDXF = `0
ARC
5
${handle.toString(16).toUpperCase()}
100
AcDbEntity
8
${entity.layer || '0'}
100
AcDbCircle
10
${entity.coordinates[0][0]}
20
${entity.coordinates[0][1]}
30
0.0
40
${entity.properties.radius}
100
AcDbArc
50
${entity.properties.start_angle || 0}
51
${entity.properties.end_angle || 360}
`;
        }
        break;

      case 'TEXT':
        if (entity.coordinates && entity.coordinates.length > 0 && entity.properties?.text) {
          entityDXF = `0
TEXT
5
${handle.toString(16).toUpperCase()}
100
AcDbEntity
8
${entity.layer || '0'}
100
AcDbText
10
${entity.coordinates[0][0]}
20
${entity.coordinates[0][1]}
30
0.0
40
${entity.properties.height || 1}
1
${entity.properties.text}
50
${entity.properties.rotation || 0}
`;
        }
        break;
    }

    return entityDXF;
  }
}

export interface ExportOptions {
  includeMeasurements: boolean;
  includeRoomLabels: boolean;
  colorCodedRooms: boolean;
  showGrid: boolean;
  scale?: string;
}

export const exportService = new ExportService();
