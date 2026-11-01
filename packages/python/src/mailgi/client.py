"""The Mailgi API client. Mirrors ``client.ts``.

Standard library only: requests go through ``urllib``, so installing the SDK
adds no dependencies to an agent's environment.
"""

from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Literal, Optional, Sequence, Tuple, Union, cast
from urllib.parse import quote, urlencode

from ._version import __version__
from .errors import (
    BadRequestError,
    ConflictError,
    MailgiError,
    NotFoundError,
    PaymentRequiredError,
    UnauthorizedError,
)
from .types import (
    Agent,
    ApiKey,
    BillingInfo,
    ChallengeResponse,
    CreateApiKeyResponse,
    CreateWebhookEndpointResponse,
    EmailWithBody,
    EnableEndpointResponse,
    HealthResponse,
    ListMailResponse,
    ListTransactionsResponse,
    Mailbox,
    PaymentRequiredDetails,
    RegisterAgentResponse,
    ResendDeliveryResponse,
    SendMailResponse,
    TopupResponse,
    VerifyResponse,
    WebhookDelivery,
    WebhookEndpoint,
)

DEFAULT_BASE_URL = "https://api.mailgi.xyz"

Transport = Callable[
    [str, str, Dict[str, str], Optional[bytes], float], Tuple[int, str, bytes]
]
"""``(method, url, headers, body, timeout) -> (status, reason, body)``.

The default sends with ``urllib``. Replace it to use another HTTP library, or
to stub the network in tests. Raise :class:`TimeoutError` on a timeout.
"""

Recipients = Union[str, Sequence[str]]


def _urllib_transport(
    method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: float
) -> Tuple[int, str, bytes]:
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.reason, res.read()
    except urllib.error.HTTPError as err:
        # A non-2xx status is a response, not a transport failure.
        return err.code, str(err.reason), err.read()
    except socket.timeout as err:  # A read timeout; TimeoutError itself from 3.10
        raise TimeoutError(str(err)) from err
    except urllib.error.URLError as err:
        if isinstance(err.reason, (socket.timeout, TimeoutError)):
            raise TimeoutError(str(err.reason)) from err
        raise


def _seg(value: str) -> str:
    """Encode one path segment, like JS ``encodeURIComponent``."""
    return quote(value, safe="")


def _recipients(value: Recipients) -> List[str]:
    return [value] if isinstance(value, str) else list(value)


class MailgiClient:
    """Client for the Mailgi REST API.

    >>> client = MailgiClient(api_key=os.environ["MAILGI_API_KEY"])
    >>> client.mail.send(to="alice@example.com", subject="Hi", text_body="Hello")

    ``api_key`` can also be set later via ``client.api_key``. ``timeout`` is in
    seconds (default 30).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        transport: Optional[Transport] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._transport: Transport = transport or _urllib_transport

        self.agents = _Agents(self)
        self.api_keys = _ApiKeys(self)
        self.auth = _Auth(self)
        self.mail = _Mail(self)
        self.mailboxes = _Mailboxes(self)
        self.billing = _Billing(self)
        self.health = _Health(self)
        self.webhooks = _Webhooks(self)

    @classmethod
    def with_api_key(cls, base_url: str, api_key: str) -> "MailgiClient":
        """Same as ``MailgiClient(api_key=..., base_url=...)``; kept for parity with the TS SDK."""
        return cls(api_key=api_key, base_url=base_url)

    # -------------------------------------------------------------------------
    # Core HTTP plumbing
    # -------------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        body: Any = None,
        authenticated: bool = True,
        query: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = self.base_url + path
        if query:
            params = {k: v for k, v in query.items() if v is not None}
            if params:
                url += "?" + urlencode(params)

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"mailgi-python/{__version__}",
        }
        if authenticated and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        data = json.dumps(body).encode("utf-8") if body is not None else None

        try:
            status, reason, raw = self._transport(method, url, headers, data, self.timeout)
        except TimeoutError:
            raise MailgiError(f"Request timed out after {self.timeout}s", 408, "TIMEOUT") from None

        if not 200 <= status < 300:
            raise self._error(status, reason, raw)

        if status == 204 or not raw:
            return None
        return json.loads(raw)

    @staticmethod
    def _error(status: int, reason: str, raw: bytes) -> MailgiError:
        message: Optional[str] = None
        code: Optional[str] = None
        details: Optional[Dict[str, Any]] = None
        try:
            payload = json.loads(raw)
        except ValueError:
            payload = None
        if isinstance(payload, dict):
            # The API sends {"error": {"code", "message", "details"}}; fall back to flat shapes.
            err = payload.get("error")
            nested = err if isinstance(err, dict) else {}
            message = payload.get("message") or nested.get("message") or (err if isinstance(err, str) else None)
            code = payload.get("code") or nested.get("code")
            details = nested.get("details")
        message = message or reason

        if status == 400:
            return BadRequestError(message)
        if status == 401:
            return UnauthorizedError(message)
        if status == 402:
            return PaymentRequiredError(message, cast(PaymentRequiredDetails, details or {}))
        if status == 404:
            return NotFoundError(message)
        if status == 409:
            return ConflictError(message)
        return MailgiError(message, status, code or "SERVER_ERROR", details)


class _Namespace:
    def __init__(self, client: MailgiClient) -> None:
        self._client = client

    def _request(self, *args: Any, **kwargs: Any) -> Any:
        return self._client._request(*args, **kwargs)


class _Agents(_Namespace):
    def register(self, label: Optional[str] = None, did: Optional[str] = None) -> RegisterAgentResponse:
        """Register a new agent. Returns its address and API key.

        The key is shown once: store it securely. No API key is needed to call this.
        """
        body = {k: v for k, v in {"label": label, "did": did}.items() if v is not None}
        return self._request("POST", "/v1/agents/register", body, authenticated=False)

    def me(self) -> Agent:
        """The authenticated agent's profile."""
        return self._request("GET", "/v1/agents/me")

    def delete(self) -> None:
        """Deregister the authenticated agent and permanently delete all its data."""
        self._request("DELETE", "/v1/agents/me")


