import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { NotificationCenter } from "@/components/NotificationCenter";
import { EvolutionShortcut } from "@/components/EvolutionShortcut";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { PageTransition } from "@/components/PageTransition";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <BackButton />
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <EvolutionShortcut />
      <NotificationCenter />
    </>
  );
}
