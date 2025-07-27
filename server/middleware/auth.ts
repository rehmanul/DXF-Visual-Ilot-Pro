import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

export const generateToken = (user: { id: string; email: string }) => {
  return jwt.sign(user, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
};