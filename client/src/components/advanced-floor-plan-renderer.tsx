
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Settings,
  Download,
  Layers,
  Grid,
  Ruler
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Ilot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  type: 'small' | 'medium' | 'large';
  color: string;
  label: string;
}

interface Corridor {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  connectedIlots: string[];
  length: number;
}

interface ZoneType {
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

interface FloorPlanLayout {
  ilots: Ilot[];
  corridors: Corridor[];
  zones: ZoneType[];
  totalUsableArea: number;
  totalIlotArea: number;
  totalCorridorArea: number;
  efficiencyRatio: number;
}

interface Props {
  floorPlan: any;
  layout?: FloorPlanLayout;
  className?: string;
  onIlotSelect?: (ilot: Ilot) => void;
  onCorridorSelect?: (corridor: Corridor) => void;
}

const COLORS = {
  WALL: '#6B7280',           // Gray (MUR)
  RESTRICTED: '#3B82F6',     // Blue (NO ENTREE) 
  ENTRANCE: '#EF4444',       // Red (ENTRÉE/SORTIE)
  USABLE: '#F3F4F6',         // Light gray
  ILOT_SMALL: '#FED7D7',     // Light pink
  ILOT_MEDIUM: '#FBB6CE',    // Medium pink
  ILOT_LARGE: '#F687B3',     // Darker pink
  CORRIDOR: '#FCE7F3',       // Very light pink
  CORRIDOR_LINE: '#EC4899',  // Pink corridor outlines
  TEXT: '#111827',           // Dark gray for text
  GRID: '#E5E7EB'            // Light gray for grid
};

export function AdvancedFloorPlanRenderer({ 
  floorPlan, 
  layout, 
  className, 
  onIlotSelect,
  onCorridorSelect 
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [selectedIlot, setSelectedIlot] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [corridorWidth, setCorridorWidth] = useState([1.2]);

  const render = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Calculate bounds and scale
    const bounds = calculateBounds();
    const scale = calculateScale(bounds, rect);

    // Apply transformations
    ctx.save();
    ctx.translate(rect.width / 2 + pan.x, rect.height / 2 + pan.y);
    ctx.scale(zoom * scale, zoom * scale);
    ctx.translate(-bounds.centerX, -bounds.centerY);

    // Draw background
    ctx.fillStyle = COLORS.USABLE;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, bounds);
    }

    // Draw zones (walls, restricted areas, entrances)
    if (showZones && layout) {
      drawZones(ctx, layout.zones);
    }

    // Draw corridors
    if (layout) {
      drawCorridors(ctx, layout.corridors);
    }

    // Draw îlots
    if (layout) {
      drawIlots(ctx, layout.ilots);
    }

    // Draw measurements if enabled
    if (showMeasurements && layout) {
      drawMeasurements(ctx, layout);
    }

