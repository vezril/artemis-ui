import { Activity, FolderGit2, Gauge, Images, ListChecks, RefreshCw, Search, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not yet implemented — rendered disabled ("coming soon"). */
  comingSoon?: boolean;
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
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Search", href: "/search", icon: Search, comingSoon: true },
      { label: "Uploads", href: "/uploads", icon: Upload, comingSoon: true },
      { label: "Pools", href: "/pools", icon: FolderGit2, comingSoon: true },
      { label: "Review", href: "/review", icon: ListChecks, comingSoon: true },
      { label: "Gallery", href: "/gallery", icon: Images, comingSoon: true },
    ],
  },
];
