import { Ilot, Corridor, Zone } from '@shared/schema';

export class CorridorGenerator {
  private readonly DEFAULT_CORRIDOR_WIDTH = 1.2;

  constructor() {
    // Constructor can be used for initialization if needed
  }

  /**
   * Main function to generate corridors for a given set of îlots.
   * @param ilots - Array of îlots to connect.
   * @param zones - Array of restricted zones.
   * @param corridorWidth - The desired width for the corridors.
   * @returns An array of generated corridors.
   */
  public generate(ilots: Ilot[], zones: Zone[], corridorWidth: number = this.DEFAULT_CORRIDOR_WIDTH): Corridor[] {
    if (ilots.length < 2) {
      return [];
    }

    const ilotGroups = this.groupIlotsByProximity(ilots);
    let allCorridors: Corridor[] = [];

    for (const group of ilotGroups) {
      const rows = this.organizeIlotsIntoRows(group);
      const corridors = this.createCorridorsForRows(rows, corridorWidth, zones);
      allCorridors = [...allCorridors, ...corridors];
    }

    const connectedCorridors = this._connectIsolatedIlots(ilots, allCorridors, corridorWidth, zones);
    allCorridors.push(...connectedCorridors);

    // TODO: Implement corridor optimization as per documentation
    // const optimizedCorridors = this.optimizeCorridorNetwork(connectedCorridors, ilots);

    return allCorridors;
  }

