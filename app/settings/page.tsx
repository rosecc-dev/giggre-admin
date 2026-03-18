"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function SettingsPage() {
  useAuthGuard({ module: "settings" });
  return (
    <AdminLayout
      title="Settings"
      subtitle="Configure platform preferences and system options"
    >
      <></>
    </AdminLayout>
  );
}
