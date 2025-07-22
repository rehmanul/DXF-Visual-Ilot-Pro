import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFloorPlanSchema, insertRoomSchema, insertMeasurementSchema } from "@shared/schema";
import { cadProcessor } from "./services/cadProcessor";
import { roomDetectionService } from "./services/roomDetection";
import { exportService, type ExportOptions } from "./services/exportService";
import { AIRoomLabelingService } from "./services/aiRoomLabeling";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.dxf', '.dwg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only DXF, DWG, and PDF files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Initialize AI service
  const aiLabelingService = new AIRoomLabelingService();

  // Get all floor plans
  app.get("/api/floor-plans", async (req, res) => {
    try {
      const floorPlans = await storage.getFloorPlans();
      res.json(floorPlans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch floor plans" });
    }
  });

  // Get specific floor plan with details
  app.get("/api/floor-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const floorPlan = await storage.getFloorPlan(id);

      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }

      const rooms = await storage.getRoomsByFloorPlan(id);
      const measurements = await storage.getMeasurementsByFloorPlan(id);

      res.json({
        floorPlan,
        rooms,
        measurements
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch floor plan details" });
    }
  });

  // Upload and process CAD file
  app.post("/api/floor-plans/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Create initial floor plan record
      const floorPlan = await storage.createFloorPlan({
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: path.extname(req.file.originalname).toLowerCase().substring(1),
        fileSize: req.file.size,
        status: "processing"
      });

      // Start background processing (non-blocking)
      const io = req.app.get('io');
      processCADFile(floorPlan.id, req.file.path, req.file.originalname, io).catch(error => {
        console.error('Background processing failed:', error);
        storage.updateFloorPlan(floorPlan.id, { 
          status: "error", 
          errorMessage: error.message 
        });
        if (io) {
          io.emit('processing-error', { floorPlanId: floorPlan.id, error: error.message });
        }
      });

      res.json({ floorPlan });
    } catch (error) {
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Get processing status
  app.get("/api/floor-plans/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const floorPlan = await storage.getFloorPlan(id);

      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }

      res.json({
        status: floorPlan.status,
        progress: getProcessingProgress(floorPlan.status),
        errorMessage: floorPlan.errorMessage
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Export floor plan
  app.post("/api/floor-plans/:id/export", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { format, options } = req.body;

      const floorPlan = await storage.getFloorPlan(id);
      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }

      const rooms = await storage.getRoomsByFloorPlan(id);
      const measurements = await storage.getMeasurementsByFloorPlan(id);

      let buffer: Buffer;
      let mimeType: string;
      let filename: string;

      switch (format) {
        case 'pdf':
          buffer = await exportService.exportToPDF(floorPlan, rooms, measurements, options);
          mimeType = 'application/pdf';
          filename = `${floorPlan.originalName.split('.')[0]}_analysis.pdf`;
          break;

        case 'excel':
          buffer = await exportService.exportToExcel(floorPlan, rooms, measurements);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          filename = `${floorPlan.originalName.split('.')[0]}_data.xlsx`;
          break;

        case 'cad':
          buffer = await exportService.exportToCAD(floorPlan, floorPlan.geometryData);
          mimeType = 'application/dxf';
          filename = `${floorPlan.originalName.split('.')[0]}_processed.dxf`;
          break;

        case 'png':
          if (!req.body.canvasData) {
            return res.status(400).json({ error: "Canvas data required for PNG export" });
          }
          buffer = await exportService.exportToPNG(floorPlan, req.body.canvasData, options);
          mimeType = 'image/png';
          filename = `${floorPlan.originalName.split('.')[0]}_floorplan.png`;
          break;

        default:
          return res.status(400).json({ error: "Invalid export format" });
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  // AI room labeling
  app.post("/api/floor-plans/:id/ai-label", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Get floor plan and rooms
      const floorPlan = await storage.getFloorPlan(id);
      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }

      const rooms = await storage.getRoomsByFloorPlan(id);

      if (!floorPlan.geometryData || Object.keys(floorPlan.geometryData).length === 0) {
        return res.status(400).json({ error: "No geometry data available for AI analysis" });
      }

      // Run AI analysis
      const roomAnalyses = await aiLabelingService.labelRooms(rooms, floorPlan.geometryData as any);

      // Update room labels based on AI analysis
      const updatedRooms = await aiLabelingService.updateRoomLabels(rooms, roomAnalyses);

      // Update rooms in storage (if we had update functionality)
      // For now, just return the analysis results

      res.json({ 
        success: true,
        analyses: roomAnalyses,
        updatedRooms: updatedRooms.length
      });
    } catch (error) {
      console.error('AI labeling error:', error);
      res.status(500).json({ error: "AI labeling failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processCADFile(floorPlanId: number, filePath: string, originalName: string, io: any): Promise<void> {
  try {
    // Update status to processing
    await storage.updateFloorPlan(floorPlanId, { status: "processing" });

    // Determine file type and process accordingly
    const ext = path.extname(originalName).toLowerCase();
    let geometryData;

    switch (ext) {
      case '.dxf':
        geometryData = await cadProcessor.processDXF(filePath);
        break;
      case '.dwg':
        geometryData = await cadProcessor.processDWG(filePath);
        break;
      case '.pdf':
        geometryData = await cadProcessor.processPDF(filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Detect rooms
    const roomDetection = await roomDetectionService.detectRooms(geometryData);

    // Extract measurements
    const measurements = await cadProcessor.extractMeasurements(geometryData);

    // Count architectural elements
    const elements = cadProcessor.countArchitecturalElements(geometryData);

    // Calculate totals
    const totalArea = roomDetection.totalArea;
    const perimeter = measurements.find(m => m.type === 'perimeter')?.value || 0;

    // Update floor plan with extracted data
    await storage.updateFloorPlan(floorPlanId, {
      status: "completed",
      processedAt: new Date(),
      totalArea,
      perimeter,
      wallThickness: 0.2, // Default
      ceilingHeight: 2.7, // Default
      layers: new Set(geometryData.entities.map(e => e.layer)).size,
      geometricObjects: geometryData.entities.length,
      doors: elements.doors,
      windows: elements.windows,
      stairs: elements.stairs,
      columns: elements.columns,
      geometryData,
      roomsData: roomDetection,
      measurementsData: measurements
    });

    // Create room records
    for (const room of roomDetection.rooms) {
      await storage.createRoom({
        floorPlanId,
        name: room.name,
        type: room.type,
        area: room.area,
        width: room.dimensions.width,
        height: room.dimensions.height,
        shape: room.shape,
        color: room.color,
        minX: room.bounds.minX,
        minY: room.bounds.minY,
        maxX: room.bounds.maxX,
        maxY: room.bounds.maxY,
        boundaries: room.boundaries
      });
    }

    // Create measurement records
    for (const measurement of measurements) {
      await storage.createMeasurement({
        floorPlanId,
        type: measurement.type,
        value: measurement.value,
        unit: measurement.unit,
        startX: measurement.startX,
        startY: measurement.startY,
        endX: measurement.endX,
        endY: measurement.endY,
        label: measurement.label
      });
    }

    // Clean up uploaded file
    await fs.unlink(filePath);

  } catch (error) {
    // Update status to error
    await storage.updateFloorPlan(floorPlanId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });

    // Clean up uploaded file on error
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error("Failed to cleanup file:", cleanupError);
    }

    throw error;
  }
}

function getProcessingProgress(status: string): number {
  switch (status) {
    case "uploading": return 10;
    case "processing": return 50;
    case "completed": return 100;
    case "error": return 0;
    default: return 0;
  }
}