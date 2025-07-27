import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Settings, Check, RotateCcw } from 'lucide-react';

interface CorridorWidthControlProps {
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}

export function CorridorWidthControl({
  defaultWidth = 1.2,
  onWidthChange,
  className
}: CorridorWidthControlProps) {
  const [corridorWidth, setCorridorWidth] = useState([defaultWidth]);
  const [isApplied, setIsApplied] = useState(false);

  const handleWidthChange = (value: number[]) => {
    setCorridorWidth(value);
    setIsApplied(false);
  };

  const handleApply = () => {
    if (onWidthChange) {
      onWidthChange(corridorWidth[0]);
      setIsApplied(true);
      
      // Reset the applied state after 2 seconds
      setTimeout(() => {
        setIsApplied(false);
      }, 2000);
    }
  };

  const handleReset = () => {
    setCorridorWidth([defaultWidth]);
    if (onWidthChange) {
      onWidthChange(defaultWidth);
    }
    setIsApplied(true);
    
    // Reset the applied state after 2 seconds
    setTimeout(() => {
      setIsApplied(false);
    }, 2000);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Corridor Width
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Slider
              value={corridorWidth}
              onValueChange={handleWidthChange}
              min={0.8}
              max={2.0}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm w-12 text-right font-medium">
              {corridorWidth[0].toFixed(1)}m
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant={isApplied ? "default" : "outline"} 
              size="sm" 
              className="flex-1"
              onClick={handleApply}
            >
              {isApplied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Applied
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Apply Width
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReset}
              title="Reset to default width (1.2m)"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}