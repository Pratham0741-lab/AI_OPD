"""
Multilingual Yes/No/Unclear Intent Classifier

Classifies patient answers in any supported language, independent of the
language selected for the call question (e.g. English question, Hindi answer).
"""

import re
from typing import Tuple

from backend.constants import INTENT_KEYWORDS

# Romanized / spoken variants (Deepgram often returns these for Indic speech)
ROMANIZED_YES = {
    "en": ["yes", "yeah", "yep", "yup", "yah", "yea", "ok", "okay", "sure", "done", "taken", "i did", "i have", "i took"],
    "hi": ["haan", "haa", "han", "hn", "ji", "jee", "haanji", "bilkul", "le liya", "le li", "kha liya", "khaya", "liya", "khai", "kar liya"],
    "kn": ["haudu", "howdu", "agide", "hoo", "houdu"],
    "mr": ["ho", "hoye", "ghetale", "gheli", "hoy"],
    "ta": ["aam", "aama", "amam", "eduthen", "saptiten"],
    "te": ["avunu", "avunandi", "veskunna"],
    "bn": ["hyaa", "haan", "niyechi", "kheyechi"],
    "ml": ["athe", "kazhichu", "eduthu"],
    "gu": ["haa", "lidhi", "khadhi"],
    "pa": ["haanji", "lai", "kha lai"],
}

ROMANIZED_NO = {
    "en": ["no", "nope", "nah", "nay", "not", "not yet", "haven't", "didn't", "forgot", "missed", "skip"],
    "hi": ["nahi", "nahin", "nai", "nahee", "nahi liya", "nahi khaya", "nahi li", "bhool gaya", "bhul gaya"],
    "kn": ["illa", "illla", "beda", "agilla", "illa beda"],
    "mr": ["nahi", "nako", "nay", "ghetale nahi", "nahie"],
    "ta": ["illai", "illa", "podala", "edukala"],
    "te": ["ledu", "kaadu", "vesukoledu"],
    "bn": ["na", "niini", "khaini", "nah"],
    "ml": ["illa", "kazhichilla"],
    "gu": ["na", "nathi", "lidhi nathi"],
    "pa": ["nahi", "nai lyi"],
}

# Deepgram mis-hearings for short Hindi/Kannada yes/no clips
GARBLED_YES = ["lily", "lady", "lee", "holly", "honey", "done"]
GARBLED_NO = ["gracias", "gracia", "nazi", "nasi", "naomi", "money", "navy"]

YES_KEYWORDS: list[str] = [
    "yes", "yeah", "yep", "yup", "sure", "of course", "definitely",
    "i did", "i have", "taken", "done", "ok", "okay",
    "हाँ", "हां", "हा", "जी", "जी हाँ", "बिल्कुल", "ले लिया",
    "ले ली", "खा लिया", "खा ली", "कर लिया",
    "हो", "होय", "हाय", "घेतली", "घेतला", "केलं", "केली",
    "ಹೌದು", "ಹಾ", "ಆದರೆ", "ತೆಗೆದುಕೊಂಡೆ", "ಮಾಡಿದೆ",
    "ஆமா", "ஆம்", "எடுத்தேன்", "சாப்பிட்டேன்",
    "అవును", "ఔను", "తీసుకున్నాను", "చేశాను",
    "হ্যাঁ", "হ্যা", "জি", "খেয়েছি", "নিয়েছি", "करেছি",
]

NO_KEYWORDS: list[str] = [
    "no", "nope", "nah", "not yet", "haven't", "didn't", "i forgot",
    "forgot", "not done", "skip", "missed",
    "नहीं", "ना", "नही", "नईं", "भूल गया", "भूल गयी",
    "नहीं लिया", "नहीं खाया", "नहीं किया",
    "नाही", "नको", "विसरलो", "विसरले", "नाही घेतली", "नाही केलं",
    "ಇಲ್ಲ", "ಬೇಡ", "ಮರೆತೆ", "ತೆಗೆದುಕೊಂಡಿಲ್ಲ",
    "இல்லை", "வேண்டாம்", "மறந்துவிட்டேன்",
    "లేదు", "వద్దు", "మర్చిపోయాను",
    "না", "নাহ", "ভুলে গেছি", "খাইনি", "করিনি",
]


def _keyword_matches(text: str, text_lower: str, kw: str) -> bool:
    haystack = text_lower if kw.isascii() else text
    needle = kw.lower() if kw.isascii() else kw
    if not needle:
        return False
    # Avoid "na" matching inside "nahi", etc.
    if needle.isascii() and len(needle) <= 3:
        return re.search(r"(?<!\w)" + re.escape(needle) + r"(?!\w)", haystack) is not None
    return needle in haystack or kw in text


def _score_keywords(text: str, text_lower: str, keywords: list[str]) -> int:
    score = 0
    for kw in keywords:
        if _keyword_matches(text, text_lower, kw):
            score += len(kw)
    return score


def _score_intent_keywords(text: str, text_lower: str) -> Tuple[str, int, str]:
    """Score against per-language INTENT_KEYWORDS; return best intent, score, lang."""
    best_intent = "Unclear"
    best_score = 0
    best_lang = "en"

    for lang_code, kw_map in INTENT_KEYWORDS.items():
        for intent_type, key in [("Yes", "yes"), ("No", "no")]:
            score = _score_keywords(text, text_lower, kw_map.get(key, []))
            if score > best_score:
                best_score = score
                best_intent = intent_type
                best_lang = lang_code

    return best_intent, best_score, best_lang


