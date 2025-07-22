
import React from 'react';
import { Clock, FileText, HardDrive, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProcessingTimeEstimatorProps {
  fileType?: string;
  fileSize?: number;
}

export function ProcessingTimeEstimator({ fileType, fileSize }: ProcessingTimeEstimatorProps) {
  const getProcessingEstimate = (type: string, size: number) => {
    const sizeInMB = size / (1024 * 1024);
    
    // Base processing times in seconds
    const baseTimes = {
      'dxf': 2,   // DXF files are generally fastest
      'dwg': 5,   // DWG requires more processing
      'pdf': 8    // PDF requires image processing and CV
    };
    
    const baseTime = baseTimes[type as keyof typeof baseTimes] || 5;
    
    // Size multiplier - larger files take proportionally longer
    let sizeMultiplier = 1;
    if (sizeInMB > 10) sizeMultiplier = 3;
    else if (sizeInMB > 5) sizeMultiplier = 2;
    else if (sizeInMB > 1) sizeMultiplier = 1.5;
    
    // Complexity factors
    const complexityMultiplier = type === 'pdf' ? 2 : 1; // PDFs need CV processing
    
    const totalSeconds = baseTime * sizeMultiplier * complexityMultiplier;
    
    return {
      seconds: Math.ceil(totalSeconds),
      steps: getProcessingSteps(type),
      factors: {
        baseTime,
        sizeMultiplier,
        complexityMultiplier,
        fileSize: sizeInMB
      }
    };
  };
  
  const getProcessingSteps = (type: string) => {
    const commonSteps = [
      'File validation and parsing',
      'Geometric data extraction',
      'Layer and block analysis',
      'Boundary calculation',
      'Room detection with AI',
      'Measurement extraction',
      'Architectural element counting'
    ];
    
    if (type === 'pdf') {
      return [
        'PDF to image conversion (300 DPI)',
        'Computer vision preprocessing',
        'Line detection using Hough Transform',
        'Contour analysis for rooms',
        'Geometric coordinate mapping',
        ...commonSteps.slice(3)
      ];
    }
    
    return commonSteps;
  };
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const allEstimates = [
    { type: 'DXF', extension: '.dxf', sizes: [0.5, 2, 5, 10, 20] },
    { type: 'DWG', extension: '.dwg', sizes: [1, 3, 7, 15, 30] },
    { type: 'PDF', extension: '.pdf', sizes: [2, 5, 10, 20, 40] }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Processing Time Estimates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fileType && fileSize ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h3 className="font-semibold">Current File</h3>
                  <p className="text-sm text-gray-600">
                    {fileType.toUpperCase()} • {(fileSize / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  ~{formatTime(getProcessingEstimate(fileType, fileSize).seconds)}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Processing Steps:</h4>
                <ul className="space-y-1 text-sm">
                  {getProcessingSteps(fileType).map((step, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {allEstimates.map((format) => (
                <div key={format.type} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <h3 className="font-semibold">{format.type} Files</h3>
                    <Badge variant="outline">{format.extension}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {format.sizes.map((sizeMB, index) => {
                      const sizeBytes = sizeMB * 1024 * 1024;
                      const estimate = getProcessingEstimate(format.extension.substring(1), sizeBytes);
                      
                      return (
                        <div key={index} className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-medium">{sizeMB} MB</div>
                          <div className="text-blue-600">{formatTime(estimate.seconds)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Performance Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                File Type Impact
              </h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>DXF:</strong> Direct vector parsing (fastest)</li>
                <li>• <strong>DWG:</strong> Binary format processing</li>
                <li>• <strong>PDF:</strong> Image conversion + CV analysis</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                File Size Impact
              </h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>&lt;1MB:</strong> Base processing time</li>
                <li>• <strong>1-5MB:</strong> 1.5x slower</li>
                <li>• <strong>5-10MB:</strong> 2x slower</li>
                <li>• <strong>&gt;10MB:</strong> 3x slower</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Complexity Factors</h4>
              <ul className="text-sm space-y-1">
                <li>• Number of entities/layers</li>
                <li>• Block references (doors/windows)</li>
                <li>• Text and dimension objects</li>
                <li>• Geometric complexity</li>
              </ul>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> Times are estimates based on typical files. 
              Complex architectural drawings with many layers, blocks, and detailed geometry may take longer.
              Processing includes AI-powered room detection and measurement extraction.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
