import { cn } from "@/lib/utils";

// Composant signature (DESIGN.md §5) : porte la hiérarchisation du cours.
// essentiel (ce qui tombe à l'examen) · utile (à connaître) · secondaire (survolable).
const VARIANTS = {
  essentiel: "bg-green-wash text-green-ink",
  utile: "bg-secondary text-foreground",
  secondaire: "bg-transparent text-muted-foreground ring-1 ring-border ring-inset",
} as const;

export type ChipVariant = keyof typeof VARIANTS;

export function Chip({
  variant = "utile",
  className,
  children,
}: {
  variant?: ChipVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] leading-tight font-medium tracking-[0.01em]",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
