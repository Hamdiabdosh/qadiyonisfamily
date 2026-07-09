import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  fetchAllMembers,
  searchMemberByName,
  submitFamily,
  sortMembersByBirthOrder,
  type KinLinkSide,
  type Member,
  type SubmitFamilyPayload,
  type SubmissionMemberIds,
} from "@/lib/family";
import type { FamilyUnit } from "@/lib/admin-family-units";
import { analyzeKinLinkJump } from "@/lib/kin-anchor";
import { buildMap, chainReachesRoot, fatherChain, motherChain } from "@/lib/lineage";
import { kinParentNamesForLocation } from "@/lib/parent-kin";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChildrenByMotherSection } from "@/components/ChildrenByMotherSection";
import { DuplicateNameDialog } from "@/components/DuplicateNameDialog";
import { SiblingOrderReview } from "@/components/SiblingOrderReview";
import {
  emptyChildrenBucket,
  flattenChildrenBuckets,
  syncChildrenBucketsForMotherCount,
  childrenBucketsFromFlat,
  type ChildrenBucket,
  type FormChildEntry,
} from "@/lib/children-by-mother";
import { enqueueSubmission, listQueue, clearQueueItem } from "@/lib/offline-queue";
import {
  findSubmissionDuplicates,
  formHasKinLinkedParent,
  linkedMemberIdsFromForm,
  normalizeSubmitName,
  validateMotherLineCoWives,
  validateNewKinLink,
  type DuplicateNameHit,
} from "@/lib/submission-validate";
import { linkDuplicateEntry } from "@/lib/link-duplicate-entry";
import {
  assignSequentialBirthOrder,
  assignSequentialDraftBirthOrder,
  buildOrderedChildDrafts,
  siblingItemIdentity,
  siblingOrderFromItems,
  validateMergedSiblingOrder,
  type OrderedSiblingItem,
} from "@/lib/sibling-order";
import {
  DEFAULT_LOCATION,
  LocationSelector,
  locationSelectionToString,
  type LocationSelection,
} from "@/components/LocationSelector";
import { SectionAudioPlayer, type SectionAudioHandle } from "@/components/SectionAudioPlayer";
import { getPublicSettingsFn } from "@/lib/api/content.functions";
import { readFileAsBase64 } from "@/lib/file-base64";

export type GuideAudioSection = "parents" | "children" | "submitter";

type AliveT = "alive" | "dead";
type AliveChoice = AliveT | null;
type Child = FormChildEntry;
type PhotoPick = { base64: string; mimeType: string } | null;

type ParentEntry = {
  name: string;
  alive: AliveChoice;
  existingId: number | null;
  inKin: boolean | null;
  kinSide: KinLinkSide | null;
  kinAnchorId: number | null;
  photo: PhotoPick;
};

const compactNameClass = "h-8 text-xs px-2 py-1 rounded-lg";

function emptyParent(): ParentEntry {
  return { name: "", alive: null, existingId: null, inKin: null, kinSide: null, kinAnchorId: null, photo: null };
}

function hasAliveChosen(alive: AliveChoice): alive is AliveT {
  return alive === "alive" || alive === "dead";
}

function parentToPayload(p: ParentEntry, byId: Map<number, Member>) {
  if (p.existingId != null) {
    const existing = byId.get(p.existingId);
    return {
      name: p.name,
      alive: p.alive === "alive",
      existingId: p.existingId,
      inKin: existing?.is_in_kin ?? false,
      kinSide: null,
      kinAnchorId: null,
    };
  }
  return {
    name: p.name,
    alive: p.alive === "alive",
    existingId: null,
    inKin: p.inKin === true,
    kinSide: p.inKin ? p.kinSide : null,
    kinAnchorId: p.inKin ? p.kinAnchorId : null,
    photoBase64: p.photo?.base64 ?? null,
    photoMimeType: p.photo?.mimeType ?? null,
  };
}

async function pickPhoto(file: File | undefined): Promise<PhotoPick> {
  if (!file) return null;
  const base64 = await readFileAsBase64(file);
  return { base64, mimeType: file.type || "image/jpeg" };
}

function formatStoredLineage(path: string) {
  return path.replace(/\s*>\s*/g, " → ");
}

function storedLineagePreview(m: Member): string | null {
  const f = m.lineage_path_father;
  const mo = m.lineage_path_mother;
  if (m.gender === "male") {
    if (f && f !== "No path") return formatStoredLineage(f);
    if (mo && mo !== "No path") return formatStoredLineage(mo);
  } else {
    if (mo && mo !== "No path") return formatStoredLineage(mo);
    if (f && f !== "No path") return formatStoredLineage(f);
  }
  return null;
}

function getParentLinePreview(parent: ParentEntry, byId: Map<number, Member>): string | null {
  if (!parent.name.trim()) return null;
  if (parent.existingId) {
    const m = byId.get(parent.existingId);
    if (!m?.is_in_kin) return null;
    return storedLineagePreview(m);
  }
  if (parent.inKin === false) return null;
  if (parent.inKin !== true || !parent.kinAnchorId || !parent.kinSide) return null;
  const chain =
    parent.kinSide === "father"
      ? [...fatherChain(parent.kinAnchorId, byId)].reverse()
      : [...motherChain(parent.kinAnchorId, byId)].reverse();
  if (!chainReachesRoot(chain)) return null;
  return [...chain.map((m) => m.full_name), parent.name.trim()].join(" → ");
}

