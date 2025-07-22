import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { ResponsiveLayout } from "@/components/responsive-layout";
import UploadZone from "@/components/upload-zone";
import RoomAnalysis from "@/components/room-analysis";
import FloorPlanCanvas from "@/components/floor-plan-canvas";
import { FloorPlan3DViewer } from "@/components/3d-floor-plan-viewer";
import ExportPanel from "@/components/export-panel";
import { ProcessingResult } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  CheckCircle, 
  Upload, 
  Search, 
  Eye,
  Layers3,
  Brain,
  Zap,
  FileText,
  Download,
  Sparkles,
  Clock,
  Database
} from "lucide-react";
import { io, Socket } from 'socket.io-client';

export default function Home() {
  const { id } = useParams<{ id: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<number | null>(
    id ? parseInt(id) : null
  );
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  // Setup WebSocket connection
  React.useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('processing-update', (data) => {
      if (data.floorPlanId === selectedFloorPlanId) {
        setProcessingProgress(data.progress);
        setProcessingMessage(data.message);
      }
    });

    newSocket.on('processing-complete', (data) => {
      if (data.floorPlanId === selectedFloorPlanId) {
        queryClient.invalidateQueries({ queryKey: ['/api/floor-plans', selectedFloorPlanId] });
        setProcessingProgress(100);
        setProcessingMessage('Processing complete!');
      }
    });

    newSocket.on('processing-error', (data) => {
      if (data.floorPlanId === selectedFloorPlanId) {
        setProcessingMessage(`Error: ${data.error}`);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [selectedFloorPlanId, queryClient]);

  // Query for floor plan details
  const { data: floorPlanData, isLoading: isLoadingPlan } = useQuery<ProcessingResult>({
    queryKey: ['/api/floor-plans', selectedFloorPlanId],
    enabled: !!selectedFloorPlanId,
  });

  // Query for processing status when floor plan is being processed
  const { data: statusData } = useQuery({
    queryKey: ['/api/floor-plans', selectedFloorPlanId, 'status'],
    enabled: !!selectedFloorPlanId && floorPlanData?.floorPlan?.status === 'processing',
    refetchInterval: 2000, // Poll every 2 seconds
  });

  useEffect(() => {
    if (floorPlanData?.floorPlan) {
      const status = floorPlanData.floorPlan.status;
      if (status === 'completed') {
        setCurrentStep(3);
      } else if (status === 'processing') {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    }
  }, [floorPlanData]);

  const handleFloorPlanSelect = (floorPlanId: number) => {
    setSelectedFloorPlanId(floorPlanId);
  };

  const handleUploadComplete = (floorPlanId: number) => {
    setSelectedFloorPlanId(floorPlanId);
    setCurrentStep(2);
  };

  // AI room labeling mutation
  const aiLabelMutation = useMutation({
    mutationFn: async (floorPlanId: number) => {
      const response = await fetch(`/api/floor-plans/${floorPlanId}/ai-label`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to label rooms with AI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans', selectedFloorPlanId] });
    },
  });

  const handleAILabeling = () => {
    if (selectedFloorPlanId) {
      aiLabelMutation.mutate(selectedFloorPlanId);
    }
  };

  return (
    <ResponsiveLayout currentStep={currentStep} onStepChange={setCurrentStep}>
      <div className="space-y-6">
        {/* Step 1: File Upload & Processing */}
        {currentStep === 1 && (
          <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Upload className="w-6 h-6 mr-3 text-primary" />
                Upload CAD Files
                <Badge variant="secondary" className="ml-auto">Step 1/4</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedFloorPlanId ? (
                <UploadZone onUploadComplete={handleUploadComplete} />
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">File Uploaded Successfully!</h3>
                  <p className="text-gray-600 mb-4">Your CAD file has been processed and is ready for analysis.</p>
                  <Button onClick={() => setCurrentStep(2)} className="mr-2">
                    Continue to Analysis <Search className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedFloorPlanId(null)}>
                    Upload New File
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Processing & AI Analysis */}
        {currentStep === 2 && selectedFloorPlanId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-3 text-purple-600" />
                  AI-Powered Room Detection
                  <Badge variant="secondary" className="ml-auto">Step 2/4</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {floorPlanData?.floorPlan?.status === 'processing' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Processing CAD File...</span>
                      <span className="text-sm text-primary">{processingProgress}%</span>
                    </div>
                    <Progress value={processingProgress} className="h-2" />
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>
                        {processingMessage || (processingProgress < 30 ? 'Extracting geometric data...' :
                         processingProgress < 70 ? 'Detecting rooms and measurements...' :
                         'Finalizing AI analysis...')}
                      </span>
                    </div>
                  </div>
                ) : floorPlanData?.floorPlan?.status === 'completed' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Layers3 className="w-8 h-8 text-blue-600 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-blue-800">Layers Detected</p>
                            <p className="text-2xl font-bold text-blue-900">{floorPlanData.floorPlan.layers || 0}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <Database className="w-8 h-8 text-green-600 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-green-800">Rooms Found</p>
                            <p className="text-2xl font-bold text-green-900">{floorPlanData.rooms?.length || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button 
                        onClick={handleAILabeling} 
                        disabled={aiLabelMutation.isPending}
                        className="flex-1 mr-2"
                      >
                        {aiLabelMutation.isPending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            AI Labeling...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Enhance with AI
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => setCurrentStep(3)}>
                        Continue <Eye className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <p className="text-gray-600">Processing will start automatically...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-3 text-orange-600" />
                  Smart Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <Brain className="w-6 h-6 text-blue-600 mr-3" />
                    <div>
                      <h4 className="font-semibold text-blue-900">AI Room Classification</h4>
                      <p className="text-sm text-blue-700">Automatic identification of room types and purposes</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                    <Layers3 className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-semibold text-green-900">3D Visualization</h4>
                      <p className="text-sm text-green-700">Interactive 3D models with realistic room layouts</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <Sparkles className="w-6 h-6 text-purple-600 mr-3" />
                    <div>
                      <h4 className="font-semibold text-purple-900">Smart Measurements</h4>
                      <p className="text-sm text-purple-700">Precise area calculations and dimension analysis</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Visualization */}
        {currentStep === 3 && selectedFloorPlanId && floorPlanData && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center text-xl">
                  <Eye className="w-6 h-6 mr-3 text-green-600" />
                  Floor Plan Visualization
                  <Badge variant="secondary" className="ml-3">Step 3/4</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as '2d' | '3d')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="2d" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">2D View</span>
                      </TabsTrigger>
                      <TabsTrigger value="3d" className="flex items-center gap-2">
                        <Layers3 className="w-4 h-4" />
                        <span className="hidden sm:inline">3D View</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[60vh] sm:h-[70vh] lg:h-[80vh] rounded-lg overflow-hidden border border-gray-200 bg-white">
                {viewMode === '2d' ? (
                  <FloorPlanCanvas 
                    floorPlan={floorPlanData.floorPlan}
                    rooms={floorPlanData.rooms || []}
                    measurements={floorPlanData.measurements || []}
                  />
                ) : (
                  <FloorPlan3DViewer
                    floorPlan={floorPlanData.floorPlan}
                    rooms={floorPlanData.rooms || []}
                    measurements={floorPlanData.measurements || []}
                    className="w-full h-full"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Export & Analysis */}
        {currentStep === 4 && selectedFloorPlanId && floorPlanData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="w-5 h-5 mr-3 text-blue-600" />
                  Export Options
                  <Badge variant="secondary" className="ml-auto">Step 4/4</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExportPanel floorPlanId={selectedFloorPlanId} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-3 text-purple-600" />
                  Room Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RoomAnalysis 
                  rooms={floorPlanData.rooms || []}
                  measurements={floorPlanData.measurements || []}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}