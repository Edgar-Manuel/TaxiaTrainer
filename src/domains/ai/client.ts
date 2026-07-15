"use client";

import { useQuery } from "@tanstack/react-query";

export function useAiAvailable() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai/status");
      const data = (await res.json()) as { available: boolean };
      return data.available;
    },
    staleTime: Infinity,
    retry: false,
  });
}

export interface ExaminerMessage {
  role: "user" | "assistant";
  content: string;
}

export async function askExaminer(input: {
  cityName: string;
  context: string;
  messages: ExaminerMessage[];
}): Promise<string> {
  const res = await fetch("/api/ai/examiner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de IA");
  return data.reply as string;
}

export async function askExplanation(input: {
  cityName: string;
  questionPrompt: string;
  questionType: string;
  correctAnswer: string;
  userAnswer: string;
  extra?: string;
}): Promise<string> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error de IA");
  return data.explanation as string;
}
