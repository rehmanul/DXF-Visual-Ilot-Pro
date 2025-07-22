import OpenAI from 'openai';
import { Room, GeometryData, FloorPlan, Measurement } from '@shared/schema';

interface RoomAnalysis {
  roomId: string;
  suggestedName: string;
  roomType: string;
  confidence: number;
  reasoning: string;
}

interface GeometricFeatures {
  area: number;
  aspectRatio: number;
  position: { x: number; y: number };
  adjacentRooms: string[];
  hasWaterAccess?: boolean;
  hasExteriorWalls?: boolean;
  nearEntrance?: boolean;
}

export class AIRoomLabelingService {
  private openai: OpenAI | null = null;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async labelRooms(rooms: Room[], geometryData: GeometryData): Promise<RoomAnalysis[]> {
    if (!this.openai) {
      // Fallback to rule-based labeling if no API key
      return this.ruleBasedLabeling(rooms, geometryData);
    }

    try {
      const analyses = await Promise.all(
        rooms.map(room => this.analyzeRoomWithAI(room, rooms, geometryData))
      );
      
      return analyses;
    } catch (error) {
      console.warn('AI labeling failed, falling back to rule-based:', error);
      return this.ruleBasedLabeling(rooms, geometryData);
    }
  }

  private async analyzeRoomWithAI(
    room: Room, 
    allRooms: Room[], 
    geometryData: GeometryData
  ): Promise<RoomAnalysis> {
    const features = this.extractRoomFeatures(room, allRooms, geometryData);
    
    const prompt = this.buildAnalysisPrompt(room, features, allRooms);
    
    const completion = await this.openai!.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert architectural analyst specializing in floor plan analysis. Analyze room characteristics and provide accurate room type identification based on size, location, and architectural features."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content;
    return this.parseAIResponse(room, response || '');
  }

  private extractRoomFeatures(room: Room, allRooms: Room[], geometryData: GeometryData): GeometricFeatures {
    const area = room.area;
    const width = room.maxX - room.minX;
    const height = room.maxY - room.minY;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    const position = {
      x: (room.minX + room.maxX) / 2,
      y: (room.minY + room.maxY) / 2
    };

    // Find adjacent rooms
    const adjacentRooms = allRooms
      .filter(otherRoom => otherRoom.id !== room.id)
      .filter(otherRoom => this.areRoomsAdjacent(room, otherRoom))
      .map(otherRoom => otherRoom.id?.toString() || '')
      .filter(id => id !== '');

    // Detect potential water access (bathroom/kitchen indicators)
    const hasWaterAccess = this.detectWaterAccess(room, geometryData);
    
    // Detect exterior walls
    const hasExteriorWalls = this.detectExteriorWalls(room, allRooms, geometryData);
    
    // Detect if near entrance
    const nearEntrance = this.detectNearEntrance(room, geometryData);

    return {
      area,
      aspectRatio,
      position,
      adjacentRooms,
      hasWaterAccess,
      hasExteriorWalls,
      nearEntrance
    };
  }

  private areRoomsAdjacent(room1: Room, room2: Room): boolean {
    const buffer = 5; // Small buffer for wall thickness
    
    // Check if rooms share a wall
    const horizontalOverlap = !(room1.maxX < room2.minX - buffer || room2.maxX < room1.minX - buffer);
    const verticalOverlap = !(room1.maxY < room2.minY - buffer || room2.maxY < room1.minY - buffer);
    
    const shareVerticalWall = horizontalOverlap && 
      (Math.abs(room1.maxY - room2.minY) < buffer || Math.abs(room2.maxY - room1.minY) < buffer);
    
    const shareHorizontalWall = verticalOverlap && 
      (Math.abs(room1.maxX - room2.minX) < buffer || Math.abs(room2.maxX - room1.minX) < buffer);
    
    return shareVerticalWall || shareHorizontalWall;
  }

