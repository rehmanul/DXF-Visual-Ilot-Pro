export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function calculateArea(points: Array<[number, number]>): number {
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  
  return Math.abs(area) / 2;
}

export function calculatePerimeter(points: Array<[number, number]>): number {
  let perimeter = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += calculateDistance(points[i][0], points[i][1], points[j][0], points[j][1]);
  }
  
  return perimeter;
}

export function formatMeasurement(value: number, unit: string): string {
  if (unit === 'm²' || unit === 'sq m') {
    return `${value.toFixed(1)} m²`;
  } else if (unit === 'm' || unit === 'meters') {
    return `${value.toFixed(2)} m`;
  } else {
    return `${value.toFixed(2)} ${unit}`;
  }
}

export function convertUnits(value: number, fromUnit: string, toUnit: string): number {
  // Convert to meters first
  let meters = value;
  switch (fromUnit.toLowerCase()) {
    case 'mm': meters = value / 1000; break;
    case 'cm': meters = value / 100; break;
    case 'in': meters = value * 0.0254; break;
    case 'ft': meters = value * 0.3048; break;
    case 'm': meters = value; break;
    default: meters = value;
  }
  
  // Convert from meters to target unit
  switch (toUnit.toLowerCase()) {
    case 'mm': return meters * 1000;
    case 'cm': return meters * 100;
    case 'in': return meters / 0.0254;
    case 'ft': return meters / 0.3048;
    case 'm': return meters;
    default: return meters;
  }
}

export function scaleCoordinates(
  coordinates: Array<[number, number]>, 
  scale: number, 
  offsetX: number = 0, 
  offsetY: number = 0
): Array<[number, number]> {
  return coordinates.map(([x, y]) => [
    (x * scale) + offsetX,
    (y * scale) + offsetY
  ]);
}

export function normalizeCoordinates(
  coordinates: Array<[number, number]>
): {
  normalized: Array<[number, number]>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
} {
  if (coordinates.length === 0) {
    return {
      normalized: [],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  coordinates.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });

  const normalized = coordinates.map(([x, y]) => [x - minX, y - minY] as [number, number]);
  
  return {
    normalized,
    bounds: { minX, minY, maxX, maxY }
  };
}
