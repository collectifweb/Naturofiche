import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Rendu d'une fiche de synthèse en Markdown (côté serveur, aucun poids client).
// remark-gfm est requis pour les tableaux (besoins particuliers / aliments riches),
// qui portent des réponses d'examen — cahier §10. Styles : .fiche-prose (globals.css).
export function FicheMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("fiche-prose", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
