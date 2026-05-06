import { NextRequest, NextResponse } from "next/server";
import { put, head, del } from "@vercel/blob";
import type { UserPrefs } from "@/lib/blob-prefs";

function blobKey(userId: string) {
  return `users/${userId}/preferences.json`;
}

/** GET /api/user/prefs?userId=UUID */
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId richiesto" }, { status: 400 });

  try {
    // Vercel Blob: check if file exists, then fetch it
    const key = blobKey(userId);
    const meta = await head(key).catch(() => null);

    if (!meta) {
      const empty: UserPrefs = { savedAsins: [], updatedAt: new Date().toISOString() };
      return NextResponse.json(empty);
    }

    const res  = await fetch(meta.url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** POST /api/user/prefs — body: { userId, prefs } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.userId || !body?.prefs) {
    return NextResponse.json({ error: "userId e prefs richiesti" }, { status: 400 });
  }

  const prefs: UserPrefs = { ...body.prefs, updatedAt: new Date().toISOString() };

  try {
    await put(blobKey(body.userId), JSON.stringify(prefs), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE /api/user/prefs?userId=UUID — removes all prefs */
export async function DELETE(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId richiesto" }, { status: 400 });

  try {
    await del(blobKey(userId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
