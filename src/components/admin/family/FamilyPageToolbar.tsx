import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Filter, Plus, Search } from "lucide-react";

import { AddFamilyForm } from "@/components/AddFamilyForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FamilySort } from "@/lib/admin-family-units";
import { countActiveMemberFilters, type MemberStatusFilter } from "@/lib/admin-member-list";

export type FamilyBrowseTab = "members" | "families";

type Props = {
  tab: FamilyBrowseTab;
  onTabChange: (tab: FamilyBrowseTab) => void;
  q: string;
  onQChange: (q: string) => void;
  generation: string;
  onGenerationChange: (g: string) => void;
  status: MemberStatusFilter;
  onStatusChange: (s: MemberStatusFilter) => void;
  sort: FamilySort;
  onSortChange: (s: FamilySort) => void;
  generationOptions: number[];
  onShowGuide: () => void;
};

export function FamilyPageToolbar({
  tab,
  onTabChange,
  q,
  onQChange,
  generation,
  onGenerationChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  generationOptions,
  onShowGuide,
}: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const defaultSort: FamilySort = tab === "members" ? "name-asc" : "generation-asc";
  const filterCount = countActiveMemberFilters({ generation, status, sort, defaultSort });

  return (
    <div className="sticky top-0 z-20 space-y-3 rounded-lg border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as FamilyBrowseTab)}>
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="families">Families</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative min-w-[180px] flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={tab === "members" ? "Search members, location…" : "Search families, names, location…"}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="size-3.5" />
              Filters
              {filterCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                  {filterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3" align="end">
            <div className="space-y-1.5">
              <Label className="text-xs">Generation</Label>
              <Select value={generation} onValueChange={onGenerationChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {generationOptions.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Gen {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => onStatusChange(v as MemberStatusFilter)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="alive">{tab === "families" ? "Has alive" : "Alive"}</SelectItem>
                  <SelectItem value="dead">{tab === "families" ? "Has deceased" : "Deceased"}</SelectItem>
                  <SelectItem value="in-kin">In kin</SelectItem>
                  <SelectItem value="out-kin">Out of kin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort</Label>
              <Select value={sort} onValueChange={(v) => onSortChange(v as FamilySort)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generation-asc">Generation ↑</SelectItem>
                  <SelectItem value="generation-desc">Generation ↓</SelectItem>
                  <SelectItem value="name-asc">Name A–Z</SelectItem>
                  {tab === "families" && <SelectItem value="size-desc">Largest first</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" className="text-xs" onClick={onShowGuide}>
          Getting started
        </Button>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1" />
              Add family
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add family</DialogTitle>
            </DialogHeader>
            <AddFamilyForm
              autoApprove
              onSubmitted={() => {
                setAddOpen(false);
                qc.invalidateQueries({ queryKey: ["admin"] });
                qc.invalidateQueries({ queryKey: ["members"] });
                qc.invalidateQueries({ queryKey: ["wives"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
