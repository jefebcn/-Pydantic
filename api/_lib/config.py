import os
from dataclasses import dataclass

@dataclass
class Config:
    # Models
    HAIKU_MODEL: str = "claude-haiku-4-5-20251001"
    OPUS_MODEL:  str = "claude-opus-4-7"
    NB2_MODEL:   str = "gemini-2.5-flash"          # Nano Banana 2
    NB_PRO_MODEL: str = "gemini-3-pro-image-preview"  # Nano Banana Pro
    GPT_IMG_MODEL: str = "gpt-image-2-2026-04-21"

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
