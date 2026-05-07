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


def validate_twilio_connection():
    """
    Test the Twilio connection by fetching account info.
    Returns (success: bool, message: str).
    """
    config = get_twilio_config()
    if not config:
        return False, "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL in .env"

    try:
        from twilio.rest import Client
        client = Client(config["account_sid"], config["auth_token"])
        account = client.api.accounts(config["account_sid"]).fetch()
        return True, f"Connected to Twilio account: {account.friendly_name} (Status: {account.status})"
    except ImportError:
        return False, "twilio package not installed. Run: pip install twilio"
    except Exception as e:
        return False, f"Twilio connection failed: {str(e)}"
