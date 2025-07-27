import { useEffect, useRef, useState } from "react";
import { FloorPlan, Room, Measurement } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoomIn, ZoomOut, Ruler, Square, StickyNote, Maximize2 } from "lucide-react";
import { renderFloorPlan, addMeasurementAnnotation } from "@/lib/canvas-utils";

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
}

export default function FloorPlanCanvas({ floorPlan, rooms, measurements }: FloorPlanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState("1:50");
  const [zoom, setZoom] = useState(1);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [selectedTool, setSelectedTool] = useState<'none' | 'measure' | 'area' | 'note'>('none');
  const [highRes, setHighRes] = useState(true);
  
  useEffect(() => {
    if (canvasRef.current && floorPlan && rooms) {
      const canvas = canvasRef.current;
      
      // Enhanced rendering options for better wall visibility
      renderFloorPlan(canvas, {
        floorPlan,
        rooms,
        measurements,
        options: {
          scale,
          zoom,
          showMeasurements,
          showRoomLabels: true,
          colorCodedRooms: true,
          showGrid: false,
          highResolution: highRes,
          wallThickness: highRes ? 5 : 3, // Thicker walls for better visibility
          wallColor: '#1A202C', // Darker wall color
          wallShadow: true, // Add shadow to walls
          antiAliasing: true,
        }
      });
    }
  }, [floorPlan, rooms, measurements, scale, zoom, showMeasurements, highRes]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.25, 5)); // Increased max zoom for high-res
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.25, 0.25)); // Increased zoom range
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    switch (selectedTool) {
      case 'measure':
        // Implementation would add measurement line
        console.log('Add measurement at:', x, y);
        break;
      case 'area':
        // Implementation would start area selection
        console.log('Add area measurement at:', x, y);
        break;
      case 'note':
        // Implementation would add annotation
        const note = prompt('Enter annotation:');
        if (note) {
          addMeasurementAnnotation(canvas, x, y, note);
          console.log('Add note:', note, 'at:', x, y);
        }
        break;
    }
  };

  const roomColors = [
    { name: 'Living Room', color: '#FF6B35' },
    { name: 'Kitchen', color: '#3B82F6' },
    { name: 'Bedrooms', color: '#10B981' },
    { name: 'Bathrooms', color: '#8B5CF6' },
    { name: 'Office', color: '#F59E0B' },
    { name: 'Storage', color: '#6B7280' },
    { name: 'Other Areas', color: '#9CA3AF' }
  ];

  return (
    <div className="bg-gray-100 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Interactive Floor Plan</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Scale:</span>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:200">1:200</SelectItem>
                <SelectItem value="1:100">1:100</SelectItem>
                <SelectItem value="1:50">1:50</SelectItem>
                <SelectItem value="1:25">1:25</SelectItem>
                <SelectItem value="1:10">1:10</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant={highRes ? "default" : "outline"}
              size="sm"
              onClick={() => setHighRes(!highRes)}
              title="Toggle High Resolution (1080p+)"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMeasurements(!showMeasurements)}
          >
            <Ruler className="w-4 h-4 mr-2" />
            Measurements
          </Button>
        </div>
      </div>

      {/* Floor Plan Canvas */}
      <div 
        ref={containerRef}
        className="bg-white rounded-lg border-2 border-gray-300 relative overflow-hidden" 
        style={{ height: highRes ? '720px' : '500px' }}
      >
        <canvas 
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
        />
        
        {/* Enhanced Legend with Statistics */}
        <div className="absolute top-4 right-4 bg-white bg-opacity-95 rounded-lg p-4 shadow-lg max-w-xs">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm">Floor Plan Details</h4>
          
          {/* Resolution Info */}
          <div className="mb-3 text-xs text-gray-600">
            <div>Resolution: {highRes ? '1080p+' : 'Standard'}</div>
            <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          </div>
          
          {/* Room Colors */}
          <div className="space-y-2 text-xs">
            <div className="font-medium text-gray-700 mb-2">Room Types:</div>
            {roomColors.map((room, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: room.color }}
                  ></div>
                  <span>{room.name}</span>
                </div>
                <span className="text-gray-500">
                  {rooms.filter(r => r.type === room.name.toLowerCase().replace(' ', '_')).length}
                </span>
              </div>
            ))}
          </div>
          
          {/* Wall Visibility Info */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <div className="flex items-center">
              <div className="w-3 h-1 bg-gray-800 mr-2 rounded"></div>
              <span>Walls (Enhanced)</span>
            </div>
          </div>
        </div>

        {/* Enhanced Measurement Tools */}
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-95 rounded-lg p-3 shadow-lg">
          <div className="flex flex-col space-y-2">
            <div className="text-xs text-gray-600 font-medium mb-1">Analysis Tools:</div>
            <div className="flex items-center space-x-2 text-sm">
              <Button
                size="sm"
                variant={selectedTool === 'measure' ? 'default' : 'outline'}
                onClick={() => setSelectedTool(selectedTool === 'measure' ? 'none' : 'measure')}
              >
                <Ruler className="w-4 h-4 mr-1" />
                Measure
              </Button>
              <Button
                size="sm"
                variant={selectedTool === 'area' ? 'default' : 'outline'}
                onClick={() => setSelectedTool(selectedTool === 'area' ? 'none' : 'area')}
              >
                <Square className="w-4 h-4 mr-1" />
                Area
              </Button>
              <Button
                size="sm"
                variant={selectedTool === 'note' ? 'default' : 'outline'}
                onClick={() => setSelectedTool(selectedTool === 'note' ? 'none' : 'note')}
              >
                <StickyNote className="w-4 h-4 mr-1" />
                Note
              </Button>
            </div>
            {selectedTool !== 'none' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                {selectedTool === 'measure' && 'Click two points to measure distance'}
                {selectedTool === 'area' && 'Click to define area boundaries'}
                {selectedTool === 'note' && 'Click to add annotation'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
