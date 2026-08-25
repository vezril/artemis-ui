import { METATAG_ENUMS, parseTerm, parseTerms } from "@/lib/catalog/dsl";
import type { ArtemisClient } from "./client";
import {
  ApiError,
  type AutocompleteContext,
  type Facets,
  type Health,
  type Post,
  type PostPage,
  type PostStatusResult,
  type PostSummary,
  type PurgeOutcome,
  type Rating,
  type ReprocessRequest,
  type ReprocessResult,
  type SearchQuery,
  type Suggestion,
  type SweepOutcome,
  type UploadResult,
} from "./types";

/**
 * How many `getPost` polls a freshly-uploaded fixture post stays `pending` before
 * it flips to `active`. Small enough that the lifecycle is demonstrable offline and
 * deterministic for tests (each `getPost` is one poll).
 */
export const FIXTURE_UPLOAD_POLLS_TO_ACTIVE = 2;

/**
 * A representative Prometheus exposition, shaped like Artemis's `/metrics`, so the
 * dashboard renders and the parser is exercised without a live service. Values drift
 * a little per call so sparklines animate in fixture mode.
 */
function metricsSample(tick: number): string {
  const jitter = (base: number, amp: number) =>
    (base + amp * Math.sin(tick / 3) + amp * 0.3 * ((tick % 5) - 2)).toFixed(3);
  // Uses Artemis's REAL metric names (Prometheus JVM client + its artemis_* counters), so the
  // curated cards render the same signals in fixtures and against the live service.
  return `# HELP artemis_ready Whether the service is ready (1) or not (0).
# TYPE artemis_ready gauge
artemis_ready 1
# HELP jvm_memory_bytes_used Used bytes of a given JVM memory area.
# TYPE jvm_memory_bytes_used gauge
jvm_memory_bytes_used{area="heap"} ${jitter(4.2e8, 3e7)}
jvm_memory_bytes_used{area="nonheap"} ${jitter(1.1e8, 5e6)}
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes ${jitter(6.1e8, 2e7)}
# HELP jvm_threads_current Current thread count of a JVM.
# TYPE jvm_threads_current gauge
jvm_threads_current ${jitter(48, 4)}
# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds ${Math.round(+jitter(120, 12))}
# HELP artemis_consume_messages_applied_total Media-result messages successfully handled and acked by the consume loop.
# TYPE artemis_consume_messages_applied_total counter
artemis_consume_messages_applied_total ${Math.floor(8800 + tick * 3)}
# HELP artemis_consume_polls_total Consume-loop poll cycles.
# TYPE artemis_consume_polls_total counter
artemis_consume_polls_total ${Math.floor(12000 + tick * 7)}
# HELP artemis_consume_poll_failures_total Consume-loop poll failures.
# TYPE artemis_consume_poll_failures_total counter
artemis_consume_poll_failures_total ${Math.floor(3 + tick * 0.02)}
`;
}

// --- catalog fixtures -------------------------------------------------------
//
// A small in-memory catalog so search/gallery/post render offline (no live media
// server, so tiles fall back to placeholders). Ids are fixed strings (ULID-ish)
// so component tests are deterministic. Tag categories follow the wire numbers
// (0 general · 1 artist · 3 copyright · 4 character · 5 meta).

/** Fixture tag vocabulary: name → { category, postCount } (+ a couple of aliases). */
const TAG_VOCAB: Record<string, { category: number; postCount: number }> = {
  "1girl": { category: 0, postCount: 4200 },
  "1boy": { category: 0, postCount: 1800 },
  solo: { category: 0, postCount: 3900 },
  long_hair: { category: 0, postCount: 2600 },
  smile: { category: 0, postCount: 2100 },
  outdoors: { category: 0, postCount: 900 },
  cat_ears: { category: 0, postCount: 640 },
  sky: { category: 0, postCount: 720 },
  cloud: { category: 0, postCount: 510 },
  weapon: { category: 0, postCount: 480 },
  night: { category: 0, postCount: 300 },
  wlop: { category: 1, postCount: 210 },
  sakimichan: { category: 1, postCount: 180 },
  original: { category: 3, postCount: 5200 },
  genshin_impact: { category: 3, postCount: 3100 },
  hu_tao: { category: 4, postCount: 820 },
  raiden_shogun: { category: 4, postCount: 760 },
  highres: { category: 5, postCount: 8800 },
  absurdres: { category: 5, postCount: 4400 },
  animated: { category: 5, postCount: 260 },
};