function validateParentKin(p: ParentEntry, byId: Map<number, Member>) {
  return validateNewKinLink(p, byId);
}

/** Mother-line kin links only this parent; an outside husband's other wives must not be added. */
const addMoreBtnClass =
  "w-full border-0 bg-none bg-out-alive font-semibold text-out-alive-foreground shadow-md shadow-out-alive/25 hover:bg-out-alive/90 hover:brightness-105";

const addWifeBtnClass = cn(
  addMoreBtnClass,
  "h-auto min-h-8 gap-1.5 whitespace-normal py-2 text-xs leading-snug",
);

function AliveToggle({
  value,
  onChange,
  idPrefix,
  highlight,
}: {
  value: AliveChoice;
  onChange: (v: AliveT) => void;
  idPrefix: string;
  highlight?: boolean;
}) {
  const { t } = useI18n();
  const btnBase =
    "w-full rounded-lg border px-4 py-1 text-sm font-medium transition-all duration-200 text-center";
  const toggle = (
    <div className="flex w-full items-start gap-2">
      <button
        type="button"
        id={`${idPrefix}-alive`}
        onClick={() => onChange("alive")}
        className={cn(
          btnBase,
          "flex-1",
          value === "alive"
            ? "border-kin-alive/60 bg-kin-alive text-kin-alive-foreground shadow-sm"
            : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        {t("alive")}
      </button>
      <div className="flex flex-1 flex-col items-stretch">
        <button
          type="button"
          id={`${idPrefix}-dead`}
          onClick={() => onChange("dead")}
          className={cn(
            btnBase,
            value === "dead"
              ? "border-destructive/60 bg-destructive text-destructive-foreground shadow-sm"
              : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {t("dead")}
        </button>
        {value === "dead" && (
          <p className="mt-1 px-1 text-center text-[7px] leading-[1.15] text-muted-foreground">
            {t("innaLillah")}
          </p>
        )}
      </div>
    </div>
  );

  if (!highlight) return toggle;
  return <div className="alive-required-glow p-0.5">{toggle}</div>;
}

function NameAutocomplete({
  value, onChange, placeholder, onPick, onFocusField, inputClassName,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  onPick?: (m: { id: number; full_name: string; generation_level?: number }) => void;
  onFocusField?: () => void;
  inputClassName?: string;
}) {
  const [suggest, setSuggest] = useState<{ id: number; full_name: string; generation_level?: number }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (value.length < 2) { setSuggest([]); return; }
    const timer = setTimeout(async () => {
      const r = await searchMemberByName(value);
      setSuggest(r.filter((x) => x.is_approved));
    }, 200);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div className="relative">
      <Input value={value} placeholder={placeholder} className={inputClassName}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); onFocusField?.(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && suggest.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
          {suggest.map((s) => (
            <li key={s.id}>
              <button type="button" className="w-full text-left px-2 py-1.5 hover:bg-accent text-xs"
                onClick={() => { onChange(s.full_name); onPick?.(s); setOpen(false); }}>
                {s.full_name}
                {"generation_level" in s && s.generation_level ? (
                  <span className="ml-1 text-muted-foreground">· Gen {s.generation_level}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ParentKinFields({
  parent,
  onChange,
  members,
  idPrefix,
  onFocusField,
  showLineLabel,
  parentRole,
  isEditMode,
}: {
  parent: ParentEntry;
  onChange: (p: ParentEntry) => void;
  members: Member[];
  idPrefix: string;
  onFocusField?: () => void;
  showLineLabel?: boolean;
  parentRole?: "father" | "mother";
  isEditMode?: boolean;
}) {
  const { t } = useI18n();
  const byId = useMemo(() => buildMap(members), [members]);

  const inKinTree = useMemo(
    () =>
      members
        .filter((m) => m.is_approved && m.is_in_kin)
        .sort((a, b) => a.generation_level - b.generation_level || a.full_name.localeCompare(b.full_name)),
    [members],
  );

  const generations = useMemo(() => {
    const map = new Map<number, Member[]>();
    inKinTree.forEach((m) => {
      const g = m.generation_level || 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [inKinTree]);

  const anchorPool =
    parent.kinSide === "father"
      ? inKinTree.filter((m) => m.gender === "male")
      : parent.kinSide === "mother"
        ? inKinTree.filter((m) => m.gender === "female")
        : [];

  const pathPreview = useMemo(
    () => getParentLinePreview(parent, byId),
    [parent, byId],
  );

  const kinLinkJump = useMemo(() => {
    if (!parentRole) return null;
    return analyzeKinLinkJump(
      {
        name: parent.name,
        existingId: parent.existingId,
        inKin: parent.inKin ?? false,
        kinSide: parent.kinSide,
        kinAnchorId: parent.kinAnchorId,
        role: parentRole,
      },
      members,
    );
  }, [parent, parentRole, members]);

  const sideBtn =
    "h-7 flex-1 rounded-lg border px-1 text-[10px] font-medium transition-colors";

  return (
    <div className="space-y-2">
      {showLineLabel && parent.name.trim() && (
        <p className="text-[10px] font-medium text-muted-foreground">{t("thisParentLine")}</p>
      )}
      <NameAutocomplete
        value={parent.name}
        placeholder={t("fullName")}
        inputClassName={compactNameClass}
        onFocusField={onFocusField}
        onChange={(v) =>
          onChange(
            isEditMode
              ? { ...parent, name: v }
              : { ...parent, name: v, existingId: null, inKin: null, kinSide: null, kinAnchorId: null }
          )
        }
        onPick={(m) =>
          onChange({
            ...parent,
            name: m.full_name,
            existingId: m.id,
            inKin: true,
            kinSide: null,
            kinAnchorId: null,
          })
        }
      />

      {parent.existingId ? (
        pathPreview ? (
          <p className="text-[10px] leading-snug text-primary">
            {t("lineagePathPreview")}: {pathPreview}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">{t("parentOutOfKinHint")}</p>
        )
      ) : parent.name.trim() ? (
        <>
          <p className="text-[10px] font-medium text-muted-foreground">{t("parentInKinQuestion")}</p>
          <div className="flex gap-1">
            <button
              type="button"
              className={cn(
                sideBtn,
                parent.inKin === true
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-transparent text-muted-foreground",
              )}
              onClick={() => onChange({ ...parent, inKin: true, kinSide: null, kinAnchorId: null })}
            >
              {t("yes")}
            </button>
            <button
              type="button"
              className={cn(
                sideBtn,
                parent.inKin === false
                  ? "border-muted-foreground/50 bg-muted/50 text-foreground"
                  : "border-border/60 bg-transparent text-muted-foreground",
              )}
              onClick={() => onChange({ ...parent, inKin: false, kinSide: null, kinAnchorId: null })}
            >
              {t("no")}
            </button>
          </div>
          {parent.inKin === false && (
            <p className="text-[10px] text-muted-foreground">{t("parentOutOfKinHint")}</p>
          )}
          {parent.inKin === true && (
            <>
              <p className="text-[10px] font-medium text-muted-foreground">{t("kinLinkSide")}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={cn(
                    sideBtn,
                    parent.kinSide === "father"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-transparent text-muted-foreground",
                  )}
                  onClick={() => onChange({ ...parent, kinSide: "father", kinAnchorId: null })}
                >
                  {t("kinLinkSideFather")}
                </button>
                <button
                  type="button"
                  className={cn(
                    sideBtn,
                    parent.kinSide === "mother"
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 bg-transparent text-muted-foreground",
                  )}
                  onClick={() => onChange({ ...parent, kinSide: "mother", kinAnchorId: null })}
                >
                  {t("kinLinkSideMother")}
                </button>
              </div>
              {parent.kinSide === "mother" && (
                <p
                  className={cn(
                    "text-[10px] leading-snug",
                    parent.kinAnchorId && parentRole === "mother"
                      ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 font-medium text-amber-900 dark:text-amber-200"
                      : "text-muted-foreground",
                  )}
                >
                  {parent.kinAnchorId && parentRole === "mother"
                    ? t("motherLineOutsideHusbandHint")
                    : t("motherLineKinHint")}
                </p>
              )}
              {parent.kinSide && (
                <>
                <p className="text-[10px] leading-snug text-muted-foreground">{t("kinAnchorPickHint")}</p>
                <Select
                  value={parent.kinAnchorId ? String(parent.kinAnchorId) : ""}
                  onValueChange={(v) => onChange({ ...parent, kinAnchorId: Number(v) })}
                >
                  <SelectTrigger className={cn(compactNameClass, "w-full")}>
                    <SelectValue placeholder={t("selectKinAnchor")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {generations.map(([gen, list]) => {
                      const filtered = list.filter((m) => anchorPool.some((a) => a.id === m.id));
                      if (filtered.length === 0) return null;
                      return (
                        <SelectGroup key={gen}>
                          <SelectLabel className="text-xs">
                            {t("gen")} {gen}
                          </SelectLabel>
                          {filtered.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                              {m.full_name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
                {kinLinkJump && (
                  <p
                    className={cn(
                      "text-[10px] leading-snug rounded-md border px-2 py-1.5",
                      kinLinkJump.kind === "skipped_closer"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                        : "border-primary/30 bg-primary/5 text-primary",
                    )}
                  >
                    {kinLinkJump.kind === "skipped_closer" ? t("kinLinkSkippedHint") : t("kinLinkGapAdminHint")}
                  </p>
                )}
                </>
              )}
              {pathPreview && (
                <p className="text-[10px] leading-snug text-primary">
                  {t("lineagePathPreview")}: {pathPreview}
                </p>
              )}
            </>
          )}
        </>
      ) : null}

      <AliveToggle
        value={parent.alive}
        idPrefix={idPrefix}
        highlight={Boolean(parent.name.trim()) && !hasAliveChosen(parent.alive)}
        onChange={(v) => onChange({ ...parent, alive: v })}
      />
    </div>
  );
}

function LocationKinHint({
  father,
  mothers,
  members,
}: {
  father: ParentEntry;
  mothers: ParentEntry[];
  members: Member[];
}) {
  const { t } = useI18n();
  const byId = useMemo(() => buildMap(members), [members]);
  const kinParents = useMemo(
    () => kinParentNamesForLocation(father, mothers, byId),
    [father, mothers, byId],
  );

  if (kinParents.length === 0) {
    return (
      <p className="text-xs leading-snug text-muted-foreground">{t("locationKinPendingHint")}</p>
    );
  }
  if (kinParents.length === 1) {
    return (
      <p className="text-xs leading-snug text-muted-foreground">
        {t("locationKinOneHint")}{" "}
        <span className="font-medium text-foreground">{kinParents[0]}</span>
      </p>
    );
  }
  if (kinParents.length === 2) {
    return (
      <p className="text-xs leading-snug text-muted-foreground">
        {t("locationKinBothHint")}{" "}
        <span className="font-medium text-foreground">{kinParents.join(" & ")}</span>
      </p>
    );
  }
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      {t("locationKinMultipleHint")}{" "}
      <span className="font-medium text-foreground">{kinParents.join(", ")}</span>
    </p>
  );
}

function ParentsEndogamySummary({
  father,
  mothers,
  members,
}: {
  father: ParentEntry;
  mothers: ParentEntry[];
  members: Member[];
}) {
  const { t } = useI18n();
  const byId = useMemo(() => buildMap(members), [members]);
  const fatherPath = getParentLinePreview(father, byId);
  const primaryMother = mothers.find((m) => m.name.trim());
  const motherPath = primaryMother ? getParentLinePreview(primaryMother, byId) : null;

  if (!fatherPath || !motherPath || !primaryMother) return null;

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <p className="text-[10px] font-semibold text-primary">{t("parentsEndogamySummary")}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        🔵 {father.name.trim()}: {fatherPath}
      </p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        🟣 {primaryMother.name.trim()}: {motherPath}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card
        variant={open ? "default" : "flat"}
        className={cn(
          "overflow-hidden transition-colors",
          !open && "border-dashed border-muted-foreground/40 bg-muted/30",
        )}
      >
        <CardHeader className={cn("transition-colors", open ? "pb-3" : "py-4")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className={cn("text-base", !open && "text-muted-foreground")}>{title}</CardTitle>
              {!open && (
                <p className="mt-1 text-xs text-muted-foreground">{t("sectionCollapsed")}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2.5 text-xs"
              onClick={() => onOpenChange(!open)}
            >
              {open ? t("closeThis") : t("openThis")}
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function AddFamilyForm({
  onSubmitted,
  autoApprove,
  initialFamilyUnit,
  onEditUnit,
  mode = "newFamily",
  selfMemberId,
  defaultSubmitterName,
  defaultSubmitterPhone,
}: {
  onSubmitted?: () => void;
  /** Admin dashboard: members are approved immediately. */
  autoApprove?: boolean;
  initialFamilyUnit?: FamilyUnit;
  onEditUnit?: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  mode?: "newFamily" | "extendSelf" | "extendAncestor";
  selfMemberId?: number | null;
  defaultSubmitterName?: string;
  defaultSubmitterPhone?: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const parentsAudioRef = useRef<SectionAudioHandle>(null);
  const childrenAudioRef = useRef<SectionAudioHandle>(null);
  const submitterAudioRef = useRef<SectionAudioHandle>(null);
  const { data: allMembers = [] } = useQuery({ queryKey: ["members", "all-incl-pending"], queryFn: () => fetchAllMembers(true) });
  const { data: settings = {} } = useQuery({
    queryKey: ["public-settings"],
    queryFn: getPublicSettingsFn,
  });

  const isEdit = !!initialFamilyUnit;
  const isAdminForm = Boolean(autoApprove || initialFamilyUnit);
  const [parentsOpen, setParentsOpen] = useState(true);
  const [childrenOpen, setChildrenOpen] = useState(isEdit && (initialFamilyUnit?.children.length ?? 0) > 0);
  const [siblingOrderOpen, setSiblingOrderOpen] = useState(false);
  const [submitterOpen, setSubmitterOpen] = useState(false);

  const [father, setFather] = useState<ParentEntry>(() => {
    if (!initialFamilyUnit?.father) return emptyParent();
    const f = initialFamilyUnit.father;
    return { name: f.full_name, alive: f.is_alive ? "alive" : "dead", existingId: f.id, inKin: true, kinSide: null, kinAnchorId: null, photo: null };
  });
  const [mothers, setMothers] = useState<ParentEntry[]>(() => {
    if (!initialFamilyUnit || initialFamilyUnit.mothers.length === 0) return [emptyParent()];
    return initialFamilyUnit.mothers.map((m) => ({ name: m.full_name, alive: m.is_alive ? "alive" : "dead", existingId: m.id, inKin: true, kinSide: null, kinAnchorId: null, photo: null }));
  });
  const [childPhotos, setChildPhotos] = useState<Record<string, PhotoPick>>({});
  const [locationSelection, setLocationSelection] = useState<LocationSelection>(() => {
    if (!initialFamilyUnit?.location) return { ...DEFAULT_LOCATION };
    return { ...DEFAULT_LOCATION, region: initialFamilyUnit.location };
  });
  const location = locationSelectionToString(locationSelection);
  const [childrenByMother, setChildrenByMother] = useState<Record<number, ChildrenBucket>>(() => {
    if (!initialFamilyUnit || initialFamilyUnit.children.length === 0) return { 0: emptyChildrenBucket() };
    const kids = initialFamilyUnit.children.map((c) => {
      let mIdx = 0;
      if (c.mother_id) {
        const foundIdx = initialFamilyUnit.mothers.findIndex((m) => m.id === c.mother_id);
        if (foundIdx !== -1) mIdx = foundIdx;
      }
      return {
        name: c.full_name,
        alive: c.is_alive,
        gender: c.gender,
        birthOrder: c.birth_order ?? 1,
        motherIndex: mIdx,
        existingId: c.id,
      };
    });
    return childrenBucketsFromFlat(kids);
  });
  const [activeMotherTab, setActiveMotherTab] = useState("0");
  const [submitterName, setSubmitterName] = useState(
    initialFamilyUnit ? "Admin Edit" : (defaultSubmitterName ?? ""),
  );
  const [submitterPhone, setSubmitterPhone] = useState(
    initialFamilyUnit ? "000" : (defaultSubmitterPhone ?? ""),
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedDistinctNames, setConfirmedDistinctNames] = useState<string[]>([]);
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateNameHit | null>(null);

  useEffect(() => {
    const flush = async () => {
      if (!navigator.onLine) return;
      const q = await listQueue();
      for (const item of q) {
        try {
          await submitFamily(item.payload as SubmitFamilyPayload);
          if (item.id != null) await clearQueueItem(item.id);
        } catch (e) { console.error(e); }
      }
      if (q.length) qc.invalidateQueries({ queryKey: ["members"] });
    };
    window.addEventListener("online", flush);
    flush();
    return () => window.removeEventListener("online", flush);
  }, [qc]);

  const rootMember = useMemo(() => allMembers.find((m) => m.is_root && m.is_approved), [allMembers]);
  const namedMothers = useMemo(() => mothers.filter((m) => m.name.trim()), [mothers]);
  const motherNames = useMemo(() => namedMothers.map((m) => m.name.trim()), [namedMothers]);
  const namedChildren = useMemo(
    () => flattenChildrenBuckets(childrenByMother).filter((c) => c.name.trim()),
    [childrenByMother],
  );
  const existingSiblings = useMemo(() => {
    const fatherId = initialFamilyUnit?.father?.id ?? father.existingId;
    if (fatherId == null) return [];
    return sortMembersByBirthOrder(
      allMembers.filter((m) => m.father_id === fatherId && m.is_approved),
    );
  }, [initialFamilyUnit, father.existingId, allMembers]);
  const [orderedSiblings, setOrderedSiblings] = useState<OrderedSiblingItem[]>([]);
  const knownSubmitter = mode === "extendSelf" && !!defaultSubmitterName && !!defaultSubmitterPhone;

  useEffect(() => {
    const count = namedMothers.length;
    setChildrenByMother((prev) => {
      const { buckets, removedNamedChildren } = syncChildrenBucketsForMotherCount(prev, count);
      if (removedNamedChildren > 0) {
        toast.warning(t("childrenRemovedWithMother"));
      }
      return buckets;
    });
    setActiveMotherTab((tab) => (Number(tab) >= Math.max(count, 1) ? "0" : tab));
  }, [namedMothers.length, t]);

  useEffect(() => {
    const nextDrafts = buildOrderedChildDrafts(assignSequentialBirthOrder(namedChildren));
    const draftExistingIds = new Set(
      nextDrafts.map((draft) => draft.existingId).filter((id): id is number => id != null),
    );
    const anchorItems: OrderedSiblingItem[] = existingSiblings
      .filter((member) => !draftExistingIds.has(member.id))
      .map((member) => ({
        kind: "existing" as const,
        existingId: member.id,
        name: member.full_name,
        gender: member.gender,
      }));

    if (nextDrafts.length === 0 && anchorItems.length === 0) {
      setOrderedSiblings([]);
      return;
    }

    setOrderedSiblings((prev) => {
      const initial = [
        ...anchorItems,
        ...nextDrafts.map((draft) => ({ kind: "draft" as const, draft })),
      ];
      if (prev.length === 0) return assignSequentialDraftBirthOrder(initial);

      const nextByIdentity = new Map(initial.map((item) => [siblingItemIdentity(item), item]));
      const stitched: OrderedSiblingItem[] = [];
      for (const item of prev) {
        const identity = siblingItemIdentity(item);
        const replacement = nextByIdentity.get(identity);
        if (replacement) {
          stitched.push(replacement);
          nextByIdentity.delete(identity);
        }
      }
      for (const item of nextByIdentity.values()) {
        stitched.push(item);
      }
      return assignSequentialDraftBirthOrder(stitched);
    });
  }, [namedChildren, existingSiblings]);

  useEffect(() => {
    if (mode !== "extendSelf" || !selfMemberId) return;
    const me = allMembers.find((m) => m.id === selfMemberId);
    if (!me) return;
    if (me.gender === "male") {
      setFather((prev) => {
        if (prev.existingId || prev.name.trim()) return prev;
        return {
          name: me.full_name,
          alive: me.is_alive ? "alive" : "dead",
          existingId: me.id,
          inKin: true,
          kinSide: null,
          kinAnchorId: null,
          photo: null,
        };
      });
      return;
    }
    // Female: prefill self as first mother
    setMothers((prev) => {
      if (prev.some((m) => m.existingId === me.id)) return prev;
      const selfMother: ParentEntry = {
        name: me.full_name,
        alive: me.is_alive ? "alive" : "dead",
        existingId: me.id,
        inKin: true,
        kinSide: null,
        kinAnchorId: null,
        photo: null,
      };
      if (!prev[0]?.name.trim() && prev[0]?.existingId == null) {
        return [selfMother, ...prev.slice(1)];
      }
      return [selfMother, ...prev];
    });
  }, [mode, selfMemberId, allMembers]);

  const reset = (keepLocation = false) => {
    setFather(emptyParent());
    setMothers([emptyParent()]);
    if (!keepLocation) setLocationSelection({ ...DEFAULT_LOCATION });
    setChildrenByMother({ 0: emptyChildrenBucket() });
    setOrderedSiblings([]);
    setActiveMotherTab("0");
    setNotes("");
    setSubmitterName("");
    setSubmitterPhone("");
    setParentsOpen(true);
    setChildrenOpen(true);
    setSubmitterOpen(true);
    setConfirmedDistinctNames([]);
    setDuplicateDialog(null);
    setChildPhotos({});
  };

  const memberById = useMemo(() => buildMap(allMembers), [allMembers]);

  const playSectionAudio = (section: GuideAudioSection) => {
    if (isAdminForm) return;
    parentsAudioRef.current?.stop();
    childrenAudioRef.current?.stop();
    submitterAudioRef.current?.stop();
    if (section === "parents") parentsAudioRef.current?.start();
    else if (section === "children") childrenAudioRef.current?.start();
    else submitterAudioRef.current?.start();
  };

  const executeSubmit = async (formState: {
    father: ParentEntry;
    mothers: ParentEntry[];
    childrenByMother: Record<number, ChildrenBucket>;
    confirmedDistinct: string[];
  }) => {
    const { father: formFather, mothers: formMothers, childrenByMother: formChildrenByMother, confirmedDistinct } =
      formState;
    const formNamedMothers = formMothers.filter((m) => m.name.trim());
    const formNamedChildren = flattenChildrenBuckets(formChildrenByMother);

    const selfMember = selfMemberId ? allMembers.find((m) => m.id === selfMemberId) : null;
    const femaleExtend = mode === "extendSelf" && selfMember?.gender === "female";

    if (!formFather.name.trim() && !femaleExtend) {
      toast.error(t("fatherNameRequired"));
      return;
    }
    if (formFather.name.trim() && !hasAliveChosen(formFather.alive)) {
      toast.error(t("aliveStatusRequired"));
      return;
    }
    if (formNamedMothers.some((m) => !hasAliveChosen(m.alive))) {
      toast.error(t("aliveStatusRequired"));
      return;
    }
    const memberByIdSubmit = buildMap(allMembers);
    if (formHasKinLinkedParent(
      {
        father: parentToPayload(formFather, memberByIdSubmit),
        mothers: formNamedMothers.map((m) => parentToPayload(m, memberByIdSubmit)),
        location,
        children: [],
        submitter: { name: "", phone: "", alive: true },
        notes: "",
      },
      memberByIdSubmit,
    ) && !location.trim()) {
      toast.error(t("locationRequired"));
      return;
    }
    if (!isAdminForm && (!submitterName.trim() || !submitterPhone.trim())) {
      toast.error(t("submitterRequired"));
      return;
    }
    const allFormKids = Object.values(formChildrenByMother).flatMap((b) => [...b.sons, ...b.daughters]);
    if (allFormKids.some((c) => c.name.trim() && !hasAliveChosen(c.alive))) {
      toast.error(t("aliveStatusRequired"));
      return;
    }
    const orderedDrafts = orderedSiblings.flatMap((item) =>
      item.kind === "draft" ? [item.draft] : [],
    );
    if (orderedDrafts.some((c) => !c.birthOrder || c.birthOrder < 1)) {
      toast.error(t("birthOrderRequired"));
      return;
    }
    try {
      validateMergedSiblingOrder(orderedSiblings, formNamedChildren);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("birthOrderRequired"));
      return;
    }
    if (formFather.name.trim() && !validateParentKin(formFather, memberByIdSubmit)) {
      toast.error(formFather.inKin === true && formFather.kinAnchorId ? t("kinPathInvalid") : t("parentKinRequired"));
      return;
    }
    for (const m of formMothers) {
      if (!validateParentKin(m, memberByIdSubmit)) {
        toast.error(m.inKin === true && m.kinAnchorId ? t("kinPathInvalid") : t("parentKinRequired"));
        return;
      }
    }
    if (!validateMotherLineCoWives(formMothers, memberByIdSubmit)) {
      toast.error(t("motherLineCoWivesNotRegistered"));
      return;
    }
    const payload: SubmitFamilyPayload = {
      father: parentToPayload(formFather, memberByIdSubmit),
      mothers: formNamedMothers.map((m) => parentToPayload(m, memberByIdSubmit)),
      location,
      children: assignSequentialBirthOrder(orderedDrafts).map(({ key, ...child }) => {
        const photo = childPhotos[key] ?? null;
        return {
          ...child,
          photoBase64: photo?.base64 ?? null,
          photoMimeType: photo?.mimeType ?? null,
        };
      }),
      siblingOrder: orderedSiblings.length > 0 ? siblingOrderFromItems(orderedSiblings) : undefined,
      submitter: {
        name: isAdminForm ? submitterName.trim() || "Admin" : submitterName,
        phone: isAdminForm ? submitterPhone.trim() || "000" : submitterPhone,
        alive: true,
      },
      notes,
      confirmedDistinctNames: confirmedDistinct,
      ...(autoApprove ? { autoApprove: true } : {}),
    };
    const duplicateExcludeIds = [
      ...linkedMemberIdsFromForm(payload),
      ...(initialFamilyUnit?.father?.id ? [initialFamilyUnit.father.id] : []),
      ...(initialFamilyUnit?.mothers.map((m) => m.id) ?? []),
      ...(initialFamilyUnit?.children.map((c) => c.id) ?? []),
    ];
    const duplicates = findSubmissionDuplicates(payload, allMembers, {
      excludeMemberIds: duplicateExcludeIds,
      confirmedDistinctNames: confirmedDistinct,
    });
    if (duplicates.length > 0) {
      setDuplicateDialog(duplicates[0]);
      return;
    }
    setSubmitting(true);
    try {
      if (onEditUnit && initialFamilyUnit) {
        const memberIds: SubmissionMemberIds = {
          fatherId: initialFamilyUnit.father?.id ?? null,
          motherIds: initialFamilyUnit.mothers.map((m) => m.id),
          childIds: initialFamilyUnit.children.map((c) => c.id),
        };
        await onEditUnit(payload, memberIds);
        onSubmitted?.();
        return;
      }
      if (!navigator.onLine && !autoApprove) {
        await enqueueSubmission(payload);
        toast.success("Saved offline — will sync when online.");
      } else {
        await submitFamily(payload);
        toast.success(autoApprove ? "Family added." : t("successSubmitted"));
      }
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      onSubmitted?.();
      const again = window.confirm(t("addAnotherFamily"));
      reset(again);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = () =>
    executeSubmit({ father, mothers, childrenByMother, confirmedDistinct: confirmedDistinctNames });

  const handleDuplicateDistinct = () => {
    const hit = duplicateDialog;
    if (!hit) return;
    const norm = normalizeSubmitName(hit.name);
    const next = [...confirmedDistinctNames, norm];
    setConfirmedDistinctNames(next);
    setDuplicateDialog(null);
    void executeSubmit({ father, mothers, childrenByMother, confirmedDistinct: next });
  };

  const handleDuplicateLink = (memberId: number) => {
    const hit = duplicateDialog;
    if (!hit) return;
    const linked = linkDuplicateEntry(hit, memberId, allMembers, { father, mothers, childrenByMother });
    setFather(linked.father);
    setMothers(linked.mothers);
    setChildrenByMother(linked.childrenByMother);
    setDuplicateDialog(null);
    void executeSubmit({ ...linked, confirmedDistinct: confirmedDistinctNames });
  };

  const parentsAudioUrl = String(settings["add_family_audio_parents_url"] ?? "");
  const childrenAudioUrl = String(settings["add_family_audio_children_url"] ?? "");
  const submitterAudioUrl = String(settings["add_family_audio_submitter_url"] ?? "");

  return (
    <div className="space-y-4">
      {autoApprove && rootMember ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Admin: seed ancestors under {rootMember.full_name}</p>
          <p className="mt-1">
            Pick existing members from autocomplete to link under the tree. Set alive/deceased per person — not everyone
            in the same generation shares the same status.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            onClick={() =>
              setFather({
                name: rootMember.full_name,
                alive: "dead",
                existingId: rootMember.id,
                inKin: true,
                kinSide: null,
                kinAnchorId: null,
                photo: null,
              })
            }
          >
            Use {rootMember.full_name} as father
          </Button>
        </div>
      ) : null}
      <div className="space-y-2">
        {!isAdminForm && parentsAudioUrl ? (
          <SectionAudioPlayer
            ref={parentsAudioRef}
            src={parentsAudioUrl}
            label={t("audioGuideParents")}
          />
        ) : null}
        <SectionCard title={t("parents")} open={parentsOpen} onOpenChange={setParentsOpen}>
        <CardContent className="space-y-4">
          {!isAdminForm ? (
            <p className="text-xs leading-snug text-muted-foreground">{t("parentsEndogamyHint")}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-2">
              <Label className="text-xs">🔵 {t("father")} *</Label>
              <ParentKinFields
                parent={father}
                onChange={setFather}
                members={allMembers}
                idPrefix="father"
                parentRole="father"
                onFocusField={() => playSectionAudio("parents")}
                showLineLabel
                isEditMode={!!initialFamilyUnit}
              />
              {!father.existingId && father.name.trim() ? (
                <label className="block text-[10px] text-muted-foreground">
                  {t("addPhoto")}
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1 h-8 text-xs"
                    onChange={async (e) => {
                      const photo = await pickPhoto(e.target.files?.[0]);
                      setFather((p) => ({ ...p, photo }));
                    }}
                  />
                </label>
              ) : null}
            </div>
            <div className="space-y-3">
              {mothers.map((mo, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">🟣 {t("mother")} {mothers.length > 1 ? `#${i + 1}` : ""}</Label>
                    {i > 0 && (
                      <button type="button" onClick={() => setMothers((p) => p.filter((_, x) => x !== i))} className="text-muted-foreground">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  <ParentKinFields
                    parent={mo}
                    onChange={(next) => setMothers((p) => p.map((m, x) => (x === i ? next : m)))}
                    members={allMembers}
                    idPrefix={`mother-${i}`}
                    parentRole="mother"
                    onFocusField={() => playSectionAudio("parents")}
                    showLineLabel
                    isEditMode={!!initialFamilyUnit}
                  />
                  {!mo.existingId && mo.name.trim() ? (
                    <label className="block text-[10px] text-muted-foreground">
                      {t("addPhoto")}
                      <Input
                        type="file"
                        accept="image/*"
                        className="mt-1 h-8 text-xs"
                        onChange={async (e) => {
                          const photo = await pickPhoto(e.target.files?.[0]);
                          setMothers((p) => p.map((m, x) => (x === i ? { ...m, photo } : m)));
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {mothers.some((m) => m.inKin === true && m.kinSide === "mother") && (
            <p className="text-[10px] leading-snug text-muted-foreground">
              {t("addWifeNotOutsideCoWivesHint")}
            </p>
          )}
          <Button
            type="button"
            className={addWifeBtnClass}
            onClick={() => setMothers((p) => [...p, emptyParent()])}
          >
            <Plus className="size-3.5 shrink-0" />
            <span>{t("addAnotherWife")}</span>
          </Button>
          <ParentsEndogamySummary father={father} mothers={mothers} members={allMembers} />
          <div className="space-y-1.5" onFocusCapture={() => playSectionAudio("parents")}>
            <Label className="text-sm">📍 {t("currentLocation")} *</Label>
            <LocationKinHint father={father} mothers={mothers} members={allMembers} />
            <LocationSelector value={locationSelection} onChange={setLocationSelection} />
          </div>
        </CardContent>
        </SectionCard>
      </div>

      {(!isAdminForm || orderedSiblings.length > 0) && (
      <div className="space-y-2">
        <SectionCard title={t("siblingOrderTitle")} open={siblingOrderOpen} onOpenChange={setSiblingOrderOpen}>
          <CardContent>
            <SiblingOrderReview
              children={namedChildren}
              motherNames={motherNames}
              ordered={orderedSiblings}
              onChange={(next) => setOrderedSiblings(assignSequentialDraftBirthOrder(next))}
            />
          </CardContent>
        </SectionCard>
      </div>
      )}

      <div className="space-y-2">
        {!isAdminForm && childrenAudioUrl ? (
          <SectionAudioPlayer
            ref={childrenAudioRef}
            src={childrenAudioUrl}
            label={t("audioGuideChildren")}
          />
        ) : null}
        <SectionCard title={t("children")} open={childrenOpen} onOpenChange={setChildrenOpen}>
        <CardContent onFocusCapture={() => playSectionAudio("children")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("childrenBirthOrderHint")}</p>
          <ChildrenByMotherSection
            namedMothers={namedMothers}
            childrenByMother={childrenByMother}
            setChildrenByMother={setChildrenByMother}
            activeMotherTab={activeMotherTab}
            onActiveMotherTabChange={setActiveMotherTab}
          />
          {orderedSiblings.some((s) => s.kind === "draft") ? (
            <div className="mt-3 space-y-2 rounded-lg border border-dashed p-2">
              <p className="text-[10px] text-muted-foreground">{t("addPhoto")} (online only)</p>
              {orderedSiblings
                .filter((s): s is Extract<typeof s, { kind: "draft" }> => s.kind === "draft")
                .map((s) => (
                  <label key={s.draft.key} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">{s.draft.name}</span>
                    <Input
                      type="file"
                      accept="image/*"
                      className="h-8 max-w-[160px] text-xs"
                      onChange={async (e) => {
                        const photo = await pickPhoto(e.target.files?.[0]);
                        setChildPhotos((prev) => ({ ...prev, [s.draft.key]: photo }));
                      }}
                    />
                  </label>
                ))}
            </div>
          ) : null}
        </CardContent>
        </SectionCard>
      </div>

      {isAdminForm ? (
        <div className="space-y-1.5">
          <Label className="text-sm">{t("notes")}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
          />
        </div>
      ) : (
      <div className="space-y-2">
        {submitterAudioUrl ? (
          <SectionAudioPlayer
            ref={submitterAudioRef}
            src={submitterAudioUrl}
            label={t("audioGuideSubmitter")}
          />
        ) : null}
        <SectionCard title={t("submitter")} open={submitterOpen} onOpenChange={setSubmitterOpen}>
        <CardContent className="space-y-3" onFocusCapture={() => playSectionAudio("submitter")}>
          {knownSubmitter ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{submitterName}</p>
              <p className="text-muted-foreground">{submitterPhone}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("fullName")} *</Label>
                <Input
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder={t("fullName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("phone")} *</Label>
                <Input type="tel" value={submitterPhone} onChange={(e) => setSubmitterPhone(e.target.value)} placeholder="+251…" />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">{t("notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
            />
          </div>
        </CardContent>
        </SectionCard>
      </div>
      )}

      <Button size="lg" className="w-full font-bold tracking-wide" onClick={onSubmit} disabled={submitting}>
        {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
        {isAdminForm ? (isEdit ? "Save family" : "Add family") : t("submitForApproval")}
      </Button>

      <DuplicateNameDialog
        hit={duplicateDialog}
        byId={memberById}
        open={duplicateDialog != null}
        onOpenChange={(open) => {
          if (!open) setDuplicateDialog(null);
        }}
        onLinkSame={handleDuplicateLink}
        onDistinct={handleDuplicateDistinct}
      />
    </div>
  );
}
