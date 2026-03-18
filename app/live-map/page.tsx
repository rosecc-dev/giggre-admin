"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function LiveMapPage() {
  useAuthGuard({ module: "live-map" });
  return (
    <AdminLayout title="Live Map">
      <></>
    </AdminLayout>
  );
}
