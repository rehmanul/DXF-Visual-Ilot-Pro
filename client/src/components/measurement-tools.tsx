
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Ruler, 
  Square, 
  Circle, 
  MapPin, 
  Trash2, 
  Download,
  Calculator,
  Move,
  RotateCcw
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  id: string;
  type: 'distance' | 'area' | 'angle' | 'annotation';
  points: Point[];
  value: number;
  unit: string;
  label: string;
  color: string;
}

interface MeasurementToolsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  scale: number;
  measurements: Measurement[];
  onMeasurementsChange: (measurements: Measurement[]) => void;
}

export function MeasurementTools({ 
  canvasRef, 
  scale, 
  measurements, 
  onMeasurementsChange 
}: MeasurementToolsProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [showMeasurements, setShowMeasurements] = useState(true);

  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!canvasRef.current || !activeTool) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const point = { x, y };

    if (activeTool === 'distance') {
      if (currentPoints.length === 0) {
        setCurrentPoints([point]);
        setIsDrawing(true);
      } else if (currentPoints.length === 1) {
        const newMeasurement: Measurement = {
          id: `measure_${Date.now()}`,
          type: 'distance',
          points: [currentPoints[0], point],
          value: calculateDistance(currentPoints[0], point) * scale,
          unit: 'm',
          label: `${(calculateDistance(currentPoints[0], point) * scale).toFixed(2)}m`,
          color: '#3B82F6'
        };
        onMeasurementsChange([...measurements, newMeasurement]);
        setCurrentPoints([]);
        setIsDrawing(false);
        setActiveTool(null);
      }
    } else if (activeTool === 'area') {
      const newPoints = [...currentPoints, point];
      setCurrentPoints(newPoints);
      
      if (newPoints.length >= 3) {
        // Check if clicking near the first point to close the polygon
        const firstPoint = newPoints[0];
        const distance = calculateDistance(point, firstPoint);
        
        if (distance < 20 || newPoints.length > 8) { // Close polygon
          const area = calculatePolygonArea(newPoints) * scale * scale;
          const newMeasurement: Measurement = {
            id: `area_${Date.now()}`,
            type: 'area',
            points: newPoints,
            value: area,
            unit: 'm²',
            label: `${area.toFixed(2)}m²`,
            color: '#10B981'
          };
          onMeasurementsChange([...measurements, newMeasurement]);
          setCurrentPoints([]);
          setIsDrawing(false);
          setActiveTool(null);
        }
      }
    } else if (activeTool === 'annotation') {
      const label = prompt('Enter annotation text:');
      if (label) {
        const newMeasurement: Measurement = {
          id: `annotation_${Date.now()}`,
          type: 'annotation',
          points: [point],
          value: 0,
          unit: '',
          label,
          color: '#F59E0B'
        };
        onMeasurementsChange([...measurements, newMeasurement]);
      }
      setActiveTool(null);
    }
  }, [activeTool, currentPoints, measurements, onMeasurementsChange, scale, canvasRef]);

  const calculateDistance = (p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const calculatePolygonArea = (points: Point[]): number => {
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  };

  const deleteMeasurement = (id: string) => {
    onMeasurementsChange(measurements.filter(m => m.id !== id));
  };

  const clearAllMeasurements = () => {
    onMeasurementsChange([]);
    setCurrentPoints([]);
    setIsDrawing(false);
    setActiveTool(null);
  };

  const exportMeasurements = () => {
    const data = measurements.map(m => ({
      type: m.type,
      value: m.value,
      unit: m.unit,
      label: m.label,
      coordinates: m.points
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'measurements.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [handleCanvasClick]);

  // Draw measurements on canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showMeasurements) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw existing measurements
    measurements.forEach(measurement => {
      ctx.strokeStyle = measurement.color;
      ctx.fillStyle = measurement.color;
      ctx.lineWidth = 2;
      ctx.font = '12px Arial';

      if (measurement.type === 'distance') {
        const [p1, p2] = measurement.points;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Draw measurement label
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.fillText(measurement.label, midX + 5, midY - 5);
      } else if (measurement.type === 'area') {
        ctx.beginPath();
        ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
        for (let i = 1; i < measurement.points.length; i++) {
          ctx.lineTo(measurement.points[i].x, measurement.points[i].y);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();

        // Draw area label at centroid
        const centroidX = measurement.points.reduce((sum, p) => sum + p.x, 0) / measurement.points.length;
        const centroidY = measurement.points.reduce((sum, p) => sum + p.y, 0) / measurement.points.length;
        ctx.fillText(measurement.label, centroidX, centroidY);
      } else if (measurement.type === 'annotation') {
        const point = measurement.points[0];
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(measurement.label, point.x + 8, point.y - 8);
      }
    });

    // Draw current measurement being created
    if (isDrawing && currentPoints.length > 0) {
      ctx.strokeStyle = '#FF6B35';
      ctx.fillStyle = '#FF6B35';
      ctx.lineWidth = 2;

      if (activeTool === 'distance' && currentPoints.length === 1) {
        // Draw starting point
        ctx.beginPath();
        ctx.arc(currentPoints[0].x, currentPoints[0].y, 4, 0, 2 * Math.PI);
        ctx.fill();
      } else if (activeTool === 'area' && currentPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.stroke();

        // Draw points
        currentPoints.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    }
  }, [measurements, currentPoints, isDrawing, activeTool, showMeasurements, canvasRef]);

  const totalArea = measurements
    .filter(m => m.type === 'area')
    .reduce((sum, m) => sum + m.value, 0);

  const totalDistance = measurements
    .filter(m => m.type === 'distance')
    .reduce((sum, m) => sum + m.value, 0);

  return (
    <div className="space-y-4">
      {/* Tool Selection */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <Calculator className="w-5 h-5 mr-2" />
            Measurement Tools
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Button
              variant={activeTool === 'distance' ? 'default' : 'outline'}
              onClick={() => setActiveTool(activeTool === 'distance' ? null : 'distance')}
              className="flex items-center"
            >
              <Ruler className="w-4 h-4 mr-1" />
              Distance
            </Button>
            
            <Button
              variant={activeTool === 'area' ? 'default' : 'outline'}
              onClick={() => setActiveTool(activeTool === 'area' ? null : 'area')}
              className="flex items-center"
            >
              <Square className="w-4 h-4 mr-1" />
              Area
            </Button>
            
            <Button
              variant={activeTool === 'annotation' ? 'default' : 'outline'}
              onClick={() => setActiveTool(activeTool === 'annotation' ? null : 'annotation')}
              className="flex items-center"
            >
              <MapPin className="w-4 h-4 mr-1" />
              Annotate
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowMeasurements(!showMeasurements)}
              className="flex items-center"
            >
              <Circle className="w-4 h-4 mr-1" />
              {showMeasurements ? 'Hide' : 'Show'}
            </Button>
          </div>

          {activeTool && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              {activeTool === 'distance' && 'Click two points to measure distance'}
              {activeTool === 'area' && 'Click points to create a polygon. Click near the first point to close.'}
              {activeTool === 'annotation' && 'Click to add an annotation'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Measurement Summary */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-medium mb-3">Measurement Summary</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {totalDistance.toFixed(2)}m
              </div>
              <div className="text-sm text-gray-600">Total Distance</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">
                {totalArea.toFixed(2)}m²
              </div>
              <div className="text-sm text-gray-600">Total Area</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllMeasurements}
              disabled={measurements.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportMeasurements}
              disabled={measurements.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Measurements List */}
      {measurements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3">Measurements ({measurements.length})</h4>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {measurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: measurement.color }}
                    />
                    <span className="text-sm font-medium">
                      {measurement.label}
                    </span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {measurement.type}
                    </Badge>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMeasurement(measurement.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
