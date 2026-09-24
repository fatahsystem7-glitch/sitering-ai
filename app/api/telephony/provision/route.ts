import { NextResponse } from "next/server";
import { provisionPhoneNumber, registerExistingNumber } from "@/app/actions/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let mode = "purchase";
  let phoneNumber = "";
  try {
    const body = (await request.json()) as { mode?: string; phoneNumber?: string };
    mode = body.mode === "register" ? "register" : "purchase";
    phoneNumber = body.phoneNumber ?? "";
  } catch {
    mode = "purchase";
  }
  const result = mode === "register" ? await registerExistingNumber(phoneNumber) : await provisionPhoneNumber();
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
