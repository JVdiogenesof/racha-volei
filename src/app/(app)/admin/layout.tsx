import type { ReactNode } from "react";
import { AdminTabs } from "@/components/AdminTabs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}
