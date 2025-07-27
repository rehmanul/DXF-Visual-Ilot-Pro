import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import
  {
    Eye,
    Layers3,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    Settings,
    Palette,
    Grid3X3,
    Ruler
  } from 'lucide-react';

import { FloorPlan, Ilot, Corridor } from '@shared/schema';
import { VisualizationMode } from '@/lib/visualization-state';

interface Props
{
  className?: string;
  floorPlan?: any;
  layout?: any;
  visualizationMode?: VisualizationMode;
  onVisualizationModeChange?: ( mode: VisualizationMode ) => void;
  onIlotSelect?: ( ilot: Ilot ) => void;
  onCorridorSelect?: ( corridor: Corridor ) => void;
}

interface Zone
{
  type: 'wall' | 'restricted' | 'entrance' | 'usable';
  color: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  doorSwing?: {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

// Exact color matching from reference images
const ZONE_COLORS = {
  wall: '#6B7280',        // Gray (MUR)
  restricted: '#3B82F6',  // Blue (NO ENTREE)
  entrance: '#EF4444',    // Red (ENTRÉE/SORTIE)
  usable: '#F8FAFC',      // Light background
  ilot_small: '#FED7D7',  // Light pink
  ilot_medium: '#FBB6CE', // Medium pink
  ilot_large: '#F687B3',  // Darker pink
  corridor: '#EC4899'     // Pink corridor lines
};

export function PixelPerfectFloorPlanRenderer({
  className,
  floorPlan,
  layout,
  visualizationMode = 'base',
  onVisualizationModeChange,
  onIlotSelect,
  onCorridorSelect
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [selectedIlot, setSelectedIlot] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<string | null>(null);

  const drawFloorPlan = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !floorPlan) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up coordinate system
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width / zoom, canvas.height / zoom);
    }

    // Base mode: Draw only walls, restricted areas, and entrances
    if (visualizationMode === 'base' || !layout) {
      drawBaseFloorPlan(ctx, floorPlan);
    }
    
    // Detailed mode: Draw everything including îlots and corridors
    if (visualizationMode === 'detailed' && layout) {
      drawBaseFloorPlan(ctx, floorPlan);
      drawIlots(ctx, layout.ilots);
      drawCorridors(ctx, layout.corridors);
      drawMeasurements(ctx, layout);
    }

