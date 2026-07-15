import { NextResponse } from "next/server";
import { z } from "zod";
import { chat, isAiConfigured } from "@/domains/ai/provider";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  cityName: z.string().min(1).max(80),
  topic: z.enum(["callejero", "reglamento"]),
  streetNames: z.array(z.string().max(120)).max(150).default([]),
  placeNames: z.array(z.string().max(120)).max(100).default([]),
  count: z.number().int().min(1).max(20).default(10),
});

/**
 * Generates extra multiple-choice questions with the LLM (regulations quiz,
 * or tricky street questions beyond the geometric generators). Used from the
 * admin panel to extend the question bank.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:/api/ai/generate-questions`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: "IA no configurada" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }
  const { cityName, topic, streetNames, placeNames, count } = parsed.data;

  const material =
    topic === "callejero"
      ? `Calles reales: ${streetNames.join(", ")}\nLugares reales: ${placeNames.join(", ")}`
      : "Temario: reglamento general del servicio de taxi en España (tarifas, paradas, obligaciones del conductor, derechos del pasajero, documentación, descansos).";

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content: `Generas preguntas tipo test para el examen de taxista de ${cityName}. Devuelve SOLO JSON válido con esta forma: {"questions": [{"prompt": "...", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "..."}]}. Usa únicamente el material proporcionado; no inventes calles.`,
        },
        {
          role: "user",
          content: `${material}\n\nGenera ${count} preguntas variadas de dificultad media.`,
        },
      ],
      { json: true, maxTokens: 2500 },
    );
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    logger.error("AI generate-questions failed", { route: "/api/ai/generate-questions", error: String(err) });
    return NextResponse.json({ error: "No se pudieron generar preguntas" }, { status: 502 });
  }
}
