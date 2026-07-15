import { NextResponse } from "next/server";
import { isAiConfigured } from "@/domains/ai/provider";

export function GET() {
  return NextResponse.json({ available: isAiConfigured() });
}