    ctx.restore();
  }, [zoom, pan, showGrid, showMeasurements, showZones, selectedIlot, selectedCorridor, layout, corridorWidth]);

  useEffect(() => {
    render();
  }, [render]);

  const calculateBounds = () => {
    if (!layout || layout.zones.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100, centerX: 50, centerY: 50 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const zone of layout.zones) {
      minX = Math.min(minX, zone.bounds.minX);
      minY = Math.min(minY, zone.bounds.minY);
      maxX = Math.max(maxX, zone.bounds.maxX);
      maxY = Math.max(maxY, zone.bounds.maxY);
    }

    for (const ilot of layout.ilots) {
      minX = Math.min(minX, ilot.x);
      minY = Math.min(minY, ilot.y);
      maxX = Math.max(maxX, ilot.x + ilot.width);
      maxY = Math.max(maxY, ilot.y + ilot.height);
    }

    return {
      minX: minX - 2,
      minY: minY - 2,
      maxX: maxX + 2,
      maxY: maxY + 2,
      width: maxX - minX + 4,
      height: maxY - minY + 4,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  };

  const calculateScale = (bounds: any, rect: DOMRect) => {
    const padding = 40;
    const scaleX = (rect.width - padding * 2) / bounds.width;
    const scaleY = (rect.height - padding * 2) / bounds.height;
    return Math.min(scaleX, scaleY);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, bounds: any) => {
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 0.05;
    ctx.setLineDash([0.1, 0.1]);

    // Draw 1m grid
    for (let x = Math.floor(bounds.minX); x <= Math.ceil(bounds.maxX); x++) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.maxY);
      ctx.stroke();
    }

    for (let y = Math.floor(bounds.minY); y <= Math.ceil(bounds.maxY); y++) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.maxX, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  };

  const drawZones = (ctx: CanvasRenderingContext2D, zones: ZoneType[]) => {
    for (const zone of zones) {
      ctx.fillStyle = zone.color;
      
      if (zone.type === 'wall') {
        // Draw walls as thick gray lines/rectangles
        ctx.lineWidth = 0.2; // Wall thickness
        ctx.strokeStyle = COLORS.WALL;
        ctx.fillStyle = COLORS.WALL;
        
        ctx.fillRect(
          zone.bounds.minX,
          zone.bounds.minY,
          zone.bounds.width,
          zone.bounds.height
        );
      } else if (zone.type === 'restricted') {
        // Draw restricted areas as solid blue
        ctx.fillStyle = COLORS.RESTRICTED + '80'; // Semi-transparent
        ctx.fillRect(
          zone.bounds.minX,
          zone.bounds.minY,
          zone.bounds.width,
          zone.bounds.height
        );
        
        // Add "NO ENTREE" text
        ctx.fillStyle = COLORS.TEXT;
        ctx.font = '0.5px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          'NO ENTRÉE',
          zone.bounds.minX + zone.bounds.width / 2,
          zone.bounds.minY + zone.bounds.height / 2
        );
      } else if (zone.type === 'entrance') {
        // Draw entrance areas with door swings
        ctx.fillStyle = COLORS.ENTRANCE + '60'; // Semi-transparent
        ctx.fillRect(
          zone.bounds.minX,
          zone.bounds.minY,
          zone.bounds.width,
          zone.bounds.height
        );
        
        // Draw door swing arc if available
        if (zone.doorSwing) {
          ctx.strokeStyle = COLORS.ENTRANCE;
          ctx.lineWidth = 0.1;
          ctx.beginPath();
          ctx.arc(
            zone.doorSwing.centerX,
            zone.doorSwing.centerY,
            zone.doorSwing.radius,
            zone.doorSwing.startAngle * Math.PI / 180,
            zone.doorSwing.endAngle * Math.PI / 180
          );
          ctx.stroke();
        }
        
        // Add entrance text
        ctx.fillStyle = COLORS.TEXT;
        ctx.font = '0.4px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          'ENTRÉE/SORTIE',
          zone.bounds.minX + zone.bounds.width / 2,
          zone.bounds.minY + zone.bounds.height / 2
        );
      }
    }
  };

  const drawCorridors = (ctx: CanvasRenderingContext2D, corridors: Corridor[]) => {
    for (const corridor of corridors) {
      const isSelected = selectedCorridor === corridor.id;
      
      // Draw corridor area
      ctx.fillStyle = isSelected ? COLORS.CORRIDOR + 'CC' : COLORS.CORRIDOR + '80';
      ctx.fillRect(
        corridor.startX,
        corridor.startY,
        corridor.endX - corridor.startX,
        corridor.endY - corridor.startY
      );
      
      // Draw corridor outline
      ctx.strokeStyle = isSelected ? COLORS.CORRIDOR_LINE : COLORS.CORRIDOR_LINE + '80';
      ctx.lineWidth = isSelected ? 0.15 : 0.1;
      ctx.strokeRect(
        corridor.startX,
        corridor.startY,
        corridor.endX - corridor.startX,
        corridor.endY - corridor.startY
      );
      
      // Draw width dimension
      if (showMeasurements) {
        ctx.fillStyle = COLORS.TEXT;
        ctx.font = '0.3px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${corridor.width.toFixed(1)}m`,
          (corridor.startX + corridor.endX) / 2,
          (corridor.startY + corridor.endY) / 2
        );
      }
    }
  };

  const drawIlots = (ctx: CanvasRenderingContext2D, ilots: Ilot[]) => {
    for (const ilot of ilots) {
      const isSelected = selectedIlot === ilot.id;
      
      // Draw îlot rectangle
      ctx.fillStyle = isSelected ? ilot.color + 'FF' : ilot.color + 'DD';
      ctx.fillRect(ilot.x, ilot.y, ilot.width, ilot.height);
      
      // Draw îlot outline
      ctx.strokeStyle = isSelected ? COLORS.TEXT : COLORS.CORRIDOR_LINE;
      ctx.lineWidth = isSelected ? 0.15 : 0.08;
      ctx.strokeRect(ilot.x, ilot.y, ilot.width, ilot.height);
      
      // Draw area label
      ctx.fillStyle = COLORS.TEXT;
      ctx.font = '0.25px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        ilot.label,
        ilot.x + ilot.width / 2,
        ilot.y + ilot.height / 2
      );
      
      // Draw dimensions if selected
      if (isSelected && showMeasurements) {
        ctx.font = '0.2px Arial';
        ctx.fillText(
          `${ilot.width.toFixed(1)}×${ilot.height.toFixed(1)}m`,
          ilot.x + ilot.width / 2,
          ilot.y + ilot.height / 2 + 0.3
        );
      }
    }
  };

  const drawMeasurements = (ctx: CanvasRenderingContext2D, layout: FloorPlanLayout) => {
    // Draw total area information
    const bounds = calculateBounds();
    
    ctx.fillStyle = COLORS.TEXT;
    ctx.font = '0.4px Arial';
    ctx.textAlign = 'left';
    
    const infoY = bounds.maxY - 1;
    ctx.fillText(`Total Area: ${layout.totalUsableArea.toFixed(1)}m²`, bounds.minX, infoY);
    ctx.fillText(`Îlots: ${layout.ilots.length} (${layout.totalIlotArea.toFixed(1)}m²)`, bounds.minX, infoY + 0.5);
    ctx.fillText(`Corridors: ${layout.corridors.length} (${layout.totalCorridorArea.toFixed(1)}m²)`, bounds.minX, infoY + 1);
    ctx.fillText(`Efficiency: ${(layout.efficiencyRatio * 100).toFixed(1)}%`, bounds.minX, infoY + 1.5);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    setPan(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `floor-plan-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Professional Floor Plan
            {layout && (
              <Badge variant="secondary">
                {layout.ilots.length} îlots, {layout.corridors.length} corridors
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetView}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 0.8)}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportImage}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showGrid"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            <label htmlFor="showGrid" className="text-sm">Grid</label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showMeasurements"
              checked={showMeasurements}
              onChange={(e) => setShowMeasurements(e.target.checked)}
            />
            <label htmlFor="showMeasurements" className="text-sm">Measurements</label>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showZones"
              checked={showZones}
              onChange={(e) => setShowZones(e.target.checked)}
            />
            <label htmlFor="showZones" className="text-sm">Zones</label>
          </div>
          
          <div className="flex items-center gap-2 min-w-[200px]">
            <label className="text-sm">Corridor Width:</label>
            <Slider
              value={corridorWidth}
              onValueChange={setCorridorWidth}
              min={0.8}
              max={2.0}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm w-12">{corridorWidth[0]}m</span>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-[600px] cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
          
          {/* Zoom indicator */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {(zoom * 100).toFixed(0)}%
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 p-2 rounded text-xs">
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.WALL }}></div>
                <span>MUR</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.RESTRICTED }}></div>
                <span>NO ENTRÉE</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.ENTRANCE }}></div>
                <span>ENTRÉE/SORTIE</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.CORRIDOR_LINE }}></div>
                <span>Corridors</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        {layout && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{layout.ilots.length}</div>
              <div className="text-sm text-blue-600">Îlots Placed</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{layout.corridors.length}</div>
              <div className="text-sm text-green-600">Corridors</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{layout.totalIlotArea.toFixed(1)}m²</div>
              <div className="text-sm text-purple-600">Îlot Area</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{(layout.efficiencyRatio * 100).toFixed(1)}%</div>
              <div className="text-sm text-orange-600">Efficiency</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
