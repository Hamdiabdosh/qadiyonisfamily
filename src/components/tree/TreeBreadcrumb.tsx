import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Member } from "@/lib/family";

type Props = {
  chain: Member[];
  onFocus: (id: number) => void;
};

export function TreeBreadcrumb({ chain, onFocus }: Props) {
  if (chain.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {chain.map((m, i) => (
        <span key={m.id} className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onFocus(m.id)}
          >
            {m.full_name}
          </Button>
          {i < chain.length - 1 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
        </span>
      ))}
    </div>
  );
}

