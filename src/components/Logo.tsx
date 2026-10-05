export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-header-transparent.webp" alt="Vôlei Por Amor Racha" className={`${className} object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.28)]`} />;
}

export function Logo({ className = "", markClassName = "h-10 w-10" }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
    </span>
  );
}
