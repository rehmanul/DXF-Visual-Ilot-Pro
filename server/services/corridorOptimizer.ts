import { Corridor, Ilot } from './ilotPlacement.js';

export interface OptimizationResult {
  corridors: Corridor[];
  removedCorridors: string[];
  mergedCorridors: Array<{ original: string[], merged: string }>;
  optimizationStats: {
    originalCount: number;
    finalCount: number;
    totalLengthReduction: number;
    efficiencyGain: number;
  };
}

export class CorridorOptimizer {
  /**
   * Optimize corridor network for maximum efficiency
   * Removes redundant corridors, merges adjacent ones, and straightens paths
   */
  optimizeCorridorNetwork(corridors: Corridor[], ilots: Ilot[]): Corridor[] {
    if (!corridors || corridors.length === 0) return [];

    let optimizedCorridors = [...corridors];
    const removedCorridors: string[] = [];
    const mergedCorridors: Array<{ original: string[]; merged: string }> = [];

    // Step 1: Remove redundant corridors using minimum spanning tree approach
    optimizedCorridors = this.removeRedundantCorridors(optimizedCorridors, ilots);

    // Step 2: Merge adjacent corridors
    const mergeResult = this.mergeAdjacentCorridors(optimizedCorridors);
    optimizedCorridors = mergeResult.corridors;
    mergedCorridors.push(...mergeResult.merged);

    // Step 3: Straighten corridor paths
    optimizedCorridors = this.straightenCorridorPaths(optimizedCorridors);

    // Step 4: Optimize corridor widths for consistency
    optimizedCorridors = this.optimizeCorridorWidths(optimizedCorridors);

    return optimizedCorridors;
  }

  /**
   * Remove redundant corridors using graph theory
   */
  private removeRedundantCorridors(corridors: Corridor[], ilots: Ilot[]): Corridor[] {
    // Build connectivity graph
    const graph = this.buildConnectivityGraph(corridors, ilots);
    
    // Find minimum spanning tree to maintain connectivity with minimum corridors
    const mst = this.findMinimumSpanningTree(graph, corridors);
    
    return mst;
  }

