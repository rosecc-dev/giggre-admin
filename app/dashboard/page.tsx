"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function DashboardPage() {
  useAuthGuard();
  return (
    <AdminLayout title="Dashboard">
     <></>
    </AdminLayout>
  );
}
