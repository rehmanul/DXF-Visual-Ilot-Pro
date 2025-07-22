import { pgTable, text, serial, integer, real, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const floorPlans = pgTable("floor_plans", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(), // 'dxf', 'dwg', 'pdf'
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("uploading"), // 'uploading', 'processing', 'completed', 'error'
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  
  // Extracted data
  totalArea: real("total_area"),
  perimeter: real("perimeter"),
  wallThickness: real("wall_thickness"),
  ceilingHeight: real("ceiling_height"),
  
  // Geometric data
  layers: integer("layers"),
  geometricObjects: integer("geometric_objects"),
  
  // Architectural elements
  doors: integer("doors"),
  windows: integer("windows"),
  stairs: integer("stairs"),
  columns: integer("columns"),
  
  // Processed data as JSON
  geometryData: jsonb("geometry_data"), // Raw geometric data from CAD file
  roomsData: jsonb("rooms_data"), // Room detection results
  measurementsData: jsonb("measurements_data"), // Extracted measurements
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  floorPlanId: integer("floor_plan_id").notNull().references(() => floorPlans.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'living_room', 'kitchen', 'bedroom', 'bathroom', etc.
  area: real("area").notNull(),
  width: real("width"),
  height: real("height"),
  shape: text("shape"), // 'rectangular', 'l_shaped', 'irregular', etc.
  color: text("color").notNull(), // Hex color for visualization
  
  // Geometric bounds
  minX: real("min_x").notNull(),
  minY: real("min_y").notNull(),
  maxX: real("max_x").notNull(),
  maxY: real("max_y").notNull(),
  
  // Additional data
  boundaries: jsonb("boundaries"), // Detailed boundary coordinates
});

export const measurements = pgTable("measurements", {
  id: serial("id").primaryKey(),
  floorPlanId: integer("floor_plan_id").notNull().references(() => floorPlans.id),
  type: text("type").notNull(), // 'dimension', 'area', 'perimeter', etc.
  value: real("value").notNull(),
  unit: text("unit").notNull().default("m"),
  startX: real("start_x"),
  startY: real("start_y"),
  endX: real("end_x"),
  endY: real("end_y"),
  label: text("label"),
  annotations: jsonb("annotations"),
});

export const insertFloorPlanSchema = createInsertSchema(floorPlans).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
});

export const insertMeasurementSchema = createInsertSchema(measurements).omit({
  id: true,
});

export type InsertFloorPlan = z.infer<typeof insertFloorPlanSchema>;
export type FloorPlan = typeof floorPlans.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurements.$inferSelect;

// Analysis result types
export type GeometryData = {
  entities: Array<{
    type: string;
    layer: string;
    coordinates: number[][];
    properties: Record<string, any>;
  }>;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  scale: number;
  units: string;
};

export type RoomDetectionResult = {
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    area: number;
    dimensions: { width: number; height: number };
    shape: string;
    color: string;
    boundaries: number[][];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  }>;
  totalArea: number;
  confidence: number;
};

export type ProcessingResult = {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
  geometryData: GeometryData;
};
