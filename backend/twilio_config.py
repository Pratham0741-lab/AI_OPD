"""
Twilio Configuration

Loads Twilio credentials from environment variables.
Required for phone-based health-check calls.
"""

import os
import logging

logger = logging.getLogger("twilio-config")

# Try loading from .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
except ImportError:
    pass


def get_twilio_config():
    """
    Get Twilio configuration from environment variables.
    Returns a dict with credentials, or None if not configured.
    """
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    phone_number = os.environ.get("TWILIO_PHONE_NUMBER", "").strip()
    webhook_base_url = os.environ.get("TWILIO_WEBHOOK_BASE_URL", "").strip()

    if not all([account_sid, auth_token, phone_number, webhook_base_url]):
        return None

    return {
        "account_sid": account_sid,
        "auth_token": auth_token,
        "phone_number": phone_number,
        "webhook_base_url": webhook_base_url.rstrip("/"),
    }


def is_twilio_configured():
    """Check if all required Twilio environment variables are set."""
    return get_twilio_config() is not None


def validate_twilio_connection(timeout: float = 8.0) -> tuple[bool, str]:
    """
    Test the Twilio connection by fetching account info.
    Returns (success: bool, message: str).
    """
    config = get_twilio_config()
    if not config:
        return False, "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL in .env"

    try:
        import httpx
        url = f"https://api.twilio.com/2010-04-01/Accounts/{config['account_sid']}.json"
        resp = httpx.get(
            url,
            auth=(config["account_sid"], config["auth_token"]),
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        name = data.get("friendly_name", "Twilio account")
        status = data.get("status", "unknown")
        return True, f"Connected to Twilio account: {name} (Status: {status})"
    except Exception as e:
        err = str(e)
        if "timed out" in err.lower() or "timeout" in err.lower():
            return False, (
                "Cannot reach api.twilio.com (connection timed out). "
                "Check your internet, firewall, or VPN, then try again."
            )
        return False, f"Twilio connection failed: {err}"


def get_sarvam_config():
    """
    Get Sarvam AI TTS configuration from environment variables.
    Returns a dict with API key and settings, or None if not configured.
    """
    api_key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not api_key or api_key.startswith("your_"):
        return None

    return {
        "api_key": api_key,
        "speaker": os.environ.get("SARVAM_TTS_SPEAKER", "simran").strip(),
        "model": os.environ.get("SARVAM_TTS_MODEL", "bulbul:v3").strip(),
    }


def is_sarvam_configured():
    """Check if Sarvam AI API key is set."""
    return get_sarvam_config() is not None


def get_deepgram_config():
    """
    Get Deepgram STT configuration from environment variables.
    Returns a dict with API key, or None if not configured.
    """
    api_key = os.environ.get("DEEPGRAM_API_KEY", "").strip()
    if not api_key or api_key.startswith("your_"):
        return None

    return {
        "api_key": api_key,
    }


def is_deepgram_configured():
    """Check if Deepgram API key is set."""
    return get_deepgram_config() is not None


def check_ngrok_local(timeout: float = 2.0) -> tuple[bool, str]:
    """
    Fast check: is ngrok running locally and does its URL match TWILIO_WEBHOOK_BASE_URL?
    Uses ngrok's local API (127.0.0.1:4040) — no slow public round-trip.
    """
    config = get_twilio_config()
    if not config:
        return False, "Twilio not configured"

    expected = config["webhook_base_url"].rstrip("/")
    try:
        import httpx
        resp = httpx.get("http://127.0.0.1:4040/api/tunnels", timeout=timeout)
        resp.raise_for_status()
        tunnels = resp.json().get("tunnels", [])
        https_urls = [
            t["public_url"].rstrip("/")
            for t in tunnels
            if t.get("proto") == "https" and t.get("public_url")
        ]
        if not https_urls:
            return False, "ngrok is not running. Start it: ngrok http 8000"
        if expected in https_urls:
            return True, f"ngrok tunnel active: {expected}"
        return False, (
            f"ngrok URL mismatch. Running: {https_urls[0]} — "
            f"but .env has TWILIO_WEBHOOK_BASE_URL={expected}. Update .env to match."
        )
    except Exception:
        return False, (
            f"ngrok not detected on port 4040. Run: ngrok http 8000 — "
            f"then set TWILIO_WEBHOOK_BASE_URL={expected} in .env"
        )


def check_webhook_reachable(timeout: float = 2.0) -> tuple[bool, str]:
    """
    Verify Twilio can reach the webhook (ngrok → local server).
    Prefers fast local ngrok check; optional public URL probe as fallback.
    """
    ok, msg = check_ngrok_local(timeout=timeout)
    if ok:
        return ok, msg

    config = get_twilio_config()
    if not config:
        return False, "Twilio not configured"

    base = config["webhook_base_url"]
    try:
        import httpx
        resp = httpx.get(
            f"{base}/api/va/health",
            timeout=timeout,
            headers={"ngrok-skip-browser-warning": "true"},
            follow_redirects=True,
        )
        if resp.status_code == 200 and resp.json().get("status") == "ok":
            return True, f"Webhook URL reachable: {base}"
        return False, msg
    except Exception:
        return False, msg
