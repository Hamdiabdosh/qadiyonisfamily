import { toast } from "sonner";

import { getMemberInviteLinkFn } from "@/lib/api/family.functions";
import { APP_URL } from "@/lib/app-url";

export async function copyMemberInviteLink(memberId: number) {
  try {
    const { path } = await getMemberInviteLinkFn({ data: { memberId } });
    const url = `${typeof window !== "undefined" ? window.location.origin : APP_URL}${path}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not get invite link");
  }
}
