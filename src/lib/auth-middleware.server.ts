import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getBearerToken, verifyToken } from "./auth.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getBearerToken(getRequest());
  if (!token) throw new Error("Unauthorized");

  const payload = await verifyToken(token);
  if (!payload) throw new Error("Unauthorized");

  return next({
    context: {
      userId: payload.sub,
      email: payload.email,
      isAdmin: payload.role === "admin",
    },
  });
});

export const optionalAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getBearerToken(getRequest());
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    return next({
      context: {
        userId: null as string | null,
        email: null as string | null,
        isAdmin: false,
        isAuthenticated: false,
      },
    });
  }
  return next({
    context: {
      userId: payload.sub,
      email: payload.email,
      isAdmin: payload.role === "admin",
      isAuthenticated: true,
    },
  });
});

export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getBearerToken(getRequest());
  if (!token) throw new Error("Unauthorized");

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "admin") throw new Error("Forbidden");

  return next({
    context: {
      userId: payload.sub,
      email: payload.email,
      isAdmin: true,
    },
  });
});
