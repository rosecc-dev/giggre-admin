"use client";

import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import UserRequests from "./userRequests";

export default function UserRequestsPage() {
  useAuthGuard({ module: "user-requests" });

  return (
    <AdminLayout
      title="User Skill Requests"
      subtitle="Review and manage skill requests from gig workers"
    >
      <UserRequests />
    </AdminLayout>
  );
}
