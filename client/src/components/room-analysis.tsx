import { FloorPlan, Room, Measurement } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Ruler } from "lucide-react";

interface RoomAnalysisProps {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
}

export default function RoomAnalysis({ floorPlan, rooms, measurements }: RoomAnalysisProps) {
  const totalArea = floorPlan.totalArea || 0;
  const perimeter = floorPlan.perimeter || 0;
  const wallThickness = floorPlan.wallThickness || 0.2;
  const ceilingHeight = floorPlan.ceilingHeight || 2.7;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Room Detection */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="text-primary mr-3" />
          Room Detection & Analysis
        </h3>
        <div className="space-y-4">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-3" 
                  style={{ backgroundColor: room.color }}
                ></div>
                <div>
                  <p className="font-medium text-gray-900">{room.name}</p>
                  <p className="text-sm text-gray-500">{room.area?.toFixed(1)} m²</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {room.width?.toFixed(1)} × {room.height?.toFixed(1)}m
                </p>
                <p className="text-xs text-gray-500 capitalize">{room.shape}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Measurement Extraction */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Ruler className="text-primary mr-3" />
          Measurement Extraction
        </h3>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium text-gray-900 mb-2">Dimensions Found</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Floor Area</p>
                  <p className="font-semibold">{totalArea.toFixed(1)} m²</p>
                </div>
                <div>
                  <p className="text-gray-500">Perimeter</p>
                  <p className="font-semibold">{perimeter.toFixed(1)} m</p>
                </div>
                <div>
                  <p className="text-gray-500">Wall Thickness</p>
                  <p className="font-semibold">{wallThickness.toFixed(2)} m</p>
                </div>
                <div>
                  <p className="text-gray-500">Ceiling Height</p>
                  <p className="font-semibold">{ceilingHeight.toFixed(2)} m</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium text-gray-900 mb-2">Architectural Elements</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Doors</span>
                  <span className="font-semibold">{floorPlan.doors || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Windows</span>
                  <span className="font-semibold">{floorPlan.windows || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Stairs</span>
                  <span className="font-semibold">{floorPlan.stairs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Columns</span>
                  <span className="font-semibold">{floorPlan.columns || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
