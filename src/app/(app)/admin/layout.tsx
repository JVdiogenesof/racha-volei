import type { ReactNode } from "react";
import { requireOrganizer } from "@/lib/auth";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireOrganizer();
  return (
    <div>
      <AdminTabs canViewShirts />
      {children}
    </div>
  );
}
