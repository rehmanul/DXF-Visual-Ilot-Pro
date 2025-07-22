import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Room, Measurement, FloorPlan } from '@shared/schema';

interface FloorPlan3DViewerProps {
  floorPlan: FloorPlan;
  rooms: Room[];
  measurements: Measurement[];
  className?: string;
}

export function FloorPlan3DViewer({ floorPlan, rooms, measurements, className }: FloorPlan3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'top' | 'isometric' | 'walk'>('isometric');

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // Add lighting
    addLighting(scene);

    // Build 3D floor plan
    build3DFloorPlan(scene, rooms, measurements);

    // Set initial camera position
    setCameraPosition(camera, viewMode);

    // Add controls
    addMouseControls(camera, renderer);

    // Start animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [rooms, measurements]);

  useEffect(() => {
    if (cameraRef.current) {
      setCameraPosition(cameraRef.current, viewMode);
    }
  }, [viewMode]);

  const addLighting = (scene: THREE.Scene) => {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Point lights for interior
    const pointLight1 = new THREE.PointLight(0xfff5b7, 0.5, 100);
    pointLight1.position.set(0, 15, 0);
    scene.add(pointLight1);
  };

  const build3DFloorPlan = (scene: THREE.Scene, rooms: Room[], measurements: Measurement[]) => {
    // Calculate bounds
    const bounds = calculateBounds(rooms);
    const floorWidth = bounds.maxX - bounds.minX;
    const floorHeight = bounds.maxY - bounds.minY;

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(bounds.minX + floorWidth / 2, 0, bounds.minY + floorHeight / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Create rooms as 3D spaces
    rooms.forEach((room, index) => {
      const roomWidth = room.maxX - room.minX;
      const roomHeight = room.maxY - room.minY;
      const wallHeight = getRoomWallHeight(room.type);

      // Room walls
      const wallMaterial = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color(room.color).multiplyScalar(0.8),
        transparent: true,
        opacity: 0.7
      });

      // Create walls for room
      createRoomWalls(scene, room, wallHeight, wallMaterial);

      // Add room label
      addRoomLabel(scene, room, wallHeight);

      // Add room-specific objects
      addRoomObjects(scene, room, wallHeight);
    });

    // Add measurements as 3D annotations
    measurements.forEach(measurement => {
      if (measurement.startX !== null && measurement.startY !== null && 
          measurement.endX !== null && measurement.endY !== null) {
        addMeasurementLine3D(scene, measurement);
      }
    });
  };

  const createRoomWalls = (scene: THREE.Scene, room: Room, wallHeight: number, material: THREE.Material) => {
    const roomWidth = room.maxX - room.minX;
    const roomDepth = room.maxY - room.minY;
    const wallThickness = 0.2;

    // Front wall
    const frontWall = new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness);
    const frontWallMesh = new THREE.Mesh(frontWall, material);
    frontWallMesh.position.set(
      room.minX + roomWidth / 2,
      wallHeight / 2,
      room.minY
    );
    frontWallMesh.castShadow = true;
    scene.add(frontWallMesh);

    // Back wall
    const backWall = new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness);
    const backWallMesh = new THREE.Mesh(backWall, material);
    backWallMesh.position.set(
      room.minX + roomWidth / 2,
      wallHeight / 2,
      room.maxY
    );
    backWallMesh.castShadow = true;
    scene.add(backWallMesh);

    // Left wall
    const leftWall = new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth);
    const leftWallMesh = new THREE.Mesh(leftWall, material);
    leftWallMesh.position.set(
      room.minX,
      wallHeight / 2,
      room.minY + roomDepth / 2
    );
    leftWallMesh.castShadow = true;
    scene.add(leftWallMesh);

    // Right wall
    const rightWall = new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth);
    const rightWallMesh = new THREE.Mesh(rightWall, material);
    rightWallMesh.position.set(
      room.maxX,
      wallHeight / 2,
      room.minY + roomDepth / 2
    );
    rightWallMesh.castShadow = true;
    scene.add(rightWallMesh);
  };

  const addRoomLabel = (scene: THREE.Scene, room: Room, wallHeight: number) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = '#333333';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.fillText(room.name, canvas.width / 2, 40);
    
    context.font = '16px Arial';
    context.fillText(`${room.area.toFixed(1)} m²`, canvas.width / 2, 70);
    context.fillText(room.type, canvas.width / 2, 95);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const geometry = new THREE.PlaneGeometry(8, 4);
    const label = new THREE.Mesh(geometry, material);
    
    label.position.set(
      room.minX + (room.maxX - room.minX) / 2,
      wallHeight + 2,
      room.minY + (room.maxY - room.minY) / 2
    );
    label.lookAt(0, wallHeight + 2, 0);
    
    scene.add(label);
  };

  const addRoomObjects = (scene: THREE.Scene, room: Room, wallHeight: number) => {
    const roomWidth = room.maxX - room.minX;
    const roomDepth = room.maxY - room.minY;
    const centerX = room.minX + roomWidth / 2;
    const centerZ = room.minY + roomDepth / 2;

    switch (room.type.toLowerCase()) {
      case 'kitchen':
        addKitchenObjects(scene, centerX, centerZ, roomWidth, roomDepth, wallHeight);
        break;
      case 'bathroom':
        addBathroomObjects(scene, centerX, centerZ, roomWidth, roomDepth, wallHeight);
        break;
      case 'bedroom':
        addBedroomObjects(scene, centerX, centerZ, roomWidth, roomDepth, wallHeight);
        break;
      case 'living_room':
        addLivingRoomObjects(scene, centerX, centerZ, roomWidth, roomDepth, wallHeight);
        break;
    }
  };

  const addKitchenObjects = (scene: THREE.Scene, x: number, z: number, width: number, depth: number, wallHeight: number) => {
    // Kitchen counter
    const counterGeometry = new THREE.BoxGeometry(width * 0.6, 1, 2);
    const counterMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.set(x, 0.5, z - depth * 0.3);
    counter.castShadow = true;
    scene.add(counter);

    // Refrigerator
    const fridgeGeometry = new THREE.BoxGeometry(2, 6, 2);
    const fridgeMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
    const fridge = new THREE.Mesh(fridgeGeometry, fridgeMaterial);
    fridge.position.set(x - width * 0.3, 3, z + depth * 0.3);
    fridge.castShadow = true;
    scene.add(fridge);
  };

  const addBathroomObjects = (scene: THREE.Scene, x: number, z: number, width: number, depth: number, wallHeight: number) => {
    // Bathtub
    const tubGeometry = new THREE.BoxGeometry(4, 1.5, 2);
    const tubMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const tub = new THREE.Mesh(tubGeometry, tubMaterial);
    tub.position.set(x, 0.75, z);
    tub.castShadow = true;
    scene.add(tub);

    // Toilet
    const toiletGeometry = new THREE.CylinderGeometry(0.8, 1, 1.5, 8);
    const toiletMaterial = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
    const toilet = new THREE.Mesh(toiletGeometry, toiletMaterial);
    toilet.position.set(x + width * 0.25, 0.75, z + depth * 0.25);
    toilet.castShadow = true;
    scene.add(toilet);
  };

  const addBedroomObjects = (scene: THREE.Scene, x: number, z: number, width: number, depth: number, wallHeight: number) => {
    // Bed
    const bedGeometry = new THREE.BoxGeometry(6, 1, 4);
    const bedMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const bed = new THREE.Mesh(bedGeometry, bedMaterial);
    bed.position.set(x, 0.5, z);
    bed.castShadow = true;
    scene.add(bed);

    // Mattress
    const mattressGeometry = new THREE.BoxGeometry(5.8, 0.5, 3.8);
    const mattressMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
    mattress.position.set(x, 1.25, z);
    mattress.castShadow = true;
    scene.add(mattress);
  };

  const addLivingRoomObjects = (scene: THREE.Scene, x: number, z: number, width: number, depth: number, wallHeight: number) => {
    // Sofa
    const sofaGeometry = new THREE.BoxGeometry(8, 2, 3);
    const sofaMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const sofa = new THREE.Mesh(sofaGeometry, sofaMaterial);
    sofa.position.set(x, 1, z);
    sofa.castShadow = true;
    scene.add(sofa);

    // Coffee table
    const tableGeometry = new THREE.BoxGeometry(4, 1, 2);
    const tableMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(x, 0.5, z - 4);
    table.castShadow = true;
    scene.add(table);
  };

  const addMeasurementLine3D = (scene: THREE.Scene, measurement: Measurement) => {
    const points = [
      new THREE.Vector3(measurement.startX!, 2, measurement.startY!),
      new THREE.Vector3(measurement.endX!, 2, measurement.endY!)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    // Add measurement text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 128;
    canvas.height = 32;
    
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = '#333333';
    context.font = '14px Arial';
    context.textAlign = 'center';
    context.fillText(`${measurement.value.toFixed(1)}${measurement.unit}`, canvas.width / 2, 20);

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const textGeometry = new THREE.PlaneGeometry(4, 1);
    const textLabel = new THREE.Mesh(textGeometry, textMaterial);
    
    const midX = (measurement.startX! + measurement.endX!) / 2;
    const midZ = (measurement.startY! + measurement.endY!) / 2;
    textLabel.position.set(midX, 3, midZ);
    textLabel.lookAt(0, 3, 0);
    
    scene.add(textLabel);
  };

  const getRoomWallHeight = (roomType: string): number => {
    switch (roomType.toLowerCase()) {
      case 'bathroom': return 8;
      case 'kitchen': return 10;
      case 'bedroom': return 12;
      case 'living_room': return 14;
      default: return 10;
    }
  };

  const calculateBounds = (rooms: Room[]) => {
    if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    
    const bounds = {
      minX: Math.min(...rooms.map(r => r.minX)),
      minY: Math.min(...rooms.map(r => r.minY)),
      maxX: Math.max(...rooms.map(r => r.maxX)),
      maxY: Math.max(...rooms.map(r => r.maxY))
    };
    
    return bounds;
  };

  const setCameraPosition = (camera: THREE.PerspectiveCamera, mode: string) => {
    const bounds = calculateBounds(rooms);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minY + bounds.maxY) / 2;
    const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    switch (mode) {
      case 'top':
        camera.position.set(centerX, size * 1.5, centerZ);
        camera.lookAt(centerX, 0, centerZ);
        break;
      case 'isometric':
        camera.position.set(centerX + size, size * 0.8, centerZ + size);
        camera.lookAt(centerX, 5, centerZ);
        break;
      case 'walk':
        camera.position.set(centerX, 6, centerZ + size * 0.4);
        camera.lookAt(centerX, 6, centerZ);
        break;
    }
  };

  const addMouseControls = (camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    renderer.domElement.addEventListener('mousedown', (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
      if (isMouseDown && viewMode === 'isometric') {
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        targetX += deltaX * 0.01;
        targetY += deltaY * 0.01;
        
        const bounds = calculateBounds(rooms);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerZ = (bounds.minY + bounds.maxY) / 2;
        const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        
        camera.position.x = centerX + Math.cos(targetX) * size;
        camera.position.z = centerZ + Math.sin(targetX) * size;
        camera.position.y = size * 0.8 + Math.sin(targetY) * 20;
        
        camera.lookAt(centerX, 5, centerZ);
        
        mouseX = event.clientX;
        mouseY = event.clientY;
      }
    });

    renderer.domElement.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    renderer.domElement.addEventListener('wheel', (event) => {
      const bounds = calculateBounds(rooms);
      const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
      
      const zoomSpeed = size * 0.1;
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      
      if (event.deltaY > 0) {
        camera.position.sub(direction.multiplyScalar(zoomSpeed));
      } else {
        camera.position.add(direction.multiplyScalar(zoomSpeed));
      }
    });
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading 3D View...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* View Controls */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <div className="flex gap-2">
          {[
            { mode: 'top', label: 'Top', icon: '⬇️' },
            { mode: 'isometric', label: '3D', icon: '📐' },
            { mode: 'walk', label: 'Walk', icon: '🚶' }
          ].map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === mode 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-1">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
        <p className="text-xs text-gray-600">
          {viewMode === 'isometric' ? '🖱️ Click and drag to rotate • Scroll to zoom' :
           viewMode === 'walk' ? '🖱️ Click and drag to look around • Scroll to zoom' :
           '🖱️ Scroll to zoom in/out'}
        </p>
      </div>
    </div>
  );
}