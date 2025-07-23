import { GeometryData, Room } from '../../shared/schema';

interface Point {
  x: number;
  y: number;
}

interface Zone {
  type: 'NO_ENTREE' | 'ENTREE_SORTIE' | 'MUR' | 'USABLE';
  boundaries: Point[];
  color: string;
}

interface Ilot {
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

interface Corridor {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
  type: 'main' | 'secondary';
  color: string;
}

interface FloorPlanLayout {
  zones: Zone[];
  ilots: Ilot[];
  corridors: Corridor[];
  totalArea: number;
  usableArea: number;
  efficiency: number;
  measurements: Array<{
    ilotId: string;
    area: number;
    label: string;
  }>;
}

class IlotPlacementService {
  private readonly CORRIDOR_WIDTH = 1.2; // Default 1.2m corridor width
  private readonly MIN_ILOT_SIZE = 1.5; // Minimum îlot dimension
  private readonly MAX_ILOT_SIZE = 4.0; // Maximum îlot dimension
  private readonly CLEARANCE = 0.3; // Minimum clearance from walls/obstacles
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
    rooms: Room[],
    densityPercentage: number = 25
  ): Promise<FloorPlanLayout> {
    try {
      // Step 1: Detect zones from CAD data
      const zones = this.detectZones(geometryData);

      // Step 2: Calculate usable areas
      const usableZones = zones.filter(zone => zone.type === 'USABLE');
      const totalUsableArea = this.calculateTotalArea(usableZones);

      // Step 3: Generate îlots based on density
      const ilots = this.generateIlots(usableZones, totalUsableArea, densityPercentage);

      // Step 4: Generate corridors between facing îlot rows
      const corridors = this.generateCorridors(ilots, zones);

      // Step 5: Add measurements
      const measurements = this.generateMeasurements(ilots);

      const totalArea = this.calculateTotalArea(zones);
      const efficiency = (ilots.reduce((sum, ilot) => sum + ilot.area, 0) / totalUsableArea) * 100;

      return {
        zones,
        ilots,
        corridors,
        totalArea,
        usableArea: totalUsableArea,
        efficiency,
        measurements
      };
    } catch (error) {
      throw new Error(`Floor plan layout generation failed: ${error}`);
    }
  }

  private detectZones(geometryData: GeometryData): Zone[] {
    const zones: Zone[] = [];

    // Detect walls (MUR) - black lines
    const walls = this.extractWalls(geometryData);
    walls.forEach((wall, index) => {
      zones.push({
        type: 'MUR',
        boundaries: wall.boundaries,
        color: '#374151' // Gray-700
      });
    });

    // Detect restricted areas (NO_ENTREE) - light blue zones
    const restrictedAreas = this.extractRestrictedAreas(geometryData);
    restrictedAreas.forEach((area, index) => {
      zones.push({
        type: 'NO_ENTREE',
        boundaries: area.boundaries,
        color: '#3B82F6' // Blue-500
      });
    });

    // Detect entrances/exits (ENTREE_SORTIE) - red zones
    const entrances = this.extractEntrances(geometryData);
    entrances.forEach((entrance, index) => {
      zones.push({
        type: 'ENTREE_SORTIE',
        boundaries: entrance.boundaries,
        color: '#EF4444' // Red-500
      });
    });

    // Calculate usable areas (remaining space)
    const usableAreas = this.calculateUsableAreas(geometryData, zones);
    usableAreas.forEach(area => {
      zones.push({
        type: 'USABLE',
        boundaries: area.boundaries,
        color: '#F3F4F6' // Gray-100
      });
    });

    return zones;
  }

  private generateIlots(usableZones: Zone[], totalUsableArea: number, densityPercentage: number): Ilot[] {
    const ilots: Ilot[] = [];
    const targetArea = (totalUsableArea * densityPercentage) / 100;

    // Define îlot size categories
    const ilotTypes = [
      { type: 'small' as const, minArea: 3, maxArea: 8, color: '#FEE2E2' }, // Red-50 with red outline
      { type: 'medium' as const, minArea: 8, maxArea: 15, color: '#FECACA' }, // Red-200
      { type: 'large' as const, minArea: 15, maxArea: 25, color: '#FCA5A5' } // Red-300
    ];

    let placedArea = 0;
    let ilotId = 1;

    for (const zone of usableZones) {
      if (placedArea >= targetArea) break;

      const zoneBounds = this.calculateBounds(zone.boundaries);
      const availableWidth = zoneBounds.maxX - zoneBounds.minX;
      const availableHeight = zoneBounds.maxY - zoneBounds.minY;

      // Grid-based placement for optimal arrangement
      const rows = Math.floor(availableHeight / (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH));
      const cols = Math.floor(availableWidth / (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH));

      for (let row = 0; row < rows && placedArea < targetArea; row++) {
        for (let col = 0; col < cols && placedArea < targetArea; col++) {
          const x = zoneBounds.minX + col * (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH) + this.CLEARANCE;
          const y = zoneBounds.minY + row * (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH) + this.CLEARANCE;

          // Determine îlot size based on available space and target distribution
          const ilotType = this.selectIlotType(ilotTypes, placedArea, targetArea);
          const ilotSize = this.calculateOptimalIlotSize(
            availableWidth - col * (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH),
            availableHeight - row * (this.MIN_ILOT_SIZE + this.CORRIDOR_WIDTH),
            ilotType
          );

          if (this.canPlaceIlot(x, y, ilotSize.width, ilotSize.height, zone)) {
            const ilot: Ilot = {
              id: `ilot_${ilotId++}`,
              x,
              y,
              width: ilotSize.width,
              height: ilotSize.height,
              area: ilotSize.width * ilotSize.height,
              type: ilotType.type,
              color: ilotType.color,
              label: `${(ilotSize.width * ilotSize.height).toFixed(1)}m²`
            };

            ilots.push(ilot);
            placedArea += ilot.area;
          }
        }
      }
    }

    return ilots;
  }

