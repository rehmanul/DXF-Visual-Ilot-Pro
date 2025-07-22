import { FloorPlan, Room, Measurement } from "@shared/schema";

export interface RenderOptions {
  scale: string;
  zoom: number;
  showMeasurements: boolean;
  showRoomLabels: boolean;
  colorCodedRooms: boolean;
  showGrid: boolean;
}

export interface RenderData {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
  options: RenderOptions;
}

export function renderFloorPlan(canvas: HTMLCanvasElement, data: RenderData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { floorPlan, rooms, measurements, options } = data;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set up coordinate system
  const bounds = calculateBounds(rooms);
  const scale = calculateScale(bounds, canvas, options.zoom);
  
  // Apply transformations
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX + 50, -bounds.minY + 50);

  // Draw grid if enabled
  if (options.showGrid) {
    drawGrid(ctx, bounds, 10);
  }

  // Draw rooms
  if (options.colorCodedRooms) {
    drawColorCodedRooms(ctx, rooms);
  } else {
    drawRoomOutlines(ctx, rooms);
  }

  // Draw room labels
  if (options.showRoomLabels) {
    drawRoomLabels(ctx, rooms, scale);
  }

  // Draw measurements
  if (options.showMeasurements) {
    drawMeasurements(ctx, measurements, scale);
  }

  // Draw floor plan outline
  drawFloorPlanOutline(ctx, bounds);
  
  ctx.restore();
  
  // Draw scale indicator
  drawScaleIndicator(ctx, canvas, options.scale, scale);
}

function calculateBounds(rooms: Room[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (rooms.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  rooms.forEach(room => {
    minX = Math.min(minX, room.minX);
    minY = Math.min(minY, room.minY);
    maxX = Math.max(maxX, room.maxX);
    maxY = Math.max(maxY, room.maxY);
  });

  return { minX, minY, maxX, maxY };
}

function calculateScale(bounds: { minX: number; minY: number; maxX: number; maxY: number }, canvas: HTMLCanvasElement, zoom: number): number {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padding = 100; // Padding around the floor plan
  
  const scaleX = (canvas.width - padding) / width;
  const scaleY = (canvas.height - padding) / height;
  
  return Math.min(scaleX, scaleY) * zoom;
}

function drawGrid(ctx: CanvasRenderingContext2D, bounds: { minX: number; minY: number; maxX: number; maxY: number }, spacing: number) {
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);

  // Vertical lines
  for (let x = Math.floor(bounds.minX / spacing) * spacing; x <= bounds.maxX; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.minY);
    ctx.lineTo(x, bounds.maxY);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = Math.floor(bounds.minY / spacing) * spacing; y <= bounds.maxY; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(bounds.minX, y);
    ctx.lineTo(bounds.maxX, y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawColorCodedRooms(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  rooms.forEach(room => {
    // Fill room with color
    ctx.fillStyle = room.color + '40'; // Add transparency
    ctx.fillRect(room.minX, room.minY, room.maxX - room.minX, room.maxY - room.minY);
    
    // Draw room outline
    ctx.strokeStyle = room.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(room.minX, room.minY, room.maxX - room.minX, room.maxY - room.minY);
  });
}

function drawRoomOutlines(ctx: CanvasRenderingContext2D, rooms: Room[]) {
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  
  rooms.forEach(room => {
    ctx.strokeRect(room.minX, room.minY, room.maxX - room.minX, room.maxY - room.minY);
  });
}

function drawRoomLabels(ctx: CanvasRenderingContext2D, rooms: Room[], scale: number) {
  ctx.fillStyle = '#333333';
  ctx.font = `${Math.max(12 / scale, 8)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  rooms.forEach(room => {
    const centerX = (room.minX + room.maxX) / 2;
    const centerY = (room.minY + room.maxY) / 2;
    
    // Draw room name
    ctx.fillText(room.name, centerX, centerY - 5);
    
    // Draw area
    if (room.area) {
      ctx.font = `${Math.max(10 / scale, 6)}px Arial`;
      ctx.fillStyle = '#666666';
      ctx.fillText(`${room.area.toFixed(1)} m²`, centerX, centerY + 8);
      
      // Reset font and color
      ctx.font = `${Math.max(12 / scale, 8)}px Arial`;
      ctx.fillStyle = '#333333';
    }
  });
}

function drawMeasurements(ctx: CanvasRenderingContext2D, measurements: Measurement[], scale: number) {
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.fillStyle = '#666666';
  ctx.font = `${Math.max(10 / scale, 6)}px Arial`;
  ctx.textAlign = 'center';

  measurements.forEach(measurement => {
    if (measurement.startX !== undefined && measurement.startY !== undefined && 
        measurement.endX !== undefined && measurement.endY !== undefined) {
      
      // Draw measurement line
      ctx.beginPath();
      ctx.moveTo(measurement.startX || 0, measurement.startY || 0);
      ctx.lineTo(measurement.endX || 0, measurement.endY || 0);
      ctx.stroke();
      
      // Draw measurement text
      const midX = ((measurement.startX || 0) + (measurement.endX || 0)) / 2;
      const midY = ((measurement.startY || 0) + (measurement.endY || 0)) / 2;
      
      if (measurement.label) {
        ctx.fillText(measurement.label, midX, midY - 5);
      } else {
        ctx.fillText(`${measurement.value.toFixed(1)}${measurement.unit}`, midX, midY - 5);
      }
    }
  });

  ctx.setLineDash([]);
}

function drawFloorPlanOutline(ctx: CanvasRenderingContext2D, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 3;
  ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

function drawScaleIndicator(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scaleText: string, scale: number) {
  // Draw scale indicator in bottom right corner
  const x = canvas.width - 150;
  const y = canvas.height - 30;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(x - 10, y - 20, 140, 35);
  
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 10, y - 20, 140, 35);
  
  ctx.fillStyle = '#333333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Scale: ${scaleText}`, x, y);
}

export function addMeasurementAnnotation(canvas: HTMLCanvasElement, x: number, y: number, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw annotation marker
  ctx.fillStyle = '#FF6B35';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();

  // Draw annotation text
  ctx.fillStyle = '#333333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 10, y - 5);
}