  /**
   * Build connectivity graph from corridors and îlots
   */
  private buildConnectivityGraph(corridors: Corridor[], ilots: Ilot[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    // Initialize graph with all îlots
    for (const ilot of ilots) {
      graph.set(ilot.id, new Set());
    }
    
    // Add connections from corridors
    for (const corridor of corridors) {
      for (const ilotId of corridor.connectedIlots) {
        if (!graph.has(ilotId)) {
          graph.set(ilotId, new Set());
        }
        
        // Connect this îlot to all other îlots in the same corridor
        for (const otherId of corridor.connectedIlots) {
          if (ilotId !== otherId) {
            graph.get(ilotId)!.add(otherId);
          }
        }
      }
    }
    
    return graph;
  }

  /**
   * Find minimum spanning tree to maintain connectivity with fewest corridors
   */
  private findMinimumSpanningTree(graph: Map<string, Set<string>>, corridors: Corridor[]): Corridor[] {
    if (corridors.length === 0) return [];
    
    // Sort corridors by length (prefer shorter corridors)
    const sortedCorridors = [...corridors].sort((a, b) => a.length - b.length);
    
    const mst: Corridor[] = [];
    const visited = new Set<string>();
    const components = new Map<string, Set<string>>();
    
    // Initialize each îlot as its own component
    for (const corridor of corridors) {
      for (const ilotId of corridor.connectedIlots) {
        if (!components.has(ilotId)) {
          components.set(ilotId, new Set([ilotId]));
        }
      }
    }
    
    // Kruskal's algorithm adapted for corridors
    for (const corridor of sortedCorridors) {
      const ilotIds = corridor.connectedIlots;
      if (ilotIds.length < 2) continue;
      
      // Check if this corridor connects different components
      const firstComponent = this.findComponent(ilotIds[0], components);
      let connectsDifferentComponents = false;
      
      for (let i = 1; i < ilotIds.length; i++) {
        const currentComponent = this.findComponent(ilotIds[i], components);
        if (firstComponent !== currentComponent) {
          connectsDifferentComponents = true;
          break;
        }
      }
      
      if (connectsDifferentComponents) {
        mst.push(corridor);
        
        // Merge components
        const allConnectedIlots = new Set<string>();
        const allComponents = ilotIds.map((id: any) => this.findComponent(id, components));
        const mergedComponent = new Set<string>();
        
        for (const component of allComponents) {
          if (component) {
            for (const ilotId of component) {
              mergedComponent.add(ilotId);
            }
          }
        }
        
        // Update component mapping
        for (const ilotId of mergedComponent) {
          components.set(ilotId, mergedComponent);
        }
      }
    }
    
    return mst;
  }

  /**
   * Find which component an îlot belongs to
   */
  private findComponent(ilotId: string, components: Map<string, Set<string>>): Set<string> | undefined {
    return components.get(ilotId);
  }

  /**
   * Merge adjacent corridors that can be combined
   */
  private mergeAdjacentCorridors(corridors: Corridor[]): {
    corridors: Corridor[];
    merged: Array<{ original: string[], merged: string }>;
  } {
    const merged: Array<{ original: string[], merged: string }> = [];
    const result: Corridor[] = [];
    const processed = new Set<string>();
    
    for (const corridor of corridors) {
      if (processed.has(corridor.id)) continue;
      
      // Find adjacent corridors that can be merged
      const adjacentCorridors = this.findAdjacentCorridors(corridor, corridors);
      
      if (adjacentCorridors.length > 0) {
        const mergedCorridor = this.mergeCorridor(corridor, adjacentCorridors);
        result.push(mergedCorridor);
        
        processed.add(corridor.id);
        adjacentCorridors.forEach(c => processed.add(c.id));
        
        merged.push({
          original: [corridor.id, ...adjacentCorridors.map(c => c.id)],
          merged: mergedCorridor.id
        });
      } else {
        result.push(corridor);
        processed.add(corridor.id);
      }
    }
    
    return { corridors: result, merged };
  }

  /**
   * Find corridors adjacent to the given corridor
   */
  private findAdjacentCorridors(corridor: Corridor, allCorridors: Corridor[]): Corridor[] {
    const adjacent: Corridor[] = [];
    const tolerance = 0.1; // 10cm tolerance
    
    for (const other of allCorridors) {
      if (other.id === corridor.id) continue;
      
      // Check if corridors are adjacent (end of one touches start of another)
      const isAdjacent = 
        (Math.abs(corridor.endX - other.startX) < tolerance && 
         Math.abs(corridor.endY - other.startY) < tolerance) ||
        (Math.abs(corridor.startX - other.endX) < tolerance && 
         Math.abs(corridor.startY - other.endY) < tolerance);
      
      // Check if they have similar width and direction
      const similarWidth = Math.abs(corridor.width - other.width) < tolerance;
      const sameDirection = this.haveSameDirection(corridor, other);
      
      if (isAdjacent && similarWidth && sameDirection) {
        adjacent.push(other);
      }
    }
    
    return adjacent;
  }

  /**
   * Check if two corridors have the same direction
   */
  private haveSameDirection(corridor1: Corridor, corridor2: Corridor): boolean {
    const dir1 = {
      x: corridor1.endX - corridor1.startX,
      y: corridor1.endY - corridor1.startY
    };
    const dir2 = {
      x: corridor2.endX - corridor2.startX,
      y: corridor2.endY - corridor2.startY
    };
    
    // Normalize directions
    const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
    const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
    
    if (len1 === 0 || len2 === 0) return false;
    
    dir1.x /= len1;
    dir1.y /= len1;
    dir2.x /= len2;
    dir2.y /= len2;
    
    // Check if directions are similar (dot product close to 1 or -1)
    const dotProduct = dir1.x * dir2.x + dir1.y * dir2.y;
    return Math.abs(dotProduct) > 0.9; // Within ~25 degrees
  }

  /**
   * Merge a corridor with its adjacent corridors
   */
  private mergeCorridor(main: Corridor, adjacent: Corridor[]): Corridor {
    let minX = main.startX;
    let minY = main.startY;
    let maxX = main.endX;
    let maxY = main.endY;
    
    const allConnectedIlots = new Set(main.connectedIlots);
    
    for (const adj of adjacent) {
      minX = Math.min(minX, adj.startX, adj.endX);
      minY = Math.min(minY, adj.startY, adj.endY);
      maxX = Math.max(maxX, adj.startX, adj.endX);
      maxY = Math.max(maxY, adj.startY, adj.endY);
      
      adj.connectedIlots.forEach((id: any) => allConnectedIlots.add(id));
    }
    
    const length = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
    
    return {
      id: `merged_${main.id}_${Date.now()}`,
      startX: minX,
      startY: minY,
      endX: maxX,
      endY: maxY,
      width: main.width, // Use main corridor's width
      connectedIlots: Array.from(allConnectedIlots),
      length
    };
  }

  /**
   * Straighten corridor paths by removing unnecessary bends
   */
  private straightenCorridorPaths(corridors: Corridor[]): Corridor[] {
    return corridors.map(corridor => {
      // For now, corridors are already straight lines
      // In a more complex system, this would handle multi-segment paths
      return corridor;
    });
  }

  /**
   * Optimize corridor widths for consistency
   */
  private optimizeCorridorWidths(corridors: Corridor[]): Corridor[] {
    if (corridors.length === 0) return corridors;
    
    // Find the most common width (mode)
    const widthCounts = new Map<number, number>();
    
    for (const corridor of corridors) {
      const roundedWidth = Math.round(corridor.width * 10) / 10; // Round to 1 decimal
      widthCounts.set(roundedWidth, (widthCounts.get(roundedWidth) || 0) + 1);
    }
    
    // Find the most common width
    let mostCommonWidth = 1.2; // Default
    let maxCount = 0;
    
    for (const [width, count] of widthCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonWidth = width;
      }
    }
    
    // Standardize widths to the most common width (with some tolerance)
    return corridors.map(corridor => {
      const widthDiff = Math.abs(corridor.width - mostCommonWidth);
      
      // If width is close to the standard, standardize it
      if (widthDiff < 0.2) { // 20cm tolerance
        return {
          ...corridor,
          width: mostCommonWidth
        };
      }
      
      return corridor;
    });
  }

  /**
   * Calculate optimization statistics
   */
  calculateOptimizationStats(
    originalCorridors: Corridor[],
    optimizedCorridors: Corridor[]
  ): OptimizationResult['optimizationStats'] {
    const originalLength = originalCorridors.reduce((sum, c) => sum + c.length, 0);
    const optimizedLength = optimizedCorridors.reduce((sum, c) => sum + c.length, 0);
    
    return {
      originalCount: originalCorridors.length,
      finalCount: optimizedCorridors.length,
      totalLengthReduction: originalLength - optimizedLength,
      efficiencyGain: originalCorridors.length > 0 ? 
        (originalCorridors.length - optimizedCorridors.length) / originalCorridors.length : 0
    };
  }
}

export const corridorOptimizer = new CorridorOptimizer();
