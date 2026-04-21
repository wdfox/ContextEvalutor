import { NextResponse } from "next/server";
import { listCodexSessions } from "@/lib/codex-importer";

export async function GET() {
  try {
    const sessions = await listCodexSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown importer error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
