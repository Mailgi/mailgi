"""Verifying inbound webhook notifications. Mirrors ``webhooks.ts``.

Every integrator has to check that a notification really came from Mailgi
before acting on it. Getting that check subtly wrong is easy and the failure is
silent: a signature computed over a parsed-and-re-serialised body, or compared
with ``==``, looks correct and isn't. So the SDK ships the check.

The scheme: ``x-mailgi-signature`` is the lowercase hex HMAC-SHA256, keyed with
the endpoint secret, of ``f"{timestamp}.{raw_body}"``, where ``timestamp`` is
the ``x-mailgi-timestamp`` header (unix seconds).
"""

from __future__ import annotations

import hashlib
import hmac
import math
import time
from dataclasses import dataclass
from typing import Literal, Optional, Union

VerifyFailureReason = Literal[
    "malformed-timestamp", "timestamp-outside-tolerance", "signature-mismatch"
]


@dataclass(frozen=True)
class WebhookVerification:
    """Result of :func:`verify_webhook_signature`. Truthy when valid."""

    valid: bool
    reason: Optional[VerifyFailureReason] = None

    def __bool__(self) -> bool:
        return self.valid


def _to_bytes(value: Union[str, bytes]) -> bytes:
    return value if isinstance(value, bytes) else value.encode("utf-8")


def sign_webhook_payload(
    body: Union[str, bytes], secret: str, timestamp: Union[str, int]
) -> str:
    """The expected signature for a payload.

    Exposed mainly for tests and for building signed fixtures; use
    :func:`verify_webhook_signature` to check an incoming request.
    """
    # The timestamp is part of the signed content, not just a header, which is
    # what makes the replay check meaningful.
    message = _to_bytes(str(timestamp)) + b"." + _to_bytes(body)
    return hmac.new(_to_bytes(secret), message, hashlib.sha256).hexdigest()


def verify_webhook_signature(
    body: Union[str, bytes],
    signature: str,
    timestamp: Union[str, int],
    secret: str,
    tolerance_seconds: float = 300,
) -> WebhookVerification:
    """Verify an inbound webhook notification.

    ``body`` must be the **raw** request body, exactly as received (``bytes``
    or ``str``). Not a parsed object, and not ``json.dumps(parsed)``:
    re-serialising changes bytes and the signature will not match.

    ``tolerance_seconds`` rejects notifications older than this (default 300).
    The timestamp is signed with the body, so this stops a captured request
    being replayed later. Pass ``0`` to skip the check.

    Returns a reason on failure rather than raising, so a handler can log why
    it rejected something::

        raw = request.get_data()  # Flask; FastAPI: await request.body()
        result = verify_webhook_signature(
            body=raw,
            signature=request.headers["x-mailgi-signature"],
            timestamp=request.headers["x-mailgi-timestamp"],
            secret=os.environ["MAILGI_WEBHOOK_SECRET"],
        )
        if not result:
            return result.reason, 401
        notification: InboundMailNotification = json.loads(raw)
    """
    try:
        seconds = float(timestamp)
    except (TypeError, ValueError):
        return WebhookVerification(False, "malformed-timestamp")
    if not math.isfinite(seconds):
        return WebhookVerification(False, "malformed-timestamp")

    if tolerance_seconds > 0 and abs(time.time() - seconds) > tolerance_seconds:
        return WebhookVerification(False, "timestamp-outside-tolerance")

    expected = sign_webhook_payload(body, secret, timestamp)
    # Constant time: `==` short-circuits and leaks how much of a forgery was right.
    # Compared as bytes, since compare_digest raises on non-ASCII str.
    if not hmac.compare_digest(expected.encode("ascii"), _to_bytes(signature)):
        return WebhookVerification(False, "signature-mismatch")

    return WebhookVerification(True)
