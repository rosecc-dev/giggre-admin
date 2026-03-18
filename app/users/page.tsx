"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function UsersPage() {
  useAuthGuard({ module: "users" });
  return (
    <AdminLayout
      title="Users"
      subtitle="Manage all registered users and workers"
    >
      <></>
    </AdminLayout>
  );
}
