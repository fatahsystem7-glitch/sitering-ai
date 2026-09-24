import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { importBusinessFromUrl } from "@/lib/import-business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to import a website." }, { status: 401 });

  let url = "";
  try {
    const body = (await request.json()) as { url?: string };
    url = body.url?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "Add a website address first." }, { status: 400 });

  try {
    const profile = await importBusinessFromUrl(url);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
