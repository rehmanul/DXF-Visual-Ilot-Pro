import { floorPlans, rooms, measurements, type FloorPlan, type InsertFloorPlan, type Room, type InsertRoom, type Measurement, type InsertMeasurement } from "@shared/schema";

export interface IStorage {
  // Floor plans
  createFloorPlan(floorPlan: InsertFloorPlan): Promise<FloorPlan>;
  getFloorPlan(id: number): Promise<FloorPlan | undefined>;
  updateFloorPlan(id: number, updates: Partial<FloorPlan>): Promise<FloorPlan | undefined>;
  getFloorPlans(): Promise<FloorPlan[]>;
  
  // Rooms
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomsByFloorPlan(floorPlanId: number): Promise<Room[]>;
  
  // Measurements
  createMeasurement(measurement: InsertMeasurement): Promise<Measurement>;
  getMeasurementsByFloorPlan(floorPlanId: number): Promise<Measurement[]>;
}

export class MemStorage implements IStorage {
  private floorPlans: Map<number, FloorPlan>;
  private rooms: Map<number, Room>;
  private measurements: Map<number, Measurement>;
  private currentFloorPlanId: number;
  private currentRoomId: number;
  private currentMeasurementId: number;

  constructor() {
    this.floorPlans = new Map();
    this.rooms = new Map();
    this.measurements = new Map();
    this.currentFloorPlanId = 1;
    this.currentRoomId = 1;
    this.currentMeasurementId = 1;
  }

  async createFloorPlan(insertFloorPlan: InsertFloorPlan): Promise<FloorPlan> {
    const id = this.currentFloorPlanId++;
    const floorPlan: FloorPlan = {
      ...insertFloorPlan,
      id,
      uploadedAt: new Date(),
      processedAt: null,
    };
    this.floorPlans.set(id, floorPlan);
    return floorPlan;
  }

  async getFloorPlan(id: number): Promise<FloorPlan | undefined> {
    return this.floorPlans.get(id);
  }

  async updateFloorPlan(id: number, updates: Partial<FloorPlan>): Promise<FloorPlan | undefined> {
    const existing = this.floorPlans.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.floorPlans.set(id, updated);
    return updated;
  }

  async getFloorPlans(): Promise<FloorPlan[]> {
    return Array.from(this.floorPlans.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = this.currentRoomId++;
    const room: Room = {
      ...insertRoom,
      id,
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoomsByFloorPlan(floorPlanId: number): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter(room => room.floorPlanId === floorPlanId);
  }

  async createMeasurement(insertMeasurement: InsertMeasurement): Promise<Measurement> {
    const id = this.currentMeasurementId++;
    const measurement: Measurement = {
      ...insertMeasurement,
      id,
    };
    this.measurements.set(id, measurement);
    return measurement;
  }

  async getMeasurementsByFloorPlan(floorPlanId: number): Promise<Measurement[]> {
    return Array.from(this.measurements.values()).filter(measurement => measurement.floorPlanId === floorPlanId);
  }
}

export const storage = new MemStorage();
