import type { Member, PendingFamilySubmission, SubmitFamilyPayload, SubmissionMemberIds } from "@/lib/family";

export type AdminView =
  | "dashboard"
  | "approval"
  | "accounts"
  | "family"
  | "duplicates"
  | "incomplete"
  | "export"
  | "tree"
  | "feedbacks"
  | "announcements"
  | "notifications"
  | "explore"
  | "kin"
  | "translations"
  | "settings";

export type AdminData = {
  pending: Member[];
  pendingSubmissions: PendingFamilySubmission[];
  approved: Member[];
  all: Member[];
  duplicates: Member[][];
  incomplete: Member[];
};

export type AdminActions = {
  approve: (id: number) => Promise<void>;
  reject: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setAlive: (id: number, isAlive: boolean) => Promise<void>;
  editFamilyUnit: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  saveSubmission: (id: string, form: SubmitFamilyPayload) => Promise<void>;
  approveSubmission: (id: string) => Promise<void>;
  rejectSubmission: (id: string) => Promise<void>;
  exportCSV: () => void;
  exportJSON: () => void;
  exportGEDCOM: () => void;
  dismissDuplicateGroup: (groupKey: string) => Promise<void>;
};

export type AdminCounts = {
  pending: number;
  members: number;
  feedbacks: number;
  notifications: number;
  accounts: number;
};
