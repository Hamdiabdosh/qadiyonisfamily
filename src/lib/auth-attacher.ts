import { createMiddleware } from "@tanstack/react-start";

import { TOKEN_COOKIE } from "./auth.server";

export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_COOKIE) : null;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
