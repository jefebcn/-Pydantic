import os
from dataclasses import dataclass

@dataclass
class Config:
    # Models
    HAIKU_MODEL: str = "claude-haiku-4-5-20251001"
    OPUS_MODEL:  str = "claude-opus-4-7"
    # Gemini image-output models (verified via models.list on 2026-05-22):
    #   gemini-2.5-flash-image      → Nano Banana stable (default)
    #   gemini-3.1-flash-image-preview → newer Flash image, in preview
    #   gemini-3-pro-image-preview  → Nano Banana Pro, slower/higher quality
    # Override via env if you want to A/B test.
    NB2_MODEL:   str = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
    NB_PRO_MODEL: str = os.environ.get("GEMINI_PRO_IMAGE_MODEL", "gemini-3-pro-image-preview")
    GPT_IMG_MODEL: str = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")

    # QC thresholds
    QC_PASS_THRESHOLD:    int = 90
    QC_RETRY_THRESHOLD:   int = 75
    QC_OPUS_THRESHOLD:    int = 65
    MAX_RETRIES:          int = 3

    # Image settings
    OUTPUT_SIZE:      tuple = (2000, 2000)
    MAX_REF_IMAGES:   int = 4

    # Pipeline target
    TARGET_DURATION_S: int = 90

cfg = Config()
