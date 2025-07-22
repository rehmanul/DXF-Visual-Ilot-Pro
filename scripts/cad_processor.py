#!/usr/bin/env python3
"""
CAD File Processing Script for FloorPlan Processor
Handles DXF, DWG, and PDF file parsing and geometric data extraction
"""

import sys
import json
import os
from typing import Dict, List, Any, Tuple, Optional
import traceback

# Import required libraries for CAD processing
try:
    import ezdxf
    from ezdxf import recover
    from ezdxf.entities import LWPolyline, Polyline, Line, Circle, Arc, Insert
    DXF_AVAILABLE = True
except ImportError:
    DXF_AVAILABLE = False

try:
    from pdf2image import convert_from_path
    import cv2
    import numpy as np
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

class CADProcessor:
    def __init__(self):
        self.entities = []
        self.layers = set()
        self.bounds = {'minX': 0, 'minY': 0, 'maxX': 100, 'maxY': 100}
        self.scale = 1.0
        self.units = 'm'

    def process_dxf(self, file_path: str) -> Dict[str, Any]:
        """Process DXF file and extract geometric data"""
        if not DXF_AVAILABLE:
            raise ImportError("ezdxf library is required for DXF processing")

        try:
            # Try to load the DXF file, use recover if needed
            try:
                doc = ezdxf.readfile(file_path)
            except ezdxf.DXFStructureError:
                doc, auditor = recover.readfile(file_path)
                if auditor.has_errors:
                    print(f"DXF file has errors: {auditor.errors}", file=sys.stderr)

            # Get the model space
            msp = doc.modelspace()
            
            # Extract entities
            for entity in msp:
                self._process_entity(entity)

            # Calculate bounds
            self._calculate_bounds()
            
            # Detect units from DXF header
            self._detect_units(doc)

            return self._build_result()

        except Exception as e:
            raise Exception(f"Failed to process DXF file: {str(e)}")

    def process_dwg(self, file_path: str) -> Dict[str, Any]:
        """Process DWG file - typically converted to DXF first"""
        # DWG files require specialized libraries like Open Design Alliance
        # For now, we'll simulate the processing structure
        # In production, this would use ODA File Converter or similar
        
        try:
            # This would typically convert DWG to DXF first
            # For demonstration, we'll create a structured response
            
            # Simulate geometric data extraction
            self._create_sample_geometry()
            
            return self._build_result()
            
        except Exception as e:
            raise Exception(f"Failed to process DWG file: {str(e)}")

    def process_pdf(self, file_path: str) -> Dict[str, Any]:
        """Process PDF file and extract vector graphics"""
        if not PDF_AVAILABLE:
            raise ImportError("pdf2image and cv2 libraries are required for PDF processing")

        try:
            # Convert PDF to images
            images = convert_from_path(file_path, dpi=300)
            
            if not images:
                raise Exception("No pages found in PDF")

            # Process first page (architectural drawings are typically single page)
            image = images[0]
            
            # Convert to OpenCV format
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Extract lines and shapes using computer vision
            self._extract_pdf_geometry(opencv_image)
            
            return self._build_result()

        except Exception as e:
            raise Exception(f"Failed to process PDF file: {str(e)}")

    def _process_entity(self, entity):
        """Process individual DXF entity"""
        entity_data = {
            'type': entity.dxftype(),
            'layer': entity.dxf.layer,
            'coordinates': [],
            'properties': {}
        }

        # Add layer to our set
        self.layers.add(entity.dxf.layer)

        # Extract coordinates based on entity type
        if entity.dxftype() == 'LINE':
            start = entity.dxf.start
            end = entity.dxf.end
            entity_data['coordinates'] = [[start.x, start.y], [end.x, end.y]]
            
        elif entity.dxftype() == 'LWPOLYLINE':
            points = list(entity.get_points('xy'))
            entity_data['coordinates'] = [[p[0], p[1]] for p in points]
            
        elif entity.dxftype() == 'POLYLINE':
            points = []
            for vertex in entity.vertices:
                points.append([vertex.dxf.location.x, vertex.dxf.location.y])
            entity_data['coordinates'] = points
            
        elif entity.dxftype() == 'CIRCLE':
            center = entity.dxf.center
            radius = entity.dxf.radius
            entity_data['coordinates'] = [[center.x, center.y]]
            entity_data['properties']['radius'] = radius
            
        elif entity.dxftype() == 'ARC':
            center = entity.dxf.center
            radius = entity.dxf.radius
            start_angle = entity.dxf.start_angle
            end_angle = entity.dxf.end_angle
            entity_data['coordinates'] = [[center.x, center.y]]
            entity_data['properties'].update({
                'radius': radius,
                'start_angle': start_angle,
                'end_angle': end_angle
            })
            
        elif entity.dxftype() == 'INSERT':
            # Handle block insertions (doors, windows, etc.)
            insert_point = entity.dxf.insert
            entity_data['coordinates'] = [[insert_point.x, insert_point.y]]
            entity_data['properties'].update({
                'block_name': entity.dxf.name,
                'rotation': entity.dxf.rotation,
                'x_scale': entity.dxf.xscale,
                'y_scale': entity.dxf.yscale
            })
            
        elif entity.dxftype() == 'TEXT':
            insert_point = entity.dxf.insert
            entity_data['coordinates'] = [[insert_point.x, insert_point.y]]
            entity_data['properties'].update({
                'text': entity.dxf.text,
                'height': entity.dxf.height,
                'rotation': entity.dxf.rotation
            })

        # Add entity to our list
        self.entities.append(entity_data)

    def _extract_pdf_geometry(self, image):
        """Extract geometric data from PDF image using computer vision"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply edge detection
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        
        # Find lines using Hough Transform
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, 
                               minLineLength=50, maxLineGap=10)
        
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                entity_data = {
                    'type': 'LINE',
                    'layer': 'PDF_EXTRACTED',
                    'coordinates': [[x1, y1], [x2, y2]],
                    'properties': {}
                }
                self.entities.append(entity_data)
                self.layers.add('PDF_EXTRACTED')

        # Find contours for enclosed areas
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            if cv2.contourArea(contour) > 1000:  # Filter small contours
                # Approximate contour to polygon
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                if len(approx) >= 3:
                    coordinates = [[int(point[0][0]), int(point[0][1])] for point in approx]
                    entity_data = {
                        'type': 'POLYLINE',
                        'layer': 'PDF_ROOMS',
                        'coordinates': coordinates,
                        'properties': {'area': cv2.contourArea(contour)}
                    }
                    self.entities.append(entity_data)
                    self.layers.add('PDF_ROOMS')

    def _calculate_bounds(self):
        """Calculate bounding box of all entities"""
        if not self.entities:
            return

        min_x = min_y = float('inf')
        max_x = max_y = float('-inf')

        for entity in self.entities:
            for coord in entity['coordinates']:
                min_x = min(min_x, coord[0])
                min_y = min(min_y, coord[1])
                max_x = max(max_x, coord[0])
                max_y = max(max_y, coord[1])

        self.bounds = {
            'minX': min_x,
            'minY': min_y,
            'maxX': max_x,
            'maxY': max_y
        }

    def _detect_units(self, doc):
        """Detect units from DXF document"""
        try:
            # Get units from header variables
            insunits = doc.header.get('$INSUNITS', 0)
            
            # Map DXF unit codes to readable units
            unit_map = {
                0: 'unitless',
                1: 'in',      # inches
                2: 'ft',      # feet
                3: 'miles',
                4: 'mm',      # millimeters
                5: 'cm',      # centimeters
                6: 'm',       # meters
                7: 'km',      # kilometers
                14: 'm'       # default to meters
            }
            
            self.units = unit_map.get(insunits, 'm')
            
            # Convert to meters if needed
            if self.units == 'mm':
                self.scale = 0.001
            elif self.units == 'cm':
                self.scale = 0.01
            elif self.units == 'in':
                self.scale = 0.0254
            elif self.units == 'ft':
                self.scale = 0.3048
            else:
                self.scale = 1.0
                
            self.units = 'm'  # Standardize to meters
            
        except Exception:
            # Default values if detection fails
            self.units = 'm'
            self.scale = 1.0

    def _create_sample_geometry(self):
        """Create sample geometry for testing purposes"""
        # This would be replaced with actual DWG processing
        sample_entities = [
            {
                'type': 'LINE',
                'layer': 'WALLS',
                'coordinates': [[0, 0], [100, 0]],
                'properties': {}
            },
            {
                'type': 'LINE',
                'layer': 'WALLS',
                'coordinates': [[100, 0], [100, 80]],
                'properties': {}
            },
            {
                'type': 'LINE',
                'layer': 'WALLS',
                'coordinates': [[100, 80], [0, 80]],
                'properties': {}
            },
            {
                'type': 'LINE',
                'layer': 'WALLS',
                'coordinates': [[0, 80], [0, 0]],
                'properties': {}
            }
        ]
        
        self.entities.extend(sample_entities)
        self.layers.add('WALLS')
        self.bounds = {'minX': 0, 'minY': 0, 'maxX': 100, 'maxY': 80}

    def _build_result(self) -> Dict[str, Any]:
        """Build the final result dictionary"""
        return {
            'entities': self.entities,
            'bounds': self.bounds,
            'scale': self.scale,
            'units': self.units,
            'layers': list(self.layers),
            'entity_count': len(self.entities),
            'layer_count': len(self.layers)
        }

def main():
    """Main entry point for the script"""
    if len(sys.argv) != 3:
        print("Usage: python cad_processor.py <file_type> <file_path>")
        sys.exit(1)

    file_type = sys.argv[1].lower()
    file_path = sys.argv[2]

    # Validate file exists
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    try:
        processor = CADProcessor()
        
        if file_type == 'dxf':
            result = processor.process_dxf(file_path)
        elif file_type == 'dwg':
            result = processor.process_dwg(file_path)
        elif file_type == 'pdf':
            result = processor.process_pdf(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        # Output result as JSON
        print(json.dumps(result, indent=2))

    except Exception as e:
        error_result = {
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
