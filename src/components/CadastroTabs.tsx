"use client";

import { useState, type ReactNode } from "react";

export function CadastroTabs({
  memberForm,
  reserveForm,
}: {
  memberForm: ReactNode;
  reserveForm: ReactNode;
}) {
  const [tab, setTab] = useState<"member" | "reserve">("member");

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTab("member")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "member" ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"
          }`}
        >
          Sou do grupo
        </button>
        <button
          type="button"
          onClick={() => setTab("reserve")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === "reserve" ? "bg-white text-brand-navy shadow-sm" : "text-gray-500"
          }`}
        >
          Sou de fora
        </button>
      </div>
      {tab === "member" ? memberForm : reserveForm}
    </div>
  );
}
