import { FloorPlan, Room, Measurement } from "@shared/schema";

export interface RenderOptions {
  scale: string;
  zoom: number;
  showMeasurements: boolean;
  showRoomLabels: boolean;
  colorCodedRooms: boolean;
  showGrid: boolean;
  highResolution?: boolean;
  wallThickness?: number;
  wallColor?: string;
  wallShadow?: boolean;
  antiAliasing?: boolean;
  pixelRatio?: number;
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
  
  // Configure high-resolution rendering
  const pixelRatio = options.highResolution ? window.devicePixelRatio || 1 : 1;
  canvas.width = canvas.clientWidth * pixelRatio;
  canvas.height = canvas.clientHeight * pixelRatio;

  if (options.antiAliasing) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  
  // Clear canvas with background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Set up coordinate system
  const bounds = calculateBounds(rooms, floorPlan);
  const scale = calculateScale(bounds, canvas, options.zoom, pixelRatio);
  
  // Apply transformations
  ctx.save();
  const padding = options.highResolution ? 100 : 50;
  ctx.scale(scale * pixelRatio, scale * pixelRatio);
  ctx.translate(-bounds.minX + padding / (scale * pixelRatio), -bounds.minY + padding / (scale * pixelRatio));

  // Draw grid if enabled
  if (options.showGrid) {
    drawGrid(ctx, bounds, options.highResolution ? 5 : 10);
  }

  // Draw enhanced walls first
  drawEnhancedWalls(ctx, floorPlan, options);

  // Draw rooms
  if (options.colorCodedRooms) {
    drawColorCodedRooms(ctx, rooms, options);
  } else {
    drawRoomOutlines(ctx, rooms, options);
  }

  // Draw room labels
  if (options.showRoomLabels) {
    drawRoomLabels(ctx, rooms, scale, options);
  }

  // Draw measurements
  if (options.showMeasurements) {
    drawMeasurements(ctx, measurements, scale, options);
  }

  // Draw floor plan outline with enhanced visibility
  drawFloorPlanOutline(ctx, bounds, options);
  
  ctx.restore();
  
  // Draw scale indicator
  drawScaleIndicator(ctx, canvas, options.scale, scale, pixelRatio);
}

