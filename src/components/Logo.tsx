export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" fill="url(#vpa-ball-gradient)" stroke="white" strokeWidth="1.5" />
      <path
        d="M20 1c6 5 6 33 0 38M1 20h38M6 8c8 6 20 6 28 0M6 32c8-6 20-6 28 0"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="vpa-ball-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#101534" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  className = "",
  accentClassName = "text-brand-purple",
}: {
  className?: string;
  accentClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight">
        VPA <span className={accentClassName}>Racha</span>
      </span>
    </span>
  );
}
