# Render Deployment Guide

## Prerequisites
- GitHub repository: https://github.com/rehmanul/DXF-Visual-Ilot-Pro.git
- Render account

## Deployment Steps

### 1. Create PostgreSQL Database
1. Go to Render Dashboard
2. Click "New" → "PostgreSQL"
3. Configure:
   - Name: `dxf-visual-ilot-pro-db`
   - Database Name: `dwg_analyzer_pro`
   - User: `dxf_user`
   - Region: Choose closest to your users
4. Click "Create Database"
5. Note the connection details (will be auto-configured)

### 2. Deploy Web Service
1. Go to Render Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository: `rehmanul/DXF-Visual-Ilot-Pro`
4. Configure:
   - Name: `dxf-visual-ilot-pro`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance Type: Choose based on needs (Starter for testing)

### 3. Environment Variables
Render will automatically set:
- `DATABASE_URL` (from the PostgreSQL service)
- `NODE_ENV=production`

### 4. Database Initialization
After deployment, the database will be automatically initialized with the schema from `drizzle/0001_initial.sql`.

## Features Included
- ✅ CAD file processing (DXF, DWG, PDF)
- ✅ Îlot placement with configurable density
- ✅ Automatic corridor generation
- ✅ Professional visualization
- ✅ Export functionality
- ✅ Responsive design

## Post-Deployment
1. Test file upload functionality
2. Verify database connections
3. Check corridor generation
4. Test export features

## Monitoring
- Check Render logs for any issues
- Monitor database performance
- Set up alerts if needed

## Support
For issues, check:
1. Render deployment logs
2. Database connection status
3. Environment variables configuration