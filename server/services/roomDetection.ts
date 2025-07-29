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
    const wallEntities = this.extractWalls(geometryData.entities);
    const roomBoundaries = this.findRoomBoundaries(wallEntities);
    
    const rooms = [];
    let totalArea = 0;
    
    for (const boundary of roomBoundaries) {
      const room = this.analyzeRoomBoundary(boundary, geometryData);
      if (room && room.area > 1.0) {
        rooms.push(room);
        totalArea += room.area;
      }
    }
    
    this.classifyRooms(rooms, geometryData);
    
    return {
      rooms,
      totalArea,
      confidence: this.calculateConfidence(rooms, geometryData)
    };
  }
  
  private extractWalls(entities: any[]): any[] {
    return entities.filter(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      const isWallLayer = layer.includes('wall') || layer.includes('mur') || 
                         layer.includes('cloison') || layer === '0';
      const isWallEntity = entity.type === 'line' && 
                          (entity.properties?.lineweight > 0.5 || isWallLayer);
      
      return isWallEntity;
    });
  }
  
  private findRoomBoundaries(walls: any[]): any[][] {
    const boundaries = [];
    const processed = new Set();
    
    for (const wall of walls) {
      if (processed.has(wall)) continue;
      
      const boundary = this.traceRoomBoundary(wall, walls, processed);
      if (boundary.length >= 3) {
        boundaries.push(boundary);
      }
    }
    
    return boundaries;
  }
  
  private traceRoomBoundary(startWall: any, allWalls: any[], processed: Set<any>): any[] {
    const boundary = [startWall];
    processed.add(startWall);
    
    let currentEnd = startWall.coordinates[1];
    const tolerance = 10;
    
    while (boundary.length < 20) {
      let nextWall = null;
      let minDistance = Infinity;
      
      for (const wall of allWalls) {
        if (processed.has(wall)) continue;
        
        const startDist = this.distance(currentEnd, wall.coordinates[0]);
        const endDist = this.distance(currentEnd, wall.coordinates[1]);
        
        if (startDist < tolerance && startDist < minDistance) {
          nextWall = wall;
          minDistance = startDist;
        } else if (endDist < tolerance && endDist < minDistance) {
          nextWall = {
            ...wall,
            coordinates: [wall.coordinates[1], wall.coordinates[0]]
          };
          minDistance = endDist;
        }
      }
      
      if (!nextWall) break;
      
      boundary.push(nextWall);
      processed.add(nextWall);
      currentEnd = nextWall.coordinates[1];
      
      const distToStart = this.distance(currentEnd, startWall.coordinates[0]);
      if (distToStart < tolerance) {
        break;
      }
    }
    
    return boundary;
  }
  
  private analyzeRoomBoundary(boundary: any[], geometryData: GeometryData): any {
    const points = boundary.map(wall => wall.coordinates[0]);
    const area = this.calculatePolygonArea(points);
    const bounds = this.calculateBounds(points);
    const centroid = this.calculateCentroid(points);
    
    const roomType = this.determineRoomType(area, bounds, geometryData);
    
    return {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: this.generateRoomName(roomType, area),
      type: roomType,
      area: area * Math.pow(geometryData.scale || 0.001, 2),
      dimensions: {
        width: (bounds.maxX - bounds.minX) * (geometryData.scale || 0.001),
        height: (bounds.maxY - bounds.minY) * (geometryData.scale || 0.001)
      },
      shape: this.analyzeRoomShape(points),
      color: this.getRoomColor(roomType),
      boundaries: points,
      bounds: {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY
      }
    };
  }
  
  private classifyRooms(rooms: any[], geometryData: GeometryData): void {
    for (const room of rooms) {
      const doorCount = this.countDoorsInRoom(room, geometryData);
      const windowCount = this.countWindowsInRoom(room, geometryData);
      
      if (room.area < 5 && doorCount === 1) {
        room.type = 'storage';
      } else if (room.area < 10 && this.hasWaterFixtures(room, geometryData)) {
        room.type = 'bathroom';
      } else if (room.area > 50 && windowCount > 2) {
        room.type = 'living_room';
      }
    }
  }
  
  private distance(p1: number[], p2: number[]): number {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
  }
  
  private calculatePolygonArea(points: number[][]): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }
    return Math.abs(area) / 2;
  }
  
  private calculateBounds(points: number[][]): any {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const point of points) {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    }
    
    return { minX, minY, maxX, maxY };
  }
  
  private calculateCentroid(points: number[][]): number[] {
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return [x, y];
  }
  
  private determineRoomType(area: number, bounds: any, geometryData: GeometryData): string {
    const areaM2 = area * Math.pow(geometryData.scale || 0.001, 2);
    
    if (areaM2 < 5) return 'storage';
    if (areaM2 < 10) return 'bathroom';
    if (areaM2 < 15) return 'bedroom';
    if (areaM2 < 25) return 'office';
    if (areaM2 < 40) return 'kitchen';
    return 'living_room';
  }
  
  private analyzeRoomShape(points: number[][]): string {
    if (points.length === 4) {
      const angles = this.calculateAngles(points);
      const isRectangular = angles.every(angle => Math.abs(angle - 90) < 10);
      return isRectangular ? 'rectangular' : 'quadrilateral';
    }
    
    if (points.length > 6) return 'irregular';
    return 'polygonal';
  }
  
  private calculateAngles(points: number[][]): number[] {
    const angles = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      
      const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
      const v2 = [next[0] - curr[0], next[1] - curr[1]];
      
      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
      const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
      
      const angle = Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
      angles.push(angle);
    }
    return angles;
  }
  
  private generateRoomName(type: string, area: number): string {
    const typeNames: Record<string, string> = {
      'living_room': 'Living Room',
      'bedroom': 'Bedroom',
      'kitchen': 'Kitchen',
      'bathroom': 'Bathroom',
      'office': 'Office',
      'storage': 'Storage',
      'corridor': 'Corridor'
    };
    
    return typeNames[type] || 'Room';
  }
  
  private getRoomColor(type: string): string {
    const colors: Record<string, string> = {
      'living_room': '#E3F2FD',
      'bedroom': '#F3E5F5',
      'kitchen': '#FFF3E0',
      'bathroom': '#E8F5E8',
      'office': '#FFF8E1',
      'storage': '#FAFAFA',
      'corridor': '#F5F5F5'
    };
    
    return colors[type] || '#F0F0F0';
  }
  
  private countDoorsInRoom(room: any, geometryData: GeometryData): number {
    return geometryData.entities.filter(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      return layer.includes('door') && this.isEntityInRoom(entity, room);
    }).length;
  }
  
  private countWindowsInRoom(room: any, geometryData: GeometryData): number {
    return geometryData.entities.filter(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      return layer.includes('window') && this.isEntityInRoom(entity, room);
    }).length;
  }
  
  private hasWaterFixtures(room: any, geometryData: GeometryData): boolean {
    return geometryData.entities.some(entity => {
      const layer = entity.layer?.toLowerCase() || '';
      const blockName = entity.properties?.name?.toLowerCase() || '';
      return (layer.includes('plumb') || blockName.includes('toilet') || 
              blockName.includes('sink')) && this.isEntityInRoom(entity, room);
    });
  }
  
  private isEntityInRoom(entity: any, room: any): boolean {
    if (!entity.coordinates || !entity.coordinates[0]) return false;
    
    const point = entity.coordinates[0];
    return this.pointInPolygon(point, room.boundaries);
  }
  
  private pointInPolygon(point: number[], polygon: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i][1] > point[1]) !== (polygon[j][1] > point[1])) &&
          (point[0] < (polygon[j][0] - polygon[i][0]) * (point[1] - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
        inside = !inside;
      }
    }
    return inside;
  }

  private calculateConfidence(rooms: any[], geometryData: GeometryData): number {
    if (rooms.length === 0) return 0;
    
    let confidence = 0;
    
    confidence += Math.min(rooms.length * 0.1, 0.5);
    
    const avgArea = rooms.reduce((sum, r) => sum + r.area, 0) / rooms.length;
    if (avgArea > 5 && avgArea < 100) confidence += 0.2;
    
    const rectangularRooms = rooms.filter(r => r.shape === 'rectangular').length;
    confidence += (rectangularRooms / rooms.length) * 0.2;
    
    const uniqueTypes = new Set(rooms.map(r => r.type)).size;
    confidence += Math.min(uniqueTypes * 0.05, 0.1);
    
    return Math.min(confidence, 1.0);
  }
}

export const roomDetectionService = new RoomDetectionService();