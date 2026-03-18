"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function ActivityLogsPage() {
  useAuthGuard({ module: "activity-logs" });
  return (
    <AdminLayout
      title="Activity Logs"
      subtitle="Audit trail of all admin actions"
    >
      <></>
    </AdminLayout>
  );
}
