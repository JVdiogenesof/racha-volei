import type { ReactNode } from "react";
import { organizerCan, requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveCommunity } from "@/lib/community";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const organizer = await requireOrganizer();
  const isFull = organizerCan(organizer, "admin");
  const supabase = await createClient();
  const community = await getActiveCommunity();

  // Contadores de pendências nas abas. Qualquer falha aqui só some com o número.
  const [reserve, shirts] = isFull ? await Promise.all([
    supabase.from("reserve_list").select("id", { count: "exact", head: true }).contains("communities", [community]).eq("contacted", false),
    supabase.from("shirt_orders").select("id", { count: "exact", head: true }).eq("community", community).eq("paid", false),
  ]) : [{ count: 0 }, { count: 0 }];

  return (
    <div>
      <AdminTabs
        canViewShirts
        scope={organizer.organizer_scope ?? "full"}
        badges={{ "/admin/reserva": reserve.count ?? 0, "/admin/camisas": shirts.count ?? 0 }}
      />
      {children}
    </div>
  );
}
