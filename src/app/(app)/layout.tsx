import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { PageTransition } from "@/components/PageTransition";
import { VisitorModeBanner } from "@/components/VisitorModeBanner";
import { requireProfile } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { createClient } from "@/lib/supabase/server";
import { getAppChromeData } from "@/lib/appChromeData";
import { getHeaderAction } from "@/lib/headerAction";
import { NavigationFeedback } from "@/components/NavigationFeedback";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { PaymentNotices } from "@/components/PaymentNotices";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const isVisitor = profile.status === "visitor" || profile.status === "guest";
  const community = await getActiveCommunity(profile);
  const supabase = await createClient();
  const chromeData = getAppChromeData(supabase, profile, community);
  const headerAction = getHeaderAction(supabase, profile, community, chromeData);
  return (
    <div className={`community-shell flex min-h-screen flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0 ${community === "sand" ? "community-sand" : "community-court"}`}>
      <div key={community} aria-hidden="true" className={`community-aura community-aura-${community}`} />
      <NavigationFeedback />
      <PwaInstallPrompt />
      {(profile.status === "approved" || profile.is_organizer) && <PushPermissionPrompt />}
      <NavBar profile={profile} activeCommunity={community} chromeData={chromeData} headerAction={headerAction} />
      {isVisitor && <VisitorModeBanner invited={profile.status === "guest"} />}
      <main className="mx-auto min-w-0 w-full max-w-5xl flex-1 px-4 py-6 pb-40 sm:py-8 sm:pb-40 xl:max-w-7xl xl:px-6 2xl:max-w-[90rem]">
        {profile.status !== "visitor" && <PaymentNotices profileId={profile.id} community={community} headerAction={headerAction} />}
        <BackButton />
        <PageTransition community={community}>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  );
}
