"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function AnnouncementsPage() {
  useAuthGuard({ module: "announcements" });
  return (
    <AdminLayout
      title="Announcements"
    >
      <></>
    </AdminLayout>
  );
}
