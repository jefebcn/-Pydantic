import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns: { users: [{ id, email, display_name, created_at, last_sign_in_at,
 *                       run_count, total_spend }] }
 *
 * Note: Mariano runs aren't currently linked to user_id (there's no user_id
 * column in mariano_runs). We expose the user list + global run counts
 * separately. If/when we add user_id to mariano_runs the per-user counts
 * here become accurate per user instead of zero.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;
  const { supabase } = gate;

  let registered: Array<{
    id: string;
    email: string | null;
    display_name: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    run_count: number;
    total_spend: number;
  }> = [];

  try {
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    registered = users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      display_name: (u.user_metadata?.display_name as string | undefined) ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      run_count: 0,
      total_spend: 0,
    }));
  } catch (e) {
    return NextResponse.json({ error: `Listing utenti fallito: ${String(e)}` }, { status: 500 });
  }

  // Best-effort: if a future migration adds user_id to mariano_runs we'll join
  // here. For now per-user counts stay at 0 — see the table at the bottom of
  // the admin page for the global stats.
  return NextResponse.json({ users: registered });
}
