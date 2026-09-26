import type { ReactNode } from "react";
import { PerfilTabs } from "@/components/PerfilTabs";
import { requireProfile } from "@/lib/auth";

export default async function PerfilLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  return (
    <div>
      <PerfilTabs readOnly={profile.status !== "approved"} />
      {children}
    </div>
  );
}
