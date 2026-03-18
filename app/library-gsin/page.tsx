"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function LibraryGSINPage() {
  useAuthGuard({ module: "library-gsin" });
  return (
    <AdminLayout
      title="Skills (GSIN Library)"
    >
      <></>
    </AdminLayout>
  );
}
