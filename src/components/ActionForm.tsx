"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useToast } from "./Toast";

type ActionFn = (formData: FormData) => Promise<void> | void;

/**
 * Wrapper de <form action={...}> que mostra um toast de confirmação quando a
 * Server Action termina sem erro. Não funciona com ações que chamam redirect()
 * (a navegação acontece antes do efeito rodar) — para essas, use ToastFromQuery
 * na página de destino.
 */
export function ActionForm({
  action,
  successMessage,
  children,
  className,
}: {
  action: ActionFn;
  successMessage: string | ((formData: FormData) => string);
  children: ReactNode;
  className?: string;
}) {
  const { showToast } = useToast();
  const messageRef = useRef("");

  const [tick, formAction] = useActionState(async (prevTick: number, formData: FormData) => {
    await action(formData);
    messageRef.current =
      typeof successMessage === "function" ? successMessage(formData) : successMessage;
    return prevTick + 1;
  }, 0);

  useEffect(() => {
    if (tick > 0) showToast(messageRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
