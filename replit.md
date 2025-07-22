# FloorPlan Processor

## Overview

FloorPlan Processor is a comprehensive web application for uploading, analyzing, and visualizing architectural floor plans. The system supports multiple CAD file formats (DXF, DWG, PDF) and provides intelligent room detection, measurement extraction, and interactive visualization capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built as a React Single Page Application (SPA) using:
- **React 18** with TypeScript for type safety
- **Vite** as the build tool and development server
- **Wouter** for lightweight client-side routing
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for styling with a custom design system
- **TanStack Query** for server state management and caching

### Backend Architecture
The backend follows a REST API pattern with:
- **Express.js** server with TypeScript
- **Drizzle ORM** for database operations with PostgreSQL
- **Neon Database** as the PostgreSQL provider
- **Multer** for file upload handling
- **Python integration** for CAD file processing via child processes

### File Processing Pipeline
The application implements a sophisticated CAD processing pipeline:
1. File upload and validation
2. Python-based CAD parsing using specialized libraries (ezdxf, pdf2image, opencv)
3. Geometric data extraction and room detection
4. Storage of processed results in structured format

## Key Components

### File Upload System
- Supports DXF, DWG, and PDF file formats
- 50MB file size limit with client-side validation
- Drag-and-drop interface with visual feedback
- Real-time upload progress tracking

### CAD Processing Engine
- Python-based processing using industry-standard libraries
- Geometric entity extraction (lines, polylines, circles, arcs)
- Layer analysis and architectural element detection
- Coordinate system normalization and scaling

### Room Detection Service
- Automated room boundary identification
- Intelligent room type classification
- Area and perimeter calculations
- Color-coded visualization system

### Interactive Canvas
- HTML5 Canvas-based floor plan rendering
- Zoom and pan functionality
- Measurement tools (distance, area, annotations)
- Real-time scale adjustments
- Export capabilities to multiple formats

### Export System
- PDF report generation with floor plan analysis
- Excel spreadsheet export with measurements
- PNG image export with customizable options
- CAD file regeneration (DXF format)

## Data Flow

1. **Upload Flow**: User uploads CAD file → File validation → Storage in uploads directory → Database record creation
2. **Processing Flow**: Python processor spawned → CAD file parsed → Geometric data extracted → Room detection performed → Results stored in database
3. **Visualization Flow**: Frontend queries processed data → Canvas renders floor plan → Interactive tools enabled
4. **Export Flow**: User selects export format → Server generates file → Download initiated

## External Dependencies

### Frontend Dependencies
- **@radix-ui/react-***: Accessible UI component primitives
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing
- **class-variance-authority**: Component variant utilities
- **tailwindcss**: Utility-first CSS framework

### Backend Dependencies
- **drizzle-orm**: Type-safe ORM for PostgreSQL
- **@neondatabase/serverless**: Neon database client
- **multer**: File upload middleware
- **express**: Web framework

### Python Processing Dependencies
- **ezdxf**: DXF file parsing and manipulation
- **pdf2image**: PDF to image conversion
- **opencv-python**: Computer vision for image processing
- **numpy**: Numerical computing

## Deployment Strategy

### Development Environment
- Vite dev server with HMR for frontend development
- Express server with tsx for TypeScript execution
- Database migrations handled via Drizzle Kit
- Python environment with required CAD processing libraries

### Production Build
- Frontend: Vite builds to static assets in dist/public
- Backend: esbuild bundles server code for Node.js execution
- Database: PostgreSQL via Neon with connection pooling
- File storage: Local filesystem with potential for cloud migration

### Environment Configuration
- Database URL configuration via environment variables
- File upload directory configuration
- Python script path resolution
- CORS and security headers for production

The application is designed as a monorepo with shared TypeScript schemas between frontend and backend, ensuring type safety across the full stack. The architecture supports horizontal scaling and can be deployed on various platforms including Replit, Vercel, or traditional VPS hosting.