"""Secure access tokens for guest trip preferences."""

import hashlib
import hmac
import secrets


def generate_guest_access_token():
    """Generate a private guest token and its SHA-256 hash."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return token, token_hash


def verify_guest_access_token(preference, provided_token):
    """Verify a guest's access token without storing the raw token."""
    if not preference.guest_access_token_hash or not provided_token:
        return False

    provided_hash = hashlib.sha256(
        provided_token.encode("utf-8")
    ).hexdigest()

    return hmac.compare_digest(
        preference.guest_access_token_hash,
        provided_hash,
    )
