import { useQuery } from "@tanstack/react-query";
import { FloorPlan } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SidebarNavigationProps {
  currentStep: number;
  onFloorPlanSelect: (id: number) => void;
  selectedFloorPlanId: number | null;
}

export default function SidebarNavigation({ 
  currentStep, 
  onFloorPlanSelect, 
  selectedFloorPlanId 
}: SidebarNavigationProps) {
  const { data: floorPlans } = useQuery<FloorPlan[]>({
    queryKey: ['/api/floor-plans'],
  });

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return 'fas fa-file-pdf text-red-400';
      case 'dwg':
        return 'fas fa-file-alt text-blue-400';
      case 'dxf':
        return 'fas fa-file-alt text-green-400';
      default:
        return 'fas fa-file-alt text-gray-400';
    }
  };

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200">
      <nav className="mt-8">
        <div className="px-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Workflow</h2>
        </div>
        <div className="mt-4 space-y-2">
          {/* Step 1 - File Upload */}
          <div className={cn(
            "group flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-4",
            currentStep >= 1 
              ? "bg-primary text-white" 
              : "text-gray-600 hover:bg-gray-50"
          )}>
            <span className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full mr-3 text-xs font-bold",
              currentStep >= 1 
                ? "bg-white bg-opacity-20" 
                : "bg-gray-200 text-gray-600"
            )}>1</span>
            File Upload & Processing
          </div>
          
          {/* Step 2 - Analysis */}
          <div className={cn(
            "group flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-4",
            currentStep >= 2 
              ? "bg-primary text-white" 
              : "text-gray-600 hover:bg-gray-50"
          )}>
            <span className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full mr-3 text-xs font-bold",
              currentStep >= 2 
                ? "bg-white bg-opacity-20" 
                : "bg-gray-200 text-gray-600"
            )}>2</span>
            Analysis & Extraction
          </div>
          
          {/* Step 3 - Visualization */}
          <div className={cn(
            "group flex items-center px-4 py-3 text-sm font-medium rounded-lg mx-4",
            currentStep >= 3 
              ? "bg-primary text-white" 
              : "text-gray-600 hover:bg-gray-50"
          )}>
            <span className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full mr-3 text-xs font-bold",
              currentStep >= 3 
                ? "bg-white bg-opacity-20" 
                : "bg-gray-200 text-gray-600"
            )}>3</span>
            Visualization & Export
          </div>
        </div>

        <div className="px-4 mt-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">File History</h2>
        </div>
        <div className="mt-4 px-4">
          {floorPlans && floorPlans.length > 0 ? (
            floorPlans.map((floorPlan) => (
              <div 
                key={floorPlan.id}
                className={cn(
                  "flex items-center p-3 rounded-lg mb-2 cursor-pointer transition-colors",
                  selectedFloorPlanId === floorPlan.id 
                    ? "bg-blue-50 border border-blue-200" 
                    : "bg-gray-50 hover:bg-gray-100"
                )}
                onClick={() => onFloorPlanSelect(floorPlan.id)}
              >
                <i className={`${getFileIcon(floorPlan.fileType)} mr-3`}></i>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {floorPlan.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(floorPlan.uploadedAt)}
                  </p>
                </div>
                {floorPlan.status === 'processing' && (
                  <div className="ml-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  </div>
                )}
                {floorPlan.status === 'completed' && (
                  <div className="ml-2">
                    <i className="fas fa-check-circle text-green-500"></i>
                  </div>
                )}
                {floorPlan.status === 'error' && (
                  <div className="ml-2">
                    <i className="fas fa-exclamation-circle text-red-500"></i>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No files uploaded yet
            </p>
          )}
        </div>
      </nav>
    </aside>
  );
}
