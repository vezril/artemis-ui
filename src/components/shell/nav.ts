import {
  Activity,
  FolderGit2,
  Gauge,
  Images,
  ListChecks,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not yet implemented — rendered disabled ("coming soon"). */
  comingSoon?: boolean;
  /** Show a live needs-review count badge on this entry (from the queue length). */
  reviewBadge?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * The console navigation. Operations is live now; Catalog entries are placeholders
 * (disabled) until their capabilities land, so the intended shape is visible.
 */
export const NAV: NavGroup[] = [
  {
    title: "Operations",
    items: [
      { label: "Health", href: "/health", icon: Activity },
      { label: "Metrics", href: "/metrics", icon: Gauge },
      { label: "Reprocess", href: "/reprocess", icon: RefreshCw },
      { label: "Posts", href: "/maintenance/posts", icon: Wrench },
      { label: "Garbage collection", href: "/maintenance/gc", icon: Trash2 },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Search", href: "/search", icon: Search },
      { label: "Gallery", href: "/search", icon: Images },
      { label: "Uploads", href: "/uploads", icon: Upload },
      { label: "Pools", href: "/pools", icon: FolderGit2, comingSoon: true },
      { label: "Review", href: "/review", icon: ListChecks, reviewBadge: true },
    ],
  },
];