  private generateCorridors(ilots: Ilot[], zones: Zone[]): Corridor[] {
    const corridors: Corridor[] = [];
    const ilotRows = this.groupIlotsIntoRows(ilots);

    let corridorId = 1;

    // Generate corridors between facing rows
    for (let i = 0; i < ilotRows.length - 1; i++) {
      const currentRow = ilotRows[i];
      const nextRow = ilotRows[i + 1];

      if (this.areRowsFacing(currentRow, nextRow)) {
        const corridor = this.createCorridorBetweenRows(currentRow, nextRow, corridorId++);
        if (corridor && this.isCorridorValid(corridor, ilots, zones)) {
          corridors.push(corridor);
        }
      }
    }

    // Generate main circulation corridors
    const mainCorridors = this.generateMainCirculationCorridors(ilots, zones);
    corridors.push(...mainCorridors);

    return corridors;
  }

  private createCorridorBetweenRows(row1: Ilot[], row2: Ilot[], corridorId: number): Corridor | null {
    if (row1.length === 0 || row2.length === 0) return null;

    // Calculate corridor position between rows
    const row1Bottom = Math.max(...row1.map(ilot => ilot.y + ilot.height));
    const row2Top = Math.min(...row2.map(ilot => ilot.y));

    const corridorY = (row1Bottom + row2Top) / 2;
    const corridorStartX = Math.min(...row1.map(ilot => ilot.x), ...row2.map(ilot => ilot.x));
    const corridorEndX = Math.max(...row1.map(ilot => ilot.x + ilot.width), ...row2.map(ilot => ilot.x + ilot.width));

    return {
      id: `corridor_${corridorId}`,
      startX: corridorStartX,
      startY: corridorY - this.CORRIDOR_WIDTH / 2,
      endX: corridorEndX,
      endY: corridorY + this.CORRIDOR_WIDTH / 2,
      width: this.CORRIDOR_WIDTH,
      type: 'main',
      color: '#F472B6' // Pink-400
    };
  }

  private generateMeasurements(ilots: Ilot[]): Array<{ ilotId: string; area: number; label: string }> {
    return ilots.map(ilot => ({
      ilotId: ilot.id,
      area: parseFloat(ilot.area.toFixed(2)),
      label: `${ilot.area.toFixed(2)}m²`
    }));
  }

  // Helper methods
  private extractWalls(geometryData: GeometryData): Array<{ boundaries: Point[] }> {
    const walls: Array<{ boundaries: Point[] }> = [];

    geometryData.entities.forEach(entity => {
      if (entity.type === 'LINE' || entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
        const layer = entity.layer?.toLowerCase() || '';
        if (layer.includes('wall') || layer.includes('mur') || layer === '0') {
          walls.push({
            boundaries: entity.coordinates.map(coord => ({ x: coord[0], y: coord[1] }))
          });
        }
      }
    });

    return walls;
  }

