import { Room, GeometryData, FloorPlan, Measurement } from '../../shared/schema.js';


export interface RoomAnalysis {
  roomId: number;
  name: string;
  area: number;
  typeGuess: string;
  confidence: number;
  reasoning: string[];
  suggestedName?: string;
}

export class AIRoomLabelingService {
  private readonly MIN_AREA_FOR_LIVING_ROOM = 12; // m²
  private readonly MAX_AREA_FOR_BATHROOM = 8; // m²
  private readonly KITCHEN_INDICATORS = ['kitchen', 'cuisine', 'sink', 'oven', 'fridge'];
  private readonly BEDROOM_INDICATORS = ['bedroom', 'chambre'];
  private readonly BATHROOM_INDICATORS = ['bathroom', 'salle de bain', 'wc', 'toilet', 'shower', 'bath'];

  async labelRooms(rooms: Room[], geometryData: GeometryData): Promise<RoomAnalysis[]> {
    const analyses: RoomAnalysis[] = [];

    for (const room of rooms) {
      const analysis = this.analyzeRoom(room, geometryData);
      analyses.push(analysis);
    }

    return analyses;
  }

  analyzeRoom(room: Room, geometryData: GeometryData): RoomAnalysis {
    const reasoning: string[] = [];
    let confidence = 0.5;
    let typeGuess = 'unknown';

    // Rule 1: Area-based classification
    if (room.area > this.MIN_AREA_FOR_LIVING_ROOM) {
      typeGuess = 'living_room';
      reasoning.push(`Large area (${room.area.toFixed(1)}m²) suggests a living room.`);
      confidence += 0.2;
    } else if (room.area < this.MAX_AREA_FOR_BATHROOM) {
      reasoning.push(`Small area (${room.area.toFixed(1)}m²) suggests a bathroom or utility room.`);
      confidence += 0.1;
    }

    // Rule 2: Keyword matching in room name
    const roomName = room.name.toLowerCase();
    if (this.KITCHEN_INDICATORS.some(k => roomName.includes(k))) {
      typeGuess = 'kitchen';
      reasoning.push(`Name "${room.name}" contains a kitchen indicator.`);
      confidence = 0.9;
    } else if (this.BEDROOM_INDICATORS.some(b => roomName.includes(b))) {
      typeGuess = 'bedroom';
      reasoning.push(`Name "${room.name}" contains a bedroom indicator.`);
      confidence = 0.9;
    } else if (this.BATHROOM_INDICATORS.some(b => roomName.includes(b))) {
      typeGuess = 'bathroom';
      reasoning.push(`Name "${room.name}" contains a bathroom indicator.`);
      confidence = 0.9;
    }

    // Rule 3: Geometric feature detection (e.g., water source for kitchen/bathroom)
    if (this.detectWaterSource(room, geometryData)) {
      reasoning.push('Possible water source detected, suggesting kitchen or bathroom.');
      if (typeGuess === 'unknown' || typeGuess === 'living_room') {
        typeGuess = 'kitchen'; // Default to kitchen if undecided
      }
      confidence += 0.25;
    }

    // Rule 4: Adjacency and connectivity (simplified)
    const doorCount = this.countDoors(room, geometryData);
    reasoning.push(`Room has ${doorCount} door(s).`);
    if (doorCount > 2) {
      reasoning.push('Multiple doors may indicate a central room or hallway.');
      confidence += 0.1;
    }

    // Final confidence clamping
    confidence = Math.min(Math.max(confidence, 0), 1);

    return {
      roomId: room.id,
      name: room.name,
      area: room.area,
      typeGuess,
      confidence,
      reasoning,
      suggestedName: this.suggestName(typeGuess, room.area)
    };
  }

  async updateRoomLabels(rooms: Room[], analyses: RoomAnalysis[]): Promise<Room[]> {
    const updatedRooms: Room[] = [];

    for (const room of rooms) {
      const analysis = analyses.find(a => a.roomId === room.id);
      if (analysis && analysis.confidence > 0.6) {
        updatedRooms.push({
          ...room,
          type: analysis.typeGuess,
          name: analysis.suggestedName || room.name
        });
      } else {
        updatedRooms.push(room);
      }
    }

    return updatedRooms;
  }

  private suggestName(type: string, area: number): string {
    const areaStr = area.toFixed(0);
    switch (type) {
      case 'living_room': return `Living Room (${areaStr}m²)`;
      case 'kitchen': return `Kitchen (${areaStr}m²)`;
      case 'bedroom': return `Bedroom (${areaStr}m²)`;
      case 'bathroom': return `Bathroom (${areaStr}m²)`;
      default: return `Room (${areaStr}m²)`;
    }
  }

  private detectWaterSource(room: Room, geometryData: GeometryData): boolean {
    const waterIndicators = geometryData.entities.filter((entity: any) => {
      const layer = entity.layer.toLowerCase();
      return (
        layer.includes('plumbing') ||
        layer.includes('water') ||
        (entity.is_block && (entity.properties.block_name.toLowerCase().includes('sink') || entity.properties.block_name.toLowerCase().includes('toilet')))
      );
    });

    return waterIndicators.some((entity: any) => {
      return this.isEntityInRoom(entity, room);
    });
  }

  private detectWindow(room: Room, geometryData: GeometryData): boolean {
    const windows = geometryData.entities.filter((entity: any) => {
      const layer = entity.layer.toLowerCase();
      return layer.includes('window') || (entity.is_block && entity.properties.block_name.toLowerCase().includes('window'));
    });

    return windows.some((window: any) => this.isEntityInRoom(window, room));

  }
  
  private countWindows(room: Room, geometryData: GeometryData): number {
    const windows = geometryData.entities.filter((entity: any) => {
      const layer = entity.layer.toLowerCase();
      return layer.includes('window') || (entity.is_block && entity.properties.block_name.toLowerCase().includes('window'));
    });

    return windows.filter((window: any) => this.isEntityInRoom(window, room)).length;

  }

  private countDoors(room: Room, geometryData: GeometryData): number {
    const doors = geometryData.entities.filter((entity: any) => {
      const layer = entity.layer.toLowerCase();
      return layer.includes('door') || (entity.is_block && entity.properties.block_name.toLowerCase().includes('door'));
    });
    
    return doors.filter((door: any) => this.isEntityInRoom(door, room)).length;
  }

  private isEntityInRoom(entity: any, room: Room): boolean {
    if (!entity.coordinates || entity.coordinates.length === 0) return false;

    // Simple check: assuming first coordinate of entity is representative
    const [x, y] = entity.coordinates[0];
    
    return x >= room.minX && x <= room.maxX && y >= room.minY && y <= room.maxY;
  }
}

export const aiRoomLabelingService = new AIRoomLabelingService();
