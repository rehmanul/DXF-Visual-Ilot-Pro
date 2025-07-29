import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFloorPlanSchema, insertRoomSchema, insertMeasurementSchema } from "@shared/schema";
import { cadProcessor } from "./services/cadProcessor";
import { roomDetectionService } from "./services/roomDetection";
import { exportService, type ExportOptions } from "./services/exportService";
import { AIRoomLabelingService } from "./services/aiRoomLabeling";
import { ilotPlacementService } from "./services/ilotPlacement";
import apiRoutes from "./routes/api";
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
    const allowedTypes = ['.dxf', '.dwg', '.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only DXF, DWG, PDF, and image files (JPG, PNG) are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Register API routes
  app.use('/api', apiRoutes);

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

      const geometryData = floorPlan.geometryData || { entities: [], bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, scale: 1, units: 'm', layers: [], blocks: {} };
      const result = await exportService.exportFloorPlan(
        { ilots: [], corridors: [], zones: [], totalUsableArea: 0, totalIlotArea: 0, totalCorridorArea: 0, efficiencyRatio: 0 },
        geometryData as any,
        { format: format as any }
      );
      
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      
      const fs = await import('fs');
      buffer = fs.readFileSync(result.filePath!);
      mimeType = format === 'pdf' ? 'application/pdf' : format === 'png' ? 'image/png' : 'application/octet-stream';
      filename = result.fileName!;

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

  // Generate îlot placement and corridor network
  app.post("/api/floor-plans/:id/generate-ilots", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { corridorWidth = 1.2, targetDensity = 0.6 } = req.body;

      const floorPlan = await storage.getFloorPlan(id);
      if (!floorPlan) {
        return res.status(404).json({ error: "Floor plan not found" });
      }

      if (!floorPlan.geometryData) {
        return res.status(400).json({ error: "No geometry data available for îlot placement" });
      }

      // Generate îlot layout
      const layout = await ilotPlacementService.generateFloorPlanLayout(
        floorPlan.geometryData as any,
        corridorWidth,
        targetDensity
      );

      // Update floor plan with îlot data
      await storage.updateFloorPlan(id, {
        ilotLayout: layout,
        totalIlots: layout.ilots.length,
        totalCorridors: layout.corridors.length,
        spaceEfficiency: layout.efficiencyRatio
      });

      res.json({
        success: true,
        layout,
        summary: {
          totalIlots: layout.ilots.length,
          totalCorridors: layout.corridors.length,
          totalUsableArea: layout.totalUsableArea,
          totalIlotArea: layout.totalIlotArea,
          totalCorridorArea: layout.totalCorridorArea,
          efficiencyRatio: layout.efficiencyRatio
        }
      });
    } catch (error) {
      console.error('Îlot placement error:', error);
      res.status(500).json({ error: "Îlot placement generation failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processCADFile(floorPlanId: number, filePath: string, originalName: string, io: any) {
console.log("processCADFile called");
  const startTime = Date.now();

  try {
    console.log(`[Processing] Starting CAD file processing for plan ${floorPlanId}: ${originalName}`);

    // Update status to processing
    await storage.updateFloorPlan(floorPlanId, { 
      status: "processing",
      processedAt: new Date()
    });

    if (io) {
      io.emit('processing-update', { floorPlanId, status: 'processing', progress: 10, message: 'Starting file processing...' });
    }

    // Determine file type
    const ext = path.extname(originalName).toLowerCase();
    console.log(`[Processing] File type detected: ${ext}`);

    // Get file size for timeout estimation
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`[Processing] File size: ${fileSizeMB.toFixed(2)} MB`);

    if (io) {
      io.emit('processing-update', { 
        floorPlanId, 
        status: 'processing', 
        progress: 20, 
        message: `Processing ${ext.toUpperCase()} file (${fileSizeMB.toFixed(1)} MB)...` 
      });
    }

    // Process the CAD file
    let geometryData;


    switch (ext) {
      case '.dxf':
        if (io) {
          io.emit('processing-update', { floorPlanId, status: 'processing', progress: 30, message: 'Parsing DXF entities...' });
        }
        geometryData = await cadProcessor.processCADFile(filePath, 'application/dxf');
        break;
      case '.dwg':
        if (io) {
          io.emit('processing-update', { floorPlanId, status: 'processing', progress: 30, message: 'Parsing DWG file...' });
        }
        geometryData = await cadProcessor.processCADFile(filePath, 'application/dwg');
        break;
      case '.pdf':
        if (io) {
          io.emit('processing-update', { floorPlanId, status: 'processing', progress: 30, message: 'Converting PDF and extracting geometry...' });
        }
        geometryData = await cadProcessor.processCADFile(filePath, 'application/pdf');
        break;
      case '.jpg':
      case '.jpeg':
      case '.png':
        if (io) {
          io.emit('processing-update', { floorPlanId, status: 'processing', progress: 30, message: 'Processing image and extracting floor plan...' });
        }
        geometryData = await cadProcessor.processImage(filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Detect rooms
    const roomDetection = await roomDetectionService.detectRooms(geometryData);

    // Extract measurements
    const measurements: any[] = [];

    // Count architectural elements
      const elements = { doors: 0, windows: 0, stairs: 0, columns: 0 };

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
      layers: new Set(geometryData.entities.map((e: any) => e.layer)).size,
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
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (cleanupError) {
      // File doesn't exist or already deleted, ignore
    }

  } catch (error) {
    // Update status to error
    await storage.updateFloorPlan(floorPlanId, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    });

    // Clean up uploaded file on error
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (cleanupError) {
      // File doesn't exist or already deleted, ignore
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
