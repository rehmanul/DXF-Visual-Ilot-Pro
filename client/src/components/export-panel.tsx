import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FloorPlan, Room, Measurement } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, FileSpreadsheet, Image, Download } from "lucide-react";

interface ExportPanelProps {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
}

interface ExportOptions {
  includeMeasurements: boolean;
  includeRoomLabels: boolean;
  colorCodedRooms: boolean;
  showGrid: boolean;
}

export default function ExportPanel({ floorPlan, rooms, measurements }: ExportPanelProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeMeasurements: true,
    includeRoomLabels: true,
    colorCodedRooms: true,
    showGrid: false,
  });
  const { toast } = useToast();

  const exportMutation = useMutation({
    mutationFn: async ({ format, canvasData }: { format: string; canvasData?: string }) => {
      const body: any = {
        format,
        options: exportOptions,
      };
      
      if (canvasData) {
        body.canvasData = canvasData;
      }

      const response = await apiRequest('POST', `/api/floor-plans/${floorPlan.id}/export`, body);
      return { data: await response.blob(), format };
    },
    onSuccess: ({ data, format }) => {
      // Create download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      
      const extensions = {
        pdf: 'pdf',
        excel: 'xlsx',
        cad: 'dxf',
        png: 'png'
      };
      
      const baseFilename = floorPlan.originalName.split('.')[0];
      link.download = `${baseFilename}_${format}.${extensions[format as keyof typeof extensions]}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Floor plan exported as ${format.toUpperCase()}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleExport = (format: string) => {
    if (format === 'png') {
      // Get canvas data for PNG export
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const canvasData = canvas.toDataURL('image/png');
        exportMutation.mutate({ format, canvasData });
      }
    } else {
      exportMutation.mutate({ format });
    }
  };

  const updateOption = (key: keyof ExportOptions, value: boolean) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  };

  // Calculate room data for display
  const totalRooms = rooms.length;
  const totalArea = rooms.reduce((sum, room) => sum + (room.area || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Detailed Room Analysis Table */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="text-primary mr-3" />
          Detailed Room Analysis
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-900">Room</th>
                <th className="text-right py-2 font-medium text-gray-900">Area (m²)</th>
                <th className="text-right py-2 font-medium text-gray-900">Dimensions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="py-2 flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: room.color }}
                    ></div>
                    <span>{room.name}</span>
                  </td>
                  <td className="text-right py-2 font-medium">{room.area?.toFixed(1)}</td>
                  <td className="text-right py-2 text-gray-600">
                    {room.width?.toFixed(1)} × {room.height?.toFixed(1)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td className="py-2">Total Floor Area</td>
                <td className="text-right py-2">{totalArea.toFixed(1)}</td>
                <td className="text-right py-2">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Download className="text-primary mr-3" />
          Export Options
        </h3>
        <div className="space-y-4">
          {/* PDF Export */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">High-Resolution PDF</h4>
                <Button
                  onClick={() => handleExport('pdf')}
                  disabled={exportMutation.isPending}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Complete floor plan with measurements, room labels, and color coding
              </p>
            </CardContent>
          </Card>

          {/* CAD Export */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">DXF/DWG Export</h4>
                <Button
                  onClick={() => handleExport('cad')}
                  disabled={exportMutation.isPending}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export CAD
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Processed CAD file with cleaned geometry and layer organization
              </p>
            </CardContent>
          </Card>

          {/* Excel Export */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Data Report (Excel)</h4>
                <Button
                  onClick={() => handleExport('excel')}
                  disabled={exportMutation.isPending}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Detailed room analysis, measurements, and area calculations
              </p>
            </CardContent>
          </Card>

          {/* PNG Export */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">High-Resolution PNG</h4>
                <Button
                  onClick={() => handleExport('png')}
                  disabled={exportMutation.isPending}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Export PNG
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Floor plan image suitable for presentations and documentation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Export Settings */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-3">Export Settings</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="measurements"
                  checked={exportOptions.includeMeasurements}
                  onCheckedChange={(checked) => updateOption('includeMeasurements', !!checked)}
                />
                <label htmlFor="measurements" className="text-sm text-gray-700">
                  Include measurements
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="roomLabels"
                  checked={exportOptions.includeRoomLabels}
                  onCheckedChange={(checked) => updateOption('includeRoomLabels', !!checked)}
                />
                <label htmlFor="roomLabels" className="text-sm text-gray-700">
                  Show room labels
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="colorCoding"
                  checked={exportOptions.colorCodedRooms}
                  onCheckedChange={(checked) => updateOption('colorCodedRooms', !!checked)}
                />
                <label htmlFor="colorCoding" className="text-sm text-gray-700">
                  Color-coded rooms
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="grid"
                  checked={exportOptions.showGrid}
                  onCheckedChange={(checked) => updateOption('showGrid', !!checked)}
                />
                <label htmlFor="grid" className="text-sm text-gray-700">
                  Show grid
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
