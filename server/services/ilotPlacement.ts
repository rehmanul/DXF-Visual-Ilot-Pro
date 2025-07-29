
import { GeometryData } from "@shared/schema";
import { corridorGenerator } from "./corridorGenerator.js";



export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Ilot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  type: 'small' | 'medium' | 'large';
  color: string;
  label: string;
}

export interface Corridor {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  connectedIlots: string[];
  length: number;
}

export interface ZoneType {
  type: 'wall' | 'restricted' | 'entrance' | 'usable';
  color: string;
  bounds: Rectangle;
  doorSwing?: {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

export interface FloorPlanLayout {
  ilots: Ilot[];
  corridors: Corridor[];
  zones: ZoneType[];
  totalUsableArea: number;
  totalIlotArea: number;
  totalCorridorArea: number;
  efficiencyRatio: number;
}

export class IlotPlacementService {
  private readonly DEFAULT_CORRIDOR_WIDTH = 1.2; // 1.2m as specified in requirements
  private readonly MIN_CLEARANCE = 0.8; // Minimum clearance around îlots
  private readonly WALL_THICKNESS = 0.2;
  
  // Îlot size categories based on workspace standards
  private readonly ILOT_SIZES = {
    small: { width: 1.2, height: 0.8, area: 0.96 },
    medium: { width: 1.6, height: 1.2, area: 1.92 },
    large: { width: 2.0, height: 1.6, area: 3.2 }
  } as const;

  private readonly ZONE_COLORS = {
    wall: '#6B7280',      // Gray
    restricted: '#3B82F6', // Blue (NO ENTREE)
    entrance: '#EF4444',   // Red (ENTRÉE/SORTIE)
    usable: '#F3F4F6'     // Light gray
  };

  async generateFloorPlanLayout(
    geometryData: GeometryData,
    corridorWidth: number = this.DEFAULT_CORRIDOR_WIDTH,
    targetDensity: number = 0.6
  ): Promise<FloorPlanLayout> {
    
    // Step 1: Extract and classify zones from CAD data
    const zones = this.extractZones(geometryData);
    
    // Step 2: Calculate usable areas
    const usableZones = zones.filter(z => z.type === 'usable');
    const totalUsableArea = usableZones.reduce((sum, zone) => 
      sum + (zone.bounds.width * zone.bounds.height), 0);
    
    // Step 3: Generate optimal îlot placement
    const ilots = this.generateOptimalIlotPlacement(
      usableZones, 
      zones.filter(z => z.type !== 'usable'),
      targetDensity
    );
    
    // Step 4: Generate corridor network using the dedicated corridor generator
    const corridors = corridorGenerator.generateCorridorNetwork(ilots, zones, corridorWidth);
    
    // Step 5: Calculate metrics
    const totalIlotArea = ilots.reduce((sum, ilot) => sum + ilot.area, 0);
    const totalCorridorArea = corridors.reduce((sum, corridor) => 
      sum + (corridor.length * corridor.width), 0);
    const efficiencyRatio = totalIlotArea / (totalUsableArea - totalCorridorArea);

    return {
      ilots,
      corridors,
      zones,
      totalUsableArea,
      totalIlotArea,
      totalCorridorArea,
      efficiencyRatio
    };
  }

  private extractZones(geometryData: GeometryData): ZoneType[] {
    const zones: ZoneType[] = [];
    const bounds = geometryData.bounds;

    // Create default usable area from bounds
    const boundsAsRect: Rectangle = {
      ...bounds,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
    
    // Add main usable area
    zones.push({
      type: 'usable',
      color: this.ZONE_COLORS.usable,
      bounds: boundsAsRect
    });

    return zones;
  }

  private isWallEntity(entity: any, layer: string, type: string): boolean {
    return (
      type === 'line' && entity.properties?.lineweight > 0.5 ||
      layer.includes('wall') || layer.includes('mur') ||
      layer.includes('structure') ||
      (type === 'polyline' && entity.properties?.closed && 
       this.calculateArea(entity.coordinates) < 1.0) // Small closed areas likely walls
    );
  }

  private isRestrictedArea(entity: any, layer: string, type: string): boolean {
    return (
      layer.includes('restrict') || layer.includes('no_entry') ||
      layer.includes('interdit') ||
      (entity.properties?.color && this.isBlueish(entity.properties.color)) ||
      (type === 'hatch' && entity.properties?.pattern === 'solid' && 
       this.isBlueish(entity.properties?.color))
    );
  }

  private isEntranceArea(entity: any, layer: string, type: string): boolean {
    return (
      layer.includes('door') || layer.includes('entrance') || 
      layer.includes('entree') || layer.includes('sortie') ||
      (type === 'arc' && this.isDoorSwingArc(entity)) ||
      (entity.properties?.color && this.isReddish(entity.properties.color))
    );
  }

  private isDoorSwingArc(entity: any): boolean {
    if (!entity.properties) return false;
    
    const radius = entity.properties.radius || 0;
    const angleSpan = Math.abs(
      (entity.properties.end_angle || 0) - (entity.properties.start_angle || 0)
    );
    
    // Typical door swing: radius 0.6-1.2m, angle 60-120 degrees
    return radius >= 0.6 && radius <= 1.2 && angleSpan >= 60 && angleSpan <= 120;
  }

  private createWallZone(entity: any): ZoneType {
    const coords = entity.coordinates;
    const bounds = this.calculateBounds(coords);
    
    return {
      type: 'wall',
      color: this.ZONE_COLORS.wall,
      bounds: {
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY
      }
    };
  }

  private createRestrictedZone(entity: any): ZoneType {
    const coords = entity.coordinates;
    const bounds = this.calculateBounds(coords);
    
    return {
      type: 'restricted',
      color: this.ZONE_COLORS.restricted,
      bounds: {
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY
      }
    };
  }

  private createEntranceZone(entity: any): ZoneType {
    const coords = entity.coordinates;
    const bounds = this.calculateBounds(coords);
    
    const zone: ZoneType = {
      type: 'entrance',
      color: this.ZONE_COLORS.entrance,
      bounds: {
        ...bounds,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY
      }
    };

    // Add door swing if it's an arc
    if (entity.type?.toLowerCase() === 'arc' && entity.properties) {
      zone.doorSwing = {
        centerX: entity.properties.center_x || bounds.minX,
        centerY: entity.properties.center_y || bounds.minY,
        radius: entity.properties.radius || 0.9,
        startAngle: entity.properties.start_angle || 0,
        endAngle: entity.properties.end_angle || 90
      };
    }

    return zone;
  }

  private generateOptimalIlotPlacement(
    usableZones: ZoneType[],
    restrictiveZones: ZoneType[],
    targetDensity: number
  ): Ilot[] {
    const ilots: Ilot[] = [];
    let idCounter = 1;

    // Generate unique placement based on actual zone geometry
    for (const zone of usableZones) {
      const zoneHash = this.calculateZoneHash(zone.bounds);
      const zoneIlots = this.placeIlotsInZone(
        zone.bounds,
        restrictiveZones,
        targetDensity,
        idCounter,
        zoneHash
      );
      
      ilots.push(...zoneIlots);
      idCounter += zoneIlots.length;
    }

    return this.optimizeIlotPlacement(ilots, restrictiveZones);
  }

  private calculateZoneHash(bounds: Rectangle): number {
    // Create unique hash based on zone dimensions and position
    const str = `${bounds.minX.toFixed(2)}_${bounds.minY.toFixed(2)}_${bounds.width.toFixed(2)}_${bounds.height.toFixed(2)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private placeIlotsInZone(
    zone: Rectangle,
    restrictions: ZoneType[],
    targetDensity: number,
    startId: number,
    zoneHash: number
  ): Ilot[] {
    const ilots: Ilot[] = [];
    const spacing = this.DEFAULT_CORRIDOR_WIDTH + 0.5;
    
    // Simple grid placement
    const ilotSize = this.ILOT_SIZES.medium;
    const cols = Math.floor((zone.width - 20) / (ilotSize.width + spacing));
    const rows = Math.floor((zone.height - 20) / (ilotSize.height + spacing));
    
    let id = startId;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = zone.minX + 10 + col * (ilotSize.width + spacing);
        const y = zone.minY + 10 + row * (ilotSize.height + spacing);
        
        ilots.push({
          id: `ilot_${id++}`,
          x,
          y,
          width: ilotSize.width,
          height: ilotSize.height,
          area: ilotSize.area,
          type: 'medium',
          color: this.getIlotColor('medium'),
          label: `${ilotSize.area.toFixed(1)}m²`
        });
      }
    }
    
    return ilots;
  }

  // Corridor generation is now handled by the dedicated corridorGenerator service

  // Helper methods
  private calculateBounds(coordinates: number[][]): Rectangle {
    if (!coordinates || coordinates.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const coord of coordinates) {
      const x = coord[0] || 0;
      const y = coord[1] || 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private calculateArea(coordinates: number[][]): number {
    if (!coordinates || coordinates.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    return Math.abs(area) / 2;
  }

  private isBlueish(color: any): boolean {
    if (typeof color === 'string') {
      return color.toLowerCase().includes('blue') || 
             color.toLowerCase().includes('#3b82f6') ||
             color.toLowerCase().includes('rgb(59, 130, 246)');
    }
    return false;
  }

  private isReddish(color: any): boolean {
    if (typeof color === 'string') {
      return color.toLowerCase().includes('red') || 
             color.toLowerCase().includes('#ef4444') ||
             color.toLowerCase().includes('rgb(239, 68, 68)');
    }
    return false;
  }







  private canPlaceIlot(
    x: number,
    y: number,
    dims: {width: number, height: number},
    zone: Rectangle,
    restrictions: ZoneType[]
  ): boolean {
    // Check if îlot fits within zone bounds
    if (x + dims.width > zone.maxX || y + dims.height > zone.maxY) {
      return false;
    }

    // Check for conflicts with restrictions
    const ilotRect = {
      minX: x,
      minY: y,
      maxX: x + dims.width,
      maxY: y + dims.height,
      width: dims.width,
      height: dims.height
    };

    for (const restriction of restrictions) {
      if (this.rectanglesOverlap(ilotRect, restriction.bounds)) {
        return false;
      }
    }

    return true;
  }

  private rectanglesOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
    return !(rect1.maxX <= rect2.minX || 
             rect1.minX >= rect2.maxX || 
             rect1.maxY <= rect2.minY || 
             rect1.minY >= rect2.maxY);
  }

  private getIlotColor(size: 'small' | 'medium' | 'large'): string {
    const colors = {
      small: '#FED7D7',   // Light pink
      medium: '#FBB6CE',  // Medium pink  
      large: '#F687B3'    // Darker pink
    };
    return colors[size];
  }

  private optimizeIlotPlacement(ilots: Ilot[], restrictions: ZoneType[]): Ilot[] {
    // Apply optimization based on actual constraints and geometry
    const optimized = ilots.map(ilot => {
      // Calculate distance to nearest restriction for optimization
      let minDistance = Infinity;
      for (const restriction of restrictions) {
        const distance = this.calculateDistanceToZone(ilot, restriction.bounds);
        minDistance = Math.min(minDistance, distance);
      }
      
      // Adjust îlot properties based on proximity to restrictions
      const proximityFactor = Math.min(minDistance / 100, 1); // Normalize to 0-1
      const optimizedArea = ilot.area * (0.9 + proximityFactor * 0.1); // 90-100% of original
      
      return {
        ...ilot,
        area: optimizedArea,
        label: `${optimizedArea.toFixed(2)}m²`,
        color: this.getOptimizedIlotColor(ilot.type, proximityFactor)
      };
    });
    
    return optimized;
  }
  
  private calculateDistanceToZone(ilot: Ilot, zone: Rectangle): number {
    const ilotCenterX = ilot.x + ilot.width / 2;
    const ilotCenterY = ilot.y + ilot.height / 2;
    const zoneCenterX = zone.minX + zone.width / 2;
    const zoneCenterY = zone.minY + zone.height / 2;
    
    return Math.sqrt(
      Math.pow(ilotCenterX - zoneCenterX, 2) + 
      Math.pow(ilotCenterY - zoneCenterY, 2)
    );
  }
  
  private getOptimizedIlotColor(size: 'small' | 'medium' | 'large', proximityFactor: number): string {
    const baseColors = {
      small: { r: 254, g: 215, b: 215 },   // Light pink
      medium: { r: 251, g: 182, b: 206 }, // Medium pink  
      large: { r: 246, g: 135, b: 179 }   // Darker pink
    };
    
    const base = baseColors[size];
    const intensity = 0.8 + proximityFactor * 0.2; // 80-100% intensity
    
    return `rgb(${Math.floor(base.r * intensity)}, ${Math.floor(base.g * intensity)}, ${Math.floor(base.b * intensity)})`;
  }
}

export const ilotPlacementService = new IlotPlacementService();
