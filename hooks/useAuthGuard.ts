"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { ModuleKey } from "@/lib/modules";

interface GuardOptions {
  roles?: Array<"super_admin" | "admin">;
  module?: ModuleKey;
  redirectTo?: string;
}

/**
 * useAuthGuard — redirect unauthenticated or unauthorized users.
 *
 * @example
 *   // Any authenticated admin
 *   useAuthGuard();
 *
 *   // Super admin only page
 *   useAuthGuard({ roles: ["super_admin"] });
 *
 *   // Module-gated page
 *   useAuthGuard({ module: "reports" });
 */
export function useAuthGuard(options: GuardOptions = {}) {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();
  const { roles, module, redirectTo = "/dashboard" } = options;

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (roles && !roles.includes(user.role)) {
      router.replace(redirectTo);
      return;
    }

    if (module && !hasPermission(module)) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, roles, module, redirectTo, hasPermission]);

  return { user, loading, hasPermission };
}