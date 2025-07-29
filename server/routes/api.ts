import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ilotPlacementService } from '../services/ilotPlacement';
import { cadProcessor } from '../services/cadProcessor';
import { exportService } from '../services/exportService';
import { validateFileUpload, validateCorridorWidth } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../db';
import { floorPlans } from '@shared/schema';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/extract-base-plan', upload.single('file'), validateFileUpload, asyncHandler(async (req: Request, res: Response) => {
  const file = req.file!;

  const [floorPlan] = await db.insert(floorPlans).values({
    filename: file.filename,
    originalName: file.originalname,
    fileType: file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
    fileSize: file.size,
    status: 'processing'
  }).returning();

  try {
    const basePlanData = await cadProcessor.processCADFile(file.path, file.mimetype, 'base');

    await db.update(floorPlans)
      .set({
        status: 'processed',
        geometryData: basePlanData,
        processedAt: new Date()
      })
      .where(floorPlans.id, floorPlan.id);

    res.json({ success: true, floorPlanId: floorPlan.id, basePlanData });
  } catch (error) {
    await db.update(floorPlans)
      .set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Processing failed'
      })
      .where(floorPlans.id, floorPlan.id);

    throw error;
  }
}));

router.post('/generate-layout/:id', validateCorridorWidth, asyncHandler(async (req: Request, res: Response) => {
  const floorPlanId = parseInt(req.params.id);
  const { corridorWidth = 1.2, targetDensity = 0.6 } = req.body;

  const [floorPlan] = await db.select().from(floorPlans).where(floorPlans.id, floorPlanId);

  if (!floorPlan || !floorPlan.geometryData) {
    return res.status(404).json({ error: 'Floor plan not found or not processed' });
  }

  const layout = await ilotPlacementService.generateFloorPlanLayout(
    floorPlan.geometryData as any,
    corridorWidth,
    targetDensity
  );

  await db.update(floorPlans)
    .set({
      ilotLayout: layout,
      totalIlots: layout.ilots.length,
      totalCorridors: layout.corridors.length,
      spaceEfficiency: layout.efficiencyRatio
    })
    .where(floorPlans.id, floorPlanId);

  res.json({ success: true, layout });
}));

router.post('/export/:id', asyncHandler(async (req: Request, res: Response) => {
  const floorPlanId = parseInt(req.params.id);
  const exportOptions = req.body;

  const [floorPlan] = await db.select().from(floorPlans).where(floorPlans.id, floorPlanId);

  if (!floorPlan || !floorPlan.ilotLayout) {
    return res.status(404).json({ error: 'Floor plan layout not found' });
  }

  const result = await exportService.exportFloorPlan(
    floorPlan.ilotLayout as any,
    floorPlan.geometryData as any,
    exportOptions
  );

  res.json(result);
}));
