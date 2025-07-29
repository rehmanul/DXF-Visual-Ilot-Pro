import { Ilot, Corridor, ZoneType, Rectangle } from './ilotPlacement.js';
import { corridorOptimizer } from './corridorOptimizer.js';

export class CorridorGenerator {
  private readonly DEFAULT_CORRIDOR_WIDTH = 1.2; // 1.2m default width as specified in requirements

  /**
   * Generate corridors between facing rows of îlots
   * @param ilots Array of placed îlots
   * @param zones Array of zones (walls, restricted areas, entrances)
   * @param corridorWidth Width of corridors in meters (default: 1.2m)
   * @returns Array of generated corridors
   */
  generateCorridorNetwork(
    ilots: Ilot[],
    zones: ZoneType[],
    corridorWidth: number = this.DEFAULT_CORRIDOR_WIDTH
  ): Corridor[] {
    if (!ilots || ilots.length === 0) return [];
    
    const corridors: Corridor[] = [];
    
    // Step 1: Group îlots by spatial proximity for realistic layouts
    const ilotGroups = this.groupIlotsByProximity(ilots);
    
    // Step 2: For each group, organize îlots into facing rows
    for (const group of ilotGroups) {
      const rows = this.organizeIlotsIntoRows(group);
      
      // Step 3: Create mandatory corridors between facing rows
      for (let i = 0; i < rows.length - 1; i++) {
        const currentRow = rows[i];
        const nextRow = rows[i + 1];
        
        if (this.areRowsFacing(currentRow, nextRow)) {
          const corridor = this.createCorridorBetweenRows(
            currentRow,
            nextRow,
            corridorWidth,
            zones
          );
          
          if (corridor && this.validateCorridorPlacement(corridor, ilots, zones)) {
            corridors.push(corridor);
          }
        }
      }
      
      // Step 4: Create perpendicular corridors for access
      const accessCorridors = this.createAccessCorridors(rows, corridorWidth, zones, ilots);
      corridors.push(...accessCorridors);
    }

    // Step 5: Connect isolated îlots to ensure full connectivity
    const connectedIlots = new Set(
      corridors.flatMap(c => c.connectedIlots)
    );
    
    const isolatedIlots = ilots.filter(ilot => !connectedIlots.has(ilot.id));
    
    for (const isolated of isolatedIlots) {
      const connectionCorridor = this.findBestConnection(
        isolated,
        corridors,
        ilots,
        corridorWidth,
        zones
      );
      
      if (connectionCorridor && this.validateCorridorPlacement(connectionCorridor, ilots, zones)) {
        corridors.push(connectionCorridor);
      }
    }

    // Step 6: Optimize the corridor network for efficiency
    return corridorOptimizer.optimizeCorridorNetwork(corridors, ilots);
  }