/** Alias antecedents that resolve to a canonical tag (for the alias hint). */
const TAG_ALIASES: Record<string, string> = {
  neko_ears: "cat_ears",
  girl: "1girl",
};

function categoryOf(name: string): number {
  return TAG_VOCAB[name]?.category ?? 0;
}

const imageDerivatives = [
  { kind: "thumbnail", variant: "thumb.webp" },
  { kind: "sample", variant: "sample.webp" },
  { kind: "original", variant: "original.png" },
];
const videoDerivatives = [
  { kind: "thumbnail", variant: "thumb.webp" },
  { kind: "transcode", variant: "720p.mp4" },
];

const FIXTURE_POSTS: PostSummary[] = [
  {
    id: "01J8A0",
    status: "active",
    tags: ["1girl", "solo", "long_hair", "smile", "genshin_impact", "hu_tao", "wlop", "highres"],
    rating: "s",
    score: 142,
    favCount: 88,
    width: 1200,
    height: 1600,
    createdAt: "2026-08-20T12:00:00Z",
    md5: "aaaa1111",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A1",
    status: "active",
    tags: ["1girl", "solo", "cat_ears", "outdoors", "sky", "original", "sakimichan", "absurdres"],
    rating: "g",
    score: 95,
    favCount: 54,
    width: 1500,
    height: 1000,
    createdAt: "2026-08-19T09:30:00Z",
    md5: "bbbb2222",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A2",
    status: "active",
    tags: ["1boy", "solo", "weapon", "night", "genshin_impact", "raiden_shogun", "highres"],
    rating: "q",
    score: 61,
    favCount: 27,
    width: 1080,
    height: 1350,
    createdAt: "2026-08-18T22:15:00Z",
    md5: "cccc3333",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A3",
    status: "active",
    tags: ["1girl", "long_hair", "cloud", "sky", "original", "highres"],
    rating: "g",
    score: 210,
    favCount: 130,
    width: 1600,
    height: 900,
    createdAt: "2026-08-17T08:00:00Z",
    md5: "dddd4444",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A4",
    status: "active",
    tags: ["1girl", "solo", "smile", "genshin_impact", "hu_tao", "animated"],
    rating: "s",
    score: 78,
    favCount: 44,
    width: 1280,
    height: 720,
    duration: 12,
    createdAt: "2026-08-16T14:45:00Z",
    md5: "eeee5555",
    derivatives: videoDerivatives,
  },
  {
    id: "01J8A5",
    status: "active",
    tags: ["1boy", "1girl", "outdoors", "smile", "original", "wlop", "absurdres"],
    rating: "g",
    score: 33,
    favCount: 12,
    width: 2000,
    height: 1333,
    createdAt: "2026-08-15T18:20:00Z",
    md5: "ffff6666",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A6",
    status: "active",
    tags: ["1girl", "solo", "cat_ears", "long_hair", "night", "genshin_impact", "raiden_shogun"],
    rating: "q",
    score: 187,
    favCount: 101,
    width: 1440,
    height: 1800,
    createdAt: "2026-08-14T03:10:00Z",
    md5: "77778888",
    derivatives: imageDerivatives,
  },
  {
    id: "01J8A7",
    status: "active",
    // A "pending" post with no derivatives — exercises the placeholder path.
    tags: ["1girl", "original"],
    rating: "e",
    score: 5,
    favCount: 1,
    width: 800,
    height: 1200,
    createdAt: "2026-08-13T20:05:00Z",
    md5: "9999aaaa",
    derivatives: [],
  },
];

