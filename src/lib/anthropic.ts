import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { prisma } from "@/lib/prisma";

// Modèles configurables via .env (cf. cahier des charges §8).
// Ingestion = jugement nuancé → Opus ; vérification = contre-regard ;
// Q&A en direct = modèle léger.
export const MODELS = {
  ingest: process.env.INGEST_MODEL ?? "claude-opus-5-5",
  verify: process.env.VERIFY_MODEL ?? "claude-sonnet-5-5",
  qa: process.env.QA_MODEL ?? "claude-haiku-5-5",
} as const;

// Effort de réflexion par phase. Les modèles 5.5 réfléchissent toujours (Opus) ou par
// défaut (Sonnet, Haiku) ; l'effort règle combien. Défauts de l'API : medium sur Opus et
// Haiku, high sur Sonnet. Q&A en direct : low, pour la latence.
export const EFFORT: Record<ApiPhase, NonNullable<Anthropic.Messages.OutputConfig["effort"]>> = {
  ingestion: "medium",
  verification: "high",
  qa: "low",
};

// La réflexion compte dans max_tokens : marge ajoutée au budget de la réponse,
// sinon elle peut couper le JSON en route.
const MARGE_REFLEXION = 32_000;

let client: Anthropic | null = null;

/**
 * Client Anthropic (lazy) — la clé reste STRICTEMENT côté serveur.
 * Branché au pipeline d'ingestion en M2 ([src/lib/ingest]).
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

// Phases journalisées dans ApiUsageLog (cf. schéma Prisma).
export type ApiPhase = "ingestion" | "verification" | "qa";

interface StructuredCall {
  phase: ApiPhase;
  courseId?: string | null;
  model: string;
  system: string;
  prompt: string;
  /** Identifie l'appel dans les messages d'erreur. */
  nom: string;
  /** JSON Schema de la réponse (objet `{ type: "object", properties, required }`). */
  schema: Record<string, unknown>;
  /** Budget de la réponse elle-même ; la marge de réflexion s'y ajoute. */
  maxTokens?: number;
}

/**
 * Appel Claude à **sortie structurée garantie** (`output_config.format`) : la réponse
 * suit le JSON Schema donné, on la lit sans parsing fragile. Remplace l'outil imposé
 * (`tool_choice`), que refusent Opus 5.5 et Sonnet 5.5 (erreur 400). Chaque appel est
 * journalisé dans `ApiUsageLog` (phase, modèle, tokens) pour le suivi de coût.
 */
export async function runStructured<T>({
  phase,
  courseId = null,
  model,
  system,
  prompt,
  nom,
  schema,
  maxTokens = 8000,
}: StructuredCall): Promise<T> {
  const anthropic = getAnthropic();

  // Le SDK retire du schéma ce que la sortie structurée ne prend pas (minimum, maximum…)
  // et le reporte dans la description.
  const { schema: schemaStrict } = jsonSchemaOutputFormat(
    schema as Parameters<typeof jsonSchemaOutputFormat>[0],
  );

  // En flux : au-delà d'environ 21 000 jetons, le SDK refuse un appel sans flux.
  const res = await anthropic.messages
    .stream({
      model,
      max_tokens: maxTokens + MARGE_REFLEXION,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: {
        effort: EFFORT[phase],
        format: { type: "json_schema", schema: schemaStrict },
      },
    })
    .finalMessage();

  // Journalisation best-effort : un échec de log ne doit pas casser l'ingestion.
  await logUsage(courseId, phase, model, res.usage);

  // Refus de sécurité (`refusal`) ou réponse coupée (`max_tokens`) : JSON absent ou incomplet.
  const texte = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  if (res.stop_reason !== "end_turn" || !texte) {
    throw new Error(
      `runStructured(${nom}) : aucune sortie structurée complète (stop_reason=${res.stop_reason}).`,
    );
  }
  return JSON.parse(texte) as T;
}

export async function logUsage(
  courseId: string | null,
  phase: ApiPhase,
  model: string,
  usage: Anthropic.Messages.Usage,
): Promise<void> {
  try {
    await prisma.apiUsageLog.create({
      data: {
        courseId,
        phase,
        model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      },
    });
  } catch (e) {
    console.error("[apiUsageLog] échec journalisation :", e);
  }
}
