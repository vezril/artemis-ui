import type { MetricMeta, MetricSample, ParsedMetrics } from "@/lib/api/types";

/**
 * A small, defensive parser for the Prometheus text exposition format (what
 * Artemis's `GET /metrics` returns). It is deliberately lenient: any line it
 * cannot understand is counted in `skipped` and dropped, never thrown — one bad
 * line must not blank the whole dashboard. It handles `# HELP`/`# TYPE` metadata,
 * label sets with escaped values, an optional trailing timestamp, and the special
 * values `NaN`, `+Inf`, `-Inf`.
 *
 * Not a full spec implementation (no exemplars, no created-timestamp lines) — enough
 * for an operator dashboard, with the raw view as the escape hatch for anything exotic.
 */
export function parsePrometheus(text: string): ParsedMetrics {
  const samples: MetricSample[] = [];
  const meta: Record<string, MetricMeta> = {};
  let skipped = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    if (line.startsWith("#")) {
      const m = /^#\s+(HELP|TYPE)\s+(\S+)\s+(.*)$/.exec(line);
      if (m) {
        const [, kind, name, rest] = m;
        const entry = (meta[name] ??= {});
        if (kind === "HELP") entry.help = unescapeHelp(rest);
        else entry.type = rest.trim();
      }
      // A plain `#` comment is ignored, not skipped-as-error.
      continue;
    }

    const sample = parseSampleLine(line);
    if (sample) samples.push(sample);
    else skipped++;
  }

  return { samples, meta, skipped };
}

/** Parse one `name{labels} value [timestamp]` line, or return null if unparseable. */
function parseSampleLine(line: string): MetricSample | null {
  const nameMatch = /^[a-zA-Z_:][a-zA-Z0-9_:]*/.exec(line);
  if (!nameMatch) return null;
  const name = nameMatch[0];
  let rest = line.slice(name.length);

  let labels: Record<string, string> = {};
  if (rest.startsWith("{")) {
    const close = findLabelClose(rest);
    if (close === -1) return null;
    const parsed = parseLabels(rest.slice(1, close));
    if (parsed === null) return null;
    labels = parsed;
    rest = rest.slice(close + 1);
  }

  // Remainder is ` value [timestamp]`; the value is the first whitespace-delimited token.
  const tokens = rest.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === "") return null;
  const value = parseValue(tokens[0]);
  if (value === null) return null;

  return { name, labels, value };
}

/** Find the index of the `}` that closes the label block at index 0, respecting quotes. */
function findLabelClose(s: string): number {
  let inQuote = false;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === "\\") i++; // skip the escaped char
      else if (c === '"') inQuote = false;
    } else if (c === '"') inQuote = true;
    else if (c === "}") return i;
  }
  return -1;
}

/** Parse `key="value",key2="value2"` (already stripped of the surrounding braces). */
function parseLabels(body: string): Record<string, string> | null {
  const labels: Record<string, string> = {};
  const trimmed = body.trim();
  if (trimmed === "") return labels;

  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"\s*(,|$)/g;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    // Each match must begin exactly where the previous one ended. A global regex
    // otherwise skips forward over an unparsed gap (e.g. a space instead of a comma),
    // which would silently drop labels — reject the whole set as malformed instead.
    if (m.index !== consumed) return null;
    labels[m[1]] = unescapeLabel(m[2]);
    consumed = re.lastIndex;
    if (m[3] === "") break;
  }
  // If we couldn't consume the whole body, treat the label set as malformed.
  return consumed === trimmed.length ? labels : null;
}

function parseValue(token: string): number | null {
  switch (token) {
    case "NaN":
    case "Nan":
      return NaN;
    case "+Inf":
    case "Inf":
      return Infinity;
    case "-Inf":
      return -Infinity;
  }
  const n = Number(token);
  return Number.isNaN(n) ? null : n;
}

function unescapeLabel(v: string): string {
  return v.replace(/\\(["\\n])/g, (_, c) => (c === "n" ? "\n" : c));
}

function unescapeHelp(v: string): string {
  return v.replace(/\\(["\\n])/g, (_, c) => (c === "n" ? "\n" : c)).trim();
}
