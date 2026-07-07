import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bot, Heart, Images, Loader2, MessageCircle, Send, Sparkles, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  chatGuestTrialFn,
  chatWithAssistantFn,
  getChatbotContextFn,
  getGuestChatStatusFn,
  getPublicChatbotContextFn,
} from "@/lib/api/chatbot.functions";
import type { ChatMessage, ChatbotContext } from "@/lib/chatbot/types";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const EMPTY_CONTEXT: ChatbotContext = {
  totalMembers: 0,
  unreadNotifications: 0,
  adminEmail: "",
  adminPhone: "",
  hasVideo: false,
  hasAudioGuide: false,
  contactAdmins: [],
  sponsorUrl: "https://t.me/hamdiabdosh43",
  kinPageConfig: {
    pageTitle: "",
    pageDescription: "",
    defaultTab: "lineage",
    showSearch: true,
    showFilters: true,
    showLineageTab: true,
    showLocationTab: true,
    showGenerationTab: true,
  },
};

const GUEST_TRIAL_KEY = "chat_guest_used";

function createWelcomeMessage(t: (key: string) => string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "bot",
    text: t("chatWelcome"),
  };
}

type Props = {
  /** Auth page has no bottom nav — lift the FAB. */
  placement?: "app" | "auth";
};

export function ChatbotWidget({ placement = "app" }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [guestLocked, setGuestLocked] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: guestStatus } = useQuery({
    queryKey: ["chatbot-guest-status"],
    queryFn: getGuestChatStatusFn,
    enabled: !user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (user) {
      setGuestLocked(false);
      return;
    }
    if (guestStatus?.used) {
      setGuestLocked(true);
      if (typeof window !== "undefined") localStorage.setItem(GUEST_TRIAL_KEY, "1");
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(GUEST_TRIAL_KEY) === "1") {
      setGuestLocked(true);
    }
  }, [user, guestStatus?.used]);

  const { data: context = EMPTY_CONTEXT } = useQuery({
    queryKey: ["chatbot-context", user?.id ?? "guest"],
    queryFn: user ? getChatbotContextFn : getPublicChatbotContextFn,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!open || messages.length > 0) return;
    setMessages([createWelcomeMessage((k) => t(k as never))]);
  }, [open, messages.length, t]);

  const openChat = () => {
    setOpen(true);
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [createWelcomeMessage((k) => t(k as never))];
    });
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const chatLocked = !user && guestLocked;

  const lockGuestChat = () => {
    setGuestLocked(true);
    if (typeof window !== "undefined") localStorage.setItem(GUEST_TRIAL_KEY, "1");
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || chatLocked) return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);

    try {
      if (!user) {
        const ai = await chatGuestTrialFn({ data: { message: trimmed, pathname } });
        if (ai.guestLimitReached) {
          lockGuestChat();
          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "bot", text: t("chatLoginToContinue") }]);
          return;
        }
        if (ai.reply) {
          lockGuestChat();
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "bot", text: ai.reply },
            { id: crypto.randomUUID(), role: "bot", text: t("chatLoginToContinue") },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "bot", text: ai.ok ? t("errorOccurred") : ai.reply || t("errorOccurred") },
          ]);
        }
        return;
      }

      const history = messages
        .filter((m) => m.role === "user" || (m.role === "bot" && m.text !== t("chatWelcome")))
        .slice(-10)
        .map((m) => ({ role: m.role === "bot" ? ("assistant" as const) : ("user" as const), content: m.text }));

      const ai = await chatWithAssistantFn({
        data: { message: trimmed, pathname, history },
      });

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "bot", text: ai.reply || t("errorOccurred") },
      ]);
    } catch (e) {
      console.error("[chatbot] request failed:", e);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "bot", text: t("errorOccurred") }]);
    } finally {
      setThinking(false);
    }
  };

  const pageLabel = useMemo(() => {
    if (pathname.startsWith("/home")) return t("chatPage_home");
    if (pathname.startsWith("/tree")) return t("chatPage_tree");
    if (pathname.startsWith("/kin")) return t("chatPage_kin");
    if (pathname.startsWith("/add-family")) return t("chatPage_addFamily");
    if (pathname.startsWith("/profile")) return t("chatPage_profile");
    if (pathname.startsWith("/notifications")) return t("chatPage_notifications");
    if (pathname.startsWith("/explore")) return t("chatPage_explore");
    if (pathname.startsWith("/gallery")) return t("chatPage_gallery");
    return t("chatPage_home");
  }, [pathname, t]);

  const fabBottom =
    placement === "auth"
      ? "bottom-[calc(20px+env(safe-area-inset-bottom))]"
      : "bottom-[calc(88px+env(safe-area-inset-bottom)+20px)]";

  return (
    <>
      <button
        type="button"
        aria-label={t("chatOpen")}
        onClick={openChat}
        className={cn(
          "fixed right-4 z-[45] flex size-12 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25",
          "transition-transform hover:scale-105 active:scale-95",
          fabBottom,
        )}
      >
        {!open ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" /> : null}
        <Bot className="relative size-6" />
        {user && context.unreadNotifications > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {context.unreadNotifications > 9 ? "9+" : context.unreadNotifications}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex h-[62vh] max-h-[560px] w-full max-w-md flex-col rounded-t-3xl border-x border-t bg-background/95 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl [&>button]:hidden"
        >
          <SheetHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-primary/5 px-4 py-3 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <SheetTitle className="text-base">{t("chatTitle")}</SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("chatSubtitle").replace("{page}", pageLabel)}
                  </p>
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-2 border-b px-3 py-2">
            <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
              <Link to="/profile" onClick={() => setOpen(false)}>
                <MessageCircle className="mr-1.5 size-3.5 shrink-0" />
                {t("chatContactAdmin")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
              <Link to="/profile" search={{ sponsor: true }} onClick={() => setOpen(false)}>
                <Heart className="mr-1.5 size-3.5 shrink-0" />
                {t("chatSponsorApp")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
              <Link to="/gallery" onClick={() => setOpen(false)}>
                <Images className="mr-1.5 size-3.5 shrink-0" />
                {t("chatExploreGallery")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" asChild>
              <Link to="/kin" onClick={() => setOpen(false)}>
                <Users className="mr-1.5 size-3.5 shrink-0" />
                {t("chatExploreKin")}
              </Link>
            </Button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    message.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border bg-muted/40 text-foreground",
                  )}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {thinking ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t("chatThinking")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-background px-3 py-3">
            {chatLocked ? (
              <div className="space-y-2 text-center">
                <p className="text-xs text-muted-foreground">{t("chatLoginToContinue")}</p>
                <Button asChild size="sm" className="w-full">
                  <Link to="/auth">{t("signIn")}</Link>
                </Button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={user ? t("chatPlaceholder") : t("chatGuestPlaceholder")}
                  disabled={thinking}
                />
                <Button type="submit" size="icon" disabled={thinking || !input.trim()}>
                  <Send className="size-4" />
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
