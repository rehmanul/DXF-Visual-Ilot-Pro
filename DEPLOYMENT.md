# Deployment Guide - DXF Visual Ilot Pro

## Deploy to Render.com

### Prerequisites
1. GitHub account
2. Render.com account

### Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy DXF Visual Ilot Pro with 1.2m corridor system"
   git push origin main
   ```

2. **Connect to Render.com**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure Service**
   - Name: `dxf-visual-ilot-pro`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Auto-deploy: `Yes`

4. **Add Database**
   - Go to Dashboard → "New +" → "PostgreSQL"
   - Name: `dxf-visual-ilot-pro-db`
   - Copy the DATABASE_URL

5. **Set Environment Variables**
   - Add `DATABASE_URL` from step 4
   - Add `NODE_ENV=production`
   - Add `PORT=10000`

6. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)

### Features Deployed
✅ **1.2m Default Corridor Width**
✅ **Mandatory Corridors Between Facing Rows**  
✅ **No Overlaps Between Îlots and Corridors**
✅ **Full Connectivity of All Îlots**
✅ **Professional CAD File Processing**
✅ **Real-time Layout Generation**
✅ **Interactive Visualization**

### URL
Your app will be available at: `https://dxf-visual-ilot-pro.onrender.com`

### Testing the Corridor System
1. Upload a DXF/CAD file
2. Click "Generate Îlots & Corridors"
3. Verify 1.2m corridor width in the layout summary
4. Check that corridors connect all facing rows
5. Confirm no overlaps in the visualization