  private extractRestrictedAreas(geometryData: GeometryData): Array<{ boundaries: Point[] }> {
    const restricted: Array<{ boundaries: Point[] }> = [];

    geometryData.entities.forEach(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      if (layer.includes('stairs') || layer.includes('elevator') || layer.includes('restricted')) {
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
          restricted.push({
            boundaries: entity.coordinates.map(coord => ({ x: coord[0], y: coord[1] }))
          });
        }
      }
    });

    return restricted;
  }

  private extractEntrances(geometryData: GeometryData): Array<{ boundaries: Point[] }> {
    const entrances: Array<{ boundaries: Point[] }> = [];

    geometryData.entities.forEach(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      if (layer.includes('door') || layer.includes('entrance') || layer.includes('sortie')) {
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE' || entity.type === 'ARC') {
          entrances.push({
            boundaries: entity.coordinates.map(coord => ({ x: coord[0], y: coord[1] }))
          });
        }
      }
    });

    return entrances;
  }

  private calculateUsableAreas(geometryData: GeometryData, restrictedZones: Zone[]): Array<{ boundaries: Point[] }> {
    const bounds = geometryData.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100 };

    // Simplified approach: create a main usable rectangle excluding restricted areas
    return [{
      boundaries: [
        { x: bounds.minX + 1, y: bounds.minY + 1 },
        { x: bounds.maxX - 1, y: bounds.minY + 1 },
        { x: bounds.maxX - 1, y: bounds.maxY - 1 },
        { x: bounds.minX + 1, y: bounds.maxY - 1 }
      ]
    }];
  }

  private calculateTotalArea(zones: Zone[]): number {
    return zones.reduce((total, zone) => {
      return total + this.calculatePolygonArea(zone.boundaries);
    }, 0);
  }

  private calculatePolygonArea(boundaries: Point[]): number {
    if (boundaries.length < 3) return 0;

    let area = 0;
    const n = boundaries.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += boundaries[i].x * boundaries[j].y;
      area -= boundaries[j].x * boundaries[i].y;
    }

    return Math.abs(area) / 2;
  }

  private calculateBounds(boundaries: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    boundaries.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    return { minX, minY, maxX, maxY };
  }

  private selectIlotType(ilotTypes: any[], placedArea: number, targetArea: number): any {
    const remaining = targetArea - placedArea;

    if (remaining < 10) return ilotTypes[0]; // Small
    if (remaining < 30) return ilotTypes[1]; // Medium
    return ilotTypes[2]; // Large
  }

  private calculateOptimalIlotSize(availableWidth: number, availableHeight: number, ilotType: any): { width: number; height: number } {
    const targetArea = (ilotType.minArea + ilotType.maxArea) / 2;
    const aspectRatio = 1.5; // Rectangular îlots

    let width = Math.sqrt(targetArea * aspectRatio);
    let height = targetArea / width;

    // Constrain to available space
    width = Math.min(width, availableWidth - this.CLEARANCE * 2);
    height = Math.min(height, availableHeight - this.CLEARANCE * 2);

    // Ensure minimum sizes
    width = Math.max(width, this.MIN_ILOT_SIZE);
    height = Math.max(height, this.MIN_ILOT_SIZE);

    return { width, height };
  }

  private canPlaceIlot(x: number, y: number, width: number, height: number, zone: Zone): boolean {
    const ilotBounds = {
      minX: x,
      minY: y,
      maxX: x + width,
      maxY: y + height
    };

    const zoneBounds = this.calculateBounds(zone.boundaries);

    return ilotBounds.minX >= zoneBounds.minX &&
           ilotBounds.minY >= zoneBounds.minY &&
           ilotBounds.maxX <= zoneBounds.maxX &&
           ilotBounds.maxY <= zoneBounds.maxY;
  }

  private groupIlotsIntoRows(ilots: Ilot[]): Ilot[][] {
    const rows: Ilot[][] = [];
    const sortedByY = [...ilots].sort((a, b) => a.y - b.y);

    let currentRow: Ilot[] = [];
    let currentY = -Infinity;

    sortedByY.forEach(ilot => {
      if (Math.abs(ilot.y - currentY) > this.CORRIDOR_WIDTH) {
        if (currentRow.length > 0) {
          rows.push([...currentRow]);
        }
        currentRow = [ilot];
        currentY = ilot.y;
      } else {
        currentRow.push(ilot);
      }
    });

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  private areRowsFacing(row1: Ilot[], row2: Ilot[]): boolean {
    if (row1.length === 0 || row2.length === 0) return false;

    const row1Y = row1[0].y;
    const row2Y = row2[0].y;
    const distance = Math.abs(row2Y - row1Y);

    return distance > this.MIN_ILOT_SIZE && distance < this.MIN_ILOT_SIZE * 3;
  }

  private isCorridorValid(corridor: Corridor, ilots: Ilot[], zones: Zone[]): boolean {
    // Check corridor doesn't overlap with îlots
    for (const ilot of ilots) {
      if (this.rectanglesOverlap(
        { x: corridor.startX, y: corridor.startY, width: corridor.endX - corridor.startX, height: corridor.endY - corridor.startY },
        { x: ilot.x, y: ilot.y, width: ilot.width, height: ilot.height }
      )) {
        return false;
      }
    }

    return true;
  }

  private generateMainCirculationCorridors(ilots: Ilot[], zones: Zone[]): Corridor[] {
    // Generate main circulation paths
    return [];
  }

  private rectanglesOverlap(rect1: any, rect2: any): boolean {
    return !(rect1.x + rect1.width < rect2.x ||
             rect2.x + rect2.width < rect1.x ||
             rect1.y + rect1.height < rect2.y ||
             rect2.y + rect2.height < rect1.y);
  }
}

export const ilotPlacementService = new IlotPlacementService();