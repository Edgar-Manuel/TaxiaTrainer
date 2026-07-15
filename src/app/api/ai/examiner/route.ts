import { NextResponse } from "next/server";
import { z } from "zod";
import { chat, isAiConfigured, type ChatMessage } from "@/domains/ai/provider";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  cityName: z.string().min(1).max(80),
  context: z.string().max(8000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(30),
});

const SYSTEM_PROMPT = (cityName: string, context: string) => `
Eres un examinador oficial del permiso municipal de taxista de ${cityName}, España.
Tu papel:
1. Propones rutas ("Lléveme desde X hasta Y") y evalúas la respuesta del aspirante.
2. Cuando el aspirante describe un recorrido, compáralo con la ruta óptima que se te
   proporciona en el contexto. Señala errores concretos (calles inexistentes, sentidos
   prohibidos, rodeos) y explica la alternativa correcta calle a calle.
3. Respondes dudas sobre el reglamento del taxi (tarifas, paradas, obligaciones,
   derechos del pasajero) de forma general y práctica; si algo depende de la
   ordenanza local exacta, dilo.
4. Hablas en español, con frases cortas y claras (tus respuestas pueden leerse en voz alta).
5. Sé exigente pero motivador, como un buen profesor de autoescuela.
6. Puntúa cada respuesta de ruta de 0 a 10 y termina con "Puntuación: N/10".

CONTEXTO DE LA CIUDAD (calles y lugares reales, y la ruta óptima del ejercicio actual):
${context}
`.trim();

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:/api/ai/examiner`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "IA no configurada. Añade AI_API_KEY en el servidor." },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }
  const { cityName, context, messages } = parsed.data;

  try {
    const reply = await chat([
      { role: "system", content: SYSTEM_PROMPT(cityName, context) },
      ...(messages as ChatMessage[]),
    ]);
    return NextResponse.json({ reply });
  } catch (err) {
    logger.error("AI examiner failed", { route: "/api/ai/examiner", error: String(err) });
    return NextResponse.json(
      { error: "El proveedor de IA no respondió" },
      { status: 502 },
    );
  }
}
