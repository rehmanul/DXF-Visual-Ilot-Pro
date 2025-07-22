
import { GeometryData, RoomDetectionResult } from "@shared/schema";

interface Point {
  x: number;
  y: number;
}

interface Wall {
  start: Point;
  end: Point;
  layer: string;
}

export class RoomDetectionService {
  
  async detectRooms(geometryData: GeometryData): Promise<RoomDetectionResult> {
    try {
      const walls = this.extractWalls(geometryData);
      const rooms = await this.performRoomDetection(walls, geometryData);
      const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
      
      return {
        rooms,
        totalArea,
        confidence: this.calculateConfidence(rooms, geometryData)
      };
    } catch (error) {
      throw new Error(`Room detection failed: ${error}`);
    }
  }

  private extractWalls(geometryData: GeometryData): Wall[] {
    const walls: Wall[] = [];
    
    for (const entity of geometryData.entities) {
      const layer = entity.layer?.toLowerCase() || '';
      
      // Consider lines as walls if they're on wall layers or long enough
      if (entity.type === 'LINE') {
        const isWallLayer = layer.includes('wall') || layer.includes('partition') || 
                           layer === '0' || layer === 'defpoints';
        const length = this.calculateDistance(
          entity.coordinates[0], entity.coordinates[1]
        );
        
        if (isWallLayer || length > 0.5) { // Walls should be at least 0.5 units long
          walls.push({
            start: { x: entity.coordinates[0][0], y: entity.coordinates[0][1] },
            end: { x: entity.coordinates[1][0], y: entity.coordinates[1][1] },
            layer: entity.layer
          });
        }
      }
      
      // Handle polylines as multiple wall segments
      if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
        const coords = entity.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          const length = this.calculateDistance(coords[i], coords[i + 1]);
          if (length > 0.1) { // Minimum segment length
            walls.push({
              start: { x: coords[i][0], y: coords[i][1] },
              end: { x: coords[i + 1][0], y: coords[i + 1][1] },
              layer: entity.layer
            });
          }
        }
      }
    }
    
    return walls;
  }

  private async performRoomDetection(walls: Wall[], geometryData: GeometryData): Promise<RoomDetectionResult['rooms']> {
    const rooms: Array<{
      id: string;
      name: string;
      type: string;
      area: number;
      dimensions: any;
      shape: string;
      color: string;
      boundaries: number[][];
      bounds: any;
    }> = [];
    
    const roomColors = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280', '#EC4899', '#06B6D4', '#84CC16'];
    
    // Find closed polygons using wall intersection analysis
    const enclosedSpaces = this.findEnclosedSpaces(walls);
    
    // Process existing polylines that might represent rooms
    const existingRoomPolygons = this.extractExistingRoomPolygons(geometryData);
    enclosedSpaces.push(...existingRoomPolygons);
    
    // Sort by area (largest first) and remove duplicates
    const sortedSpaces = enclosedSpaces
      .sort((a, b) => this.calculatePolygonArea(b.boundaries) - this.calculatePolygonArea(a.boundaries))
      .filter((space, index, array) => {
        // Remove spaces that are too small
        const area = this.calculatePolygonArea(space.boundaries);
        if (area < 2) return false; // Minimum 2 square units
        
        // Remove duplicates (spaces that overlap significantly)
        return !array.slice(0, index).some(otherSpace => 
          this.calculateOverlap(space.boundaries, otherSpace.boundaries) > 0.8
        );
      });
    
    sortedSpaces.forEach((space, index) => {
      const area = this.calculatePolygonArea(space.boundaries) * geometryData.scale * geometryData.scale;
      const bounds = this.calculateBounds(space.boundaries);
      const dimensions = this.calculateDimensions(bounds);
      const roomType = this.classifyRoom(area, dimensions, space.boundaries);
      
      rooms.push({
        id: `room_${index + 1}`,
        name: this.generateRoomName(roomType, index),
        type: roomType,
        area: area,
        dimensions: {
          width: dimensions.width * geometryData.scale,
          height: dimensions.height * geometryData.scale
        },
        shape: this.determineShape(space.boundaries),
        color: roomColors[index % roomColors.length],
        boundaries: space.boundaries,
        bounds: {
          minX: bounds.minX * geometryData.scale,
          minY: bounds.minY * geometryData.scale,
          maxX: bounds.maxX * geometryData.scale,
          maxY: bounds.maxY * geometryData.scale
        }
      });
    });

    return rooms;
  }

  private findEnclosedSpaces(walls: Wall[]): Array<{ boundaries: number[][] }> {
    const spaces: Array<{ boundaries: number[][] }> = [];
    const tolerance = 0.1; // Tolerance for connecting walls
    
    // Create a graph of connected wall endpoints
    const intersections = this.findWallIntersections(walls, tolerance);
    
    // Find closed cycles in the wall graph
    const cycles = this.findCycles(intersections, walls);
    
    cycles.forEach(cycle => {
      if (cycle.length >= 3) { // Must have at least 3 points for a room
        spaces.push({ boundaries: cycle });
      }
    });
    
    return spaces;
  }

  private findWallIntersections(walls: Wall[], tolerance: number): Map<string, Point[]> {
    const intersections = new Map<string, Point[]>();
    
    // Find all intersection points
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const intersection = this.lineIntersection(walls[i], walls[j]);
        if (intersection) {
          const key = `${intersection.x.toFixed(2)},${intersection.y.toFixed(2)}`;
          if (!intersections.has(key)) {
            intersections.set(key, []);
          }
          intersections.get(key)!.push(intersection);
        }
      }
    }
    
    // Add wall endpoints that are close to intersections
    walls.forEach(wall => {
      [wall.start, wall.end].forEach(point => {
        let added = false;
        for (const [key, points] of intersections) {
          const [x, y] = key.split(',').map(Number);
          if (this.calculateDistance([point.x, point.y], [x, y]) < tolerance) {
            points.push(point);
            added = true;
            break;
          }
        }
        if (!added) {
          const key = `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
          intersections.set(key, [point]);
        }
      });
    });
    
    return intersections;
  }

  private lineIntersection(wall1: Wall, wall2: Wall): Point | null {
    const x1 = wall1.start.x, y1 = wall1.start.y;
    const x2 = wall1.end.x, y2 = wall1.end.y;
    const x3 = wall2.start.x, y3 = wall2.start.y;
    const x4 = wall2.end.x, y4 = wall2.end.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Parallel lines
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }
    
    return null;
  }

  private findCycles(intersections: Map<string, Point[]>, walls: Wall[]): number[][][] {
    const cycles: number[][][] = [];
    const visited = new Set<string>();
    
    // Simplified cycle detection - look for rectangular patterns
    const points = Array.from(intersections.keys()).map(key => {
      const [x, y] = key.split(',').map(Number);
      return [x, y];
    });
    
    // Find potential rectangles
    for (let i = 0; i < points.length - 3; i++) {
      for (let j = i + 1; j < points.length - 2; j++) {
        for (let k = j + 1; k < points.length - 1; k++) {
          for (let l = k + 1; l < points.length; l++) {
            const rect = [points[i], points[j], points[k], points[l]];
            if (this.isValidRoom(rect)) {
              const orderedRect = this.orderPointsClockwise(rect);
              cycles.push(orderedRect);
            }
          }
        }
      }
    }
    
    return cycles;
  }

  private isValidRoom(points: number[][]): boolean {
    if (points.length !== 4) return false;
    
    // Check if points form a reasonable rectangle
    const distances = [];
    for (let i = 0; i < 4; i++) {
      distances.push(this.calculateDistance(points[i], points[(i + 1) % 4]));
    }
    
    // Should have two pairs of equal sides
    distances.sort((a, b) => a - b);
    const area = this.calculatePolygonArea([...points, points[0]]);
    
    return area > 1 && // Minimum area
           distances[0] > 0.5 && // Minimum side length
           Math.abs(distances[0] - distances[1]) < 0.1 && // First pair equal
           Math.abs(distances[2] - distances[3]) < 0.1;   // Second pair equal
  }

  private orderPointsClockwise(points: number[][]): number[][] {
    // Find centroid
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    
    // Sort by angle from centroid
    return points.sort((a, b) => {
      const angleA = Math.atan2(a[1] - cy, a[0] - cx);
      const angleB = Math.atan2(b[1] - cy, b[0] - cx);
      return angleA - angleB;
    }).concat([points[0]]); // Close the polygon
  }

  private extractExistingRoomPolygons(geometryData: GeometryData): Array<{ boundaries: number[][] }> {
    const roomPolygons: Array<{ boundaries: number[][] }> = [];
    
    geometryData.entities.forEach(entity => {
      if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') && 
          entity.properties?.closed && entity.coordinates.length >= 4) {
        
        const area = this.calculatePolygonArea(entity.coordinates);
        if (area > 2) { // Minimum room area
          roomPolygons.push({ boundaries: entity.coordinates });
        }
      }
    });
    
    return roomPolygons;
  }

  private calculateDistance(p1: number[], p2: number[]): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculatePolygonArea(boundaries: number[][]): number {
    if (boundaries.length < 3) return 0;
    
    let area = 0;
    const n = boundaries.length - 1; // Exclude closing point if it exists
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += boundaries[i][0] * boundaries[j][1];
      area -= boundaries[j][0] * boundaries[i][1];
    }
    
    return Math.abs(area) / 2;
  }

  private calculateOverlap(boundaries1: number[][], boundaries2: number[][]): number {
    // Simplified overlap calculation - check if centroids are close
    const centroid1 = this.calculateCentroid(boundaries1);
    const centroid2 = this.calculateCentroid(boundaries2);
    const distance = this.calculateDistance(
      [centroid1.x, centroid1.y], 
      [centroid2.x, centroid2.y]
    );
    
    const avgSize1 = Math.sqrt(this.calculatePolygonArea(boundaries1));
    const avgSize2 = Math.sqrt(this.calculatePolygonArea(boundaries2));
    const avgSize = (avgSize1 + avgSize2) / 2;
    
    return avgSize > 0 ? Math.max(0, 1 - distance / avgSize) : 0;
  }

  private calculateCentroid(boundaries: number[][]): { x: number; y: number } {
    const n = boundaries.length - 1; // Exclude closing point
    let x = 0, y = 0;
    
    for (let i = 0; i < n; i++) {
      x += boundaries[i][0];
      y += boundaries[i][1];
    }
    
    return { x: x / n, y: y / n };
  }

  private classifyRoom(area: number, dimensions: { width: number; height: number }, boundaries: number[][]): string {
    const aspectRatio = Math.max(dimensions.width, dimensions.height) / 
                       Math.min(dimensions.width, dimensions.height);
    
    // Room classification based on area and aspect ratio
    if (area < 8) {
      return aspectRatio > 2 ? 'hallway' : 'bathroom';
    } else if (area < 15) {
      return aspectRatio > 1.8 ? 'hallway' : 'bedroom';
    } else if (area < 25) {
      return aspectRatio > 2 ? 'hallway' : 'bedroom';
    } else if (area < 40) {
      return aspectRatio > 2.5 ? 'hallway' : 'living_room';
    } else {
      return 'living_room';
    }
  }

  private calculateBounds(boundaries: number[][]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    boundaries.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    
    return { minX, minY, maxX, maxY };
  }

  private calculateDimensions(bounds: { minX: number; minY: number; maxX: number; maxY: number }): { width: number; height: number } {
    return {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
  }

  private determineShape(boundaries: number[][]): string {
    const n = boundaries.length - 1; // Exclude closing point
    
    if (n === 4) {
      // Check if it's a rectangle
      const angles = this.calculateInteriorAngles(boundaries);
      const isRectangle = angles.every(angle => Math.abs(angle - 90) < 10);
      return isRectangle ? 'rectangular' : 'quadrilateral';
    } else if (n === 3) {
      return 'triangular';
    } else if (n <= 6) {
      return 'l_shaped';
    } else {
      return 'irregular';
    }
  }

  private calculateInteriorAngles(boundaries: number[][]): number[] {
    const angles = [];
    const n = boundaries.length - 1;
    
    for (let i = 0; i < n; i++) {
      const prev = boundaries[(i - 1 + n) % n];
      const curr = boundaries[i];
      const next = boundaries[(i + 1) % n];
      
      const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
      const v2 = [next[0] - curr[0], next[1] - curr[1]];
      
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
      
      if (mag1 > 0 && mag2 > 0) {
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
        angles.push(angle);
      }
    }
    
    return angles;
  }

  private generateRoomName(type: string, index: number): string {
    const typeNames: Record<string, string> = {
      living_room: 'Living Room',
      kitchen: 'Kitchen',
      bedroom: index === 0 ? 'Master Bedroom' : `Bedroom ${index + 1}`,
      bathroom: index === 0 ? 'Main Bathroom' : `Bathroom ${index + 1}`,
      hallway: 'Hallway',
      storage: 'Storage Room'
    };
    
    return typeNames[type] || `Room ${index + 1}`;
  }

  private calculateConfidence(rooms: any[], geometryData: GeometryData): number {
    let confidence = 0.5; // Base confidence
    
    // Adjust based on number of rooms detected
    if (rooms.length >= 2 && rooms.length <= 15) {
      confidence += 0.2;
    }
    
    // Adjust based on geometry complexity
    if (geometryData.entities.length > 50) {
      confidence += 0.1;
    }
    
    // Adjust based on presence of proper wall layers
    const hasWallLayers = geometryData.layers.some(layer => 
      layer.toLowerCase().includes('wall') || layer.toLowerCase().includes('partition')
    );
    if (hasWallLayers) {
      confidence += 0.15;
    }
    
    // Adjust based on room area distribution
    const areas = rooms.map(room => room.area);
    const avgArea = areas.reduce((sum, area) => sum + area, 0) / areas.length;
    if (avgArea > 5 && avgArea < 100) { // Reasonable room sizes
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }
}

export const roomDetectionService = new RoomDetectionService();
