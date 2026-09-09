export const SKILL_CATEGORIES = [
  "attack",
  "setting",
  "serve",
  "reception",
  "defense",
  "block",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_LABELS: Record<SkillCategory, string> = {
  attack: "Ataque",
  setting: "Levantamento",
  serve: "Saque",
  reception: "Recepção/Passe",
  defense: "Defesa",
  block: "Bloqueio",
};

const NEUTRAL_SCORE = 2.5;

export type RatingsByCategory = Partial<Record<SkillCategory, number>>;

/**
 * Nota final = média ponderada entre autoavaliação e nota do organizador.
 * Sem autoavaliação preenchida, usa NEUTRAL_SCORE no lugar dela até a pessoa preencher.
 * Sem nota do organizador ainda, usa 100% a autoavaliação (ou o neutro, se nenhuma existir).
 */
export function finalScoreForCategory(
  self: number | undefined,
  organizer: number | undefined,
  selfWeight: number,
  organizerWeight: number,
): number {
  if (organizer === undefined) {
    return self ?? NEUTRAL_SCORE;
  }
  const selfValue = self ?? NEUTRAL_SCORE;
  const totalWeight = selfWeight + organizerWeight;
  return (selfValue * selfWeight + organizer * organizerWeight) / totalWeight;
}

export function finalScoresForPlayer(
  self: RatingsByCategory,
  organizer: RatingsByCategory,
  selfWeight: number,
  organizerWeight: number,
): Record<SkillCategory, number> {
  const result = {} as Record<SkillCategory, number>;
  for (const category of SKILL_CATEGORIES) {
    result[category] = finalScoreForCategory(
      self[category],
      organizer[category],
      selfWeight,
      organizerWeight,
    );
  }
  return result;
}

export function overallScore(scores: Record<SkillCategory, number>): number {
  const values = SKILL_CATEGORIES.map((c) => scores[c]);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
