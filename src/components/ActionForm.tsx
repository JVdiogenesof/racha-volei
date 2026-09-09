"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

type ActionFn = (formData: FormData) => Promise<void> | void;

/**
 * Wrapper de <form> que chama a Server Action diretamente no submit (em vez
 * de usar <form action={fn}> com useActionState — em produção isso não
 * disparava a ação de forma confiável quando a função vinha de uma prop/
 * import em vez de ser o valor exato ligado ao form). Mostra um toast de
 * sucesso, ou de erro se a ação falhar, e força os dados da página a
 * atualizar depois.
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await action(formData);
        showToast(typeof successMessage === "function" ? successMessage(formData) : successMessage);
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={isPending}>
      {children}
    </form>
  );
}
