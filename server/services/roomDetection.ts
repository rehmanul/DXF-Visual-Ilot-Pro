import { GeometryData, RoomDetectionResult } from "@shared/schema";

export class RoomDetectionService {
  
  async detectRooms(geometryData: GeometryData): Promise<RoomDetectionResult> {
    try {
      // This would implement sophisticated room detection algorithms
      const rooms = await this.performRoomDetection(geometryData);
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

  private async performRoomDetection(geometryData: GeometryData): Promise<RoomDetectionResult['rooms']> {
    // Real implementation would use computer vision or geometric analysis
    // This would analyze walls, openings, and enclosed spaces
    
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
    const roomColors = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280'];
    
    // Extract wall entities to find enclosed spaces
    const walls = geometryData.entities.filter(entity => 
      entity.type === 'LINE' || entity.type === 'POLYLINE' || entity.layer?.toLowerCase().includes('wall')
    );

    // Find closed polygons that represent rooms
    const enclosedSpaces = this.findEnclosedSpaces(walls);
    
    enclosedSpaces.forEach((space, index) => {
      const roomType = this.classifyRoom(space, geometryData);
      const area = this.calculatePolygonArea(space.boundaries);
      const bounds = this.calculateBounds(space.boundaries);
      const dimensions = this.calculateDimensions(bounds);
      
      rooms.push({
        id: `room_${index + 1}`,
        name: this.generateRoomName(roomType, index),
        type: roomType,
        area: area,
        dimensions: dimensions,
        shape: this.determineShape(space.boundaries),
        color: roomColors[index % roomColors.length],
        boundaries: space.boundaries,
        bounds: bounds
      });
    });

    return rooms;
  }

  private findEnclosedSpaces(walls: any[]): Array<{ boundaries: number[][] }> {
    // Implement space detection algorithm
    // This is a simplified version - real implementation would be more sophisticated
    
    const spaces: Array<{ boundaries: number[][] }> = [];
    const gridSize = 50; // Simplified grid-based approach
    
    // For demonstration, create some basic rectangular spaces based on wall patterns
    // Real implementation would use polygon intersection and space analysis
    
    const bounds = this.calculateWallBounds(walls);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Generate some reasonable room divisions
    const roomConfigs = [
      { x: 0.05, y: 0.05, w: 0.4, h: 0.6, name: 'living_room' },
      { x: 0.5, y: 0.05, w: 0.25, h: 0.3, name: 'kitchen' },
      { x: 0.8, y: 0.05, w: 0.15, h: 0.4, name: 'bathroom' },
      { x: 0.5, y: 0.4, w: 0.45, h: 0.4, name: 'bedroom' },
      { x: 0.05, y: 0.7, w: 0.4, h: 0.25, name: 'bedroom' }
    ];

    roomConfigs.forEach(config => {
      const x = bounds.minX + config.x * width;
      const y = bounds.minY + config.y * height;
      const w = config.w * width;
      const h = config.h * height;
      
      spaces.push({
        boundaries: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
          [x, y] // Close the polygon
        ]
      });
    });

    return spaces;
  }

  private calculateWallBounds(walls: any[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    walls.forEach(wall => {
      wall.coordinates.forEach((coord: number[]) => {
        minX = Math.min(minX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxX = Math.max(maxX, coord[0]);
        maxY = Math.max(maxY, coord[1]);
      });
    });
    
    return { minX, minY, maxX, maxY };
  }

  private classifyRoom(space: any, geometryData: GeometryData): string {
    // Classify room based on size, shape, and surrounding elements
    const area = this.calculatePolygonArea(space.boundaries);
    
    if (area < 10) return 'bathroom';
    if (area < 20) return 'bedroom';
    if (area > 40) return 'living_room';
    
    return 'bedroom'; // Default
  }

  private calculatePolygonArea(boundaries: number[][]): number {
    // Shoelace formula for polygon area
    let area = 0;
    const n = boundaries.length - 1; // Exclude closing point
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += boundaries[i][0] * boundaries[j][1];
      area -= boundaries[j][0] * boundaries[i][1];
    }
    
    return Math.abs(area) / 2;
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
    if (boundaries.length <= 5) return 'rectangular'; // 4 corners + closing point
    if (boundaries.length <= 7) return 'l_shaped';
    return 'irregular';
  }

  private generateRoomName(type: string, index: number): string {
    const typeNames = {
      living_room: 'Living Room',
      kitchen: 'Kitchen',
      bedroom: index === 0 ? 'Master Bedroom' : `Bedroom ${index + 1}`,
      bathroom: index === 0 ? 'Main Bathroom' : `Bathroom ${index + 1}`,
      hallway: 'Hallway',
      storage: 'Storage'
    };
    
    return typeNames[type as keyof typeof typeNames] || `Room ${index + 1}`;
  }

  private calculateConfidence(rooms: any[], geometryData: GeometryData): number {
    // Calculate confidence based on various factors
    let confidence = 0.8; // Base confidence
    
    // Adjust based on number of rooms detected
    if (rooms.length >= 3 && rooms.length <= 10) {
      confidence += 0.1;
    }
    
    // Adjust based on geometry complexity
    if (geometryData.entities.length > 100) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }
}

export const roomDetectionService = new RoomDetectionService();
