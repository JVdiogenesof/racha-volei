import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { PageTransition } from "@/components/PageTransition";
import { VisitorModeBanner } from "@/components/VisitorModeBanner";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const isVisitor = profile.status === "visitor" || profile.status === "pending" || profile.status === "guest";
  return (
    <>
      <NavBar />
      {isVisitor && <VisitorModeBanner invited={profile.status === "guest"} />}
      <main className="mx-auto min-w-0 w-full max-w-5xl flex-1 px-4 py-6 pb-40 sm:py-8 sm:pb-40">
        <BackButton />
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <NotificationCenter />
    </>
  );
}
