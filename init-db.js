import postgres from 'postgres';

const sql = postgres('postgresql://de_de:PUPB8V0s2b3bvNZUblolz7d6UM9bcBzb@dpg-d1h53rffte5s739b1i40-a.oregon-postgres.render.com/dwg_analyzer_pro', {
  ssl: 'require'
});

async function initDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS "floor_plans" (
        "id" serial PRIMARY KEY NOT NULL,
        "filename" text NOT NULL,
        "original_name" text NOT NULL,
        "file_type" text NOT NULL,
        "file_size" integer NOT NULL,
        "status" text DEFAULT 'uploading' NOT NULL,
        "error_message" text,
        "uploaded_at" timestamp DEFAULT now() NOT NULL,
        "processed_at" timestamp,
        "total_area" real,
        "perimeter" real,
        "wall_thickness" real,
        "ceiling_height" real,
        "layers" integer,
        "geometric_objects" integer,
        "doors" integer,
        "windows" integer,
        "stairs" integer,
        "columns" integer,
        "geometry_data" jsonb,
        "rooms_data" jsonb,
        "measurements_data" jsonb,
        "ilot_layout" jsonb,
        "total_ilots" integer,
        "total_corridors" integer,
        "space_efficiency" real
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "rooms" (
        "id" serial PRIMARY KEY NOT NULL,
        "floor_plan_id" integer NOT NULL,
        "name" text NOT NULL,
        "type" text NOT NULL,
        "area" real NOT NULL,
        "width" real,
        "height" real,
        "shape" text,
        "color" text NOT NULL,
        "min_x" real NOT NULL,
        "min_y" real NOT NULL,
        "max_x" real NOT NULL,
        "max_y" real NOT NULL,
        "boundaries" jsonb
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "measurements" (
        "id" serial PRIMARY KEY NOT NULL,
        "floor_plan_id" integer NOT NULL,
        "type" text NOT NULL,
        "value" real NOT NULL,
        "unit" text DEFAULT 'm' NOT NULL,
        "start_x" real,
        "start_y" real,
        "end_x" real,
        "end_y" real,
        "label" text,
        "annotations" jsonb
      );
    `;

    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();