class _ApiKeys(_Namespace):
    def list(self) -> List[ApiKey]:
        return self._request("GET", "/v1/apikeys")

    def create(self, label: Optional[str] = None, expires_at: Optional[str] = None) -> CreateApiKeyResponse:
        """Create an API key. The raw key is returned once: store it securely."""
        body = {k: v for k, v in {"label": label, "expiresAt": expires_at}.items() if v is not None}
        return self._request("POST", "/v1/apikeys", body)

    def revoke(self, key_id: str) -> None:
        self._request("DELETE", f"/v1/apikeys/{_seg(key_id)}")


class _Auth(_Namespace):
    """DID-based authentication. Optional: most agents use API keys."""

    def challenge(self, did: str) -> ChallengeResponse:
        return self._request("POST", "/v1/auth/challenge", {"did": did}, authenticated=False)

    def verify(self, did: str, nonce: str, signature: str) -> VerifyResponse:
        """Exchange a signed nonce (base64url Ed25519) for a bearer token."""
        body = {"did": did, "nonce": nonce, "signature": signature}
        return self._request("POST", "/v1/auth/verify", body, authenticated=False)


class _Mail(_Namespace):
    def list(
        self,
        mailbox_id: Optional[str] = None,
        limit: Optional[int] = None,
        position: Optional[int] = None,
        sort: Optional[Literal["asc", "desc"]] = None,
    ) -> ListMailResponse:
        """List messages. Carries a ``billing`` notice while the wallet needs attention."""
        query = {"mailboxId": mailbox_id, "limit": limit, "position": position, "sort": sort}
        return self._request("GET", "/v1/mail", query=query)

    def get(self, id: str) -> EmailWithBody:
        """One message with its body. Carries a ``billing`` notice while the wallet needs attention."""
        return self._request("GET", f"/v1/mail/{_seg(id)}")

    def send(
        self,
        to: Recipients,
        subject: str,
        text_body: Optional[str] = None,
        html_body: Optional[str] = None,
        cc: Optional[Recipients] = None,
        bcc: Optional[Recipients] = None,
        reply_to: Optional[str] = None,
    ) -> SendMailResponse:
        """Send from the agent's address. Recipients are bare addresses, a string or a list.

        Raises :class:`PaymentRequiredError` if the wallet cannot cover it;
        nothing is sent in that case.
        """
        body: Dict[str, Any] = {"to": _recipients(to), "subject": subject}
        if cc is not None:
            body["cc"] = _recipients(cc)
        if bcc is not None:
            body["bcc"] = _recipients(bcc)
        if text_body is not None:
            body["textBody"] = text_body
        if html_body is not None:
            body["htmlBody"] = html_body
        if reply_to is not None:
            body["replyTo"] = reply_to
        return self._request("POST", "/v1/mail/send", body)

    def delete(self, id: str) -> None:
        """Delete a message (moves it to Trash)."""
        self._request("DELETE", f"/v1/mail/{_seg(id)}")

    def move(self, id: str, mailbox_id: str) -> None:
        self._request("PATCH", f"/v1/mail/{_seg(id)}/move", {"mailboxId": mailbox_id})

    def set_flags(self, id: str, seen: Optional[bool] = None, flagged: Optional[bool] = None) -> None:
        """Update flags: ``seen=True`` marks read, ``flagged=True`` stars."""
        flags = {k: v for k, v in {"seen": seen, "flagged": flagged}.items() if v is not None}
        self._request("PATCH", f"/v1/mail/{_seg(id)}/flags", flags)


