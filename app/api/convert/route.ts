import { NextResponse } from "next/server";
import { convertLink } from "@/lib/convert";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const url = typeof body === "object" && body && "url" in body ? (body as { url: unknown }).url : null;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Saknar länk" }, { status: 400 });
  }
  try {
    const result = await convertLink(url);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
