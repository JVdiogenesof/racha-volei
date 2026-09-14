import type { ReactNode } from "react";
import { PerfilTabs } from "@/components/PerfilTabs";

export default function PerfilLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <PerfilTabs />
      {children}
    </div>
  );
}