  /**
   * Group îlots based on actual spatial relationships and geometry
   */
  private groupIlotsByProximity(ilots: Ilot[]): Ilot[][] {
    const groups: Ilot[][] = [];
    const visited = new Set<string>();
    
    // Calculate unique grouping distance based on îlot distribution
    const bounds = this.calculateIlotBounds(ilots);
    const avgIlotSize = ilots.reduce((sum, i) => sum + (i.width + i.height) / 2, 0) / ilots.length;
    const groupingDistance = avgIlotSize * 2.5 + (bounds.width + bounds.height) * 0.01;
    
    for (const ilot of ilots) {
      if (visited.has(ilot.id)) continue;
      
      const group = [ilot];
      visited.add(ilot.id);
      
      // Find nearby îlots using calculated distance
      for (const other of ilots) {
        if (visited.has(other.id)) continue;
        
        const distance = Math.sqrt(
          Math.pow(ilot.x - other.x, 2) + Math.pow(ilot.y - other.y, 2)
        );
        
        if (distance <= groupingDistance) {
          group.push(other);
          visited.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
  
  private calculateIlotBounds(ilots: Ilot[]): Rectangle {
    if (ilots.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    
    const minX = Math.min(...ilots.map(i => i.x));
    const minY = Math.min(...ilots.map(i => i.y));
    const maxX = Math.max(...ilots.map(i => i.x + i.width));
    const maxY = Math.max(...ilots.map(i => i.y + i.height));
    
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Organize îlots into rows based on actual spatial distribution
   */
  private organizeIlotsIntoRows(ilots: Ilot[]): Ilot[][] {
    if (ilots.length === 0) return [];
    
    // Calculate dynamic tolerance based on îlot sizes and distribution
    const avgHeight = ilots.reduce((sum, i) => sum + i.height, 0) / ilots.length;
    const tolerance = avgHeight * 0.8; // Adaptive tolerance
    const rows: Ilot[][] = [];
    
    const sortedByY = [...ilots].sort((a, b) => a.y - b.y);
    
    for (const ilot of sortedByY) {
      let addedToRow = false;
      
      for (const row of rows) {
        const avgY = row.reduce((sum, i) => sum + i.y, 0) / row.length;
        if (Math.abs(ilot.y - avgY) <= tolerance) {
          row.push(ilot);
          addedToRow = true;
          break;
        }
      }
      
      if (!addedToRow) {
        rows.push([ilot]);
      }
    }
    
    // Sort each row by X coordinate and filter out single-îlot rows if multiple rows exist
    rows.forEach(row => row.sort((a, b) => a.x - b.x));
    
    return rows.length > 1 ? rows.filter(row => row.length > 1 || rows.length <= 2) : rows;
  }

  /**
   * Check if two rows of îlots are facing each other
   */
  private areRowsFacing(row1: Ilot[], row2: Ilot[]): boolean {
    if (!row1.length || !row2.length) return false;
    
    const bounds1 = this.calculateRowBounds(row1);
    const bounds2 = this.calculateRowBounds(row2);
    
    // Calculate gaps and overlaps
    const yGap = Math.abs(bounds2.minY - bounds1.maxY);
    const xOverlap = Math.min(bounds1.maxX, bounds2.maxX) - Math.max(bounds1.minX, bounds2.minX);
    
    // Rows are facing if:
    // 1. They have a reasonable gap (corridor can fit)
    // 2. They have significant X overlap (at least 50% of smaller row)
    // 3. Gap is not too large (max 3x corridor width)
    const minRowWidth = Math.min(bounds1.width, bounds2.width);
    const requiredOverlap = minRowWidth * 0.3; // At least 30% overlap
    
    return yGap >= this.DEFAULT_CORRIDOR_WIDTH * 0.8 && 
           yGap <= this.DEFAULT_CORRIDOR_WIDTH * 3 && 
           xOverlap >= requiredOverlap;
  }

  /**
   * Calculate the bounding box of a row of îlots
   */
  private calculateRowBounds(row: Ilot[]): Rectangle {
    if (row.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    
    const minX = Math.min(...row.map(i => i.x));
    const minY = Math.min(...row.map(i => i.y));
    const maxX = Math.max(...row.map(i => i.x + i.width));
    const maxY = Math.max(...row.map(i => i.y + i.height));
    
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Create corridor between rows ensuring it touches both rows
   */
  private createCorridorBetweenRows(
    row1: Ilot[],
    row2: Ilot[],
    width: number,
    zones: ZoneType[]
  ): Corridor | null {
    const row1Bounds = this.calculateRowBounds(row1);
    const row2Bounds = this.calculateRowBounds(row2);
    
    // Calculate the overlap region where corridor should be placed
    const overlapStart = Math.max(row1Bounds.minX, row2Bounds.minX);
    const overlapEnd = Math.min(row1Bounds.maxX, row2Bounds.maxX);
    
    if (overlapEnd <= overlapStart) {
      // No overlap - create L-shaped connection
      return this.createLShapedCorridor(row1, row2, width, zones);
    }
    
    // Create horizontal corridor in the overlap region
    // Position it to touch both rows
    const corridorY = (row1Bounds.maxY + row2Bounds.minY) / 2;
    const corridorLength = overlapEnd - overlapStart;
    
    // Ensure minimum corridor length
    if (corridorLength < width) {
      return this.createLShapedCorridor(row1, row2, width, zones);
    }
    
    const corridor: Corridor = {
      id: `corridor_${this.calculateCorridorHash(row1, row2)}_${Date.now()}`,
      startX: overlapStart,
      startY: corridorY - width / 2,
      endX: overlapEnd,
      endY: corridorY + width / 2,
      width: width,
      connectedIlots: [...row1.map(i => i.id), ...row2.map(i => i.id)],
      length: corridorLength
    };

    return corridor;
  }
  
  /**
   * Create L-shaped corridor when rows don't overlap
   */
  private createLShapedCorridor(
    row1: Ilot[],
    row2: Ilot[],
    width: number,
    zones: ZoneType[]
  ): Corridor | null {
    const row1Bounds = this.calculateRowBounds(row1);
    const row2Bounds = this.calculateRowBounds(row2);
    
    const row1Center = row1Bounds.minX + row1Bounds.width / 2;
    const row2Center = row2Bounds.minX + row2Bounds.width / 2;
    
    // Create connecting corridor from center of row1 to center of row2
    const corridor: Corridor = {
      id: `corridor_L_${this.calculateCorridorHash(row1, row2)}_${Date.now()}`,
      startX: row1Center - width / 2,
      startY: row1Bounds.maxY,
      endX: row2Center + width / 2,
      endY: row2Bounds.minY,
      width: width,
      connectedIlots: [...row1.map(i => i.id), ...row2.map(i => i.id)],
      length: Math.sqrt(
        Math.pow(row2Center - row1Center, 2) + 
        Math.pow(row2Bounds.minY - row1Bounds.maxY, 2)
      )
    };
    
    return corridor;
  }
  
  private calculateCorridorHash(row1: Ilot[], row2: Ilot[]): number {
    const positions = [...row1, ...row2].map(i => `${i.x.toFixed(1)}_${i.y.toFixed(1)}`).join('|');
    let hash = 0;
    for (let i = 0; i < positions.length; i++) {
      hash = ((hash << 5) - hash) + positions.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Check if a corridor conflicts with restricted zones
   */
  private corridorConflictsWithRestrictions(corridor: Corridor, zones: ZoneType[]): boolean {
    const corridorRect: Rectangle = {
      minX: corridor.startX,
      minY: corridor.startY,
      maxX: corridor.endX,
      maxY: corridor.endY,
      width: corridor.endX - corridor.startX,
      height: corridor.endY - corridor.startY
    };

    return zones.some(zone => 
      (zone.type === 'wall' || zone.type === 'restricted' || zone.type === 'entrance') &&
      this.rectanglesOverlap(corridorRect, zone.bounds)
    );
  }

  /**
   * Check if two rectangles overlap
   */
  private rectanglesOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
    return !(rect1.maxX <= rect2.minX || 
             rect1.minX >= rect2.maxX || 
             rect1.maxY <= rect2.minY || 
             rect1.minY >= rect2.maxY);
  }

  /**
   * Find optimal connection strategy for isolated îlots based on layout analysis
   */
  private findBestConnection(
    isolated: Ilot,
    existingCorridors: Corridor[],
    allIlots: Ilot[],
    corridorWidth: number,
    zones: ZoneType[]
  ): Corridor | null {
    const ilotCenter = {
      x: isolated.x + isolated.width / 2,
      y: isolated.y + isolated.height / 2
    };
    
    // Analyze layout to determine best connection strategy
    const layoutAnalysis = this.analyzeLayoutForConnection(isolated, existingCorridors, allIlots);
    
    let bestTarget: { x: number, y: number, type: 'corridor' | 'ilot' } | null = null;
    let bestDistance = Infinity;
    
    // Prioritize connections based on layout analysis
    const targets = layoutAnalysis.preferCorridors ? 
      [...existingCorridors.map(c => ({ x: (c.startX + c.endX) / 2, y: (c.startY + c.endY) / 2, type: 'corridor' as const })),
       ...allIlots.filter(i => i.id !== isolated.id).map(i => ({ x: i.x + i.width/2, y: i.y + i.height/2, type: 'ilot' as const }))] :
      [...allIlots.filter(i => i.id !== isolated.id).map(i => ({ x: i.x + i.width/2, y: i.y + i.height/2, type: 'ilot' as const })),
       ...existingCorridors.map(c => ({ x: (c.startX + c.endX) / 2, y: (c.startY + c.endY) / 2, type: 'corridor' as const }))];
    
    for (const target of targets) {
      const distance = Math.sqrt(
        Math.pow(ilotCenter.x - target.x, 2) + Math.pow(ilotCenter.y - target.y, 2)
      );
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = target;
      }
    }
    
    if (!bestTarget) return null;
    
    // Create connection with unique characteristics based on analysis
    const connectionType = layoutAnalysis.preferredDirection;
    const connectionHash = this.calculateConnectionHash(isolated, bestTarget);
    const widthMultiplier = 0.7 + (connectionHash % 30) / 100; // 0.70-1.00
    
    let corridor: Corridor;
    
    if (connectionType === 'horizontal' || (connectionType === 'auto' && Math.abs(bestTarget.x - ilotCenter.x) > Math.abs(bestTarget.y - ilotCenter.y))) {
      corridor = {
        id: `connection_h_${connectionHash}_${isolated.id}`,
        startX: Math.min(ilotCenter.x, bestTarget.x),
        startY: ilotCenter.y - (corridorWidth * widthMultiplier) / 2,
        endX: Math.max(ilotCenter.x, bestTarget.x),
        endY: ilotCenter.y + (corridorWidth * widthMultiplier) / 2,
        width: corridorWidth * widthMultiplier,
        connectedIlots: [isolated.id],
        length: Math.abs(bestTarget.x - ilotCenter.x)
      };
    } else {
      corridor = {
        id: `connection_v_${connectionHash}_${isolated.id}`,
        startX: ilotCenter.x - (corridorWidth * widthMultiplier) / 2,
        startY: Math.min(ilotCenter.y, bestTarget.y),
        endX: ilotCenter.x + (corridorWidth * widthMultiplier) / 2,
        endY: Math.max(ilotCenter.y, bestTarget.y),
        width: corridorWidth * widthMultiplier,
        connectedIlots: [isolated.id],
        length: Math.abs(bestTarget.y - ilotCenter.y)
      };
    }
    
    return this.corridorConflictsWithRestrictions(corridor, zones) ? null : corridor;
  }
  
  private analyzeLayoutForConnection(isolated: Ilot, corridors: Corridor[], ilots: Ilot[]): {
    preferCorridors: boolean;
    preferredDirection: 'horizontal' | 'vertical' | 'auto';
  } {
    const ilotCenter = { x: isolated.x + isolated.width / 2, y: isolated.y + isolated.height / 2 };
    
    // Analyze surrounding density
    const nearbyIlots = ilots.filter(i => {
      const distance = Math.sqrt(
        Math.pow(i.x + i.width/2 - ilotCenter.x, 2) + 
        Math.pow(i.y + i.height/2 - ilotCenter.y, 2)
      );
      return distance <= 200; // Within 2m
    });
    
    // Determine layout characteristics
    const horizontalSpread = Math.max(...nearbyIlots.map(i => i.x)) - Math.min(...nearbyIlots.map(i => i.x));
    const verticalSpread = Math.max(...nearbyIlots.map(i => i.y)) - Math.min(...nearbyIlots.map(i => i.y));
    
    return {
      preferCorridors: corridors.length > 0 && nearbyIlots.length > 3,
      preferredDirection: horizontalSpread > verticalSpread ? 'horizontal' : 
                         verticalSpread > horizontalSpread ? 'vertical' : 'auto'
    };
  }
  
  private calculateConnectionHash(isolated: Ilot, target: { x: number, y: number }): number {
    const str = `${isolated.x.toFixed(1)}_${isolated.y.toFixed(1)}_${target.x.toFixed(1)}_${target.y.toFixed(1)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  /**
   * Create access corridors perpendicular to main corridors
   */
  private createAccessCorridors(
    rows: Ilot[][],
    corridorWidth: number,
    zones: ZoneType[],
    allIlots: Ilot[]
  ): Corridor[] {
    const accessCorridors: Corridor[] = [];
    
    // Create perpendicular access corridors at the ends of rows
    for (const row of rows) {
      if (row.length < 2) continue;
      
      const rowBounds = this.calculateRowBounds(row);
      
      // Left access corridor
      const leftCorridor: Corridor = {
        id: `access_left_${this.calculateRowHash(row)}_${Date.now()}`,
        startX: rowBounds.minX - corridorWidth,
        startY: rowBounds.minY - corridorWidth / 2,
        endX: rowBounds.minX,
        endY: rowBounds.maxY + corridorWidth / 2,
        width: corridorWidth,
        connectedIlots: row.map(i => i.id),
        length: rowBounds.height + corridorWidth
      };
      
      if (this.validateCorridorPlacement(leftCorridor, allIlots, zones)) {
        accessCorridors.push(leftCorridor);
      }
      
      // Right access corridor
      const rightCorridor: Corridor = {
        id: `access_right_${this.calculateRowHash(row)}_${Date.now()}`,
        startX: rowBounds.maxX,
        startY: rowBounds.minY - corridorWidth / 2,
        endX: rowBounds.maxX + corridorWidth,
        endY: rowBounds.maxY + corridorWidth / 2,
        width: corridorWidth,
        connectedIlots: row.map(i => i.id),
        length: rowBounds.height + corridorWidth
      };
      
      if (this.validateCorridorPlacement(rightCorridor, allIlots, zones)) {
        accessCorridors.push(rightCorridor);
      }
    }
    
    return accessCorridors;
  }
  
  /**
   * Validate corridor placement to ensure no overlaps
   */
  private validateCorridorPlacement(
    corridor: Corridor,
    ilots: Ilot[],
    zones: ZoneType[]
  ): boolean {
    // Check for conflicts with restricted zones
    if (this.corridorConflictsWithRestrictions(corridor, zones)) {
      return false;
    }
    
    // Check for overlaps with îlots
    const corridorRect = {
      minX: Math.min(corridor.startX, corridor.endX),
      minY: Math.min(corridor.startY, corridor.endY),
      maxX: Math.max(corridor.startX, corridor.endX),
      maxY: Math.max(corridor.startY, corridor.endY),
      width: Math.abs(corridor.endX - corridor.startX),
      height: Math.abs(corridor.endY - corridor.startY)
    };
    
    for (const ilot of ilots) {
      const ilotRect = {
        minX: ilot.x,
        minY: ilot.y,
        maxX: ilot.x + ilot.width,
        maxY: ilot.y + ilot.height,
        width: ilot.width,
        height: ilot.height
      };
      
      if (this.rectanglesOverlap(corridorRect, ilotRect)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculate hash for a row of îlots
   */
  private calculateRowHash(row: Ilot[]): number {
    const positions = row.map(i => `${i.x.toFixed(1)}_${i.y.toFixed(1)}`).join('|');
    let hash = 0;
    for (let i = 0; i < positions.length; i++) {
      hash = ((hash << 5) - hash) + positions.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

}

export const corridorGenerator = new CorridorGenerator();