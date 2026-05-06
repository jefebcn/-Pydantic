export interface Job {
  id: string;
  asin: string;
  status: "queued" | "scraping" | "mvd" | "generating" | "qc" | "compositing" | "done" | "error";
  progress: number;
  current_step: string;
  slide_urls: string[];
  qc_scores: Record<string, QCScore>;
  error_message: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface QCScore {
  scores: {
    shape: number;
    color: number;
    material: number;
    branding: number;
    detail: number;
  };
  avg: number;
  artifacts: string[];
  pass: boolean;
  reason: string;
}

export interface Product {
  asin: string;
  title: string;
  pts_json: Record<string, unknown>;
  mvd_text: string;
  ref_image_urls: string[];
  created_at: string;
  updated_at: string;
}
