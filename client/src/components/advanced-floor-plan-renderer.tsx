import React, { useRef, useCallback, useState } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Ilot, Corridor, GeometryData } from '@shared/schema';
import { VisualizationOptions } from '@/lib/visualization-state';

// Define professional color palette based on requirements
const COLORS = {
  BACKGROUND: 0xFFFFFF,
  WALL: 0x27272A, // Black
  RESTRICTED: 0xBFDBFE, // Light Blue
  RESTRICTED_OUTLINE: 0x3B82F6,
  ENTRANCE: 0xFECACA, // Light Red
  ENTRANCE_OUTLINE: 0xEF4444,
  ILOT: 0xFEF2F2, // Very Light Pink/Red
  ILOT_OUTLINE: 0xF87171,
  CORRIDOR: 0xFFE4E6, // Light Pink
  CORRIDOR_OUTLINE: 0xF43F5E,
  TEXT: 0x111827, // Dark Gray for text
  GRID: 0xE5E7EB,
};

interface Props
{
  className?: string;
  basePlanData?: GeometryData;
  layout?: {
    ilots: Ilot[];
    corridors: Corridor[];
  };
  options: VisualizationOptions;
  onIlotSelect?: ( ilot: Ilot ) => void;
  onCorridorSelect?: ( corridor: Corridor ) => void;
}

export function AdvancedFloorPlanRenderer ( {
  className,
  basePlanData,
  layout,
  options,
  onIlotSelect,
  onCorridorSelect,
}: Props )
{
  const stageRef = useRef<any>( null );
  const [ scale, setScale ] = useState( 1 );
  const [ position, setPosition ] = useState( { x: 0, y: 0 } );
  const [ isDragging, setIsDragging ] = useState( false );
  const [ dragStart, setDragStart ] = useState( { x: 0, y: 0 } );

  const handleWheel = useCallback( ( event: React.WheelEvent ) =>
  {
    event.preventDefault();
    const delta = -event.deltaY;
    const scaleFactor = 1.1;
    const newScale = delta > 0 ? scale * scaleFactor : scale / scaleFactor;
    setScale( Math.max( 0.1, Math.min( 5, newScale ) ) );
  }, [ scale ] );

  const handleMouseDown = useCallback( ( event: React.MouseEvent ) =>
  {
    setIsDragging( true );
    setDragStart( { x: event.clientX, y: event.clientY } );
  }, [] );

  const handleMouseUp = useCallback( () => setIsDragging( false ), [] );

  const handleMouseMove = useCallback(
    ( event: React.MouseEvent ) =>
    {
      if ( !isDragging ) return;
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      setPosition( prev => ( { x: prev.x + deltaX, y: prev.y + deltaY } ) );
      setDragStart( { x: event.clientX, y: event.clientY } );
    },
    [ isDragging, dragStart ]
  );

  // Drawing callbacks for PIXI.Graphics
  const drawWall = useCallback( ( g: PIXI.Graphics, wall: any ) =>
  {
    g.clear()
      .lineStyle( wall.thickness || 4, COLORS.WALL )
      .moveTo( wall.start.x, wall.start.y )
      .lineTo( wall.end.x, wall.end.y );
  }, [] );

  const drawZone = useCallback( ( g: PIXI.Graphics, zone: any, fill: number, stroke: number ) =>
  {
    g.clear()
      .beginFill( fill )
      .lineStyle( 2, stroke )
      .drawRect( zone.x, zone.y, zone.width, zone.height )
      .endFill();
  }, [] );

  const drawIlot = useCallback( ( g: PIXI.Graphics, ilot: Ilot ) =>
  {
    g.clear()
      .beginFill( COLORS.ILOT )
      .lineStyle( 2, COLORS.ILOT_OUTLINE )
      .drawRect( ilot.x, ilot.y, ilot.width, ilot.height )
      .endFill();
  }, [] );

  const drawCorridor = useCallback( ( g: PIXI.Graphics, corridor: Corridor ) =>
  {
    g.clear()
      .beginFill( COLORS.CORRIDOR, 0.8 )
      .lineStyle( 1, COLORS.CORRIDOR_OUTLINE )
      .drawRect( corridor.startX, corridor.startY, corridor.length, corridor.width )
      .endFill();
  }, [] );

  const getEntitiesByLayer = ( layerName: string ) =>
  {
    return basePlanData?.entities.filter( e => e.layer.toLowerCase().includes( layerName ) ) || [];
  };

  return (
    <Card className={ className }>
      <CardHeader>
        <CardTitle>Professional Floor Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-lg w-full h-[800px] cursor-grab active:cursor-grabbing"
          onWheel={ handleWheel }
          onMouseDown={ handleMouseDown }
          onMouseUp={ handleMouseUp }
          onMouseLeave={ handleMouseUp }
          onMouseMove={ handleMouseMove }
        >
          <Stage
            ref={ stageRef }
            width={ 1200 } // Set a fixed internal resolution
            height={ 800 }
            options={ {
              backgroundColor: COLORS.BACKGROUND,
              autoDensity: true,
              resolution: Math.max( window.devicePixelRatio || 1, 2 ),
            } }
            className="w-full h-full"
          >
            <Container position={ position } scale={ scale }>
              {/* Base Floor Plan Elements */ }
              { options.showWalls && getEntitiesByLayer( 'wall' ).map( ( wall, i ) => (
                <Graphics key={ `wall-${ i }` } draw={ ( g ) => drawWall( g, wall ) } />
              ) ) }
              { options.showRestricted && getEntitiesByLayer( 'restricted' ).map( ( zone, i ) => (
                <Graphics key={ `restricted-${ i }` } draw={ ( g ) => drawZone( g, zone, COLORS.RESTRICTED, COLORS.RESTRICTED_OUTLINE ) } />
              ) ) }
              { options.showEntrances && getEntitiesByLayer( 'entrance' ).map( ( zone, i ) => (
                <Graphics key={ `entrance-${ i }` } draw={ ( g ) => drawZone( g, zone, COLORS.ENTRANCE, COLORS.ENTRANCE_OUTLINE ) } />
              ) ) }

              {/* Detailed Layout Elements (conditionally rendered) */ }
              { options.mode === 'detailed' && (
                <>
                  { options.showCorridors && layout?.corridors.map( ( corridor ) => (
                    <Graphics key={ corridor.id } draw={ ( g ) => drawCorridor( g, corridor ) } eventMode="static" pointertap={ () => onCorridorSelect?.( corridor ) } />
                  ) ) }
                  { options.showIlots && layout?.ilots.map( ( ilot ) => (
                    <Graphics key={ ilot.id } draw={ ( g ) => drawIlot( g, ilot ) } eventMode="static" pointertap={ () => onIlotSelect?.( ilot ) } />
                  ) ) }
                  { options.showMeasurements && layout?.ilots.map( ( ilot ) => (
                    <Text
                      key={ `${ ilot.id }-text` }
                      text={ `${ ( ilot.width * ilot.height ).toFixed( 2 ) }m²` }
                      anchor={ 0.5 }
                      x={ ilot.x + ilot.width / 2 }
                      y={ ilot.y + ilot.height / 2 }
                      style={ new PIXI.TextStyle( { fontSize: 12, fill: COLORS.TEXT } ) }
                    />
                  ) ) }
                </>
              ) }
            </Container>
          </Stage>
        </div>
      </CardContent>
    </Card>
  );
}
