import { redirect } from "next/navigation";

/** O resultado final agora fica na tela "Como foi o racha" (links antigos continuam funcionando). */
export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/racha/${id}/resumo`);
}
