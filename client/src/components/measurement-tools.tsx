import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ruler, Square, StickyNote, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateDistance, calculateArea, formatMeasurement } from "@/lib/measurement-utils";

export type MeasurementTool = 'none' | 'distance' | 'area' | 'annotation';

interface MeasurementPoint {
  x: number;
  y: number;
}

interface Measurement {
  id: string;
  type: MeasurementTool;
  points: MeasurementPoint[];
  value?: number;
  unit: string;
  label?: string;
  completed: boolean;
}

interface MeasurementToolsProps {
  selectedTool: MeasurementTool;
  onToolSelect: (tool: MeasurementTool) => void;
  onMeasurementAdd: (measurement: Measurement) => void;
  onMeasurementUpdate: (id: string, measurement: Partial<Measurement>) => void;
  onMeasurementDelete: (id: string) => void;
  measurements: Measurement[];
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export default function MeasurementTools({
  selectedTool,
  onToolSelect,
  onMeasurementAdd,
  onMeasurementUpdate,
  onMeasurementDelete,
  measurements,
  canvasRef
}: MeasurementToolsProps) {
  const [currentMeasurement, setCurrentMeasurement] = useState<Measurement | null>(null);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [pendingAnnotationPoint, setPendingAnnotationPoint] = useState<MeasurementPoint | null>(null);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'none') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point: MeasurementPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    switch (selectedTool) {
      case 'distance':
        handleDistanceMeasurement(point);
        break;
      case 'area':
        handleAreaMeasurement(point);
        break;
      case 'annotation':
        handleAnnotation(point);
        break;
    }
  }, [selectedTool, currentMeasurement, canvasRef]);

  const handleDistanceMeasurement = (point: MeasurementPoint) => {
    if (!currentMeasurement) {
      // Start new distance measurement
      const newMeasurement: Measurement = {
        id: `dist_${Date.now()}`,
        type: 'distance',
        points: [point],
        unit: 'm',
        completed: false
      };
      setCurrentMeasurement(newMeasurement);
    } else if (currentMeasurement.points.length === 1) {
      // Complete distance measurement
      const updatedMeasurement = {
        ...currentMeasurement,
        points: [...currentMeasurement.points, point],
        value: calculateDistance(
          currentMeasurement.points[0].x,
          currentMeasurement.points[0].y,
          point.x,
          point.y
        ),
        completed: true
      };
      
      onMeasurementAdd(updatedMeasurement);
      setCurrentMeasurement(null);
      onToolSelect('none');
    }
  };

  const handleAreaMeasurement = (point: MeasurementPoint) => {
    if (!currentMeasurement) {
      // Start new area measurement
      const newMeasurement: Measurement = {
        id: `area_${Date.now()}`,
        type: 'area',
        points: [point],
        unit: 'm²',
        completed: false
      };
      setCurrentMeasurement(newMeasurement);
    } else {
      // Add point to area measurement
      const updatedPoints = [...currentMeasurement.points, point];
      
      if (updatedPoints.length >= 3) {
        // Check if user clicked near the first point to close the polygon
        const firstPoint = updatedPoints[0];
        const distance = calculateDistance(point.x, point.y, firstPoint.x, firstPoint.y);
        
        if (distance < 20) { // Close polygon if within 20 pixels of start
          const area = calculateArea(updatedPoints.map(p => [p.x, p.y] as [number, number]));
          const completedMeasurement = {
            ...currentMeasurement,
            points: updatedPoints,
            value: area,
            completed: true
          };
          
          onMeasurementAdd(completedMeasurement);
          setCurrentMeasurement(null);
          onToolSelect('none');
          return;
        }
      }
      
      setCurrentMeasurement({
        ...currentMeasurement,
        points: updatedPoints
      });
    }
  };

  const handleAnnotation = (point: MeasurementPoint) => {
    setPendingAnnotationPoint(point);
    setShowAnnotationDialog(true);
  };

  const saveAnnotation = () => {
    if (!pendingAnnotationPoint || !annotationText.trim()) return;

    const annotation: Measurement = {
      id: `note_${Date.now()}`,
      type: 'annotation',
      points: [pendingAnnotationPoint],
      unit: '',
      label: annotationText.trim(),
      completed: true
    };

    onMeasurementAdd(annotation);
    setShowAnnotationDialog(false);
    setAnnotationText('');
    setPendingAnnotationPoint(null);
    onToolSelect('none');
  };

  const cancelCurrentMeasurement = () => {
    setCurrentMeasurement(null);
    onToolSelect('none');
  };

  const finishAreaMeasurement = () => {
    if (currentMeasurement && currentMeasurement.points.length >= 3) {
      const area = calculateArea(currentMeasurement.points.map(p => [p.x, p.y] as [number, number]));
      const completedMeasurement = {
        ...currentMeasurement,
        value: area,
        completed: true
      };
      
      onMeasurementAdd(completedMeasurement);
      setCurrentMeasurement(null);
      onToolSelect('none');
    }
  };

  return (
    <>
      {/* Tool Selection */}
      <Card className="bg-white bg-opacity-95 shadow-lg">
        <CardContent className="p-3">
          <div className="flex items-center space-x-3 text-sm">
            <Button
              size="sm"
              variant={selectedTool === 'distance' ? 'default' : 'outline'}
              onClick={() => onToolSelect(selectedTool === 'distance' ? 'none' : 'distance')}
              className="text-xs"
            >
              <Ruler className="w-4 h-4 mr-1" />
              Measure
            </Button>
            <Button
              size="sm"
              variant={selectedTool === 'area' ? 'default' : 'outline'}
              onClick={() => onToolSelect(selectedTool === 'area' ? 'none' : 'area')}
              className="text-xs"
            >
              <Square className="w-4 h-4 mr-1" />
              Area
            </Button>
            <Button
              size="sm"
              variant={selectedTool === 'annotation' ? 'default' : 'outline'}
              onClick={() => onToolSelect(selectedTool === 'annotation' ? 'none' : 'annotation')}
              className="text-xs"
            >
              <StickyNote className="w-4 h-4 mr-1" />
              Note
            </Button>
            
            {currentMeasurement && (
              <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-gray-300">
                {currentMeasurement.type === 'area' && currentMeasurement.points.length >= 3 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={finishAreaMeasurement}
                    className="text-xs"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Finish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelCurrentMeasurement}
                  className="text-xs"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          
          {/* Current measurement status */}
          {currentMeasurement && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                {currentMeasurement.type === 'distance' && (
                  <>Click second point to complete distance measurement</>
                )}
                {currentMeasurement.type === 'area' && (
                  <>
                    Click to add points. {currentMeasurement.points.length >= 3 ? 'Click near first point or use Finish button to close.' : `${currentMeasurement.points.length} point(s) added.`}
                  </>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Measurement List */}
      {measurements.length > 0 && (
        <Card className="bg-white bg-opacity-95 shadow-lg mt-4 max-w-xs">
          <CardContent className="p-3">
            <h4 className="font-medium text-gray-900 mb-2 text-sm">Measurements</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {measurements.map((measurement) => (
                <div key={measurement.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {measurement.type === 'distance' && 'Distance'}
                      {measurement.type === 'area' && 'Area'}
                      {measurement.type === 'annotation' && (measurement.label || 'Note')}
                    </p>
                    {measurement.value !== undefined && (
                      <p className="text-gray-500">
                        {formatMeasurement(measurement.value, measurement.unit)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onMeasurementDelete(measurement.id)}
                    className="p-1 h-auto text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annotation Dialog */}
      {showAnnotationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-80">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Annotation</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="annotation-text">Annotation Text</Label>
                  <Input
                    id="annotation-text"
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Enter your note..."
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAnnotationDialog(false);
                      setAnnotationText('');
                      setPendingAnnotationPoint(null);
                      onToolSelect('none');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveAnnotation}
                    disabled={!annotationText.trim()}
                  >
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructions */}
      {selectedTool !== 'none' && (
        <Card className="bg-blue-50 border-blue-200 mt-4">
          <CardContent className="p-3">
            <div className="flex items-start">
              <div className="text-blue-600 mt-1 mr-2">
                {selectedTool === 'distance' && <Ruler className="w-4 h-4" />}
                {selectedTool === 'area' && <Square className="w-4 h-4" />}
                {selectedTool === 'annotation' && <StickyNote className="w-4 h-4" />}
              </div>
              <div className="text-sm text-blue-700">
                {selectedTool === 'distance' && (
                  <div>
                    <p className="font-medium">Distance Measurement</p>
                    <p>Click two points to measure the distance between them.</p>
                  </div>
                )}
                {selectedTool === 'area' && (
                  <div>
                    <p className="font-medium">Area Measurement</p>
                    <p>Click to define polygon vertices. Click near the first point or use the Finish button to close the shape.</p>
                  </div>
                )}
                {selectedTool === 'annotation' && (
                  <div>
                    <p className="font-medium">Add Annotation</p>
                    <p>Click anywhere to add a text annotation at that location.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// Hook to attach canvas click handler
export function useMeasurementCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  selectedTool: MeasurementTool,
  onCanvasClick: (event: React.MouseEvent<HTMLCanvasElement>) => void
) {
  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'none') {
      onCanvasClick(event);
    }
  }, [selectedTool, onCanvasClick]);

  return handleClick;
}
