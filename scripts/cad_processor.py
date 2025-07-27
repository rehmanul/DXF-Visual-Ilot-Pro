#!/usr/bin/env python3
"""
Professional CAD Processor for DXF Visual Ilot Pro
Handles DXF, DWG, and PDF files with full geometric analysis
"""

import sys
import json
import os
import ezdxf
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass
import math

@dataclass
class Entity:
    type: str
    layer: str
    coordinates: List[List[float]]
    properties: Dict[str, Any]
    is_block: bool = False

@dataclass
class Bounds:
    minX: float
    minY: float
    maxX: float
    maxY: float

class ProfessionalCADProcessor:
    def __init__(self):
        self.entities: List[Entity] = []
        self.layers: set = set()
        self.blocks: Dict[str, List[Entity]] = {}
        self.bounds = Bounds(0, 0, 0, 0)
        self.scale = 1.0
        self.units = 'mm'

    def process_file(self, file_path: str, mode: str = 'full') -> Dict[str, Any]:
        """Process CAD file with full geometric analysis"""
        try:
            doc = ezdxf.readfile(file_path)

            # Process model space
            msp = doc.modelspace()
            for entity in msp:
                self._process_entity(entity)

            # Process blocks
            for block in doc.blocks:
                block_name = block.name
                if not block_name.startswith('*'):
                    block_entities = []
                    for entity in block:
                        block_entity = self._process_entity(entity, is_block=True)
                        if block_entity:
                            block_entities.append(block_entity)
                    if block_entities:
                        self.blocks[block_name] = block_entities

            # Calculate precise bounds
            self._calculate_bounds()

            # Detect units and scale
            self._detect_units_and_scale(doc)

            return self._build_result(mode)

        except Exception as e:
            raise Exception(f"CAD processing failed: {str(e)}")

    def _process_entity(self, entity, is_block: bool = False) -> Optional[Entity]:
        """Process individual CAD entity with full properties"""
        entity_type = entity.dxftype()
        layer = entity.dxf.layer
        self.layers.add(layer)

        processed_entity = None

        if entity_type == 'LINE':
            processed_entity = Entity(
                type='line',
                layer=layer,
                coordinates=[[entity.dxf.start.x, entity.dxf.start.y],
                           [entity.dxf.end.x, entity.dxf.end.y]],
                properties={
                    'lineweight': getattr(entity.dxf, 'lineweight', 0),
                    'color': getattr(entity.dxf, 'color', 256),
                    'linetype': getattr(entity.dxf, 'linetype', 'BYLAYER')
                },
                is_block=is_block
            )

        elif entity_type == 'POLYLINE':
            points = []
            for vertex in entity.vertices:
                points.append([vertex.dxf.location.x, vertex.dxf.location.y])

            processed_entity = Entity(
                type='polyline',
                layer=layer,
                coordinates=points,
                properties={
                    'closed': entity.is_closed,
                    'lineweight': getattr(entity.dxf, 'lineweight', 0),
                    'color': getattr(entity.dxf, 'color', 256)
                },
                is_block=is_block
            )

        elif entity_type == 'LWPOLYLINE':
            points = [[p[0], p[1]] for p in entity.get_points()]

            processed_entity = Entity(
                type='polyline',
                layer=layer,
                coordinates=points,
                properties={
                    'closed': entity.closed,
                    'lineweight': getattr(entity.dxf, 'lineweight', 0),
                    'color': getattr(entity.dxf, 'color', 256)
                },
                is_block=is_block
            )

        elif entity_type == 'CIRCLE':
            processed_entity = Entity(
                type='circle',
                layer=layer,
                coordinates=[[entity.dxf.center.x, entity.dxf.center.y]],
                properties={
                    'radius': entity.dxf.radius,
                    'color': getattr(entity.dxf, 'color', 256)
                },
                is_block=is_block
            )

        elif entity_type == 'ARC':
            processed_entity = Entity(
                type='arc',
                layer=layer,
                coordinates=[[entity.dxf.center.x, entity.dxf.center.y]],
                properties={
                    'radius': entity.dxf.radius,
                    'start_angle': entity.dxf.start_angle,
                    'end_angle': entity.dxf.end_angle,
                    'color': getattr(entity.dxf, 'color', 256)
                },
                is_block=is_block
            )

        elif entity_type == 'TEXT':
            processed_entity = Entity(
                type='text',
                layer=layer,
                coordinates=[[entity.dxf.insert.x, entity.dxf.insert.y]],
                properties={
                    'text': entity.dxf.text,
                    'height': entity.dxf.height,
                    'rotation': getattr(entity.dxf, 'rotation', 0),
                    'style': getattr(entity.dxf, 'style', 'STANDARD')
                },
                is_block=is_block
            )

        elif entity_type == 'MTEXT':
            processed_entity = Entity(
                type='text',
                layer=layer,
                coordinates=[[entity.dxf.insert.x, entity.dxf.insert.y]],
                properties={
                    'text': entity.plain_text(),
                    'height': entity.dxf.char_height,
                    'rotation': getattr(entity.dxf, 'rotation', 0),
                    'width': getattr(entity.dxf, 'width', 0)
                },
                is_block=is_block
            )

        elif entity_type == 'INSERT':
            processed_entity = Entity(
                type='insert',
                layer=layer,
                coordinates=[[entity.dxf.insert.x, entity.dxf.insert.y]],
                properties={
                    'name': entity.dxf.name,
                    'xscale': getattr(entity.dxf, 'xscale', 1),
                    'yscale': getattr(entity.dxf, 'yscale', 1),
                    'rotation': getattr(entity.dxf, 'rotation', 0)
                },
                is_block=is_block
            )

        elif entity_type == 'HATCH':
            # Get hatch boundary
            boundary_points = []
            for path in entity.paths:
                if hasattr(path, 'source_boundary_objects'):
                    for edge in path.edges:
                        if hasattr(edge, 'start'):
                            boundary_points.append([edge.start[0], edge.start[1]])
                        if hasattr(edge, 'end'):
                            boundary_points.append([edge.end[0], edge.end[1]])

            processed_entity = Entity(
                type='hatch',
                layer=layer,
                coordinates=boundary_points if boundary_points else [[0, 0]],
                properties={
                    'pattern': entity.dxf.pattern_name,
                    'solid': entity.dxf.solid_fill,
                    'color': getattr(entity.dxf, 'color', 256)
                },
                is_block=is_block
            )

        elif entity_type == 'DIMENSION':
            # Process dimension entities
            processed_entity = Entity(
                type='dimension',
                layer=layer,
                coordinates=[[entity.dxf.defpoint.x, entity.dxf.defpoint.y]],
                properties={
                    'text': getattr(entity.dxf, 'text', ''),
                    'measurement': getattr(entity, 'get_measurement', lambda: 0)()
                },
                is_block=is_block
            )

        if processed_entity and not is_block:
            self.entities.append(processed_entity)

        return processed_entity

    def _calculate_bounds(self):
        """Calculate precise geometric bounds"""
        if not self.entities:
            self.bounds = Bounds(0, 0, 100, 100)
            return

        minX = float('inf')
        minY = float('inf')
        maxX = float('-inf')
        maxY = float('-inf')

        for entity in self.entities:
            for coord in entity.coordinates:
                x, y = coord[0], coord[1]

                if entity.type == 'circle':
                    radius = entity.properties.get('radius', 0)
                    minX = min(minX, x - radius)
                    minY = min(minY, y - radius)
                    maxX = max(maxX, x + radius)
                    maxY = max(maxY, y + radius)
                elif entity.type == 'arc':
                    radius = entity.properties.get('radius', 0)
                    minX = min(minX, x - radius)
                    minY = min(minY, y - radius)
                    maxX = max(maxX, x + radius)
                    maxY = max(maxY, y + radius)
                else:
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)

        self.bounds = Bounds(minX, minY, maxX, maxY)

    def _detect_units_and_scale(self, doc):
        """Detect drawing units and scale"""
        try:
            # Get units from header variables
            insunits = doc.header.get('$INSUNITS', 0)
            unit_map = {
                0: 'unitless',
                1: 'inches',
                2: 'feet',
                3: 'miles',
                4: 'mm',
                5: 'cm',
                6: 'm',
                7: 'km'
            }
            self.units = unit_map.get(insunits, 'mm')

            # Calculate scale based on drawing size
            width = self.bounds.maxX - self.bounds.minX
            height = self.bounds.maxY - self.bounds.minY

            if width > 0 and height > 0:
                # Estimate scale based on typical architectural drawing sizes
                if width > 10000 or height > 10000:  # Likely in mm
                    self.scale = 0.001  # mm to m
                    self.units = 'mm'
                elif width > 1000 or height > 1000:  # Likely in cm
                    self.scale = 0.01   # cm to m
                    self.units = 'cm'
                else:  # Likely in m
                    self.scale = 1.0
                    self.units = 'm'

        except Exception:
            self.units = 'mm'
            self.scale = 0.001

    def _build_result(self, mode: str = 'full') -> Dict[str, Any]:
        """Build comprehensive result"""
        result = {
            'entities': [
                {
                    'type': e.type,
                    'layer': e.layer,
                    'coordinates': e.coordinates,
                    'properties': e.properties,
                    'is_block': e.is_block
                } for e in self.entities
            ],
            'bounds': {
                'minX': self.bounds.minX,
                'minY': self.bounds.minY,
                'maxX': self.bounds.maxX,
                'maxY': self.bounds.maxY
            },
            'scale': self.scale,
            'units': self.units,
            'layers': sorted(list(self.layers)),
        }

        if mode == 'full':
            result['blocks'] = {
                name: [
                    {
                        'type': e.type,
                        'layer': e.layer,
                        'coordinates': e.coordinates,
                        'properties': e.properties,
                        'is_block': e.is_block
                    } for e in entities
                ] for name, entities in self.blocks.items()
            }
        return result

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "File path not provided"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    mode = 'full'
    if len(sys.argv) > 2 and sys.argv[2] == '--mode=base':
        mode = 'base'

    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        processor = ProfessionalCADProcessor()
        result = processor.process_file(file_path, mode=mode)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