  private detectWaterAccess(room: Room, geometryData: GeometryData): boolean {
    // Look for plumbing-related entities or layers
    const waterIndicators = geometryData.entities.filter(entity => {
      if (!entity.layer) return false;
      
      const layer = entity.layer.toLowerCase();
      return layer.includes('plumb') || 
             layer.includes('water') || 
             layer.includes('fixture') ||
             layer.includes('sink') ||
             layer.includes('toilet');
    });
    
    // Check if any water indicators are within this room's bounds
    return waterIndicators.some(entity => {
      const coords = entity.coordinates[0];
      if (!coords || coords.length < 2) return false;
      const [x, y] = coords;
      return x >= room.minX && x <= room.maxX &&
             y >= room.minY && y <= room.maxY;
    });
  }

  private detectExteriorWalls(room: Room, allRooms: Room[], geometryData: GeometryData): boolean {
    // Calculate overall building bounds
    const buildingBounds = {
      minX: Math.min(...allRooms.map(r => r.minX)),
      minY: Math.min(...allRooms.map(r => r.minY)),
      maxX: Math.max(...allRooms.map(r => r.maxX)),
      maxY: Math.max(...allRooms.map(r => r.maxY))
    };
    
    const tolerance = 10; // Allow small tolerance
    
    // Check if room is at building perimeter
    return room.minX <= buildingBounds.minX + tolerance ||
           room.maxX >= buildingBounds.maxX - tolerance ||
           room.minY <= buildingBounds.minY + tolerance ||
           room.maxY >= buildingBounds.maxY - tolerance;
  }

  private detectNearEntrance(room: Room, geometryData: GeometryData): boolean {
    // Look for door entities or openings near this room
    const doors = geometryData.entities.filter(entity => {
      if (!entity.layer) return false;
      const layer = entity.layer.toLowerCase();
      return layer.includes('door') || layer.includes('opening') || layer.includes('entry');
    });
    
    // Check if any doors are at room boundaries
    return doors.some(door => {
      const coords = door.coordinates[0];
      if (!coords || coords.length < 2) return false;
      const [x, y] = coords;
      
      const buffer = 5;
      return (x >= room.minX - buffer && x <= room.maxX + buffer &&
              (Math.abs(y - room.minY) < buffer || Math.abs(y - room.maxY) < buffer)) ||
             (y >= room.minY - buffer && y <= room.maxY + buffer &&
              (Math.abs(x - room.minX) < buffer || Math.abs(x - room.maxX) < buffer));
    });
  }

  private buildAnalysisPrompt(room: Room, features: GeometricFeatures, allRooms: Room[]): string {
    return `
Analyze this room from an architectural floor plan:

ROOM CHARACTERISTICS:
- Area: ${features.area.toFixed(1)} square meters
- Dimensions: ${(room.maxX - room.minX).toFixed(1)} x ${(room.maxY - room.minY).toFixed(1)} meters  
- Aspect Ratio: ${features.aspectRatio.toFixed(2)} (${features.aspectRatio > 2 ? 'elongated' : features.aspectRatio < 1.3 ? 'square' : 'rectangular'})
- Position: Center at (${features.position.x.toFixed(1)}, ${features.position.y.toFixed(1)})

CONTEXTUAL FEATURES:
- Adjacent to ${features.adjacentRooms.length} other rooms
- Has water access indicators: ${features.hasWaterAccess ? 'Yes' : 'No'}
- Has exterior walls: ${features.hasExteriorWalls ? 'Yes' : 'No'}
- Near entrance: ${features.nearEntrance ? 'Yes' : 'No'}

BUILDING CONTEXT:
- Total rooms in floor plan: ${allRooms.length}
- Relative size: ${this.getRelativeSize(room.area, allRooms)} (compared to other rooms)

Based on these characteristics, determine:
1. Most likely room type (bedroom, living_room, kitchen, bathroom, dining_room, office, closet, hallway, etc.)
2. Suggested room name (e.g., "Master Bedroom", "Guest Bathroom", "Main Kitchen")
3. Confidence level (0-100%)
4. Brief reasoning

Respond in this exact JSON format:
{
  "roomType": "bedroom",
  "suggestedName": "Master Bedroom",
  "confidence": 85,
  "reasoning": "Large area with exterior walls suggests master bedroom"
}`;
  }

