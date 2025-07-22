import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import SidebarNavigation from "@/components/sidebar-navigation";
import UploadZone from "@/components/upload-zone";
import RoomAnalysis from "@/components/room-analysis";
import FloorPlanCanvas from "@/components/floor-plan-canvas";
import ExportPanel from "@/components/export-panel";
import { ProcessingResult } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Upload, Search, Eye } from "lucide-react";

export default function Home() {
  const { id } = useParams<{ id: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<number | null>(
    id ? parseInt(id) : null
  );

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-drafting-compass text-primary text-2xl"></i>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-semibold text-gray-900">FloorPlan Processor</h1>
                <p className="text-sm text-gray-500">CAD File Analysis & Visualization Tool</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                <i className="fas fa-question-circle mr-2"></i>Help
              </button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors">
                <i className="fas fa-cog mr-2"></i>Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <SidebarNavigation 
          currentStep={currentStep}
          onFloorPlanSelect={handleFloorPlanSelect}
          selectedFloorPlanId={selectedFloorPlanId}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {/* Step 1: File Upload & Processing */}
            <div className="mb-12">
              <Card className="border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full mr-3 ${
                      currentStep >= 1 ? 'bg-primary' : 'bg-gray-200'
                    }`}>
                      <span className={`text-sm font-bold ${
                        currentStep >= 1 ? 'text-white' : 'text-gray-600'
                      }`}>1</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">File Upload & Processing</h2>
                    {floorPlanData?.floorPlan?.status === 'completed' && (
                      <div className="ml-auto flex items-center">
                        <CheckCircle className="text-green-500 w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="p-6">
                  {!selectedFloorPlanId ? (
                    <UploadZone onUploadComplete={handleUploadComplete} />
                  ) : (
                    <div>
                      {/* Processing Status */}
                      {floorPlanData?.floorPlan?.status === 'processing' && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900">Processing File</h4>
                            <span className="text-xs font-semibold text-primary">
                              {statusData?.progress || 50}%
                            </span>
                          </div>
                          <Progress value={statusData?.progress || 50} className="mb-2" />
                          <p className="text-xs text-gray-500">
                            {statusData?.progress < 30 ? 'Extracting geometric data...' :
                             statusData?.progress < 70 ? 'Detecting rooms and measurements...' :
                             'Finalizing analysis...'}
                          </p>
                        </div>
                      )}

                      {/* Processing Complete Summary */}
                      {floorPlanData?.floorPlan?.status === 'completed' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <i className="fas fa-layer-group text-blue-600 mr-3"></i>
                              <div>
                                <p className="text-sm font-medium text-blue-800">Layers Detected</p>
                                <p className="text-2xl font-bold text-blue-900">
                                  {floorPlanData.floorPlan.layers}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <i className="fas fa-vector-square text-green-600 mr-3"></i>
                              <div>
                                <p className="text-sm font-medium text-green-800">Geometric Objects</p>
                                <p className="text-2xl font-bold text-green-900">
                                  {floorPlanData.floorPlan.geometricObjects}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-center">
                              <i className="fas fa-home text-purple-600 mr-3"></i>
                              <div>
                                <p className="text-sm font-medium text-purple-800">Rooms Identified</p>
                                <p className="text-2xl font-bold text-purple-900">
                                  {floorPlanData.rooms.length}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error State */}
                      {floorPlanData?.floorPlan?.status === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <AlertCircle className="text-red-600 mt-1 mr-3" />
                            <div>
                              <h4 className="font-medium text-red-800 mb-1">Processing Failed</h4>
                              <p className="text-sm text-red-700">
                                {floorPlanData.floorPlan.errorMessage || 'An error occurred while processing the file.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Step 2: Analysis & Extraction */}
            {currentStep >= 2 && (
              <div className="mb-12">
                <Card className="border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full mr-3 ${
                        currentStep >= 2 ? 'bg-primary' : 'bg-gray-200'
                      }`}>
                        <span className={`text-sm font-bold ${
                          currentStep >= 2 ? 'text-white' : 'text-gray-600'
                        }`}>2</span>
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">Analysis & Extraction</h2>
                      {floorPlanData?.floorPlan?.status === 'processing' && (
                        <div className="ml-auto flex items-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    {floorPlanData && (
                      <RoomAnalysis 
                        floorPlan={floorPlanData.floorPlan}
                        rooms={floorPlanData.rooms}
                        measurements={floorPlanData.measurements}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 3: Visualization & Export */}
            {currentStep >= 3 && floorPlanData && (
              <div className="mb-12">
                <Card className="border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-full mr-3">
                          <span className="text-white text-sm font-bold">3</span>
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">Visualization & Export</h2>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    {/* Floor Plan Visualization */}
                    <div className="mb-6">
                      <FloorPlanCanvas 
                        floorPlan={floorPlanData.floorPlan}
                        rooms={floorPlanData.rooms}
                        measurements={floorPlanData.measurements}
                      />
                    </div>

                    {/* Export Panel */}
                    <ExportPanel 
                      floorPlan={floorPlanData.floorPlan}
                      rooms={floorPlanData.rooms}
                      measurements={floorPlanData.measurements}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Success Message */}
            {floorPlanData?.floorPlan?.status === 'completed' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="text-green-600 text-xl mt-1 mr-3" />
                  <div>
                    <h3 className="font-semibold text-green-800 mb-1">Processing Complete!</h3>
                    <p className="text-sm text-green-700">
                      Your floor plan has been successfully processed and analyzed. All room measurements, 
                      areas, and architectural elements have been extracted and visualized. The interactive 
                      floor plan is ready for review and export.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
