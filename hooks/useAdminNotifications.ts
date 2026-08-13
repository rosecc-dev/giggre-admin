"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { AdminNotification } from "@/lib/notifications";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Centralized admin notification feed. Visibility is scoped by the
 * `requiredPermission` query clause below (not just the Firestore rule) —
 * `list` rules can't filter partial results, so the query itself must only
 * ever ask for documents the signed-in admin is authorized to see.
 */
export function useAdminNotifications() {
  const { user, isSuperAdmin } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Realtime, permission-scoped notifications listener ──────────────────────
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (!isSuperAdmin && user.permissions.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = isSuperAdmin
      ? query(collection(db, "admin_notifications"), orderBy("createdAt", "desc"), limit(200))
      : query(
          collection(db, "admin_notifications"),
          where("requiredPermission", "in", user.permissions),
          orderBy("createdAt", "desc"),
          limit(200)
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminNotification[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id:                 d.id,
            type:               data.type ?? "verification_request",
            requiredPermission: data.requiredPermission ?? "verification",
            title:              data.title ?? "",
            message:            data.message ?? "",
            link:               data.link ?? "",
            sourceCollection:   data.sourceCollection ?? "",
            sourceId:           data.sourceId ?? "",
            meta:               data.meta ?? { userId: null, name: null, email: null },
            createdAt:          data.createdAt?.toDate?.() ?? null,
            readBy:             data.readBy ?? {},
          };
        });
        setNotifications(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message ?? "Failed to fetch notifications.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, isSuperAdmin]);

  // ── Permission-aware unread count ────────────────────────────────────────────
  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !n.readBy[user.uid]).length;
  }, [notifications, user]);

  // ── Mark as read (per-admin) ─────────────────────────────────────────────────
  const markAsRead = useCallback(
    async (notifId: string) => {
      if (!user) return;
      await updateDoc(doc(db, "admin_notifications", notifId), {
        [`readBy.${user.uid}`]: true,
      });
    },
    [user]
  );

  return { notifications, unreadCount, loading, error, markAsRead };
}
