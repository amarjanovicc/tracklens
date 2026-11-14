import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth (Better Auth core tables + our own columns on `user`)          */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // App-specific
  timezone: text("timezone").notNull().default("UTC"),
  plan: text("plan").notNull().default("free"), // free | pro
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planRenewsAt: timestamp("plan_renews_at", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Listening history                                                    */
/* ------------------------------------------------------------------ */

/**
 * One row per stream. Comes from either the Spotify "Extended streaming
 * history" privacy export (source = 'import') or from polling
 * /me/player/recently-played (source = 'api').
 *
 * Artist identity is the artist *name*: the export does not include artist
 * URIs, and grouping by name is what every comparable tool does.
 */
export const play = pgTable(
  "play",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    msPlayed: integer("ms_played").notNull(),
    kind: text("kind").notNull().default("track"), // track | episode
    trackUri: text("track_uri"),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    albumName: text("album_name"),
    platform: text("platform"), // normalised: ios, android, desktop, web, speaker, tv, car, console, other
    country: text("country"),
    reasonStart: text("reason_start"),
    reasonEnd: text("reason_end"),
    shuffle: boolean("shuffle"),
    skipped: boolean("skipped").notNull().default(false), // derived, see lib/import/normalize.ts
    offline: boolean("offline"),
    incognito: boolean("incognito"),
    source: text("source").notNull().default("import"),
  },
  (t) => [
    uniqueIndex("play_dedupe_idx").on(t.userId, t.playedAt, t.trackName, t.artistName),
    index("play_user_time_idx").on(t.userId, t.playedAt),
    index("play_user_artist_idx").on(t.userId, t.artistName),
  ],
);

export const importJob = pgTable("import_job", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("running"), // running | done | failed
  filesTotal: integer("files_total").notNull().default(0),
  rowsSeen: integer("rows_seen").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ */
/* Live Spotify connection (optional, for recently-played polling)      */
/* ------------------------------------------------------------------ */

export const spotifyConnection = pgTable("spotify_connection", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  spotifyUserId: text("spotify_user_id").notNull(),
  displayName: text("display_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Playlist tracker                                                     */
/* ------------------------------------------------------------------ */

/** Global, shared across users so every playlist is fetched once per day. */
export const playlist = pgTable("playlist", {
  spotifyId: text("spotify_id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerName: text("owner_name"),
  ownerId: text("owner_id"),
  imageUrl: text("image_url"),
  followers: integer("followers"),
  trackCount: integer("track_count"),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const playlistSnapshot = pgTable(
  "playlist_snapshot",
  {
    spotifyId: text("spotify_id")
      .notNull()
      .references(() => playlist.spotifyId, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    followers: integer("followers"),
    trackCount: integer("track_count"),
  },
  (t) => [primaryKey({ columns: [t.spotifyId, t.day] })],
);

/** Which users watch which playlists. */
export const trackedPlaylist = pgTable(
  "tracked_playlist",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spotifyId: text("spotify_id")
      .notNull()
      .references(() => playlist.spotifyId, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tracked_playlist_user_pl_idx").on(t.userId, t.spotifyId)],
);

/**
 * Track-level changes. Spotify only exposes playlist items for playlists the
 * connected user owns or collaborates on, so this is filled for those only.
 */
export const playlistEvent = pgTable(
  "playlist_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    spotifyId: text("spotify_id")
      .notNull()
      .references(() => playlist.spotifyId, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    type: text("type").notNull(), // added | removed
    trackUri: text("track_uri").notNull(),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    position: integer("position"),
  },
  (t) => [index("playlist_event_pl_idx").on(t.spotifyId, t.day)],
);

export const playlistItem = pgTable(
  "playlist_item",
  {
    spotifyId: text("spotify_id")
      .notNull()
      .references(() => playlist.spotifyId, { onDelete: "cascade" }),
    trackUri: text("track_uri").notNull(),
    trackName: text("track_name").notNull(),
    artistName: text("artist_name").notNull(),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.spotifyId, t.trackUri] })],
);

/* ------------------------------------------------------------------ */
/* Public share links ("Wrapped, any time")                             */
/* ------------------------------------------------------------------ */

export const shareLink = pgTable("share_link", {
  slug: text("slug").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  rangeFrom: timestamp("range_from", { withTimezone: true }),
  rangeTo: timestamp("range_to", { withTimezone: true }),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  play,
  importJob,
  spotifyConnection,
  playlist,
  playlistSnapshot,
  trackedPlaylist,
  playlistEvent,
  playlistItem,
  shareLink,
};
