"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ETAPES = [
  "Téléversement des PDF…",
  "Extraction du texte…",
  "Découpage en sections…",
  "Analyse de l'examen…",
  "Finalisation…",
];

export default function ImportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [etape, setEtape] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const cours = data.get("coursPdf") as File | null;
    if (!cours || cours.size === 0) {
      toast.error("Dépose au moins le PDF du cours.");
      return;
    }
    // Champ examen vide → on n'envoie pas le fichier (l'examen est peut-être dans le cours).
    const examen = data.get("examenPdf") as File | null;
    if (!examen || examen.size === 0) data.delete("examenPdf");

    setLoading(true);
    setEtape(0);
    const tick = setInterval(
      () => setEtape((s) => Math.min(s + 1, ETAPES.length - 1)),
      900,
    );

    try {
      const res = await fetch("/api/import", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Échec de l'import.");
      toast.success(
        `Cours importé (${json.questions} questions détectées). Analyse IA en cours…`,
      );
      router.push(`/course/${json.courseId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'import.");
      setLoading(false);
    } finally {
      clearInterval(tick);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 py-9">
      <div className="space-y-1.5">
        <Link
          href="/"
          className="inline-flex text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Accueil
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Importer un cours</h1>
        <p className="text-[0.9375rem] text-muted-foreground">
          Dépose le PDF du cours (et son examen s&apos;il est à part), puis choisis le délai.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau cours</CardTitle>
          <CardDescription>
            L&apos;app extrait le texte et prépare un premier découpage en sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="coursPdf">PDF du cours</Label>
              <Input id="coursPdf" name="coursPdf" type="file" accept="application/pdf,.pdf" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="examenPdf">
                PDF de l&apos;examen{" "}
                <span className="font-normal text-muted-foreground">(optionnel)</span>
              </Label>
              <Input id="examenPdf" name="examenPdf" type="file" accept="application/pdf,.pdf" />
              <p className="text-xs text-muted-foreground">
                Si l&apos;examen est inclus dans le PDF du cours, laisse vide.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre (optionnel)</Label>
                <Input
                  id="titre"
                  name="titre"
                  type="text"
                  placeholder="L'oligothérapie"
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (optionnel)</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  placeholder="354"
                  className="text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delaiJours">Délai d&apos;étude (jours)</Label>
              <Input
                id="delaiJours"
                name="delaiJours"
                type="number"
                min={1}
                max={365}
                defaultValue={30}
                required
                className="text-base"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-1 w-full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? ETAPES[etape] : "Lancer l'import"}
            </Button>

            {loading && (
              <>
                {/* Annonce l'étape en cours aux lecteurs d'écran (le libellé du
                    bouton change visuellement mais n'est pas annoncé seul). */}
                <p role="status" aria-live="polite" className="sr-only">
                  {ETAPES[etape]}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Ne ferme pas la page pendant le traitement.
                </p>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
