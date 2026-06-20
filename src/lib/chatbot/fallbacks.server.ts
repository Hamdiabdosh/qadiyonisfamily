/**
 * Quick navigation hints — only for explicit how-to / app-meta questions.
 * Factual questions (who is X, weddings, etc.) go to the LLM + database.
 */
type TopicRule = { pattern: RegExp; reply: string };

const QUICK_NAV: TopicRule[] = [
  {
    pattern: /^(\s*hi\b|\s*hello\b|\s*hey\b|\s*selam\b|\s*salaam\b|\s*asalamu|\s*good\s+(morning|afternoon|evening)\b)\s*[!?.]*$/i,
    reply:
      "Hello! I'm Qadi Yonis Ai. Ask me about the Qadi Yonis family tree, events, weddings, funerals, kin directory, gallery, or how to add your family.",
  },
  {
    pattern: /who\s+(built|made|created|developed)\s+(this\s+)?(app|application)|who\s+is\s+the\s+developer/i,
    reply:
      "This app was developed by Abdulfetah Jemal (Software Engineer) — see Profile for his link. It was founded by Abdushafi Abdulkadir.",
  },
  {
    pattern: /who\s+founded|founded\s+by|who\s+started\s+(the\s+)?app/i,
    reply:
      "The app was founded by Abdushafi Abdulkadir. Abdulfetah Jemal developed it. Visit Profile for their links.",
  },
  {
    pattern: /^how\s+(do\s+i\s+)?contact\s+(the\s+)?admin/i,
    reply: "Open Profile → Contact Admin for phone numbers and Telegram. You can also tap Contact admin in this chat.",
  },
  {
    pattern: /^how\s+(do\s+i\s+)?sponsor|sponsor\s+(the\s+)?app/i,
    reply:
      "Open Profile → Sponsor the App for server, domain, and AI costs. Tap Sponsor app in this chat. Extra contributions support kin in need.",
  },
  {
    pattern: /how\s+(to\s+|do\s+i\s+)?add\s+(my\s+)?family|how\s+(to\s+)?register\s+(my\s+)?family|how\s+(to\s+)?submit\s+(my\s+)?family/i,
    reply:
      "Sign in, then open Add Family (bottom menu or Home). Enter parents, optional children, location, and your contact info. An admin approves the submission.",
  },
  {
    pattern: /^help\s*[!?.]*$|^what\s+can\s+you\s+do\s*\??$/i,
    reply:
      "Ask me about family members, events, weddings, funerals, the tree, kin directory, gallery, or how to add your family. I use live data from the app.",
  },
];

const DEFAULT_HELP =
  "Ask me a specific question about Qadi Yonis family members, events, or the app — I answer using live data from the tree.";

export function tryQuickNavAnswer(message: string): string | null {
  const q = message.trim();
  if (!q) return null;

  for (const { pattern, reply } of QUICK_NAV) {
    if (pattern.test(q)) return reply;
  }

  return null;
}

/** @deprecated Use tryQuickNavAnswer — kept for imports */
export function tryStaticChatAnswer(message: string): string | null {
  return tryQuickNavAnswer(message);
}

export function topicFallbackOrDefault(message: string): string {
  return tryQuickNavAnswer(message) ?? DEFAULT_HELP;
}
