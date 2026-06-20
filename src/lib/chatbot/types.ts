import type { ContactAdmin } from "@/lib/contact-admins";
import type { KinPageConfig } from "@/lib/kin-page-config";

export type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
};

export type ChatbotContext = {
  totalMembers: number;
  unreadNotifications: number;
  adminEmail: string;
  adminPhone: string;
  hasVideo: boolean;
  hasAudioGuide: boolean;
  contactAdmins: ContactAdmin[];
  sponsorUrl: string;
  kinPageConfig: KinPageConfig;
};
