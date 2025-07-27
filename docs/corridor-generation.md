# Corridor Generation Algorithm

This document explains the corridor generation algorithm used in the DXF Visual Ilot Pro application.

## Overview

The corridor generation algorithm automatically creates corridors between facing rows of îlots, ensuring that:

1. Corridors touch both îlot rows
2. Corridors do not overlap with îlots or restricted areas
3. Corridors have a configurable width (default: 1.2m)
4. The placement remains optimized and compact

## Algorithm Steps

### 1. Group Îlots by Proximity

First, the algorithm groups îlots that are close to each other. This helps identify clusters of îlots that should be connected by corridors.

```typescript
private groupIlotsByProximity(ilots: Ilot[]): Ilot[][] {
  const groups: Ilot[][] = [];
  const visited = new Set<string>();
  
  for (const ilot of ilots) {
    if (visited.has(ilot.id)) continue;
    
    const group = [ilot];
    visited.add(ilot.id);
    
    // Find nearby îlots
    for (const other of ilots) {
      if (visited.has(other.id)) continue;
      
      const distance = Math.sqrt(
        Math.pow(ilot.x - other.x, 2) + Math.pow(ilot.y - other.y, 2)
      );
      
      if (distance <= this.DEFAULT_CORRIDOR_WIDTH * 3) {
        group.push(other);
        visited.add(other.id);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}
```

### 2. Organize Îlots into Rows

Next, the algorithm organizes îlots into rows based on their Y coordinates. This helps identify facing rows that need corridors between them.

```typescript
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
  
  // Sort each row by X coordinate
  rows.forEach(row => row.sort((a, b) => a.x - b.x));
  
  return rows;
}
```

### 3. Create Corridors Between Facing Rows

The algorithm then creates corridors between facing rows of îlots. It checks if rows are facing each other and creates a corridor that spans the overlapping X range.

```typescript
private createCorridorBetweenRows(
  row1: Ilot[],
  row2: Ilot[],
  width: number,
  zones: ZoneType[]
): Corridor | null {
  // Calculate corridor path
  const row1Bounds = this.calculateRowBounds(row1);
  const row2Bounds = this.calculateRowBounds(row2);
  
  // Corridor runs between the rows
  const startY = row1Bounds.maxY;
  const endY = row2Bounds.minY;
  const centerY = (startY + endY) / 2;
  
  // Find overlapping X range
  const overlapStart = Math.max(row1Bounds.minX, row2Bounds.minX);
  const overlapEnd = Math.min(row1Bounds.maxX, row2Bounds.maxX);
  
  if (overlapEnd <= overlapStart) return null; // No overlap
  
  // Create corridor spanning the overlap
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

  // Verify corridor doesn't conflict with restrictions
  if (this.corridorConflictsWithRestrictions(corridor, zones)) {
    return null;
  }

  return corridor;
}
```

### 4. Connect Isolated Îlots

The algorithm then connects isolated îlots to the main corridor network. It finds the nearest corridor or îlot and creates a connection.

```typescript
private findBestConnection(
  isolated: Ilot,
  existingCorridors: Corridor[],
  allIlots: Ilot[],
  corridorWidth: number,
  zones: ZoneType[]
): Corridor | null {
  // Find the nearest corridor or îlot to connect to
  let bestDistance = Infinity;
  let bestTarget: { x: number, y: number } | null = null;
  
  // Check distance to existing corridors
  for (const corridor of existingCorridors) {
    const centerX = (corridor.startX + corridor.endX) / 2;
    const centerY = (corridor.startY + corridor.endY) / 2;
    const distance = Math.sqrt(
      Math.pow(isolated.x + isolated.width/2 - centerX, 2) + 
      Math.pow(isolated.y + isolated.height/2 - centerY, 2)
    );
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestTarget = { x: centerX, y: centerY };
    }
  }
  
  // Create connection corridor
  // ...
}
```

### 5. Optimize the Corridor Network

Finally, the algorithm optimizes the corridor network by removing redundant corridors, merging adjacent corridors, and straightening corridor paths.

```typescript
optimizeCorridorNetwork(corridors: Corridor[], ilots: Ilot[]): Corridor[] {
  // Step 1: Remove redundant corridors
  const essentialCorridors = this.removeRedundantCorridors(corridors, ilots);
  
  // Step 2: Merge adjacent corridors
  const mergedCorridors = this.mergeAdjacentCorridors(essentialCorridors);
  
  // Step 3: Straighten corridor paths where possible
  return this.straightenCorridorPaths(mergedCorridors);
}
```

## Visualization

The corridors are visualized in the floor plan with:

1. A light pink fill color
2. Pink outlines
3. Width measurements displayed in the center
4. Connection lines to connected îlots when selected

## User Controls

Users can:

1. Adjust the corridor width using the dedicated control panel
2. Toggle the visibility of corridors in the visualization
3. Select corridors to see their connections
4. Export the final layout with corridors

## Conclusion

The corridor generation algorithm ensures that corridors are automatically created between facing rows of îlots, respecting all the specified constraints. The algorithm is optimized for efficiency and produces a professional-looking layout.