"""
Multilingual Yes/No/Unclear Intent Classifier

A lightweight keyword-based classifier that maps transcribed Indic-language
text to a boolean intent: "Yes", "No", or "Unclear".

Covers: Hindi, Marathi, Kannada, Tamil, Telugu, Bengali, and English.
"""

import re
from typing import Tuple

# ──────────────────────────────────────────────────────────────
# Keyword dictionaries (lowercase / native script)
# ──────────────────────────────────────────────────────────────

YES_KEYWORDS: list[str] = [
    # English
    "yes", "yeah", "yep", "yup", "sure", "of course", "definitely",
    "i did", "i have", "taken", "done", "ok", "okay",
    # Hindi
    "हाँ", "हां", "हा", "जी", "जी हाँ", "बिल्कुल", "ले लिया",
    "ले ली", "खा लिया", "खा ली", "कर लिया",
    # Marathi
    "हो", "होय", "हाय", "घेतली", "घेतला", "केलं", "केली",
    # Kannada
    "ಹೌದು", "ಹಾ", "ಆದರೆ", "ತೆಗೆದುಕೊಂಡೆ", "ಮಾಡಿದೆ",
    # Tamil
    "ஆமா", "ஆம்", "எடுத்தேன்", "சாப்பிட்டேன்",
    # Telugu
    "అవును", "ఔను", "తీసుకున్నాను", "చేశాను",
    # Bengali
    "হ্যাঁ", "হ্যা", "জি", "খেয়েছি", "নিয়েছি", "করেছি",
]

NO_KEYWORDS: list[str] = [
    # English
    "no", "nope", "nah", "not yet", "haven't", "didn't", "i forgot",
    "forgot", "not done", "skip", "missed",
    # Hindi
    "नहीं", "ना", "नही", "नईं", "भूल गया", "भूल गयी",
    "नहीं लिया", "नहीं खाया", "नहीं किया",
    # Marathi
    "नाही", "नको", "विसरलो", "विसरले", "नाही घेतली", "नाही केलं",
    # Kannada
    "ಇಲ್ಲ", "ಬೇಡ", "ಮರೆತೆ", "ತೆಗೆದುಕೊಂಡಿಲ್ಲ",
    # Tamil
    "இல்லை", "வேண்டாம்", "மறந்துவிட்டேன்",
    # Telugu
    "లేదు", "వద్దు", "మర్చిపోయాను",
    # Bengali
    "না", "নাহ", "ভুলে গেছি", "খাইনি", "করিনি",
]


def classify_intent(transcript: str) -> Tuple[str, float]:
    """
    Classify a transcribed utterance as Yes / No / Unclear.

    Returns:
        (intent, confidence)  where intent ∈ {"Yes", "No", "Unclear"}
        and confidence ∈ [0.0, 1.0].
    """
    if not transcript or not transcript.strip():
        return ("Unclear", 0.0)

    text = transcript.strip().lower()

    yes_score = 0
    no_score = 0

    # ── Score against keyword lists ──────────────────────────
    for kw in YES_KEYWORDS:
        if kw in text:
            # Longer keyword matches get a higher weight
            yes_score += len(kw)

    for kw in NO_KEYWORDS:
        if kw in text:
            no_score += len(kw)

    # ── Decision logic ───────────────────────────────────────
    total = yes_score + no_score

    if total == 0:
        return ("Unclear", 0.3)

    if yes_score > no_score:
        confidence = round(min(yes_score / max(total, 1), 1.0), 2)
        return ("Yes", confidence)

    if no_score > yes_score:
        confidence = round(min(no_score / max(total, 1), 1.0), 2)
        return ("No", confidence)

    # Tie → unclear
    return ("Unclear", 0.5)