const FIXTURE_BY_ID = new Map(FIXTURE_POSTS.map((p) => [p.id, p]));

/** A wildcard-aware tag matcher (`cat_*` / `*_ears`); exact otherwise. */
function tagMatches(pattern: string, tag: string): boolean {
  if (pattern.includes("*")) {
    const re = new RegExp(
      "^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$",
    );
    return re.test(tag);
  }
  return pattern === tag;
}

/** Filter the fixture set by a DSL string (plain / `-` / `~` / `rating:` terms). */
function filterPosts(dsl: string): PostSummary[] {
  const terms = parseTerms(dsl).map(parseTerm);
  const includes = terms.filter((t) => !t.negated && !t.or && !t.metatag).map((t) => t.value);
  const excludes = terms.filter((t) => t.negated && !t.metatag).map((t) => t.value);
  const ors = terms.filter((t) => t.or && !t.metatag).map((t) => t.value);
  const ratings = terms
    .filter((t) => t.metatag?.key === "rating")
    .map((t) => t.metatag!.value);

  return FIXTURE_POSTS.filter((post) => {
    if (post.status !== "active") return false;
    if (!includes.every((p) => post.tags.some((tag) => tagMatches(p, tag)))) return false;
    if (excludes.some((p) => post.tags.some((tag) => tagMatches(p, tag)))) return false;
    if (ors.length > 0 && !ors.some((p) => post.tags.some((tag) => tagMatches(p, tag)))) return false;
    if (ratings.length > 0 && !(post.rating && ratings.includes(post.rating))) return false;
    return true;
  });
}

