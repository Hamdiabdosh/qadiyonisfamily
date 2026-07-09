import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DISMISS_KEY = "admin-family-guide-dismissed";

type Props = {
  rootName: string;
  memberCount: number;
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
};

export function FamilyGettingStartedCard({ rootName, memberCount, forceOpen, onForceOpenHandled }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return memberCount < 5;
    if (localStorage.getItem(DISMISS_KEY) === "1") return false;
    return memberCount < 5;
  });

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      onForceOpenHandled?.();
    }
  }, [forceOpen, onForceOpenHandled]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Build early generations</CardTitle>
              <CardDescription>
                Add {rootName}&apos;s wives, children, and grandchildren so members can pick them when filling the form
                and their lineage path auto-fills.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2">
                {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Wives only:</strong> set father to {rootName} (autocomplete), add wife names, leave children
                blank.
              </li>
              <li>
                <strong>Children:</strong> father = {rootName}, mother = his wife, add sons/daughters in birth order.
              </li>
              <li>
                <strong>Grandchildren:</strong> father = an existing son of {rootName}, mother = his wife, add
                children.
              </li>
              <li>
                <strong>Alive or deceased:</strong> set status in the form, or use the member detail panel after adding.
              </li>
            </ul>
            <Button variant="outline" size="sm" onClick={dismiss}>
              Don&apos;t show again
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
