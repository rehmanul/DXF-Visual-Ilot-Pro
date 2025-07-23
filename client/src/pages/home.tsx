import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { ResponsiveLayout } from "@/components/responsive-layout";
import UploadZone from "@/components/upload-zone";
import RoomAnalysis from "@/components/room-analysis";
import FloorPlanCanvas from "@/components/floor-plan-canvas";
import { FloorPlan3DViewer } from "@/components/3d-floor-plan-viewer";
import { AdvancedFloorPlanRenderer } from "@/components/advanced-floor-plan-renderer";
import ExportPanel from "@/components/export-panel";
import { ProcessingResult } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Settings, Loader2, Maximize, ArrowRight } from "lucide-react";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [selectedDensity, setSelectedDensity] = useState(25); // Default 25%
  const [corridorWidth, setCorridorWidth] = useState(1.2); // Default 1.2m
  const [socket, setSocket] = useState<Socket | null>(null);
  const [ilotLayout, setIlotLayout] = useState<any>(null);
  const [isGeneratingIlots, setIsGeneratingIlots] = useState(false);
  const queryClient = useQueryClient();

  // Setup WebSocket connection
  React.useEffect(() => {
    const newSocket = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    newSocket.on('processing-update', (data) => {
      console.log('Processing update:', data);
      if (data.floorPlanId === selectedFloorPlanId) {
        setProcessingProgress(data.progress);
        setProcessingMessage(data.message || 'Processing...');
      }
    });

    newSocket.on('processing-complete', (data) => {
      console.log('Processing complete:', data);
      if (data.floorPlanId === selectedFloorPlanId) {
        queryClient.invalidateQueries({ queryKey: ['/api/floor-plans', selectedFloorPlanId] });
        queryClient.invalidateQueries({ queryKey: ['/api/floor-plans', selectedFloorPlanId, 'status'] });
        setProcessingProgress(100);
        setProcessingMessage('Processing complete!');
        setCurrentStep(3);
      }
    });

    newSocket.on('processing-error', (data) => {
      console.error('Processing error:', data);
      if (data.floorPlanId === selectedFloorPlanId) {
        setProcessingMessage(`Error: ${data.error}`);
        setProcessingProgress(0);
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
    refetchInterval: (data) => {
      // Stop polling if processing is complete or failed
      const status = data?.status;
      return (status === 'completed' || status === 'error') ? false : 2000;
    },
  });

  useEffect(() => {
    if (floorPlanData?.floorPlan) {
      const status = floorPlanData.floorPlan.status;
      if (status === 'completed') {
        setCurrentStep(3);
        setProcessingProgress(100);
        setProcessingMessage('Processing complete!');
      } else if (status === 'processing') {
        setCurrentStep(2);
        if (processingProgress === 0) {
          setProcessingProgress(10);
          setProcessingMessage('Starting CAD file processing...');
        }
      } else if (status === 'error') {
        setCurrentStep(2);
        setProcessingProgress(0);
        setProcessingMessage(`Processing failed: ${floorPlanData.floorPlan.errorMessage || 'Unknown error'}`);
      } else {
        setCurrentStep(1);
      }
    }
  }, [floorPlanData, processingProgress]);

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

  // Îlot generation mutation
  const ilotGenerationMutation = useMutation({
    mutationFn: async (params: { floorPlanId: number, corridorWidth: number, targetDensity: number }) => {
      const response = await fetch(`/api/floor-plans/${params.floorPlanId}/generate-ilots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corridorWidth: params.corridorWidth,
          targetDensity: params.targetDensity
        })
      });
      if (!response.ok) throw new Error('Failed to generate îlots');
      return response.json();
    },
    onMutate: () => {
      setIsGeneratingIlots(true);
    },
    onSuccess: (data) => {
      setIlotLayout(data.layout);
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans', selectedFloorPlanId] });
    },
    onError: (error) => {
      console.error('Îlot generation failed:', error);
    },
    onSettled: () => {
      setIsGeneratingIlots(false);
    }
  });

  const handleGenerateIlots = (corridorWidth: number = 1.2, targetDensity: number = 0.6) => {
    if (selectedFloorPlanId) {
      ilotGenerationMutation.mutate({
        floorPlanId: selectedFloorPlanId,
        corridorWidth,
        targetDensity
      });
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
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleAILabeling} 
                          disabled={aiLabelMutation.isPending}
                          variant="outline"
                          className="flex-1"
                        >
                          {aiLabelMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" />
                              AI Labeling...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI Labels
                            </>
                          )}
                        </Button>
                        <Button 
                          onClick={() => handleGenerateIlots(1.2, 0.6)} 
                          disabled={isGeneratingIlots}
                          className="flex-1"
                        >
                          {isGeneratingIlots ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Layers3 className="w-4 h-4 mr-2" />
                              Generate Îlots
                            </>
                          )}
                        </Button>
                      </div>
                      <Button variant="outline" onClick={() => setCurrentStep(3)} className="w-full">
                        Continue to Visualization <Eye className="w-4 h-4 ml-2" />
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

        {/* Step 3: Interactive Visualization & Îlot Placement */}
        {currentStep === 3 && selectedFloorPlanId && floorPlanData?.floorPlan?.status === 'completed' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-5 h-5 mr-3 text-green-600" />
                  Interactive Floor Plan Viewer
                  <Badge variant="secondary" className="ml-auto">Step 3/4</Badge>
                </CardTitle>
                <CardDescription>
                  {!floorPlanData?.floorPlan?.ilotLayout 
                    ? "Empty floor plan loaded - Configure îlot placement below"
                    : "Floor plan with îlots and corridors"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {floorPlanData && (
                  <AdvancedFloorPlanRenderer 
                    floorPlan={floorPlanData.floorPlan}
                    rooms={floorPlanData.rooms}
                    measurements={floorPlanData.measurements}
                  />
                )}
              </CardContent>
            </Card>

            {/* Îlot Placement Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-3 text-blue-600" />
                  Îlot Placement Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Space Density
                      </label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={selectedDensity}
                        onChange={(e) => setSelectedDensity(parseInt(e.target.value))}
                      >
                        <option value={10}>10% - Minimal</option>
                        <option value={25}>25% - Light</option>
                        <option value={30}>30% - Moderate</option>
                        <option value={35}>35% - Dense</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Corridor Width
                      </label>
                      <input
                        type="number"
                        className="w-full p-2 border rounded-md"
                        value={corridorWidth}
                        onChange={(e) => setCorridorWidth(parseFloat(e.target.value))}
                        min="0.8"
                        max="2.0"
                        step="0.1"
                        placeholder="1.2"
                      />
                      <p className="text-xs text-gray-500 mt-1">Default: 1.2m</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleGenerateIlots}
                      disabled={isGeneratingIlots}
                      className="flex-1"
                    >
                      {isGeneratingIlots ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Layout...
                        </>
                      ) : (
                        <>
                          <Maximize className="w-4 h-4 mr-2" />
                          Generate Îlots & Corridors
                        </>
                      )}
                    </Button>

                    {floorPlanData?.floorPlan?.ilotLayout && (
                      <Button 
                        variant="outline"
                        onClick={() => setCurrentStep(4)}
                      >
                        Continue to Export <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>

                  {floorPlanData?.floorPlan?.ilotLayout && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">Layout Generated Successfully!</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-green-600">Îlots:</span> {floorPlanData.floorPlan.totalIlots}
                        </div>
                        <div>
                          <span className="text-green-600">Corridors:</span> {floorPlanData.floorPlan.totalCorridors}
                        </div>
                        <div>
                          <span className="text-green-600">Efficiency:</span> {floorPlanData.floorPlan.spaceEfficiency?.toFixed(1)}%
                        </div>
                        <div>
                          <span className="text-green-600">Area:</span> {floorPlanData.floorPlan.totalArea?.toFixed(1)}m²
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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
                <ExportPanel 
                  floorPlan={floorPlanData.floorPlan}
                  rooms={floorPlanData.rooms || []}
                  measurements={floorPlanData.measurements || []}
                />
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
                  floorPlan={floorPlanData.floorPlan}
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