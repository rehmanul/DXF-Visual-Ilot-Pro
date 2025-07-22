import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  X, 
  Home, 
  Upload, 
  Eye, 
  Download, 
  Settings,
  Maximize2,
  Minimize2,
  Tablet,
  Smartphone,
  Monitor
} from 'lucide-react';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export function ResponsiveLayout({ children, currentStep, onStepChange }: ResponsiveLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [screenSize, setScreenSize] = useState('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const steps = [
    { id: 1, name: 'Upload', icon: Upload, description: 'Upload CAD files' },
    { id: 2, name: 'Process', icon: Settings, description: 'AI analysis & room detection' },
    { id: 3, name: 'Visualize', icon: Eye, description: '2D/3D visualization' },
    { id: 4, name: 'Export', icon: Download, description: 'Download results' }
  ];

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getScreenIcon = () => {
    switch (screenSize) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
                  FloorPlan Processor
                </h1>
                <h1 className="text-lg font-bold text-gray-900 sm:hidden">
                  FPP
                </h1>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep >= step.id;
                const isCurrent = currentStep === step.id;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => onStepChange(step.id)}
                    className={cn(
                      'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isCurrent
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : isActive
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden lg:block">{step.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right side controls */}
            <div className="flex items-center space-x-2">
              {/* Screen size indicator */}
              <div className="hidden sm:flex items-center px-2 py-1 bg-gray-100 rounded-md text-xs text-gray-600">
                {getScreenIcon()}
                <span className="ml-1 capitalize">{screenSize}</span>
              </div>

              {/* Fullscreen toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="hidden sm:flex"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200/50">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep >= step.id;
                const isCurrent = currentStep === step.id;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      onStepChange(step.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isCurrent
                        ? 'bg-primary text-white shadow-lg'
                        : isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{step.name}</div>
                      <div className="text-xs opacity-75">{step.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Progress Bar */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">
                Step {currentStep} of {steps.length}
              </span>
              <span className="text-xs font-medium text-gray-600">
                {Math.round((currentStep / steps.length) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Step Indicator */}
      <div className="md:hidden fixed bottom-4 left-4 right-4">
        <div className="bg-white/90 backdrop-blur-md rounded-xl border border-gray-200/50 shadow-lg p-3">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep >= step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <button
                    onClick={() => onStepChange(step.id)}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 mb-1',
                      isCurrent
                        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110'
                        : isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100 text-gray-400'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                  <span className={cn(
                    'text-xs font-medium transition-colors duration-200',
                    isCurrent
                      ? 'text-primary'
                      : isActive
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  )}>
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="absolute top-5 left-1/2 w-full h-0.5 bg-gray-200 -z-10">
                      <div 
                        className={cn(
                          'h-full bg-primary transition-all duration-500',
                          isActive ? 'w-full' : 'w-0'
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responsive Padding for Mobile Step Indicator */}
      <div className="md:hidden h-20" />
    </div>
  );
}