class _Mailboxes(_Namespace):
    def list(self) -> List[Mailbox]:
        return self._request("GET", "/v1/mailboxes")

    def create(self, name: str, parent_id: Optional[str] = None) -> Mailbox:
        body = {"name": name}
        if parent_id is not None:
            body["parentId"] = parent_id
        return self._request("POST", "/v1/mailboxes", body)

    def delete(self, id: str) -> None:
        """Permanently delete a mailbox and every message in it."""
        self._request("DELETE", f"/v1/mailboxes/{_seg(id)}")

    def rename(self, id: str, name: str) -> None:
        self._request("PATCH", f"/v1/mailboxes/{_seg(id)}", {"name": name})


class _Billing(_Namespace):
    def get(self) -> BillingInfo:
        """The wallet this agent spends from, its balance and standing, prices, and how to top up."""
        return self._request("GET", "/v1/billing")

    def topup(self, amount_usd: float) -> TopupResponse:
        """A Stripe Checkout link that tops up this agent's wallet.

        Give ``url`` to a human to pay by card; the balance is credited within
        seconds. The minimum is ``get()["topup"]["minAmountUsd"]``.
        """
        return self._request("POST", "/v1/billing/topup", {"amountUsd": amount_usd})

    def transactions(self, limit: Optional[int] = None, offset: Optional[int] = None) -> ListTransactionsResponse:
        """Deposits and charges, newest first."""
        return self._request("GET", "/v1/billing/transactions", query={"limit": limit, "offset": offset})


class _Health(_Namespace):
    def check(self) -> HealthResponse:
        """Liveness. No auth."""
        return self._request("GET", "/health", authenticated=False)

    def ready(self) -> HealthResponse:
        """Readiness of every dependency. No auth."""
        return self._request("GET", "/health/ready", authenticated=False)


class _Webhooks(_Namespace):
    """Inbound mail notifications. Verify each with :func:`mailgi.verify_webhook_signature`."""

    def create(
        self,
        url: str,
        scope: Optional[Literal["agent", "domain"]] = None,
        event_types: Optional[List[str]] = None,
    ) -> CreateWebhookEndpointResponse:
        """Subscribe an HTTPS URL to this agent's inbound mail.

        The response holds ``secret``, shown **once**: store it. ``scope="domain"``
        currently returns HTTP 501.
        """
        body: Dict[str, Any] = {"url": url}
        if scope is not None:
            body["scope"] = scope
        if event_types is not None:
            body["eventTypes"] = event_types
        return self._request("POST", "/v1/webhook-endpoints/", body)

    def list(self) -> List[WebhookEndpoint]:
        """This agent's endpoints. Secrets are absent by design."""
        return self._request("GET", "/v1/webhook-endpoints/")["endpoints"]

    def delete(self, id: str) -> None:
        """Delete an endpoint. Deliveries stop immediately."""
        self._request("DELETE", f"/v1/webhook-endpoints/{_seg(id)}")

    def deliveries(self, id: str) -> List[WebhookDelivery]:
        """Recent delivery attempts, with what your endpoint answered."""
        return self._request("GET", f"/v1/webhook-endpoints/{_seg(id)}/deliveries")["deliveries"]

    def resend_delivery(self, id: str, delivery_id: str) -> ResendDeliveryResponse:
        """Re-queue one delivery with a fresh attempt budget. 400 if the endpoint is disabled."""
        return self._request(
            "POST", f"/v1/webhook-endpoints/{_seg(id)}/deliveries/{_seg(delivery_id)}/resend"
        )

    def enable(self, id: str) -> EnableEndpointResponse:
        """Re-enable an endpoint that failures disabled. The signing secret is kept."""
        return self._request("POST", f"/v1/webhook-endpoints/{_seg(id)}/enable")


# Same name as the TypeScript SDK, for code ported from it.
AgentMailboxClient = MailgiClient
