
import { GeometryData } from "@shared/schema";

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
  private readonly DEFAULT_CORRIDOR_WIDTH = 1.2; // 1.2m as specified
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
    
    // Step 4: Generate corridor network
    const corridors = this.generateCorridorNetwork(ilots, zones, corridorWidth);
    
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

    // Process each entity to identify zone types
    for (const entity of geometryData.entities) {
      const layer = entity.layer?.toLowerCase() || '';
      const type = entity.type?.toLowerCase() || '';

      // Identify walls (thick lines or specific layers)
      if (this.isWallEntity(entity, layer, type)) {
        zones.push(this.createWallZone(entity));
      }
      
      // Identify restricted areas (blue zones)
      else if (this.isRestrictedArea(entity, layer, type)) {
        zones.push(this.createRestrictedZone(entity));
      }
      
      // Identify entrance/exit areas (red zones with door swings)
      else if (this.isEntranceArea(entity, layer, type)) {
        zones.push(this.createEntranceZone(entity));
      }
    }

    // Fill remaining areas as usable space
    const boundsAsRect: Rectangle = {
      ...bounds,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
    const usableAreas = this.calculateUsableAreas(boundsAsRect, zones);
    zones.push(...usableAreas);

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

    for (const zone of usableZones) {
      const zoneIlots = this.placeIlotsInZone(
        zone.bounds,
        restrictiveZones,
        targetDensity,
        idCounter
      );
      
      ilots.push(...zoneIlots);
      idCounter += zoneIlots.length;
    }

    return this.optimizeIlotPlacement(ilots);
  }

  private placeIlotsInZone(
    zone: Rectangle,
    restrictions: ZoneType[],
    targetDensity: number,
    startId: number
  ): Ilot[] {
    const ilots: Ilot[] = [];
    const availableArea = zone.width * zone.height;
    const targetIlotArea = availableArea * targetDensity;
    
    // Calculate grid dimensions with corridor spacing
    const corridorSpacing = this.DEFAULT_CORRIDOR_WIDTH + this.MIN_CLEARANCE;
    
    // Try different îlot size combinations
    const combinations = this.generateSizeCombinations(targetIlotArea);
    let bestCombination = combinations[0];
    let bestEfficiency = 0;

    for (const combo of combinations) {
      const efficiency = this.calculatePlacementEfficiency(zone, combo, corridorSpacing);
      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        bestCombination = combo;
      }
    }

    // Place îlots using the best combination
    let id = startId;
    let currentY = zone.minY + this.MIN_CLEARANCE;

    for (const sizeInfo of bestCombination) {
      const { size, count } = sizeInfo;
      const ilotDims = this.ILOT_SIZES[size as keyof typeof this.ILOT_SIZES];
      
      let currentX = zone.minX + this.MIN_CLEARANCE;
      let ilotsInRow = 0;
      const maxIlotsPerRow = Math.floor(
        (zone.width - 2 * this.MIN_CLEARANCE) / (ilotDims.width + corridorSpacing)
      );

      for (let i = 0; i < count; i++) {
        if (ilotsInRow >= maxIlotsPerRow) {
          // Move to next row
          currentY += ilotDims.height + corridorSpacing;
          currentX = zone.minX + this.MIN_CLEARANCE;
          ilotsInRow = 0;
        }

        // Check if îlot fits and doesn't conflict with restrictions
        if (this.canPlaceIlot(currentX, currentY, ilotDims, zone, restrictions)) {
          ilots.push({
            id: `ilot_${id++}`,
            x: currentX,
            y: currentY,
            width: ilotDims.width,
            height: ilotDims.height,
            area: ilotDims.area,
            type: size as 'small' | 'medium' | 'large',
            color: this.getIlotColor(size as 'small' | 'medium' | 'large'),
            label: `${ilotDims.area.toFixed(1)}m²`
          });
        }

        currentX += ilotDims.width + corridorSpacing;
        ilotsInRow++;
      }
    }

    return ilots;
  }

  private generateCorridorNetwork(
    ilots: Ilot[],
    zones: ZoneType[],
    corridorWidth: number
  ): Corridor[] {
    const corridors: Corridor[] = [];
    const ilotGroups = this.groupIlotsByProximity(ilots);
    
    // Generate corridors between facing rows of îlots
    for (const group of ilotGroups) {
      const rows = this.organizeIlotsIntoRows(group);
      
      // Create corridors between adjacent rows
      for (let i = 0; i < rows.length - 1; i++) {
        const currentRow = rows[i];
        const nextRow = rows[i + 1];
        
        if (this.areRowsFacing(currentRow, nextRow)) {
          const corridor = this.createCorridorBetweenRows(
            currentRow,
            nextRow,
            corridorWidth,
            zones
          );
          
          if (corridor) {
            corridors.push(corridor);
          }
        }
      }
    }

    // Connect isolated îlots to the main network
    const connectedIlots = new Set(
      corridors.flatMap(c => c.connectedIlots)
    );
    
    const isolatedIlots = ilots.filter(ilot => !connectedIlots.has(ilot.id));
    
    for (const isolated of isolatedIlots) {
      const connectionCorridor = this.findBestConnection(
        isolated,
        corridors,
        ilots,
        corridorWidth,
        zones
      );
      
      if (connectionCorridor) {
        corridors.push(connectionCorridor);
      }
    }

    return this.optimizeCorridorNetwork(corridors);
  }

  private createCorridorBetweenRows(
    row1: Ilot[],
    row2: Ilot[],
    width: number,
    zones: ZoneType[]
  ): Corridor | null {
    // Calculate corridor path
    const row1Bounds = this.calculateRowBounds(row1);
    const row2Bounds = this.calculateRowBounds(row2);
    
    // Corridor runs between the rows
    const startY = row1Bounds.maxY;
    const endY = row2Bounds.minY;
    const centerY = (startY + endY) / 2;
    
    // Find overlapping X range
    const overlapStart = Math.max(row1Bounds.minX, row2Bounds.minX);
    const overlapEnd = Math.min(row1Bounds.maxX, row2Bounds.maxX);
    
    if (overlapEnd <= overlapStart) return null; // No overlap
    
    // Create corridor spanning the overlap
    const corridor: Corridor = {
      id: `corridor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startX: overlapStart,
      startY: centerY - width / 2,
      endX: overlapEnd,
      endY: centerY + width / 2,
      width,
      connectedIlots: [...row1.map(i => i.id), ...row2.map(i => i.id)],
      length: overlapEnd - overlapStart
    };

    // Verify corridor doesn't conflict with restrictions
    if (this.corridorConflictsWithRestrictions(corridor, zones)) {
      return null;
    }

    return corridor;
  }

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

  private calculateUsableAreas(this: IlotPlacementService, bounds: Rectangle, restrictiveZones: ZoneType[]): ZoneType[] {
    // Simplified: create one large usable area minus restrictions
    // In production, this would use polygon subtraction algorithms
    
    const usableArea = bounds.width * bounds.height;
    const restrictedArea = restrictiveZones.reduce((sum, zone) => 
      sum + zone.bounds.width * zone.bounds.height, 0);
    
    if (usableArea - restrictedArea > 0) {
      return [{
        type: 'usable',
        color: this.ZONE_COLORS.usable,
        bounds: bounds
      }];
    }
    
    return [];
  }

  private generateSizeCombinations(this: IlotPlacementService, targetArea: number): Array<{size: keyof typeof this.ILOT_SIZES, count: number}[]> {
    // Generate different combinations of îlot sizes to achieve target area
    const combinations: Array<{size: keyof typeof this.ILOT_SIZES, count: number}[]> = [];
    
    // Combination 1: Mixed sizes (60% small, 30% medium, 10% large)
    const smallCount = Math.floor(targetArea * 0.6 / this.ILOT_SIZES.small.area);
    const mediumCount = Math.floor(targetArea * 0.3 / this.ILOT_SIZES.medium.area);
    const largeCount = Math.floor(targetArea * 0.1 / this.ILOT_SIZES.large.area);
    
    combinations.push([
      { size: 'small' as const, count: smallCount },
      { size: 'medium' as const, count: mediumCount },
      { size: 'large' as const, count: largeCount }
    ]);

    // Combination 2: Mostly small
    combinations.push([
      { size: 'small' as const, count: Math.floor(targetArea * 0.9 / this.ILOT_SIZES.small.area) },
      { size: 'medium' as const, count: Math.floor(targetArea * 0.1 / this.ILOT_SIZES.medium.area) }
    ]);

    // Combination 3: Balanced medium
    combinations.push([
      { size: 'medium' as const, count: Math.floor(targetArea * 0.8 / this.ILOT_SIZES.medium.area) },
      { size: 'small' as const, count: Math.floor(targetArea * 0.2 / this.ILOT_SIZES.small.area) }
    ]);

    return combinations;
  }

  private calculatePlacementEfficiency(
    this: IlotPlacementService,
    zone: Rectangle,
    combination: {size: keyof typeof this.ILOT_SIZES, count: number}[],
    spacing: number
  ): number {
    // Calculate how well the combination fits in the zone
    let totalArea = 0;
    let estimatedRows = 0;
    
    for (const { size, count } of combination) {
      const dims = this.ILOT_SIZES[size as keyof typeof this.ILOT_SIZES];
      totalArea += dims.area * count;
      estimatedRows += Math.ceil(count * dims.width / zone.width);
    }
    
    const estimatedHeight = estimatedRows * 2.0 + (estimatedRows - 1) * spacing;
    const fitsVertically = estimatedHeight <= zone.height;
    
    return fitsVertically ? totalArea / (zone.width * zone.height) : 0;
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

  private groupIlotsByProximity(ilots: Ilot[]): Ilot[][] {
    // Group îlots that are close to each other
    const groups: Ilot[][] = [];
    const visited = new Set<string>();
    
    for (const ilot of ilots) {
      if (visited.has(ilot.id)) continue;
      
      const group = [ilot];
      visited.add(ilot.id);
      
      // Find nearby îlots
      for (const other of ilots) {
        if (visited.has(other.id)) continue;
        
        const distance = Math.sqrt(
          Math.pow(ilot.x - other.x, 2) + Math.pow(ilot.y - other.y, 2)
        );
        
        if (distance <= this.DEFAULT_CORRIDOR_WIDTH * 3) {
          group.push(other);
          visited.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private organizeIlotsIntoRows(ilots: Ilot[]): Ilot[][] {
    // Group îlots by approximate Y coordinate (rows)
    const tolerance = 0.5; // 50cm tolerance for row alignment
    const rows: Ilot[][] = [];
    
    const sortedByY = [...ilots].sort((a, b) => a.y - b.y);
    
    for (const ilot of sortedByY) {
      let addedToRow = false;
      
      for (const row of rows) {
        const avgY = row.reduce((sum, i) => sum + i.y, 0) / row.length;
        if (Math.abs(ilot.y - avgY) <= tolerance) {
          row.push(ilot);
          addedToRow = true;
          break;
        }
      }
      
      if (!addedToRow) {
        rows.push([ilot]);
      }
    }
    
    // Sort each row by X coordinate
    rows.forEach(row => row.sort((a, b) => a.x - b.x));
    
    return rows;
  }

  private areRowsFacing(row1: Ilot[], row2: Ilot[]): boolean {
    // Check if rows are facing each other (reasonable Y gap, overlapping X range)
    const bounds1 = this.calculateRowBounds(row1);
    const bounds2 = this.calculateRowBounds(row2);
    
    const yGap = Math.abs(bounds1.minY - bounds2.maxY);
    const xOverlap = Math.min(bounds1.maxX, bounds2.maxX) - Math.max(bounds1.minX, bounds2.minX);
    
    return yGap <= this.DEFAULT_CORRIDOR_WIDTH * 2 && xOverlap > 0;
  }

  private calculateRowBounds(row: Ilot[]): Rectangle {
    if (row.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    
    const minX = Math.min(...row.map(i => i.x));
    const minY = Math.min(...row.map(i => i.y));
    const maxX = Math.max(...row.map(i => i.x + i.width));
    const maxY = Math.max(...row.map(i => i.y + i.height));
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private corridorConflictsWithRestrictions(corridor: Corridor, zones: ZoneType[]): boolean {
    const corridorRect: Rectangle = {
      minX: corridor.startX,
      minY: corridor.startY,
      maxX: corridor.endX,
      maxY: corridor.endY,
      width: corridor.endX - corridor.startX,
      height: corridor.endY - corridor.startY
    };

    return zones.some(zone => 
      (zone.type === 'wall' || zone.type === 'restricted') &&
      this.rectanglesOverlap(corridorRect, zone.bounds)
    );
  }

  private findBestConnection(
    isolated: Ilot,
    existingCorridors: Corridor[],
    allIlots: Ilot[],
    corridorWidth: number,
    zones: ZoneType[]
  ): Corridor | null {
    // Find the nearest corridor or îlot to connect to
    let bestDistance = Infinity;
    let bestTarget: { x: number, y: number } | null = null;
    
    // Check distance to existing corridors
    for (const corridor of existingCorridors) {
      const centerX = (corridor.startX + corridor.endX) / 2;
      const centerY = (corridor.startY + corridor.endY) / 2;
      const distance = Math.sqrt(
        Math.pow(isolated.x + isolated.width/2 - centerX, 2) + 
        Math.pow(isolated.y + isolated.height/2 - centerY, 2)
      );
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = { x: centerX, y: centerY };
      }
    }
    
    if (!bestTarget) return null;
    
    // Create connection corridor
    const ilotCenter = {
      x: isolated.x + isolated.width / 2,
      y: isolated.y + isolated.height / 2
    };
    
    return {
      id: `corridor_connection_${isolated.id}`,
      startX: Math.min(ilotCenter.x, bestTarget.x),
      startY: Math.min(ilotCenter.y, bestTarget.y) - corridorWidth / 2,
      endX: Math.max(ilotCenter.x, bestTarget.x),
      endY: Math.min(ilotCenter.y, bestTarget.y) + corridorWidth / 2,
      width: corridorWidth,
      connectedIlots: [isolated.id],
      length: Math.sqrt(
        Math.pow(bestTarget.x - ilotCenter.x, 2) + 
        Math.pow(bestTarget.y - ilotCenter.y, 2)
      )
    };
  }

  private optimizeIlotPlacement(ilots: Ilot[]): Ilot[] {
    // Apply optimization algorithms to improve spacing and efficiency
    // This is a simplified version - full implementation would use genetic algorithms
    
    return ilots.map(ilot => ({
      ...ilot,
      label: `${ilot.area.toFixed(2)}m²` // Ensure precise area labeling
    }));
  }

  private optimizeCorridorNetwork(corridors: Corridor[]): Corridor[] {
    // Optimize corridor network for minimal total length and maximum connectivity
    // Remove redundant corridors and merge adjacent ones
    
    const optimized: Corridor[] = [];
    const processed = new Set<string>();
    
    for (const corridor of corridors) {
      if (processed.has(corridor.id)) continue;
      
      // Find adjacent corridors that can be merged
      const adjacent = corridors.filter(c => 
        c.id !== corridor.id && 
        !processed.has(c.id) &&
        this.corridorsAreAdjacent(corridor, c)
      );
      
      if (adjacent.length > 0) {
        const merged = this.mergeCorridors([corridor, ...adjacent]);
        optimized.push(merged);
        processed.add(corridor.id);
        adjacent.forEach(c => processed.add(c.id));
      } else {
        optimized.push(corridor);
        processed.add(corridor.id);
      }
    }
    
    return optimized;
  }

  private corridorsAreAdjacent(c1: Corridor, c2: Corridor): boolean {
    // Check if corridors share endpoints or overlap
    const tolerance = 0.1;
    
    return (
      Math.abs(c1.endX - c2.startX) < tolerance && Math.abs(c1.endY - c2.startY) < tolerance ||
      Math.abs(c1.startX - c2.endX) < tolerance && Math.abs(c1.startY - c2.endY) < tolerance
    );
  }

  private mergeCorridors(corridors: Corridor[]): Corridor {
    // Merge multiple corridors into one
    const allIlots = corridors.flatMap(c => c.connectedIlots);
    const totalLength = corridors.reduce((sum, c) => sum + c.length, 0);
    
    const minX = Math.min(...corridors.map(c => Math.min(c.startX, c.endX)));
    const minY = Math.min(...corridors.map(c => Math.min(c.startY, c.endY)));
    const maxX = Math.max(...corridors.map(c => Math.max(c.startX, c.endX)));
    const maxY = Math.max(...corridors.map(c => Math.max(c.startY, c.endY)));
    
    return {
      id: `merged_${corridors.map(c => c.id).join('_')}`,
      startX: minX,
      startY: minY,
      endX: maxX,
      endY: maxY,
      width: corridors[0].width,
      connectedIlots: Array.from(new Set(allIlots)),
      length: totalLength
    };
  }
}

export const ilotPlacementService = new IlotPlacementService();
