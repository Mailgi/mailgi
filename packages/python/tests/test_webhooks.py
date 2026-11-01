"""Mirrors packages/typescript/test/webhooks.test.ts."""

import hashlib
import hmac
import json
import time

from mailgi import sign_webhook_payload, verify_webhook_signature

SECRET = "whsec_test_secret"
BODY = json.dumps({
    "event": "mail.received",
    "agentId": "agent-1",
    "messageId": "abc@example.com",
    "from": "alice@example.com",
    "to": ["bot@mailgi.xyz"],
    "receivedAt": "2026-10-31T00:00:00.000Z",
    "size": 1024,
    "spam": False,
    "fetchUrl": "https://api.mailgi.xyz/v1/mail/M1",
})


def now() -> int:
    return int(time.time())


def test_accepts_a_correctly_signed_notification():
    ts = now()
    sig = sign_webhook_payload(BODY, SECRET, ts)
    result = verify_webhook_signature(BODY, sig, str(ts), SECRET)
    assert result.valid and result.reason is None
    assert result


def test_accepts_bytes_body_as_frameworks_deliver_it():
    ts = now()
    sig = sign_webhook_payload(BODY, SECRET, ts)
    assert verify_webhook_signature(BODY.encode(), sig, ts, SECRET)


def test_rejects_a_tampered_body():
    ts = now()
    sig = sign_webhook_payload(BODY, SECRET, ts)
    result = verify_webhook_signature(BODY.replace("alice", "mallory"), sig, ts, SECRET)
    assert (result.valid, result.reason) == (False, "signature-mismatch")
    assert not result


def test_rejects_a_reserialised_body():
    # json.dumps(json.loads(raw)) is not the raw body; this is the mistake the docstring warns about.
    ts = now()
    sig = sign_webhook_payload(BODY, SECRET, ts)
    reserialised = json.dumps(json.loads(BODY), separators=(",", ":"))
    assert verify_webhook_signature(reserialised, sig, ts, SECRET).reason == "signature-mismatch"


def test_rejects_the_wrong_secret():
    ts = now()
    sig = sign_webhook_payload(BODY, "other", ts)
    assert verify_webhook_signature(BODY, sig, ts, SECRET).reason == "signature-mismatch"


def test_rejects_a_replay_outside_tolerance():
    ts = now() - 3600
    sig = sign_webhook_payload(BODY, SECRET, ts)
    assert verify_webhook_signature(BODY, sig, ts, SECRET).reason == "timestamp-outside-tolerance"


def test_replay_window_can_be_disabled():
    ts = now() - 3600
    sig = sign_webhook_payload(BODY, SECRET, ts)
    assert verify_webhook_signature(BODY, sig, ts, SECRET, tolerance_seconds=0).valid


def test_rejects_non_numeric_timestamp():
    for bad in ("not-a-number", "", "nan", "inf"):
        assert verify_webhook_signature(BODY, "deadbeef", bad, SECRET).reason == "malformed-timestamp"


def test_signs_timestamp_dot_body():
    # Pins the scheme, independently of the SDK: HMAC-SHA256(secret, f"{ts}.{body}") as lowercase hex.
    expected = hmac.new(SECRET.encode(), f"1700000000.{BODY}".encode(), hashlib.sha256).hexdigest()
    assert sign_webhook_payload(BODY, SECRET, 1700000000) == expected
    assert sign_webhook_payload(BODY, SECRET, "1700000000") == expected
    assert sign_webhook_payload(BODY, SECRET, 1700000000) != sign_webhook_payload(BODY, SECRET, "")


def test_rejects_wrong_length_and_non_ascii_signatures():
    ts = now()
    assert verify_webhook_signature(BODY, "ab", ts, SECRET).reason == "signature-mismatch"
    assert verify_webhook_signature(BODY, "é" * 64, ts, SECRET).reason == "signature-mismatch"
