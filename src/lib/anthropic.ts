import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

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
  toolName: string;
  toolDescription?: string;
  /** JSON Schema de l'outil (objet `{ type: "object", properties, required }`). */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Appel Claude à **sortie structurée garantie** : on déclare un unique outil et on
 * force son usage (`tool_choice`). On récupère l'`input` validé du bloc `tool_use`
 * plutôt que du texte libre à parser. Chaque appel est journalisé dans `ApiUsageLog`
 * (phase, modèle, tokens) pour le suivi de coût.
 */
export async function runStructured<T>({
  phase,
  courseId = null,
  model,
  system,
  prompt,
  toolName,
  toolDescription,
  schema,
  maxTokens = 8000,
}: StructuredCall): Promise<T> {
  const anthropic = getAnthropic();

  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: schema as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  // Journalisation best-effort : un échec de log ne doit pas casser l'ingestion.
  await logUsage(courseId, phase, model, res.usage);

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(
      `runStructured(${toolName}) : aucune sortie structurée (stop_reason=${res.stop_reason}).`,
    );
  }
  return block.input as T;
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
