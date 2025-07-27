import { corridorGenerator } from '../server/services/corridorGenerator';
import { corridorOptimizer } from '../server/services/corridorOptimizer';
import { Ilot, ZoneType } from '../server/services/ilotPlacement';

describe('Corridor Generator', () => {
  // Sample test data
  const ilots: Ilot[] = [
    {
      id: 'ilot_1',
      x: 1,
      y: 1,
      width: 1.5,
      height: 1,
      area: 1.5,
      type: 'small',
      color: '#FED7D7',
      label: '1.50m²'
    },
    {
      id: 'ilot_2',
      x: 3,
      y: 1,
      width: 1.5,
      height: 1,
      area: 1.5,
      type: 'small',
      color: '#FED7D7',
      label: '1.50m²'
    },
    {
      id: 'ilot_3',
      x: 1,
      y: 3,
      width: 1.5,
      height: 1,
      area: 1.5,
      type: 'small',
      color: '#FED7D7',
      label: '1.50m²'
    },
    {
      id: 'ilot_4',
      x: 3,
      y: 3,
      width: 1.5,
      height: 1,
      area: 1.5,
      type: 'small',
      color: '#FED7D7',
      label: '1.50m²'
    }
  ];

  const zones: ZoneType[] = [
    {
      type: 'wall',
      color: '#6B7280',
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 6,
        maxY: 0.2,
        width: 6,
        height: 0.2
      }
    },
    {
      type: 'wall',
      color: '#6B7280',
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 0.2,
        maxY: 5,
        width: 0.2,
        height: 5
      }
    },
    {
      type: 'wall',
      color: '#6B7280',
      bounds: {
        minX: 0,
        minY: 4.8,
        maxX: 6,
        maxY: 5,
        width: 6,
        height: 0.2
      }
    },
    {
      type: 'wall',
      color: '#6B7280',
      bounds: {
        minX: 5.8,
        minY: 0,
        maxX: 6,
        maxY: 5,
        width: 0.2,
        height: 5
      }
    },
    {
      type: 'restricted',
      color: '#3B82F6',
      bounds: {
        minX: 5,
        minY: 0.2,
        maxX: 5.8,
        maxY: 1,
        width: 0.8,
        height: 0.8
      }
    },
    {
      type: 'entrance',
      color: '#EF4444',
      bounds: {
        minX: 2.5,
        minY: 0.2,
        maxX: 3.5,
        maxY: 0.5,
        width: 1,
        height: 0.3
      }
    }
  ];

  test('should generate corridors between facing rows of îlots', () => {
    const corridors = corridorGenerator.generateCorridorNetwork(ilots, zones);
    
    // Should generate at least one corridor
    expect(corridors.length).toBeGreaterThan(0);
    
    // Corridors should connect îlots
    const connectedIlots = new Set(corridors.flatMap(c => c.connectedIlots));
    expect(connectedIlots.size).toBeGreaterThan(0);
    
    // Corridors should have the default width
    expect(corridors[0].width).toBe(1.2);
  });

  test('should generate corridors with custom width', () => {
    const customWidth = 1.5;
    const corridors = corridorGenerator.generateCorridorNetwork(ilots, zones, customWidth);
    
    // Corridors should have the custom width
    expect(corridors[0].width).toBe(customWidth);
  });

  test('should optimize corridor network', () => {
    const corridors = corridorGenerator.generateCorridorNetwork(ilots, zones);
    const optimizedCorridors = corridorOptimizer.optimizeCorridorNetwork(corridors, ilots);
    
    // Should not increase the number of corridors
    expect(optimizedCorridors.length).toBeLessThanOrEqual(corridors.length);
  });
});