def _score_romanized(text_lower: str) -> Tuple[str, int, str]:
    best_intent = "Unclear"
    best_score = 0
    best_lang = "en"

    for lang_code, phrases in ROMANIZED_NO.items():
        for phrase in phrases:
            if phrase in text_lower:
                score = len(phrase) + 10  # prefer longer phrase matches
                if score > best_score:
                    best_score = score
                    best_intent = "No"
                    best_lang = lang_code

    for lang_code, phrases in ROMANIZED_YES.items():
        for phrase in phrases:
            if phrase in text_lower:
                score = len(phrase) + 10
                if score > best_score:
                    best_score = score
                    best_intent = "Yes"
                    best_lang = lang_code

    words = text_lower.split()
    for lang_code, phrases in ROMANIZED_NO.items():
        for w in words:
            if w in phrases:
                if 8 > best_score:
                    best_score = 8
                    best_intent = "No"
                    best_lang = lang_code
    for lang_code, phrases in ROMANIZED_YES.items():
        for w in words:
            if w in phrases:
                if 8 > best_score:
                    best_score = 8
                    best_intent = "Yes"
                    best_lang = lang_code

    return best_intent, best_score, best_lang


def classify_intent(transcript: str) -> Tuple[str, float]:
    """
    Classify a transcribed utterance as Yes / No / Unclear.
    Returns (intent, confidence).
    """
    if not transcript or not transcript.strip():
        return ("Unclear", 0.0)

    text = transcript.strip()
    text_lower = text.lower()

    yes_score = _score_keywords(text, text_lower, YES_KEYWORDS)
    no_score = _score_keywords(text, text_lower, NO_KEYWORDS)

    total = yes_score + no_score
    if total == 0:
        return ("Unclear", 0.3)

    if yes_score > no_score:
        return ("Yes", round(min(yes_score / max(total, 1), 1.0), 2))
    if no_score > yes_score:
        return ("No", round(min(no_score / max(total, 1), 1.0), 2))
    return ("Unclear", 0.5)


def classify_call_response(transcript: str, stt_confidence: float = 0.0) -> Tuple[str, float, str]:
    """
    Classify a phone-call answer in ANY language, regardless of UI-selected lang.

    Returns:
        (intent, confidence, detected_language)
        intent ∈ {"Yes", "No", "Unclear"}
    """
    if not transcript or not transcript.strip():
        return ("Unclear", 0.0, "en")

    text = transcript.strip()
    text_lower = text.lower()
    # Normalize common STT punctuation
    text_lower = re.sub(r"[^\w\s\u0900-\u097F\u0C80-\u0CFF\u0B80-\u0BFF\u0C00-\u0C7F\u0980-\u09FF]", " ", text_lower)
    text_lower = re.sub(r"\s+", " ", text_lower).strip()

    candidates: list[Tuple[str, float, str]] = []

    # Native-script + per-language keywords (highest priority)
    ik_intent, ik_score, ik_lang = _score_intent_keywords(text, text_lower)
    if ik_intent != "Unclear" and ik_score > 0:
        candidates.append((ik_intent, min(0.5 + ik_score / 20.0, 1.0), ik_lang))

    # Romanized spoken answers (Hindi/Kannada/etc. even when question was English)
    rom_intent, rom_score, rom_lang = _score_romanized(text_lower)
    if rom_intent != "Unclear" and rom_score > 0:
        candidates.append((rom_intent, min(0.6 + rom_score / 20.0, 1.0), rom_lang))

    intent, conf = classify_intent(text)
    if intent != "Unclear":
        candidates.append((intent, conf, "en"))

    # Short-utterance phonetic patterns (≤4 words)
    if len(text_lower.split()) <= 4:
        no_sounds = ["na", "naa", "nah", "nahi", "nahin", "nai", "no", "nope", "illa", "beda", "illai"]
        yes_sounds = ["ha", "haa", "haan", "han", "ji", "yes", "yep", "yeah", "ho", "haudu", "houdu"]
        for p in no_sounds:
            if p in text_lower:
                candidates.append(("No", 0.7, "hi"))
                break
        for p in yes_sounds:
            if p in text_lower:
                candidates.append(("Yes", 0.7, "hi"))
                break

    # Garbled STT recovery for very short clips
    if stt_confidence < 0.8 and len(text_lower.split()) <= 3:
        for g in GARBLED_NO:
            if g in text_lower:
                candidates.append(("No", 0.55, "hi"))
                break
        for g in GARBLED_YES:
            if g in text_lower:
                candidates.append(("Yes", 0.55, "hi"))
                break

    if not candidates:
        return ("Unclear", 0.3, "en")

    # Pick highest-confidence candidate; prefer non-English lang when scores tie
    candidates.sort(key=lambda c: (c[1], c[2] != "en"), reverse=True)
    best = candidates[0]

    # If INTENT_KEYWORDS found a specific language, use that over generic "en"
    for c in candidates:
        if c[0] == best[0] and c[2] != "en" and c[1] >= best[1] * 0.8:
            best = c
            break

    return (best[0], best[1], best[2])
