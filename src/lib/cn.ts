// Helper mínimo pra combinar classes condicionalmente, sem puxar a dependência
// clsx/tailwind-merge só pra isso.
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
