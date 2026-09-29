import type { ReactNode } from "react";
import { requireOrganizer } from "@/lib/auth";
import { canAccessShirts } from "@/lib/shirt-access";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireOrganizer();
  return (
    <div>
      <AdminTabs canViewShirts={canAccessShirts(profile.id)} />
      {children}
    </div>
  );
}
