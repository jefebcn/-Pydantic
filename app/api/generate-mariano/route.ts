import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const asin = (body.asin ?? "").trim().toUpperCase();

    if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
      return NextResponse.json({ error: "ASIN non valido (deve essere 10 caratteri alfanumerici)" }, { status: 400 });
    }

    // Forward to Python serverless function
    const pythonUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/generate-mariano.py`
      : "http://localhost:3000/api/generate-mariano.py";

    // In development or when Python isn't available, call the Vercel rewrite target
    const targetUrl = process.env.NODE_ENV === "production"
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/generate-mariano`
      : pythonUrl;

    // Direct Python call for server-side (Vercel routes /api/*.py automatically)
    // For local dev without Python, return a mock structure
    if (process.env.ANTHROPIC_API_KEY && process.env.RAINFOREST_API_KEY) {
      const { spawn } = await import("child_process");
      const { promisify } = await import("util");

      return new Promise<NextResponse>((resolve) => {
        const py = spawn("python3", ["-c", `
import sys, json, asyncio, os
sys.path.insert(0, '${process.cwd()}/api')
from generate_mariano import _run
result = asyncio.run(_run('${asin}'))
print(json.dumps(result, ensure_ascii=False))
`], { env: { ...process.env } });

        let stdout = "";
        let stderr = "";
        py.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        py.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        py.on("close", (code: number) => {
          if (code !== 0) {
            resolve(NextResponse.json({ error: stderr || "Pipeline error" }, { status: 500 }));
          } else {
            try {
              const result = JSON.parse(stdout.trim());
              resolve(NextResponse.json(result));
            } catch {
              resolve(NextResponse.json({ error: "Parse error", raw: stdout.slice(0, 500) }, { status: 500 }));
            }
          }
        });
      });
    }

    // Fallback: return error asking for API keys
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY e RAINFOREST_API_KEY richiesti per la generazione" },
      { status: 503 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
