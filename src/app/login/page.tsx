"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Connexion refusée.");
      }
      const from = new URLSearchParams(window.location.search).get("from") || "/";
      window.location.href = from;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connexion refusée.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-9">
      <Card>
        <CardHeader>
          <CardTitle>NaturoFiche</CardTitle>
          <CardDescription>Accès protégé. Entre le mot de passe.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" autoFocus required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Entrer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