    ctx.restore();
  }, [floorPlan, layout, visualizationMode, zoom, pan, showGrid, selectedIlot, selectedCorridor]);

  const drawBaseFloorPlan = (ctx: CanvasRenderingContext2D, plan: any) => {
    if (!plan.geometryData) return;

    const entities = plan.geometryData.entities || [];
    
    entities.forEach((entity: any) => {
      const layer = entity.layer?.toLowerCase() || '';
      const type = entity.type?.toLowerCase() || '';

      // Draw walls (thick gray lines)
      if (layer.includes('wall') || layer.includes('mur')) {
        ctx.strokeStyle = ZONE_COLORS.wall;
        ctx.lineWidth = 3;
        drawEntityPath(ctx, entity);
      }
      
      // Draw restricted areas (blue zones)
      else if (layer.includes('restrict') || layer.includes('interdit')) {
        ctx.fillStyle = ZONE_COLORS.restricted;
        ctx.globalAlpha = 0.3;
        drawEntityFill(ctx, entity);
        ctx.globalAlpha = 1;
      }
      
      // Draw entrances (red zones with door swings)
      else if (layer.includes('entrance') || layer.includes('entree') || layer.includes('door')) {
        ctx.fillStyle = ZONE_COLORS.entrance;
        ctx.globalAlpha = 0.4;
        drawEntityFill(ctx, entity);
        ctx.globalAlpha = 1;
        
        // Draw door swing if it's an arc
        if (type === 'arc') {
          drawDoorSwing(ctx, entity);
        }
      }
    });
  };

  const drawIlots = (ctx: CanvasRenderingContext2D, ilots: any[]) => {
    ilots.forEach(ilot => {
      const isSelected = selectedIlot === ilot.id;
      
      // Draw îlot rectangle
      ctx.fillStyle = ilot.color || ZONE_COLORS[`ilot_${ilot.type}` as keyof typeof ZONE_COLORS] || ZONE_COLORS.ilot_medium;
      ctx.strokeStyle = isSelected ? '#000000' : '#E5E7EB';
      ctx.lineWidth = isSelected ? 2 : 1;
      
      ctx.fillRect(ilot.x, ilot.y, ilot.width, ilot.height);
      ctx.strokeRect(ilot.x, ilot.y, ilot.width, ilot.height);
      
      // Draw area label
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        ilot.label || `${ilot.area.toFixed(1)}m²`,
        ilot.x + ilot.width / 2,
        ilot.y + ilot.height / 2
      );
    });
  };

  const drawCorridors = (ctx: CanvasRenderingContext2D, corridors: any[]) => {
    corridors.forEach(corridor => {
      const isSelected = selectedCorridor === corridor.id;
      
      ctx.strokeStyle = isSelected ? '#BE185D' : ZONE_COLORS.corridor;
      ctx.lineWidth = corridor.width * 10; // Scale corridor width for visibility
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(corridor.startX, corridor.startY);
      ctx.lineTo(corridor.endX, corridor.endY);
      ctx.stroke();
      
      // Draw corridor width label
      if (isSelected) {
        const midX = (corridor.startX + corridor.endX) / 2;
        const midY = (corridor.startY + corridor.endY) / 2;
        
        ctx.fillStyle = '#BE185D';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${corridor.width.toFixed(1)}m`, midX, midY);
      }
    });
  };

  const drawMeasurements = (ctx: CanvasRenderingContext2D, layout: any) => {
    // Draw total area measurements
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    const measurements = [
      `Total Area: ${layout.totalUsableArea.toFixed(1)}m²`,
      `Îlot Area: ${layout.totalIlotArea.toFixed(1)}m²`,
      `Corridor Area: ${layout.totalCorridorArea.toFixed(1)}m²`,
      `Efficiency: ${(layout.efficiencyRatio * 100).toFixed(1)}%`
    ];
    
    measurements.forEach((text, index) => {
      ctx.fillText(text, 10, 30 + index * 20);
    });
  };

  const drawEntityPath = (ctx: CanvasRenderingContext2D, entity: any) => {
    if (!entity.coordinates || entity.coordinates.length === 0) return;
    
    ctx.beginPath();
    const coords = entity.coordinates;
    ctx.moveTo(coords[0][0], coords[0][1]);
    
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i][0], coords[i][1]);
    }
    
    ctx.stroke();
  };

  const drawEntityFill = (ctx: CanvasRenderingContext2D, entity: any) => {
    if (!entity.coordinates || entity.coordinates.length === 0) return;
    
    ctx.beginPath();
    const coords = entity.coordinates;
    ctx.moveTo(coords[0][0], coords[0][1]);
    
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i][0], coords[i][1]);
    }
    
    ctx.closePath();
    ctx.fill();
  };

  const drawDoorSwing = (ctx: CanvasRenderingContext2D, entity: any) => {
    if (!entity.properties) return;
    
    const { center_x, center_y, radius, start_angle, end_angle } = entity.properties;
    
    ctx.strokeStyle = ZONE_COLORS.entrance;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center_x, center_y, radius, start_angle * Math.PI / 180, end_angle * Math.PI / 180);
    ctx.stroke();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    
    const gridSize = 50; // 50 units grid
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout || visualizationMode !== 'detailed') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - pan.x) / zoom;
    const y = (event.clientY - rect.top - pan.y) / zoom;
    
    // Check for îlot clicks
    const clickedIlot = layout.ilots.find((ilot: any) => 
      x >= ilot.x && x <= ilot.x + ilot.width &&
      y >= ilot.y && y <= ilot.y + ilot.height
    );
    
    if (clickedIlot) {
      setSelectedIlot(clickedIlot.id);
      setSelectedCorridor(null);
      onIlotSelect?.(clickedIlot);
      return;
    }
    
    // Check for corridor clicks
    const clickedCorridor = layout.corridors.find((corridor: any) => {
      const distance = distanceToLineSegment(
        { x, y },
        { x: corridor.startX, y: corridor.startY },
        { x: corridor.endX, y: corridor.endY }
      );
      return distance <= corridor.width / 2;
    });
    
    if (clickedCorridor) {
      setSelectedCorridor(clickedCorridor.id);
      setSelectedIlot(null);
      onCorridorSelect?.(clickedCorridor);
      return;
    }
    
    // Clear selection
    setSelectedIlot(null);
    setSelectedCorridor(null);
  };

  const distanceToLineSegment = (point: {x: number, y: number}, start: {x: number, y: number}, end: {x: number, y: number}) => {
    const A = point.x - start.x;
    const B = point.y - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = start.x;
      yy = start.y;
    } else if (param > 1) {
      xx = end.x;
      yy = end.y;
    } else {
      xx = start.x + param * C;
      yy = start.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  useEffect(() => {
    drawFloorPlan();
  }, [drawFloorPlan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = Math.max(600, container.clientHeight);
        drawFloorPlan();
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawFloorPlan]);

  return (
    <div className={`relative ${className}`}>
      {/* Visualization Mode Toggle */}
      <div className="absolute top-4 left-4 z-10">
        <Tabs value={visualizationMode} onValueChange={(value) => onVisualizationModeChange?.(value as VisualizationMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="base" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Base Plan
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <Layers3 className="w-4 h-4" />
              With Îlots
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.min(zoom * 1.2, 3))}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.max(zoom / 1.2, 0.1))}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant={showGrid ? "default" : "outline"}
          size="sm"
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full border border-gray-200 rounded-lg cursor-crosshair"
        onClick={handleCanvasClick}
        style={{ minHeight: '600px' }}
      />

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              Mode: {visualizationMode === 'base' ? 'Base Plan' : 'Detailed Layout'}
            </Badge>
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            {layout && (
              <>
                <span>Îlots: {layout.ilots.length}</span>
                <span>Corridors: {layout.corridors.length}</span>
                <span>Corridor Width: 1.2m</span>
              </>
            )}
          </div>
          {selectedIlot && (
            <Badge variant="default">
              Selected Îlot: {selectedIlot}
            </Badge>
          )}
          {selectedCorridor && (
            <Badge variant="default">
              Selected Corridor: {selectedCorridor}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

