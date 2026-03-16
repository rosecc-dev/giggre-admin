"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * useAuthGuard — redirect unauthenticated users to /login.
 *
 * Usage: call this at the top of any page or layout that requires auth.
 *
 * @param allowedRoles  Optional whitelist of roles. If omitted, any authenticated user passes.
 *
 * @example
 *   // Any authenticated admin
 *   useAuthGuard();
 *
 *   // Superadmin only
 *   useAuthGuard(["superadmin"]);
 */
export function useAuthGuard(
  allowedRoles?: Array<"superadmin" | "admin" | "moderator">
) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Authenticated but wrong role — send to dashboard
      router.replace("/dashboard");
    }
  }, [user, loading, router, allowedRoles]);

  return { user, loading };
}
