#!/usr/bin/env python3
"""
Image Processing Script for FloorPlan Processor
Handles JPG, JPEG, and PNG file parsing and geometric data extraction
"""

import sys
import json
import os
from typing import Dict, List, Any, Tuple, Optional
import traceback

try:
    import cv2
    import numpy as np
    from PIL import Image
    IMAGE_PROCESSING_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSING_AVAILABLE = False

class ImageProcessor:
    def __init__(self):
        self.entities = []
        self.layers = set()
        self.bounds = {'minX': 0, 'minY': 0, 'maxX': 100, 'maxY': 100}
        self.scale = 1.0
        self.units = 'm'

    def process_image(self, file_path: str) -> Dict[str, Any]:
        """Process image file and extract geometric data"""
        if not IMAGE_PROCESSING_AVAILABLE:
            raise ImportError("OpenCV and PIL libraries are required for image processing")

        try:
            print("Loading image file...", flush=True)
            
            # Load the image
            image = cv2.imread(file_path)
            if image is None:
                raise ValueError(f"Failed to load image: {file_path}")
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply adaptive threshold for better line detection
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                          cv2.THRESH_BINARY_INV, 11, 2)
            
            # Extract geometric data
            self._extract_geometry(thresh, image.shape[1], image.shape[0])
            
            # Calculate bounds
            self._calculate_bounds()
            
            print("Image processing completed successfully", flush=True)
            
            return self._build_result()
            
        except Exception as e:
            print(f"Error during image processing: {str(e)}", file=sys.stderr, flush=True)
            traceback.print_exc()
            raise Exception(f"Failed to process image file: {str(e)}")

    def _extract_geometry(self, binary_image, width, height):
        """Extract geometric data from binary image"""
        # Find contours
        contours, hierarchy = cv2.findContours(binary_image, cv2.RETR_CCOMP, 
                                              cv2.CHAIN_APPROX_SIMPLE)
        
        # Process contours
        for i, contour in enumerate(contours):
            # Filter out small contours
            area = cv2.contourArea(contour)
            if area < 100:  # Minimum area threshold
                continue
                
            # Approximate contour to reduce number of points
            epsilon = 0.01 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Convert to normalized coordinates (0-100 range)
            normalized_coords = []
            for point in approx:
                x, y = point[0]
                norm_x = (x / width) * 100
                norm_y = (y / height) * 100
                normalized_coords.append([norm_x, norm_y])
            
            # Determine entity type based on shape and hierarchy
            entity_type = self._determine_entity_type(approx, hierarchy, i, area)
            
            # Create entity
            entity = {
                'type': 'POLYLINE',
                'layer': entity_type,
                'coordinates': normalized_coords,
                'properties': {
                    'closed': True,
                    'area': area
                }
            }
            
            self.entities.append(entity)
            self.layers.add(entity_type)

    def _determine_entity_type(self, contour, hierarchy, index, area):
        """Determine entity type based on shape and hierarchy"""
        # Check if contour is rectangular (4 points)
        is_rect = len(contour) == 4
        
        # Check if contour has parent (inner contour)
        has_parent = hierarchy[0][index][3] != -1
        
        if is_rect and not has_parent:
            # Outer rectangles are likely walls
            return 'WALLS'
        elif has_parent:
            # Inner contours could be doors or windows
            if area < 500:
                return 'DOORS'
            else:
                return 'RESTRICTED'
        else:
            # Other shapes could be rooms or other features
            return 'ROOMS'

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

        # Add padding
        padding = (max_x - min_x) * 0.1
        self.bounds = {
            'minX': min_x - padding,
            'minY': min_y - padding,
            'maxX': max_x + padding,
            'maxY': max_y + padding
        }

    def _build_result(self) -> Dict[str, Any]:
        """Build the final result dictionary"""
        return {
            'entities': self.entities,
            'bounds': self.bounds,
            'scale': self.scale,
            'units': self.units,
            'layers': list(self.layers),
            'blocks': {},
            'entity_count': len(self.entities),
            'layer_count': len(self.layers)
        }

def main():
    """Main entry point for the script"""
    if len(sys.argv) != 2:
        print("Usage: python image_processor.py <file_path>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]

    # Validate file exists
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        processor = ImageProcessor()
        result = processor.process_image(file_path)

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