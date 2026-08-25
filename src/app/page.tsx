/**
 * Placeholder landing for the scaffold. The real console — an operations
 * dashboard (health, metrics, reprocessing, GC) plus the catalog surface
 * (search, posts, uploads, tags, pools) — is captured as an OpenSpec design and
 * built capability by capability. This page exists so the app builds and runs.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        Artemis · management console
      </p>
      <h1 className="text-3xl font-semibold">Artemis UI</h1>
      <p className="text-muted-foreground">
        The per-service console for operating and curating the Artemis catalog. Scaffold in
        place — operations and catalog surfaces are being built from the OpenSpec design.
      </p>
    </div>
  );
}
