"""
Shared model state container.

The GPU models (IndicConformer, Whisper) are loaded once at startup in main.py
and stored here so that other modules (e.g., twilio_calls.py) can access them
without circular imports.
"""

# GPU-loaded model references — set by main.py on_event("startup")
model = None
device = None
whisper_processor = None
whisper_model = None
