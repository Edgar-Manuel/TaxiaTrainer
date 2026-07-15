import { NextResponse } from "next/server";
import { z } from "zod";
import { chat, isAiConfigured } from "@/domains/ai/provider";

const bodySchema = z.object({
  cityName: z.string().min(1).max(80),
  questionPrompt: z.string().max(500),
  questionType: z.string().max(50),
  correctAnswer: z.string().max(500),
  userAnswer: z.string().max(500),
  extra: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "IA no configurada" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }
  const { cityName, questionPrompt, questionType, correctAnswer, userAnswer, extra } =
    parsed.data;

  try {
    const reply = await chat(
      [
        {
          role: "system",
          content: `Eres un profesor del callejero de ${cityName} que prepara a futuros taxistas. Explica errores en 2-3 frases, con trucos mnemotécnicos cuando ayuden. Español, tono cercano.`,
        },
        {
          role: "user",
          content: `Pregunta (${questionType}): ${questionPrompt}\nRespuesta correcta: ${correctAnswer}\nMi respuesta: ${userAnswer}\n${extra ?? ""}\n¿Por qué me he equivocado y cómo lo recuerdo la próxima vez?`,
        },
      ],
      { maxTokens: 250 },
    );
    return NextResponse.json({ explanation: reply });
  } catch (err) {
    console.error("AI explain error:", err);
    return NextResponse.json({ error: "El proveedor de IA no respondió" }, { status: 502 });
  }
}
