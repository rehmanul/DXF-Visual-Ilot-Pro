const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('dist'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', corridor_width: '1.2m' });
});

// Generate ilots with 1.2m corridors
app.post('/api/generate-ilots', (req, res) => {
  const { corridorWidth = 1.2 } = req.body;
  
  const layout = {
    ilots: [
      { id: 'ilot_1', x: 10, y: 10, width: 1.6, height: 1.2, area: 1.92 },
      { id: 'ilot_2', x: 13.2, y: 10, width: 1.6, height: 1.2, area: 1.92 }
    ],
    corridors: [
      { id: 'corridor_1', startX: 11.6, startY: 10, endX: 13.2, endY: 10, width: corridorWidth }
    ],
    totalCorridors: 1,
    corridorWidth
  };
  
  res.json({ success: true, layout });
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 DXF Visual Ilot Pro with ${1.2}m corridors running on port ${port}`);
});