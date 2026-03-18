"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function QuickGigsPage() {
  useAuthGuard({ module: "quick-gigs" });
  return (
    <AdminLayout
      title="Quick Gigs"
      subtitle="Manage all quick gig suspensions"
    >
      <></>
    </AdminLayout>
  );
}
