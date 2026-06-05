import Anthropic from "@anthropic-ai/sdk";

// Modèles configurables via .env (cf. cahier des charges §8).
// Ingestion = jugement nuancé → Opus ; vérification = contre-regard ;
// Q&A en direct = modèle léger.
export const MODELS = {
  ingest: process.env.INGEST_MODEL ?? "claude-opus-4-8",
  verify: process.env.VERIFY_MODEL ?? "claude-sonnet-4-6",
  qa: process.env.QA_MODEL ?? "claude-haiku-4-5-20251001",
} as const;

let client: Anthropic | null = null;

/**
 * Client Anthropic (lazy) — la clé reste STRICTEMENT côté serveur.
 * Non utilisé en M1 ; branché au pipeline d'ingestion en M2.
 */
export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY manquant côté serveur (.env).");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
