"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "./Toast";

/**
 * Mostra um toast quando a URL atual tem ?param=1 (usado por ações que fazem
 * redirect(), já que o toast normal do ActionForm não roda nesse caso), e
 * depois limpa o parâmetro da URL.
 */
export function ToastFromQuery({ param, message }: { param: string; message: string }) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!searchParams.get(param)) return;
    showToast(message);
    const params = new URLSearchParams(searchParams);
    params.delete(param);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
