// Mock database for development/testing when PostgreSQL is not available
import { FloorPlan, Room, Measurement, GeometryData } from '../shared/schema.js';

let mockFloorPlans: FloorPlan[] = [];
let mockRooms: Room[] = [];
let mockMeasurements: Measurement[] = [];
let nextId = 1;

export const mockDb = {
  insert: (table: any) => ({
    values: (data: any) => ({
      returning: () => {
        const newFloorPlan: FloorPlan = {
          id: nextId++,
          uploadedAt: new Date(),
          processedAt: null,
          totalArea: null,
          perimeter: null,
          wallThickness: null,
          ceilingHeight: null,
          layers: null,
          geometricObjects: null,
          doors: null,
          windows: null,
          stairs: null,
          columns: null,
          geometryData: null,
          roomsData: null,
          measurementsData: null,
          ilotLayout: null,
          totalIlots: null,
          totalCorridors: null,
          spaceEfficiency: null,
          errorMessage: null,
          ...data
        };
        mockFloorPlans.push(newFloorPlan);
        return [newFloorPlan];
      }
    })
  }),
  
  select: () => ({
    from: (table: any) => ({
      where: (condition: any) => {
        return mockFloorPlans.length > 0 ? [mockFloorPlans[0]] : [];
      }
    })
  }),
  
  update: (table: any) => ({
    set: (updateData: any) => ({
      where: (condition: any) => {
        if (mockFloorPlans.length > 0) {
          Object.assign(mockFloorPlans[0], updateData);
        }
        return mockFloorPlans.slice(0, 1);
      }
    })
  }),
  
  floorPlans: {
    insert: (data: any) => {
      const newFloorPlan: FloorPlan = {
        id: nextId++,
        uploadedAt: new Date(),
        processedAt: null,
        ...data
      };
      mockFloorPlans.push(newFloorPlan);
      return { returning: () => [newFloorPlan] };
    },
    
    select: () => ({
      from: () => ({
        where: (condition: any) => {
          // Simple mock - return first floor plan
          return mockFloorPlans.length > 0 ? [mockFloorPlans[0]] : [];
        }
      })
    }),
    
    update: (data: any) => ({
      set: (updateData: any) => ({
        where: (condition: any) => {
          if (mockFloorPlans.length > 0) {
            Object.assign(mockFloorPlans[0], updateData);
          }
          return mockFloorPlans.slice(0, 1);
        }
      })
    })
  },
  
  rooms: {
    insert: (data: any) => {
      const newRoom: Room = {
        id: nextId++,
        ...data
      };
      mockRooms.push(newRoom);
      return { returning: () => [newRoom] };
    }
  },
  
  measurements: {
    insert: (data: any) => {
      const newMeasurement: Measurement = {
        id: nextId++,
        ...data
      };
      mockMeasurements.push(newMeasurement);
      return { returning: () => [newMeasurement] };
    }
  }
};

export const connectMockDB = () => {
  console.log('✅ Mock database initialized');
  return true;
};
