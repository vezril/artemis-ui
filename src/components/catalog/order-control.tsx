"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

import { DEFAULT_ORDER, ORDER_OPTIONS } from "@/lib/catalog/dsl";
import type { OrderKey } from "@/lib/api/types";
import { searchHref } from "@/lib/catalog/query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The DSL ordering control. Changing the order re-runs the search from a fresh
 * cursor (the query key includes order) while preserving the tag terms.
 */
export function OrderControl() {
  const router = useRouter();
  const params = useSearchParams();
  const current = (params.get("order") as OrderKey | null) ?? DEFAULT_ORDER;
  const tags = params.get("tags") ?? "";
  const activeLabel = ORDER_OPTIONS.find((o) => o.key === current)?.label ?? "Newest";

  function choose(order: OrderKey) {
    router.push(searchHref(tags, order));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <ArrowUpDown className="size-4" />
          <span className="hidden sm:inline">{activeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Order by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ORDER_OPTIONS.map((o) => (
          <DropdownMenuCheckItem
            key={o.key}
            checked={o.key === current}
            onSelect={() => choose(o.key)}
          >
            {o.label}
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
