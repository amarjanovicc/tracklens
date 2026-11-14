CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"files_total" integer DEFAULT 0 NOT NULL,
	"rows_seen" integer DEFAULT 0 NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "play" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"ms_played" integer NOT NULL,
	"kind" text DEFAULT 'track' NOT NULL,
	"track_uri" text,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"album_name" text,
	"platform" text,
	"country" text,
	"reason_start" text,
	"reason_end" text,
	"shuffle" boolean,
	"skipped" boolean DEFAULT false NOT NULL,
	"offline" boolean,
	"incognito" boolean,
	"source" text DEFAULT 'import' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist" (
	"spotify_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_name" text,
	"owner_id" text,
	"image_url" text,
	"followers" integer,
	"track_count" integer,
	"last_fetched_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "playlist_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"spotify_id" text NOT NULL,
	"day" date NOT NULL,
	"type" text NOT NULL,
	"track_uri" text NOT NULL,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"position" integer
);
--> statement-breakpoint
CREATE TABLE "playlist_item" (
	"spotify_id" text NOT NULL,
	"track_uri" text NOT NULL,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone,
	CONSTRAINT "playlist_item_spotify_id_track_uri_pk" PRIMARY KEY("spotify_id","track_uri")
);
--> statement-breakpoint
CREATE TABLE "playlist_snapshot" (
	"spotify_id" text NOT NULL,
	"day" date NOT NULL,
	"followers" integer,
	"track_count" integer,
	CONSTRAINT "playlist_snapshot_spotify_id_day_pk" PRIMARY KEY("spotify_id","day")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"slug" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"range_from" timestamp with time zone,
	"range_to" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_connection" (
	"user_id" text PRIMARY KEY NOT NULL,
	"spotify_user_id" text NOT NULL,
	"display_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_playlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"spotify_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_renews_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play" ADD CONSTRAINT "play_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_event" ADD CONSTRAINT "playlist_event_spotify_id_playlist_spotify_id_fk" FOREIGN KEY ("spotify_id") REFERENCES "public"."playlist"("spotify_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_item" ADD CONSTRAINT "playlist_item_spotify_id_playlist_spotify_id_fk" FOREIGN KEY ("spotify_id") REFERENCES "public"."playlist"("spotify_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_snapshot" ADD CONSTRAINT "playlist_snapshot_spotify_id_playlist_spotify_id_fk" FOREIGN KEY ("spotify_id") REFERENCES "public"."playlist"("spotify_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_connection" ADD CONSTRAINT "spotify_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_playlist" ADD CONSTRAINT "tracked_playlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_playlist" ADD CONSTRAINT "tracked_playlist_spotify_id_playlist_spotify_id_fk" FOREIGN KEY ("spotify_id") REFERENCES "public"."playlist"("spotify_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "play_dedupe_idx" ON "play" USING btree ("user_id","played_at","track_name","artist_name");--> statement-breakpoint
CREATE INDEX "play_user_time_idx" ON "play" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "play_user_artist_idx" ON "play" USING btree ("user_id","artist_name");--> statement-breakpoint
CREATE INDEX "playlist_event_pl_idx" ON "playlist_event" USING btree ("spotify_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_playlist_user_pl_idx" ON "tracked_playlist" USING btree ("user_id","spotify_id");