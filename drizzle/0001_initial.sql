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

DO $$ BEGIN
 ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_plan_id_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "measurements" ADD CONSTRAINT "measurements_floor_plan_id_floor_plans_id_fk" FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;