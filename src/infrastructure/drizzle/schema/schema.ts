import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { defaultId } from '../default-id';
// ─────────────────────────────────────────────────────────────────────────────
// ARTISTS
// ─────────────────────────────────────────────────────────────────────────────

export const artists = pgTable(
  'artists',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    name: text('name').notNull(),
    spotifyId: text('spotify_id'),
    slug: text('slug').notNull(),
    originCountry: text('origin_country'), // ISO-2: 'NG', 'GH', 'KE'
    debutYear: integer('debut_year'),
    imageUrl: text('image_url'),
    popularity: integer('popularity'), // Spotify 0–100, refreshed nightly
    isAfrobeats: boolean('is_afrobeats').notNull().default(false),
    isAfrobeatsOverride: boolean('is_afrobeats_override')
      .notNull()
      .default(false), // manual editorial flag
    bio: text('bio'),

    kworbStatus: text('kworb_status'), // 'pending' | 'found' | 'not_found'
    kworbLastCheckedAt: timestamp('kworb_last_checked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('artists_spotify_id_idx').on(t.spotifyId),
    uniqueIndex('artists_slug_idx').on(t.slug),
    index('artists_origin_country_idx').on(t.originCountry),
    index('artists_is_afrobeats_idx').on(t.isAfrobeats),
    index('artists_popularity_idx').on(t.popularity),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST GENRES
// ─────────────────────────────────────────────────────────────────────────────

export const artistGenres = pgTable(
  'artist_genres',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    genre: text('genre').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => [
    uniqueIndex('artist_genres_artist_genre_idx').on(t.artistId, t.genre),
    index('artist_genres_genre_idx').on(t.genre),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// ALBUMS
// ─────────────────────────────────────────────────────────────────────────────

export const albums = pgTable(
  'albums',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    spotifyAlbumId: text('spotify_album_id').notNull(),
    albumType: text('album_type').notNull().default('album'), // 'album' | 'ep' | 'single'
    releaseDate: date('release_date'),
    imageUrl: text('image_url'),
    totalTracks: integer('total_tracks'),
    isAfrobeats: boolean('is_afrobeats').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('albums_spotify_album_id_idx').on(t.spotifyAlbumId),
    index('albums_artist_id_idx').on(t.artistId),
    index('albums_release_date_idx').on(t.releaseDate),
    index('albums_is_afrobeats_idx').on(t.isAfrobeats),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// SONGS
// ─────────────────────────────────────────────────────────────────────────────

export const songs = pgTable(
  'songs',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').references(() => albums.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    spotifyTrackId: text('spotify_track_id'),
    releaseDate: date('release_date'),
    durationMs: integer('duration_ms'),
    explicit: boolean('explicit').notNull().default(false),
    isAfrobeats: boolean('is_afrobeats').notNull().default(false),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('songs_spotify_track_id_idx').on(t.spotifyTrackId),
    uniqueIndex('songs_slug_idx').on(t.slug),
    index('songs_artist_id_idx').on(t.artistId),
    index('songs_album_id_idx').on(t.albumId),
    index('songs_release_date_idx').on(t.releaseDate),
    index('songs_is_afrobeats_idx').on(t.isAfrobeats),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// SONG FEATURES (collaborators)
// ─────────────────────────────────────────────────────────────────────────────

export const songFeatures = pgTable(
  'song_features',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    featuredArtistId: uuid('featured_artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('song_features_song_artist_idx').on(
      t.songId,
      t.featuredArtistId,
    ),
    index('song_features_featured_artist_idx').on(t.featuredArtistId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST STATS SNAPSHOTS
// nightly cron — one row per artist per day
// ─────────────────────────────────────────────────────────────────────────────

export const artistStatsSnapshots = pgTable(
  'artist_stats_snapshots',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),

    artistId: uuid('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),

    totalStreams: bigint('total_streams', { mode: 'number' }),
    totalStreamsAsLead: bigint('total_streams_as_lead', { mode: 'number' }),
    totalStreamsSolo: bigint('total_streams_solo', { mode: 'number' }),
    totalStreamsAsFeature: bigint('total_streams_as_feature', {
      mode: 'number',
    }),

    dailyStreams: bigint('daily_streams', { mode: 'number' }),
    dailyStreamsAsLead: bigint('daily_streams_as_lead', { mode: 'number' }),
    dailyStreamsAsFeature: bigint('daily_streams_as_feature', {
      mode: 'number',
    }),

    trackCount: integer('track_count'),
    sourceUpdatedAt: date('source_updated_at'),
    snapshotDate: date('snapshot_date').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('artist_stats_artist_date_idx').on(t.artistId, t.snapshotDate),
    index('artist_stats_snapshot_date_idx').on(t.snapshotDate),
    index('artist_stats_total_streams_idx').on(t.totalStreams),
    index('artist_stats_daily_streams_idx').on(t.dailyStreams),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// SONG STATS SNAPSHOTS
// nightly cron — one row per song per day
// ─────────────────────────────────────────────────────────────────────────────

export const songStatsSnapshots = pgTable(
  'song_stats_snapshots',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    spotifyStreams: bigint('spotify_streams', { mode: 'number' }),
    snapshotDate: date('snapshot_date').notNull(),
  },
  (t) => [
    uniqueIndex('song_stats_song_date_idx').on(t.songId, t.snapshotDate),
    index('song_stats_snapshot_date_idx').on(t.snapshotDate),
    index('song_stats_streams_idx').on(t.spotifyStreams),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATIONS
// RIAA (US), BPI (UK), IFPI (global) etc.
// ─────────────────────────────────────────────────────────────────────────────

export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id').references(() => artists.id, {
      onDelete: 'cascade',
    }),
    songId: uuid('song_id').references(() => songs.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').references(() => albums.id, {
      onDelete: 'cascade',
    }),
    territory: text('territory').notNull(),
    body: text('body').notNull(),
    title: text('title').notNull().default(''), // add title here
    level: text('level').notNull(),
    units: bigint('units', { mode: 'number' }),
    certifiedAt: date('certified_at'),
    sourceUrl: text('source_url'),
  },
  (t) => [
    index('certs_artist_territory_idx').on(t.artistId, t.territory),
    index('certs_song_territory_idx').on(t.songId, t.territory),
    index('certs_territory_level_idx').on(t.territory, t.level),
    index('certs_certified_at_idx').on(t.certifiedAt),
    // title included — each certified title is a unique record
    uniqueIndex('certs_unique_idx').on(
      t.artistId,
      t.territory,
      t.body,
      t.title,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// CHART ENTRIES
// one row = one song on one chart for one week
// ─────────────────────────────────────────────────────────────────────────────

export const chartEntries = pgTable(
  'chart_entries',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id').references(() => artists.id, {
      onDelete: 'cascade',
    }),
    songId: uuid('song_id').references(() => songs.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').references(() => albums.id, {
      onDelete: 'cascade',
    }),
    chartName: text('chart_name').notNull(), // 'billboard_hot_100' | 'uk_official' | 'tooxclusive_afrobeats_100'
    chartTerritory: text('chart_territory'), // 'US' | 'UK' | 'NG' | 'GLOBAL'
    position: integer('position').notNull(),
    peakPosition: integer('peak_position'),
    weeksOnChart: integer('weeks_on_chart'),
    chartWeek: date('chart_week').notNull(),
  },
  (t) => [
    uniqueIndex('chart_entries_song_chart_week_idx').on(
      t.songId,
      t.chartName,
      t.chartWeek,
    ),
    index('chart_entries_chart_week_idx').on(t.chartName, t.chartWeek),
    index('chart_entries_artist_chart_idx').on(t.artistId, t.chartName),
    index('chart_entries_position_idx').on(t.chartName, t.position),
    index('chart_entries_peak_idx').on(t.chartName, t.peakPosition),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// AWARD RECORDS
// ─────────────────────────────────────────────────────────────────────────────

export const awardRecords = pgTable(
  'award_records',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id').references(() => artists.id, {
      onDelete: 'cascade',
    }),
    songId: uuid('song_id').references(() => songs.id, {
      onDelete: 'set null',
    }),
    albumId: uuid('album_id').references(() => albums.id, {
      onDelete: 'set null',
    }),
    awardBody: text('award_body').notNull(), // 'Grammy' | 'BET' | 'MTV VMA'
    awardName: text('award_name').notNull(), // 'Best Global Music Album'
    category: text('category').notNull(), // 'Album' | 'Song' | 'Artist'
    result: text('result').notNull(), // 'won' | 'nominated'
    year: integer('year').notNull(),
    ceremony: text('ceremony'), // '66th Grammy Awards'
    territory: text('territory'), // 'US' | 'GLOBAL'
    sourceUrl: text('source_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('awards_artist_idx').on(t.artistId),
    index('awards_year_idx').on(t.year),
    index('awards_body_idx').on(t.awardBody),
    index('awards_result_idx').on(t.result),
    uniqueIndex('awards_unique_idx').on(
      t.artistId,
      t.awardBody,
      t.awardName,
      t.year,
    ),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// RECORDS (stat milestones)
// powers "who has the most X" queries directly
// ─────────────────────────────────────────────────────────────────────────────

export const records = pgTable(
  'records',
  {
    id: uuid('id').primaryKey().$defaultFn(defaultId),
    artistId: uuid('artist_id').references(() => artists.id, {
      onDelete: 'cascade',
    }),
    songId: uuid('song_id').references(() => songs.id, { onDelete: 'cascade' }),
    albumId: uuid('album_id').references(() => albums.id, {
      onDelete: 'cascade',
    }),
    recordType: text('record_type').notNull(), // 'most_streamed_song' | 'fastest_to_1b' | 'most_weeks_number_1'
    recordValue: text('record_value').notNull(), // '5260000000' | '78 days' | '27 weeks'
    numericValue: bigint('numeric_value', { mode: 'number' }), // for sorting/ranking queries
    scope: text('scope').notNull(), // 'global' | 'afrobeats' | 'nigeria' | 'uk'
    isActive: boolean('is_active').notNull().default(true), // false when record is broken
    setOn: date('set_on'),
    brokenOn: date('broken_on'),
    notes: text('notes'),
  },
  (t) => [
    index('records_scope_type_idx').on(t.scope, t.recordType),
    index('records_artist_idx').on(t.artistId),
    index('records_song_idx').on(t.songId),
    index('records_is_active_idx').on(t.isActive),
    index('records_numeric_value_idx').on(t.recordType, t.numericValue),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const artistsRelations = relations(artists, ({ many }) => ({
  genres: many(artistGenres),
  albums: many(albums),
  songs: many(songs),
  features: many(songFeatures),
  statsSnapshots: many(artistStatsSnapshots),
  certifications: many(certifications),
  chartEntries: many(chartEntries),
  awardRecords: many(awardRecords),
  records: many(records),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  artist: one(artists, { fields: [albums.artistId], references: [artists.id] }),
  songs: many(songs),
  certifications: many(certifications),
  chartEntries: many(chartEntries),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  artist: one(artists, { fields: [songs.artistId], references: [artists.id] }),
  album: one(albums, { fields: [songs.albumId], references: [albums.id] }),
  features: many(songFeatures),
  statsSnapshots: many(songStatsSnapshots),
  certifications: many(certifications),
  chartEntries: many(chartEntries),
  records: many(records),
}));

export const songFeaturesRelations = relations(songFeatures, ({ one }) => ({
  song: one(songs, { fields: [songFeatures.songId], references: [songs.id] }),
  featuredArtist: one(artists, {
    fields: [songFeatures.featuredArtistId],
    references: [artists.id],
  }),
}));

export const artistStatsSnapshotsRelations = relations(
  artistStatsSnapshots,
  ({ one }) => ({
    artist: one(artists, {
      fields: [artistStatsSnapshots.artistId],
      references: [artists.id],
    }),
  }),
);

export const songStatsSnapshotsRelations = relations(
  songStatsSnapshots,
  ({ one }) => ({
    song: one(songs, {
      fields: [songStatsSnapshots.songId],
      references: [songs.id],
    }),
  }),
);

export const certificationsRelations = relations(certifications, ({ one }) => ({
  artist: one(artists, {
    fields: [certifications.artistId],
    references: [artists.id],
  }),
  song: one(songs, { fields: [certifications.songId], references: [songs.id] }),
  album: one(albums, {
    fields: [certifications.albumId],
    references: [albums.id],
  }),
}));

export const chartEntriesRelations = relations(chartEntries, ({ one }) => ({
  artist: one(artists, {
    fields: [chartEntries.artistId],
    references: [artists.id],
  }),
  song: one(songs, { fields: [chartEntries.songId], references: [songs.id] }),
  album: one(albums, {
    fields: [chartEntries.albumId],
    references: [albums.id],
  }),
}));

export const awardRecordsRelations = relations(awardRecords, ({ one }) => ({
  artist: one(artists, {
    fields: [awardRecords.artistId],
    references: [artists.id],
  }),
  song: one(songs, { fields: [awardRecords.songId], references: [songs.id] }),
  album: one(albums, {
    fields: [awardRecords.albumId],
    references: [albums.id],
  }),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  artist: one(artists, {
    fields: [records.artistId],
    references: [artists.id],
  }),
  song: one(songs, { fields: [records.songId], references: [songs.id] }),
  album: one(albums, { fields: [records.albumId], references: [albums.id] }),
}));
