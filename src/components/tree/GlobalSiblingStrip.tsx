import type { Member } from "@/lib/family";

type Props = {
  children: Member[];
  motherNameById: Map<number, string>;
};

export function GlobalSiblingStrip({ children, motherNameById }: Props) {
  if (children.length === 0) return null;
  return (
    <div className="rounded-lg border bg-background p-2">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Global sibling order</p>
      <div className="flex flex-wrap gap-1.5">
        {children.map((child, idx) => (
          <span key={child.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
            <span className="font-semibold text-primary">{idx + 1}</span>
            <span>{child.full_name}</span>
            {child.mother_id ? (
              <span className="text-muted-foreground">· {motherNameById.get(child.mother_id) ?? "?"}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

