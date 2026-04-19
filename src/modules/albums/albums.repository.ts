import { Inject, Injectable } from '@nestjs/common';
import { albums, artists, songs } from 'src/infrastructure/drizzle/schema';
import { eq, ilike, and, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/infrastructure/drizzle/drizzle.module';
import type { DrizzleDB } from 'src/infrastructure/drizzle/drizzle.module';
import { CreateAlbumInput } from './inputs/create-album.input';
import { UpdateAlbumInput } from './inputs/update-album.input';
import { FindAlbumsInput } from './inputs/find-albums.input';

@Injectable()
export class AlbumsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Find ──────────────────────────────────────────────────────────────────

  async findAll(input: FindAlbumsInput) {
    const { artistId, search, albumType, isAfrobeats, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (artistId) conditions.push(eq(albums.artistId, artistId));
    if (search) conditions.push(ilike(albums.title, `%${search}%`));
    if (albumType) conditions.push(eq(albums.albumType, albumType));
    if (isAfrobeats !== undefined)
      conditions.push(eq(albums.isAfrobeats, isAfrobeats));

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: albums.id,
          artistId: albums.artistId,
          title: albums.title,
          slug: albums.slug,
          spotifyAlbumId: albums.spotifyAlbumId,
          albumType: albums.albumType,
          releaseDate: albums.releaseDate,
          imageUrl: albums.imageUrl,
          totalTracks: albums.totalTracks,
          isAfrobeats: albums.isAfrobeats,
          createdAt: albums.createdAt,
          artistName: artists.name,
          artistSlug: artists.slug,
        })
        .from(albums)
        .leftJoin(artists, eq(albums.artistId, artists.id))
        .where(where)
        .orderBy(albums.releaseDate)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(albums)
        .where(where),
    ]);

    return { rows, total: Number(count) };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({
        id: albums.id,
        artistId: albums.artistId,
        title: albums.title,
        slug: albums.slug,
        spotifyAlbumId: albums.spotifyAlbumId,
        albumType: albums.albumType,
        releaseDate: albums.releaseDate,
        imageUrl: albums.imageUrl,
        totalTracks: albums.totalTracks,
        isAfrobeats: albums.isAfrobeats,
        createdAt: albums.createdAt,
        artistName: artists.name,
        artistSlug: artists.slug,
      })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.id))
      .where(eq(albums.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(albums)
      .where(eq(albums.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async findBySpotifyAlbumId(spotifyAlbumId: string) {
    const [row] = await this.db
      .select()
      .from(albums)
      .where(eq(albums.spotifyAlbumId, spotifyAlbumId))
      .limit(1);
    return row ?? null;
  }

  async findWithSongs(id: string) {
    const album = await this.findById(id);
    if (!album) return null;

    const albumSongs = await this.db
      .select({
        id: songs.id,
        title: songs.title,
        slug: songs.slug,
        spotifyTrackId: songs.spotifyTrackId,
        releaseDate: songs.releaseDate,
        durationMs: songs.durationMs,
        explicit: songs.explicit,
        isAfrobeats: songs.isAfrobeats,
        entityStatus: songs.entityStatus,
      })
      .from(songs)
      .where(eq(songs.albumId, id))
      .orderBy(songs.title);

    return { ...album, songs: albumSongs };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(input: CreateAlbumInput) {
    const [created] = await this.db.insert(albums).values(input).returning();
    return created;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateAlbumInput) {
    const [updated] = await this.db
      .update(albums)
      .set(input)
      .where(eq(albums.id, id))
      .returning();
    return updated ?? null;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(albums)
      .where(eq(albums.id, id))
      .returning();
    return deleted ?? null;
  }
}