  /**
   * Groups îlots that are close to each other into clusters.
   * This uses a flood-fill approach to find connected components.
   * @param ilots - Array of all îlots.
   * @returns An array of îlot groups.
   */
  private groupIlotsByProximity(ilots: Ilot[]): Ilot[][] {
    const groups: Ilot[][] = [];
    const visited = new Set<string>();

    for (const ilot of ilots) {
      if (visited.has(ilot.id)) continue;

      const group: Ilot[] = [];
      const queue = [ilot];
      visited.add(ilot.id);

      while (queue.length > 0) {
        const currentIlot = queue.shift()!;
        group.push(currentIlot);

        for (const other of ilots) {
          if (visited.has(other.id)) continue;

          const distance = Math.sqrt(
            Math.pow(currentIlot.x - other.x, 2) + Math.pow(currentIlot.y - other.y, 2)
          );

          // A multiplier of 5 seems reasonable to connect nearby groups
          if (distance <= this.DEFAULT_CORRIDOR_WIDTH * 5) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
      groups.push(group);
    }

    return groups;
  }

  /**
   * Organizes îlots into rows based on their Y coordinates.
   * @param ilots - An array of îlots to organize.
   * @returns An array of rows, where each row is an array of îlots.
   */
  private organizeIlotsIntoRows(ilots: Ilot[]): Ilot[][] {
    const tolerance = 0.5; // 50cm tolerance for row alignment
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

    rows.forEach(row => row.sort((a, b) => a.x - b.x));
    return rows;
  }

  /**
   * Creates corridors between adjacent rows of îlots.
   * @param rows - The rows of îlots.
   * @param width - The width of the corridors.
   * @param zones - Restricted zones to avoid.
   * @returns An array of generated corridors.
   */
  private createCorridorsForRows(rows: Ilot[][], width: number, zones: Zone[]): Corridor[] {
    const corridors: Corridor[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const row1 = rows[i];
      const row2 = rows[i + 1];
      const corridor = this.createCorridorBetweenRows(row1, row2, width, zones);
      if (corridor) {
        corridors.push(corridor);
      }
    }
    return corridors;
  }

  private createCorridorBetweenRows(row1: Ilot[], row2: Ilot[], width: number, zones: Zone[]): Corridor | null {
    const row1Bounds = this.calculateRowBounds(row1);
    const row2Bounds = this.calculateRowBounds(row2);

    const startY = row1Bounds.maxY;
    const endY = row2Bounds.minY;
    const centerY = startY + (endY - startY) / 2;

    const overlapStart = Math.max(row1Bounds.minX, row2Bounds.minX);
    const overlapEnd = Math.min(row1Bounds.maxX, row2Bounds.maxX);

    if (overlapEnd <= overlapStart) return null;

    const corridor: Corridor = {
      id: `corridor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startX: overlapStart,
      startY: centerY - width / 2,
      endX: overlapEnd,
      endY: centerY + width / 2,
      width,
      connectedIlots: [...row1.map(i => i.id), ...row2.map(i => i.id)],
      length: overlapEnd - overlapStart
    };

    if (this.corridorConflictsWithRestrictions(corridor, zones)) {
      return null;
    }

    return corridor;
  }

  private calculateRowBounds(row: Ilot[]): { minX: number; maxX: number; minY: number; maxY: number } {
    if (!row || row.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ilot of row) {
      minX = Math.min(minX, ilot.x);
      maxX = Math.max(maxX, ilot.x + ilot.width);
      minY = Math.min(minY, ilot.y);
      maxY = Math.max(maxY, ilot.y + ilot.height);
    }
    return { minX, maxX, minY, maxY };
  }

  private corridorConflictsWithRestrictions(corridor: Corridor, zones: Zone[]): boolean {
    const c = { minX: corridor.startX, maxX: corridor.endX, minY: corridor.startY, maxY: corridor.endY };
    for (const zone of zones) {
      const z = { minX: zone.x, maxX: zone.x + zone.width, minY: zone.y, maxY: zone.y + zone.height };
      if (c.minX < z.maxX && c.maxX > z.minX && c.minY < z.maxY && c.maxY > z.minY) {
        return true;
      }
    }
    return false;
  }

  private _connectIsolatedIlots(ilots: Ilot[], corridors: Corridor[], corridorWidth: number, zones: Zone[]): Corridor[] {
    const connectedIlotIds = new Set<string>();
    corridors.forEach(c => c.connectedIlots.forEach(id => connectedIlotIds.add(id)));

    const isolatedIlots = ilots.filter(i => !connectedIlotIds.has(i.id));
    const newCorridors: Corridor[] = [];

    for (const isolated of isolatedIlots) {
      let bestDistance = Infinity;
      let bestTarget: { x: number, y: number, corridor?: Corridor } | null = null;

      // Find nearest corridor to connect to
      for (const corridor of corridors) {
        const corridorCenterX = (corridor.startX + corridor.endX) / 2;
        const corridorCenterY = (corridor.startY + corridor.endY) / 2;

        const distance = Math.hypot(
            (isolated.x + isolated.width / 2) - corridorCenterX,
            (isolated.y + isolated.height / 2) - corridorCenterY
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestTarget = { x: corridorCenterX, y: corridorCenterY, corridor };
        }
      }

      if (bestTarget && bestTarget.corridor) {
        const targetCorridor = bestTarget.corridor;
        const isolatedCenter = { x: isolated.x + isolated.width / 2, y: isolated.y + isolated.height / 2 };

        // Create a vertical corridor from the isolated îlot to the horizontal corridor
        const startY = isolated.y > targetCorridor.startY ? targetCorridor.maxY : isolated.y + isolated.height;
        const endY = isolated.y > targetCorridor.startY ? isolated.y : targetCorridor.startY;

        const newCorridor: Corridor = {
          id: `corridor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          startX: isolatedCenter.x - corridorWidth / 2,
          startY,
          endX: isolatedCenter.x + corridorWidth / 2,
          endY,
          width: endY - startY,
          length: corridorWidth,
          connectedIlots: [isolated.id, ...targetCorridor.connectedIlots],
        };

        if (!this.corridorConflictsWithRestrictions(newCorridor, zones)) {
            newCorridors.push(newCorridor);
            // Mark this îlot as connected
            connectedIlotIds.add(isolated.id);
            // Add the new corridor to the list for subsequent checks
            corridors.push(newCorridor);
        }
      }
    }

    return newCorridors;
  }
}