"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Telescope } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { ConnectionIndicator } from "./connection-indicator";
import { ReviewNavBadge } from "./review-nav-badge";

/**
 * The persistent console shell: a header (brand + connection indicator) and a left
 * navigation grouped into Operations and Catalog, wrapping every route. Catalog
 * entries not yet built render disabled ("Soon").
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link href="/health" className="flex items-center gap-2 font-semibold">
          <Telescope className="size-5 text-primary" aria-hidden="true" />
          <span>Artemis UI</span>
          <span className="text-xs font-normal text-muted-foreground">console</span>
        </Link>
        <ConnectionIndicator />
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-border p-3 md:block">
          {NAV.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  const base =
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors";
                  if (item.comingSoon) {
                    return (
                      <li key={item.label}>
                        <span
                          className={cn(
                            base,
                            "cursor-not-allowed text-muted-foreground/50",
                          )}
                          aria-disabled="true"
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {item.label}
                          <span className="ml-auto text-[10px] uppercase tracking-wide">
                            Soon
                          </span>
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          base,
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {item.label}
                        {item.reviewBadge && <ReviewNavBadge />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
