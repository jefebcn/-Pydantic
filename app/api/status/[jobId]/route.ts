import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/status?job_id=${jobId}`
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
