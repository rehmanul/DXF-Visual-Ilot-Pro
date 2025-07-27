import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const allowedTypes = ['application/dxf', 'application/dwg', 'application/pdf', 'image/png', 'image/jpeg'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (!allowedTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(dxf|dwg|pdf)$/i)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({ error: 'File too large' });
  }

  next();
};

export const validateCorridorWidth = (req: Request, res: Response, next: NextFunction) => {
  const schema = z.object({
    corridorWidth: z.number().min(0.8).max(3.0).optional().default(1.2)
  });

  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid corridor width' });
  }
};