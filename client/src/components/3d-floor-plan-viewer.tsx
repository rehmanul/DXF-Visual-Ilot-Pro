import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Home,
  Eye,
  Layers,
  Palette,
  Settings
} from 'lucide-react';

interface Room {
  id: number;
  name: string;
  type: string;
  color: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  boundaries?: number[][];
}

interface Props {
  rooms: Room[];
  className?: string;
}

export function FloorPlan3DViewer({ rooms, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: -30, y: 45, z: 0 });
  const [zoom, setZoom] = useState(1);
  const [showWalls, setShowWalls] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  const [wallHeight, setWallHeight] = useState(3);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current || rooms.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds
    const allRooms = rooms;
    const minX = Math.min(...allRooms.map(r => r.minX));
    const minY = Math.min(...allRooms.map(r => r.minY));
    const maxX = Math.max(...allRooms.map(r => r.maxX));
    const maxY = Math.max(...allRooms.map(r => r.maxY));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const scale = Math.min(canvas.width, canvas.height) / Math.max(maxX - minX, maxY - minY) * 0.8 * zoom;

    // Transform 3D to 2D projection
    const project3D = (x: number, y: number, z: number) => {
      // Apply rotation
      const cosX = Math.cos(rotation.x * Math.PI / 180);
      const sinX = Math.sin(rotation.x * Math.PI / 180);
      const cosY = Math.cos(rotation.y * Math.PI / 180);
      const sinY = Math.sin(rotation.y * Math.PI / 180);

      // Translate to center
      const tx = x - centerX;
      const ty = y - centerY;

      // Rotate around Y axis (left-right)
      const x1 = tx * cosY - z * sinY;
      const z1 = tx * sinY + z * cosY;

      // Rotate around X axis (up-down)
      const y1 = ty * cosX - z1 * sinX;
      const z2 = ty * sinX + z1 * cosX;

      // Project to 2D
      const projectedX = canvas.width / 2 + x1 * scale;
      const projectedY = canvas.height / 2 + y1 * scale;

      return { x: projectedX, y: projectedY, z: z2 };
    };

    // Draw rooms in 3D
    if (showRooms) {
      allRooms.forEach(room => {
        const corners = [
          { x: room.minX, y: room.minY },
          { x: room.maxX, y: room.minY },
          { x: room.maxX, y: room.maxY },
          { x: room.minX, y: room.maxY }
        ];

        // Draw floor
        ctx.fillStyle = room.color + '80'; // Semi-transparent
        ctx.strokeStyle = room.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        corners.forEach((corner, i) => {
          const projected = project3D(corner.x, corner.y, 0);
          if (i === 0) {
            ctx.moveTo(projected.x, projected.y);
          } else {
            ctx.lineTo(projected.x, projected.y);
          }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw walls if enabled
        if (showWalls) {
          ctx.fillStyle = room.color + '40';
          ctx.strokeStyle = room.color;

          // Draw vertical walls
          corners.forEach((corner, i) => {
            const nextCorner = corners[(i + 1) % corners.length];

            const bottomStart = project3D(corner.x, corner.y, 0);
            const bottomEnd = project3D(nextCorner.x, nextCorner.y, 0);
            const topStart = project3D(corner.x, corner.y, wallHeight);
            const topEnd = project3D(nextCorner.x, nextCorner.y, wallHeight);

            // Draw wall face
            ctx.beginPath();
            ctx.moveTo(bottomStart.x, bottomStart.y);
            ctx.lineTo(bottomEnd.x, bottomEnd.y);
            ctx.lineTo(topEnd.x, topEnd.y);
            ctx.lineTo(topStart.x, topStart.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          });

          // Draw ceiling
          ctx.fillStyle = room.color + '20';
          ctx.beginPath();
          corners.forEach((corner, i) => {
            const projected = project3D(corner.x, corner.y, wallHeight);
            if (i === 0) {
              ctx.moveTo(projected.x, projected.y);
            } else {
              ctx.lineTo(projected.x, projected.y);
            }
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Draw room label
        const centerRoomX = (room.minX + room.maxX) / 2;
        const centerRoomY = (room.minY + room.maxY) / 2;
        const labelPos = project3D(centerRoomX, centerRoomY, wallHeight / 2);

        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, labelPos.x, labelPos.y);
      });
    }

    // Draw coordinate axes for reference
    const axisLength = 50;
    const origin = project3D(centerX, centerY, 0);

    // X axis (red)
    const xEnd = project3D(centerX + axisLength, centerY, 0);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xEnd.x, xEnd.y);
    ctx.stroke();

    // Y axis (green)
    const yEnd = project3D(centerX, centerY + axisLength, 0);
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(yEnd.x, yEnd.y);
    ctx.stroke();

    // Z axis (blue)
    const zEnd = project3D(centerX, centerY, axisLength);
    ctx.strokeStyle = '#0000ff';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(zEnd.x, zEnd.y);
    ctx.stroke();

  }, [rooms, rotation, zoom, showWalls, showRooms, wallHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    setRotation(prev => ({
      x: Math.max(-90, Math.min(90, prev.x + deltaY * 0.5)),
      y: prev.y + deltaX * 0.5,
      z: prev.z
    }));

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setRotation({ x: -30, y: 45, z: 0 });
    setZoom(1);
  };

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            3D Floor Plan View
          </span>
          <Badge variant="secondary">{rooms.length} rooms</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={resetView}>
            <Home className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="w-4 h-4 mr-1" />
            Zoom In
          </Button>
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="w-4 h-4 mr-1" />
            Zoom Out
          </Button>
          <Button 
            variant={showWalls ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowWalls(!showWalls)}
          >
            <Layers className="w-4 h-4 mr-1" />
            Walls
          </Button>
          <Button 
            variant={showRooms ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowRooms(!showRooms)}
          >
            <Palette className="w-4 h-4 mr-1" />
            Rooms
          </Button>
        </div>

        {/* Wall Height Control */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">
            Wall Height: {wallHeight}m
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="0.5"
            value={wallHeight}
            onChange={(e) => setWallHeight(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <Separator className="mb-4" />

        {/* 3D Canvas */}
        <div className="relative bg-gray-50 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full h-auto cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* View Info */}
          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
            X: {rotation.x.toFixed(1)}° Y: {rotation.y.toFixed(1)}° Z: {zoom.toFixed(1)}x
          </div>

          {/* Instructions */}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
            Drag to rotate • Scroll to zoom
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rooms.slice(0, 6).map(room => (
            <div key={room.id} className="flex items-center text-xs">
              <div 
                className="w-3 h-3 rounded mr-2" 
                style={{ backgroundColor: room.color }}
              />
              <span className="truncate">{room.name}</span>
            </div>
          ))}
          {rooms.length > 6 && (
            <div className="text-xs text-gray-500">
              +{rooms.length - 6} more rooms
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}