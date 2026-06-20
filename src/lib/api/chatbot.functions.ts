import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { chatErrorMessage } from "@/lib/chatbot/errors.server";
import { tryQuickNavAnswer, topicFallbackOrDefault } from "@/lib/chatbot/fallbacks.server";
import {
  buildAssistantSystemPrompt,
  guestTrialSetCookieHeader,
  guestTrialUsedFromRequest,
  loadChatbotUiContext,
} from "@/lib/chatbot/context.server";
import { getMemberContextBlock, tryMemberLookupReply } from "@/lib/chatbot/member-lookup.server";
import type { ChatbotContext } from "@/lib/chatbot/types";
import { chatCompletion, isLlmConfigured } from "@/lib/llm.server";
import { requireAuth } from "@/lib/auth-middleware.server";

export type ChatFnResult = { ok: boolean; reply: string; guestLimitReached?: boolean };

const CORE_SYSTEM =
  "You are Qadi Yonis Ai, the assistant for the Qadi Yonis family tree app. Answer using the app data provided. Be warm and concise (2-5 sentences unless more detail is needed). Never invent family members not in the data. For people in the tree, use the member records given.";

function markGuestCookieUsed() {
  try {
    setResponseHeader("Set-Cookie", guestTrialSetCookieHeader());
  } catch (error) {
    console.warn("[chatbot] Could not set guest cookie:", error);
  }
}

async function generateAssistantReply(opts: {
  message: string;
  pathname: string;
  userId?: string | null;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<ChatFnResult> {
  const { message, pathname, userId, history } = opts;

  const quickNav = tryQuickNavAnswer(message);
  if (quickNav) return { ok: true, reply: quickNav };

  const memberContext = await getMemberContextBlock(message);

  let systemPrompt = CORE_SYSTEM;
  try {
    const appContext = await buildAssistantSystemPrompt({
      pathname,
      userId,
      userMessage: message,
    });
    systemPrompt = `${CORE_SYSTEM}\n\n${appContext}`;
  } catch (contextError) {
    console.error("[chatbot] context build failed:", contextError);
  }

  if (memberContext) {
    systemPrompt += `\n\n## Members matching this question (from database)\n${memberContext}`;
  }

  if (!isLlmConfigured()) {
    console.warn("[chatbot] LLM_API_KEY not set — using database lookup only");
    const memberReply = await tryMemberLookupReply(message);
    if (memberReply) return { ok: true, reply: memberReply };
    return {
      ok: false,
      reply:
        "The AI service is not configured on the server yet. Try Kin Directory for member search, or contact admin via Profile.",
    };
  }

  try {
    const reply = await chatCompletion([
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ]);
    return { ok: true, reply };
  } catch (error) {
    console.error("[chatbot] LLM error:", error);
    const memberReply = await tryMemberLookupReply(message);
    if (memberReply) return { ok: true, reply: memberReply };

    const specific = chatErrorMessage(error);
    if (specific) return { ok: false, reply: specific };

    return { ok: true, reply: topicFallbackOrDefault(message) };
  }
}

export const getChatbotContextFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ChatbotContext> => {
    return loadChatbotUiContext(context.userId);
  });

export const getPublicChatbotContextFn = createServerFn({ method: "GET" }).handler(async (): Promise<ChatbotContext> => {
  return loadChatbotUiContext(null);
});

export const getGuestChatStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const used = guestTrialUsedFromRequest(getRequest());
  return { used };
});

export const chatGuestTrialFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      message: z.string().min(1).max(500),
      pathname: z.string(),
    }),
  )
  .handler(async ({ data }): Promise<ChatFnResult> => {
    const request = getRequest();
    if (guestTrialUsedFromRequest(request)) {
      return { ok: false, reply: "", guestLimitReached: true };
    }

    const result = await generateAssistantReply({
      message: data.message,
      pathname: data.pathname,
      userId: null,
      history: [],
    });

    if (result.ok && result.reply) markGuestCookieUsed();
    return { ...result, guestLimitReached: false };
  });

export const chatWithAssistantFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      message: z.string().min(1).max(2000),
      pathname: z.string(),
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
        .max(12),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }): Promise<ChatFnResult> => {
    try {
      return await generateAssistantReply({
        message: data.message,
        pathname: data.pathname,
        userId: context.userId,
        history: data.history,
      });
    } catch (error) {
      console.error("[chatbot] handler error:", error);
      const memberReply = await tryMemberLookupReply(data.message);
      if (memberReply) return { ok: true, reply: memberReply };
      const specific = chatErrorMessage(error);
      if (specific) return { ok: false, reply: specific };
      return { ok: true, reply: topicFallbackOrDefault(data.message) };
    }
  });
