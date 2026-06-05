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
    const examen = data.get("examenPdf") as File | null;
    if (!cours || cours.size === 0 || !examen || examen.size === 0) {
      toast.error("Dépose le PDF du cours ET celui de l'examen.");
      return;
    }

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
        `Cours importé : ${json.sections} sections, ${json.questions} questions d'examen.`,
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Accueil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Importer un cours</h1>
        <p className="text-sm text-muted-foreground">
          Dépose le PDF du cours et celui de l&apos;examen, puis choisis le délai.
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
              <Label htmlFor="examenPdf">PDF de l&apos;examen</Label>
              <Input id="examenPdf" name="examenPdf" type="file" accept="application/pdf,.pdf" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre (optionnel)</Label>
                <Input id="titre" name="titre" type="text" placeholder="L'oligothérapie" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code (optionnel)</Label>
                <Input id="code" name="code" type="text" placeholder="354" />
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
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? ETAPES[etape] : "Lancer l'import"}
            </Button>

            {loading && (
              <p className="text-center text-xs text-muted-foreground">
                Ne ferme pas la page pendant le traitement.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
