import { redirect } from "next/navigation";

// Criar e editar racha mudou de lugar: agora mora na aba Rachas, junto com a
// lista, pra não precisar ir no Admin só pra isso. Mantém o redirect aqui pra
// não quebrar atalhos e links salvos de antes dessa mudança.
export default function AdminRachasRedirectPage() {
  redirect("/racha");
}