  private getRelativeSize(area: number, allRooms: Room[]): string {
    const areas = allRooms.map(r => r.area).sort((a, b) => b - a);
    const percentile = areas.indexOf(area) / areas.length;
    
    if (percentile < 0.2) return 'very large';
    if (percentile < 0.4) return 'large';
    if (percentile < 0.6) return 'medium';
    if (percentile < 0.8) return 'small';
    return 'very small';
  }

  private parseAIResponse(room: Room, response: string): RoomAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        roomId: room.id?.toString() || 'unknown',
        suggestedName: parsed.suggestedName || 'Unknown Room',
        roomType: parsed.roomType || 'room',
        confidence: Math.min(Math.max(parsed.confidence || 50, 0), 100),
        reasoning: parsed.reasoning || 'AI analysis'
      };
    } catch (error) {
      console.warn('Failed to parse AI response, using fallback');
      return this.fallbackAnalysis(room);
    }
  }

  private ruleBasedLabeling(rooms: Room[], geometryData: GeometryData): RoomAnalysis[] {
    return rooms.map(room => {
      const features = this.extractRoomFeatures(room, rooms, geometryData);
      
      let roomType = 'room';
      let suggestedName = 'Room';
      let confidence = 70;
      let reasoning = 'Rule-based analysis';

      // Rule-based classification
      if (features.area < 10) {
        if (features.hasWaterAccess) {
          roomType = 'bathroom';
          suggestedName = 'Powder Room';
          reasoning = 'Small area with water access';
        } else {
          roomType = 'closet';
          suggestedName = 'Closet';
          reasoning = 'Very small area';
        }
      } else if (features.area < 20) {
        if (features.hasWaterAccess) {
          roomType = 'bathroom';
          suggestedName = features.hasExteriorWalls ? 'Main Bathroom' : 'Guest Bathroom';
          reasoning = 'Medium area with water access';
        } else if (features.aspectRatio > 3) {
          roomType = 'hallway';
          suggestedName = 'Hallway';
          reasoning = 'Elongated shape suggests corridor';
        } else {
          roomType = 'office';
          suggestedName = 'Office';
          reasoning = 'Small to medium sized room';
        }
      } else if (features.area < 40) {
        if (features.hasWaterAccess) {
          roomType = 'kitchen';
          suggestedName = 'Kitchen';
          reasoning = 'Medium area with water access';
          confidence = 85;
        } else {
          roomType = 'bedroom';
          suggestedName = features.hasExteriorWalls ? 'Bedroom' : 'Guest Bedroom';
          reasoning = 'Medium area suitable for bedroom';
        }
      } else {
        if (features.nearEntrance) {
          roomType = 'living_room';
          suggestedName = 'Living Room';
          reasoning = 'Large area near entrance';
        } else {
          roomType = 'bedroom';
          suggestedName = 'Master Bedroom';
          reasoning = 'Large area suitable for master bedroom';
        }
      }

      return {
        roomId: room.id?.toString() || 'unknown',
        suggestedName,
        roomType,
        confidence,
        reasoning
      };
    });
  }

  private fallbackAnalysis(room: Room): RoomAnalysis {
    const area = room.area;
    let roomType = 'room';
    let suggestedName = 'Room';
    
    if (area < 10) {
      roomType = 'closet';
      suggestedName = 'Small Room';
    } else if (area < 25) {
      roomType = 'bedroom';
      suggestedName = 'Bedroom';
    } else {
      roomType = 'living_room';
      suggestedName = 'Large Room';
    }
    
    return {
      roomId: room.id?.toString() || 'unknown',
      suggestedName,
      roomType,
      confidence: 50,
      reasoning: 'Basic size-based classification'
    };
  }

  async updateRoomLabels(rooms: Room[], analyses: RoomAnalysis[]): Promise<Room[]> {
    return rooms.map(room => {
      const analysis = analyses.find(a => a.roomId === room.id?.toString());
      if (analysis) {
        return {
          ...room,
          name: analysis.suggestedName,
          type: analysis.roomType
        };
      }
      return room;
    });
  }
}