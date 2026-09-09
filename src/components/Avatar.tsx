const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={`flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full bg-brand-purple/15 font-semibold text-brand-purple ring-2 ring-white`}
    >
      {initials || "?"}
    </span>
  );
}
