"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function ReportsPage() {
  useAuthGuard({ module: "reports" });
  return (
    <AdminLayout
      title="Reports"
      subtitle="Platform analytics and performance overview"
    >
     <></>
    </AdminLayout>
  );
}
