"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { getClient } from "@/lib/api";
import { ApiError, type PostSummary } from "@/lib/api/types";
import { mediaUrl, thumbnailVariant } from "@/lib/api/media";
import {
  memberMap,
  useDeletePool,
  usePool,
  usePoolMutations,
  usePoolPosts,
} from "@/lib/hooks/use-pools";
import { MediaPlaceholder } from "@/components/catalog/media-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The pool detail view: the members as an ordered gallery, driven by the ENTITY
 * read's authoritative id order (read-your-writes) and hydrated for thumbnails by
 * the projection-backed members read — a member the projection hasn't caught up
 * with yet renders as a placeholder tile rather than vanishing.
 *
 * Browse mode: tiles link to their posts. **Arrange mode**: tiles stop navigating
 * and gain remove (×) plus move-earlier/move-later controls — reorder works by
 * pointer drag AND by those keyboard-operable buttons, never drag-only. Every
 * committed move sends the full permutation optimistically (serialized per pool).
 */
export function PoolView({ id }: { id: string }) {
  const router = useRouter();
  const pool = usePool(id);
  const members = usePoolPosts(id);
  const { reorder, addPost, removePost, rename } = usePoolMutations(id);
  const deletePool = useDeletePool(id);

  const [arrange, setArrange] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [mutationError, setMutationError] = React.useState<string | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const onError = React.useCallback(
    (err: unknown) =>
      setMutationError(err instanceof Error ? err.message : "The change failed — try again."),
    [],
  );

  if (pool.isError) {
    const notFound = pool.error instanceof ApiError && pool.error.status === 404;
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center text-muted-foreground">
        {notFound ? (
          <>
            <FileQuestion className="size-8" aria-hidden />
            <p className="text-lg font-medium text-foreground">Pool not found</p>
            <p className="text-sm">
              No pool with id <code className="font-mono">{id}</code>.
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="size-6 text-destructive" aria-hidden />
            <p>Couldn&apos;t load this pool.</p>
            <p className="text-xs">{(pool.error as Error)?.message}</p>
          </>
        )}
        <Link
          href="/pools"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to pools
        </Link>
      </div>
    );
  }

  if (pool.isLoading || !pool.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const order = pool.data.posts;
  const hydrated = memberMap(members.data?.pages);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    setMutationError(null);
    reorder.mutate(next, { onError });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        href="/pools"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to pools
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PoolName
          name={pool.data.name}
          onRename={(name) => {
            setMutationError(null);
            rename.mutate(name, { onError });
          }}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {order.length} {order.length === 1 ? "post" : "posts"}
          </span>
          <Button
            variant={arrange ? "default" : "outline"}
            size="sm"
            aria-pressed={arrange}
            onClick={() => setArrange((a) => !a)}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            {arrange ? "Done arranging" : "Arrange"}
          </Button>
          {confirmDelete ? (
            <span className="flex items-center gap-1.5 text-sm">
              Delete this pool?
              <Button
                variant="destructive"
                size="sm"
                disabled={deletePool.isPending}
                onClick={() =>
                  deletePool.mutate(undefined, {
                    onSuccess: () => router.push("/pools"),
                    onError: (err) => {
                      setConfirmDelete(false);
                      onError(err);
                    },
                  })
                }
              >
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden /> Delete pool
            </Button>
          )}
        </div>
      </div>

      {mutationError && (
        <p
          role="alert"
          className="mb-3 flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{mutationError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            className="shrink-0 hover:opacity-70"
            onClick={() => setMutationError(null)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}

      {order.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <p className="font-medium text-foreground">This pool is empty</p>
          <p className="text-sm">Add posts from a post&apos;s page, or by id below.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {order.map((postId, index) => (
            <MemberTile
              key={postId}
              postId={postId}
              index={index}
              count={order.length}
              summary={hydrated.get(postId)}
              arrange={arrange}
              dragging={dragIndex === index}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDropOn={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onMove={(dir) => move(index, index + dir)}
              onRemove={() => {
                setMutationError(null);
                removePost.mutate(postId, { onError });
              }}
            />
          ))}
        </ul>
      )}

      <AddByIdField
        onAdd={(postId) => {
          setMutationError(null);
          addPost.mutate(postId, { onError });
        }}
      />
    </div>
  );
}

/** The pool name with an inline rename affordance (pencil → input → ✓/esc). */
function PoolName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  // The draft only exists while editing and is (re)initialized on edit entry,
  // so no resync effect is needed when the (optimistic) name changes at rest.
  const [draft, setDraft] = React.useState(name);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onRename(trimmed);
  }

  if (!editing) {
    return (
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {name}
        <button
          type="button"
          aria-label="Rename pool"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </h1>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Pool name"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="h-9 w-64 text-lg font-semibold"
      />
      <Button type="submit" size="sm" aria-label="Save name">
        <Check className="size-4" aria-hidden />
      </Button>
    </form>
  );
}

/**
 * One member tile. Browse mode links to the post; arrange mode disables the link
 * and exposes remove + move-earlier/move-later (keyboard) plus HTML drag-drop.
 * A member the projection hasn't hydrated yet renders its id on a placeholder.
 */
function MemberTile({
  postId,
  index,
  count,
  summary,
  arrange,
  dragging,
  onDragStart,
  onDragEnd,
  onDropOn,
  onMove,
  onRemove,
}: {
  postId: string;
  index: number;
  count: number;
  summary: PostSummary | undefined;
  arrange: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const baseUrl = getClient().baseUrl;
  const variant = summary ? thumbnailVariant(summary.derivatives) : null;
  const thumb = variant ? mediaUrl(baseUrl, summary?.md5, variant.variant) : null;

  const media = (
    <div className="relative aspect-square overflow-hidden">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote media-gateway URLs
        <img src={thumb} alt={`Post ${postId}`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <MediaPlaceholder label={postId} />
      )}
      {/* Reading-order position, visible in both modes (solid strip for contrast). */}
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
        {index + 1}
      </span>
    </div>
  );

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        dragging && "opacity-60 ring-2 ring-ring",
      )}
      draggable={arrange}
      onDragStart={arrange ? onDragStart : undefined}
      onDragEnd={arrange ? onDragEnd : undefined}
      onDragOver={arrange ? (e) => e.preventDefault() : undefined}
      onDrop={arrange ? onDropOn : undefined}
    >
      {arrange ? (
        <>
          {media}
          <div className="flex items-center justify-between gap-1 px-1.5 py-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Move post ${postId} earlier`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove post ${postId} from the pool`}
              onClick={onRemove}
            >
              <X className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Move post ${postId} later`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <Link
          href={`/posts/${postId}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {media}
        </Link>
      )}
    </li>
  );
}

/** Add a member by post id (validated non-empty; the API add is idempotent). */
function AddByIdField({ onAdd }: { onAdd: (postId: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      className="mt-6 flex max-w-sm items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim();
        if (!id) return;
        onAdd(id);
        setValue("");
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add by post id…"
        aria-label="Post id to add"
      />
      <Button type="submit" variant="outline" disabled={!value.trim()}>
        Add
      </Button>
    </form>
  );
}