/** Deterministic hash for a stable fixture "random" order. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sortPosts(posts: PostSummary[], order: SearchQuery["order"]): PostSummary[] {
  const sorted = [...posts];
  switch (order) {
    case "score":
      sorted.sort((a, b) => b.score - a.score || b.id.localeCompare(a.id));
      break;
    case "favcount":
      sorted.sort((a, b) => b.favCount - a.favCount || b.id.localeCompare(a.id));
      break;
    case "duration":
      sorted.sort((a, b) => (b.duration ?? -1) - (a.duration ?? -1) || b.id.localeCompare(a.id));
      break;
    case "random":
      sorted.sort((a, b) => hash(a.id) - hash(b.id));
      break;
    default: // "id" — newest first (ULIDs sort lexicographically by time)
      sorted.sort((a, b) => b.id.localeCompare(a.id));
  }
  return sorted;
}

export function fixtureClient(): ArtemisClient {
  let tick = 0;
  // A tiny in-memory post-status map so delete → restore → purge produce believable transitions
  // offline, including a terminal `purged` state (a purged post can't be re-purged/restored — the
  // live endpoints would 404). Unknown ids behave like an active post.
  const status = new Map<string, "active" | "deleted" | "purged">();
  const statusOf = (id: string) => status.get(id) ?? "active";
  // A mutable overlay of full posts, materialized lazily from the summary set on
  // first read. The write methods mutate this so edits (tags/favorite/score/rating)
  // persist within a session — GET /posts/{id} reflects them (read-your-writes).
  const posts = new Map<string, Post>();
  function livePost(id: string): Post | null {
    const existing = posts.get(id);
    if (existing) return existing;
    const summary = FIXTURE_BY_ID.get(id);
    if (!summary) return null;
    const post: Post = {
      id: summary.id,
      status: summary.status,
      tags: [...summary.tags],
      rating: summary.rating,
      score: summary.score,
      favorited: false,
      parent: summary.parent,
      source: "https://example.invalid/source",
      md5: summary.md5,
      filetype: summary.duration != null ? "mp4" : "png",
      width: summary.width,
      height: summary.height,
      duration: summary.duration,
      derivatives: summary.derivatives,
    };
    posts.set(id, post);
    return post;
  }
  // Uploaded-post lifecycle: an uploaded fixture post starts `pending` and flips to
  // `active` after a few `getPost` polls, so the pending→active flow is demonstrable
  // offline (and deterministic in tests — each getPost is one poll). Maps a post id to
  // how many times it has been polled while pending.
  const uploadPolls = new Map<string, number>();
  let uploadSeq = 0;
  /** Advance an uploaded post's lifecycle on each poll; flip pending→active at the threshold. */
  function advanceUpload(post: Post): void {
    if (!uploadPolls.has(post.id) || post.status !== "pending") return;
    const polls = (uploadPolls.get(post.id) ?? 0) + 1;
    uploadPolls.set(post.id, polls);
    if (polls >= FIXTURE_UPLOAD_POLLS_TO_ACTIVE) {
      post.status = "active";
      // Processing completed → derivatives now exist (a sample joins the thumbnail).
      post.derivatives =
        post.filetype === "mp4" ? [...videoDerivatives] : [...imageDerivatives];
    }
  }
  // A fixture pool of orphan debris that a real sweep would clear.
  let orphans = 4;
  return {
    live: false,
    baseUrl: null,

    async getHealth(): Promise<Health> {
      return { status: "UP", service: "artemis", version: "1.1.1" };
    },

    async getMetricsText(): Promise<string> {
      return metricsSample(tick++);
    },

    async reprocess(req: ReprocessRequest): Promise<ReprocessResult> {
      if (!req.select.trim()) throw new ApiError("empty selection", 400);
      // Pretend a plausible enqueue count keyed off the selection shape.
      const enqueued = req.select === "stale" ? 128 : req.select.startsWith("id:") ? 1 : 42;
      return { enqueued };
    },

    async previewSelectionCount(): Promise<number | null> {
      // Fixtures have no catalog to count against.
      return null;
    },

    async deletePost(id: string): Promise<PostStatusResult> {
      if (statusOf(id) === "purged") throw new ApiError("post not found", 404);
      status.set(id, "deleted");
      return { id, status: "deleted" };
    },

    async restorePost(id: string): Promise<PostStatusResult> {
      if (statusOf(id) === "purged") throw new ApiError("post not found", 404);
      status.set(id, "active");
      return { id, status: "active" };
    },

    async purgePost(id: string): Promise<PurgeOutcome> {
      if (statusOf(id) === "deleted") {
        status.set(id, "purged"); // terminal — a re-purge is a no-op
        return { purged: true, blobsDeleted: 3 };
      }
      return { purged: false, blobsDeleted: 0 };
    },

    async orphanSweep(dryRun: boolean): Promise<SweepOutcome> {
      const scanned = 42;
      const found = orphans;
      if (!dryRun) orphans = 0; // a real sweep clears the debris
      return { scanned, orphans: found, deleted: dryRun ? 0 : found };
    },

    async purgeDeleted(): Promise<number> {
      // Purge the soft-deleted fixtures that are "past retention" (→ terminal purged).
      let purged = 0;
      for (const [id, s] of status) {
        if (s === "deleted") {
          status.set(id, "purged");
          purged += 1;
        }
      }
      return purged;
    },

    // --- catalog: read surface ---------------------------------------------

    async searchPosts(query: SearchQuery): Promise<PostPage> {
      const limit = Math.max(1, Math.min(200, query.limit ?? 40));
      const offset = cursorOffset(query.cursor);
      const filtered = sortPosts(filterPosts(query.tags), query.order);
      const page = filtered.slice(offset, offset + limit);
      const end = offset + limit;
      return { posts: page, nextCursor: end < filtered.length ? `off:${end}` : null };
    },

    async getPost(id: string): Promise<Post> {
      const post = livePost(id);
      if (!post || statusOf(id) === "purged") throw new ApiError("post not found", 404);
      // An uploaded post advances its ingest lifecycle one step per poll.
      advanceUpload(post);
      // Return a copy so callers never mutate the fixture store directly (only the
      // write methods do); tags/derivatives are copied too since they are arrays.
      return { ...post, tags: [...post.tags], derivatives: [...post.derivatives] };
    },

    async facets(tags: string): Promise<Facets> {
      const counts = new Map<string, number>();
      for (const post of filterPosts(tags)) {
        for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      const byCategory = new Map<number, { name: string; count: number }[]>();
      for (const [name, count] of counts) {
        const cat = categoryOf(name);
        const list = byCategory.get(cat) ?? [];
        list.push({ name, count });
        byCategory.set(cat, list);
      }
      return {
        facets: [...byCategory.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([category, list]) => ({
            category,
            tags: list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
          })),
      };
    },

    async autocomplete(q: string, context: AutocompleteContext): Promise<Suggestion[]> {
      const query = q.toLowerCase();
      if (context === "metatag") {
        const colon = query.indexOf(":");
        const key = colon > 0 ? query.slice(0, colon) : query;
        const options = METATAG_ENUMS[key] ?? [];
        return options.filter((o) => o.value.startsWith(query)).slice(0, 12);
      }
      if (!query) return [];
      const out: Suggestion[] = [];
      for (const [name, meta] of Object.entries(TAG_VOCAB)) {
        if (name.includes(query)) {
          out.push({ kind: "tag", name, category: meta.category, postCount: meta.postCount });
        }
      }
      for (const [alias, canonical] of Object.entries(TAG_ALIASES)) {
        if (alias.includes(query)) {
          const meta = TAG_VOCAB[canonical];
          out.push({
            kind: "tag",
            name: canonical,
            category: meta?.category ?? 0,
            postCount: meta?.postCount ?? 0,
            aliasOf: alias,
          });
        }
      }
      return out.sort((a, b) => (b as { postCount: number }).postCount - (a as { postCount: number }).postCount).slice(0, 12);
    },

    // --- catalog: write surface --------------------------------------------
    //
    // Mutate the in-memory post so edits persist within the session (a subsequent
    // getPost reflects them). A missing/purged post 404s like the live service.

    async patchTags(id: string, tags: string[]): Promise<void> {
      const post = livePost(id);
      if (!post || statusOf(id) === "purged") throw new ApiError("post not found", 404);
      post.tags = [...tags]; // full-set replace
    },

    async setFavorite(id: string, favorite: boolean): Promise<void> {
      const post = livePost(id);
      if (!post || statusOf(id) === "purged") throw new ApiError("post not found", 404);
      post.favorited = favorite;
    },

    async scorePost(id: string, delta: number): Promise<void> {
      const post = livePost(id);
      if (!post || statusOf(id) === "purged") throw new ApiError("post not found", 404);
      post.score += delta; // delta-based, like Artemis
    },

    async setRating(id: string, rating: Rating): Promise<void> {
      const post = livePost(id);
      if (!post || statusOf(id) === "purged") throw new ApiError("post not found", 404);
      post.rating = rating;
    },

    // --- catalog: upload ---------------------------------------------------
    //
    // Create a NEW pending post in the same in-memory store the read/edit slices use
    // (so a subsequent getPost finds it) and register it for the pending→active
    // lifecycle. An empty file 400s, like the live service on an empty body.

    async upload(file: File, mediaType?: string): Promise<UploadResult> {
      if (file.size === 0) throw new ApiError("empty upload", 400);
      uploadSeq += 1;
      const seq = String(uploadSeq).padStart(4, "0");
      const id = `upload-${seq}`;
      const cls = mediaType ?? (file.type || "").split("/")[0];
      const isVideo = cls === "video" || (file.type || "").startsWith("video");
      const post: Post = {
        id,
        status: "pending",
        tags: [],
        score: 0,
        favorited: false,
        source: undefined,
        md5: `upload${seq}`,
        filetype: isVideo ? "mp4" : "png",
        // A pending post already has a thumbnail derivative; more join once active.
        derivatives: [{ kind: "thumbnail", variant: "thumb.webp" }],
      };
      posts.set(id, post);
      uploadPolls.set(id, 0);
      return { postId: id, status: "pending" };
    },
  };
}

/** Decode our opaque fixture cursor (`off:<n>`) back to an offset. */
function cursorOffset(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const m = /^off:(\d+)$/.exec(cursor);
  return m ? Number(m[1]) : 0;
}
