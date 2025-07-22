import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessingTimeEstimator } from "@/components/processing-time-estimator";

interface UploadZoneProps {
  onUploadComplete: (floorPlanId: number) => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const getEstimatedTime = (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const sizeInMB = file.size / (1024 * 1024);

    const baseTimes = { 'dxf': 2, 'dwg': 5, 'pdf': 8 };
    const baseTime = baseTimes[ext as keyof typeof baseTimes] || 5;

    let sizeMultiplier = 1;
    if (sizeInMB > 10) sizeMultiplier = 3;
    else if (sizeInMB > 5) sizeMultiplier = 2;
    else if (sizeInMB > 1) sizeMultiplier = 1.5;

    const complexityMultiplier = ext === 'pdf' ? 2 : 1;
    return Math.ceil(baseTime * sizeMultiplier * complexityMultiplier);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      // Use fetch directly for FormData uploads
      const response = await fetch('/api/floor-plans/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: "Your file is now being processed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/floor-plans'] });
      onUploadComplete(data.floorPlan.id);
      setUploadedFiles([]); // Clear uploaded files after successful upload
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadedFiles([]); // Clear uploaded files after an error
    }
  });

  const handleFileSelect = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    fileArray.forEach(file => {
      // Validate file type
      const allowedTypes = ['.dxf', '.dwg', '.pdf'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedTypes.includes(ext)) {
        toast({
          title: "Invalid file type",
          description: "Please upload DXF, DWG, or PDF files only.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload files smaller than 50MB.",
          variant: "destructive",
        });
        return;
      }

      setUploadedFiles(prevFiles => [...prevFiles, file]);
      uploadMutation.mutate(file);
    });
  }, [uploadMutation, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dxf,.dwg,.pdf';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleFileSelect(files);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* File Upload Zone */}
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragOver 
            ? "border-primary bg-blue-50" 
            : "border-gray-300 hover:border-primary hover:bg-blue-50",
          uploadMutation.isPending && "pointer-events-none opacity-50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Upload className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload CAD Files</h3>
        <p className="text-gray-500 mb-4">
          Drag and drop your DXF, DWG, or PDF files here, or click to browse
        </p>
        <div className="flex justify-center space-x-4 text-sm text-gray-600">
          <span className="bg-gray-100 px-3 py-1 rounded-full">.DXF</span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">.DWG</span>
          <span className="bg-gray-100 px-3 py-1 rounded-full">.PDF</span>
        </div>
      </div>

      {/* Upload Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <FileText className="text-blue-600 mt-1 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-800 mb-1">Supported Files</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>DXF files:</strong> AutoCAD Drawing Exchange Format</li>
              <li>• <strong>DWG files:</strong> AutoCAD Drawing Database</li>
              <li>• <strong>PDF files:</strong> Vector-based architectural drawings</li>
            </ul>
            <p className="text-sm text-blue-700 mt-2">
              Maximum file size: 50MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Processing Time Information */}
      {uploadedFiles.length === 0 && (
        <ProcessingTimeEstimator />
      )}

      {/* Upload Progress */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>~{formatTime(getEstimatedTime(file))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {uploadMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="text-red-600 mt-1 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800 mb-1">Upload Failed</h4>
              <p className="text-sm text-red-700">
                {uploadMutation.error?.message || 'An error occurred while uploading the file.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}