function calculateBounds(rooms: Room[], floorPlan?: FloorPlan): { minX: number; minY: number; maxX: number; maxY: number } {
  // Use floor plan bounds if available, otherwise calculate from rooms
  if (floorPlan?.bounds) {
    return {
      minX: floorPlan.bounds.minX,
      minY: floorPlan.bounds.minY,
      maxX: floorPlan.bounds.maxX,
      maxY: floorPlan.bounds.maxY
    };
  }
  
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

function calculateScale(bounds: { minX: number; minY: number; maxX: number; maxY: number }, canvas: HTMLCanvasElement, zoom: number, pixelRatio: number = 1): number {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padding = 200; // Increased padding for high-res
  
  const scaleX = (canvas.width / pixelRatio - padding) / width;
  const scaleY = (canvas.height / pixelRatio - padding) / height;
  
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

function drawColorCodedRooms(ctx: CanvasRenderingContext2D, rooms: Room[], options: RenderOptions) {
  rooms.forEach(room => {
    const width = room.maxX - room.minX;
    const height = room.maxY - room.minY;
    
    // Enhanced room rendering with gradients
    if (options.highResolution) {
      const gradient = ctx.createLinearGradient(room.minX, room.minY, room.maxX, room.maxY);
      gradient.addColorStop(0, room.color + '60');
      gradient.addColorStop(1, room.color + '20');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = room.color + '40';
    }
    
    ctx.fillRect(room.minX, room.minY, width, height);
    
    // Enhanced room outline
    ctx.strokeStyle = room.color;
    ctx.lineWidth = options.highResolution ? 2.5 : 2;
    if (options.wallShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    ctx.strokeRect(room.minX, room.minY, width, height);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });
}

function drawRoomOutlines(ctx: CanvasRenderingContext2D, rooms: Room[], options: RenderOptions) {
  ctx.strokeStyle = options.wallColor || '#2D3748';
  ctx.lineWidth = options.wallThickness || 2;
  
  if (options.wallShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  
  rooms.forEach(room => {
    ctx.strokeRect(room.minX, room.minY, room.maxX - room.minX, room.maxY - room.minY);
  });
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawRoomLabels(ctx: CanvasRenderingContext2D, rooms: Room[], scale: number, options: RenderOptions) {
  const baseFontSize = options.highResolution ? 16 : 12;
  const minFontSize = options.highResolution ? 10 : 8;
  
  ctx.fillStyle = '#1A202C';
  ctx.font = `bold ${Math.max(baseFontSize / scale, minFontSize)}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  rooms.forEach(room => {
    const centerX = (room.minX + room.maxX) / 2;
    const centerY = (room.minY + room.maxY) / 2;
    
    // Enhanced text rendering with outline
    if (options.highResolution) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.strokeText(room.name, centerX, centerY - 8);
    }
    
    // Draw room name
    ctx.fillText(room.name, centerX, centerY - 8);
    
    // Draw area with enhanced styling
    if (room.area) {
      const areaFontSize = Math.max((baseFontSize - 2) / scale, minFontSize - 2);
      ctx.font = `${areaFontSize}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#4A5568';
      
      if (options.highResolution) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeText(`${room.area.toFixed(1)} m²`, centerX, centerY + 10);
      }
      
      ctx.fillText(`${room.area.toFixed(1)} m²`, centerX, centerY + 10);
      
      // Reset font and color
      ctx.font = `bold ${Math.max(baseFontSize / scale, minFontSize)}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = '#1A202C';
    }
  });
}

function drawMeasurements(ctx: CanvasRenderingContext2D, measurements: Measurement[], scale: number, options: RenderOptions) {
  ctx.strokeStyle = '#E53E3E';
  ctx.lineWidth = options.highResolution ? 2 : 1;
  ctx.setLineDash([8, 4]);
  ctx.fillStyle = '#E53E3E';
  
  const fontSize = Math.max((options.highResolution ? 12 : 10) / scale, 8);
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';

  measurements.forEach(measurement => {
    if (measurement.startX !== undefined && measurement.startY !== undefined && 
        measurement.endX !== undefined && measurement.endY !== undefined) {
      
      // Draw measurement line with enhanced visibility
      ctx.beginPath();
      ctx.moveTo(measurement.startX || 0, measurement.startY || 0);
      ctx.lineTo(measurement.endX || 0, measurement.endY || 0);
      ctx.stroke();
      
      // Draw measurement points
      ctx.fillStyle = '#E53E3E';
      ctx.beginPath();
      ctx.arc(measurement.startX || 0, measurement.startY || 0, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(measurement.endX || 0, measurement.endY || 0, 3, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw measurement text with background
      const midX = ((measurement.startX || 0) + (measurement.endX || 0)) / 2;
      const midY = ((measurement.startY || 0) + (measurement.endY || 0)) / 2;
      
      const text = measurement.label || `${measurement.value.toFixed(1)}${measurement.unit}`;
      
      if (options.highResolution) {
        // Draw text background
        const textMetrics = ctx.measureText(text);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(midX - textMetrics.width/2 - 4, midY - fontSize/2 - 2, textMetrics.width + 8, fontSize + 4);
      }
      
      ctx.fillStyle = '#E53E3E';
      ctx.fillText(text, midX, midY);
    }
  });

  ctx.setLineDash([]);
}

function drawFloorPlanOutline(ctx: CanvasRenderingContext2D, bounds: { minX: number; minY: number; maxX: number; maxY: number }, options: RenderOptions) {
  ctx.strokeStyle = options.wallColor || '#1A202C';
  ctx.lineWidth = (options.wallThickness || 3) * 1.5;
  
  if (options.wallShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }
  
  ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawEnhancedWalls(ctx: CanvasRenderingContext2D, floorPlan: FloorPlan, options: RenderOptions) {
  if (!floorPlan?.walls) return;
  
  ctx.strokeStyle = options.wallColor || '#1A202C';
  ctx.lineWidth = options.wallThickness || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (options.wallShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  
  floorPlan.walls.forEach(wall => {
    ctx.beginPath();
    ctx.moveTo(wall.startX, wall.startY);
    ctx.lineTo(wall.endX, wall.endY);
    ctx.stroke();
  });
  
  // Reset shadow and line properties
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawScaleIndicator(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scaleText: string, scale: number, pixelRatio: number) {
  // Enhanced scale indicator
  const x = canvas.width / pixelRatio - 180;
  const y = canvas.height / pixelRatio - 40;
  
  // Background with rounded corners effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(x - 15, y - 25, 170, 45);
  
  ctx.strokeStyle = '#2D3748';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 15, y - 25, 170, 45);
  
  // Scale text
  ctx.fillStyle = '#1A202C';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Scale: ${scaleText}`, x - 5, y - 5);
  
  // Resolution indicator
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#4A5568';
  ctx.fillText(`Zoom: ${(scale * 100).toFixed(0)}% | Res: ${canvas.width}x${canvas.height}`, x - 5, y + 10);
}

export function addMeasurementAnnotation(canvas: HTMLCanvasElement, x: number, y: number, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Enhanced annotation marker
  ctx.fillStyle = '#E53E3E';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, 2 * Math.PI);
  ctx.fill();
  
  // Inner highlight
  ctx.fillStyle = '#FFF5F5';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, 2 * Math.PI);
  ctx.fill();
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Enhanced annotation text
  ctx.fillStyle = '#1A202C';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  
  // Text background
  const textMetrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x + 12, y - 18, textMetrics.width + 8, 20);
  
  // Text border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 12, y - 18, textMetrics.width + 8, 20);
  
  // Text
  ctx.fillStyle = '#1A202C';
  ctx.fillText(text, x + 16, y - 5);
}
