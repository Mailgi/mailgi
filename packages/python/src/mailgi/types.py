"""Response and request shapes. Mirrors ``types.ts``.

Results are plain ``dict`` objects decoded from the API's JSON, so keys keep
the API's camelCase spelling (``result["billing"]["topupPage"]``). These
``TypedDict`` classes describe them for type checkers and editors; nothing is
validated at runtime.

Optional keys live in a ``total=False`` subclass, since ``NotRequired`` needs
Python 3.11 and this package supports 3.9.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional, TypedDict, Union

# --- Registration ------------------------------------------------------------


class RegisterAgentRequest(TypedDict, total=False):
    did: str  # Optional W3C DID (did:key: format)
    label: str


class _RegisterAgentResponse(TypedDict):
    agentId: str
    emailAddress: str  # Friendly handle address, e.g. bubbling-dolphin@mailgi.xyz
    aliasAddress: str  # Opaque deterministic alias
    apiKey: str  # Raw key, shown once: store it securely
    apiKeyId: str


class RegisterAgentResponse(_RegisterAgentResponse, total=False):
    did: str  # Only present if a DID was given at registration


# --- Agent -------------------------------------------------------------------


class _Agent(TypedDict):
    agentId: str
    emailAddress: str
    aliasAddress: str
    label: str
    createdAt: str


class Agent(_Agent, total=False):
    did: str


# --- API keys ----------------------------------------------------------------


class ApiKey(TypedDict):
    id: str
    keyPrefix: str
    label: str
    createdAt: str
    lastUsedAt: Optional[str]
    expiresAt: Optional[str]
    revokedAt: Optional[str]


class CreateApiKeyRequest(TypedDict, total=False):
    label: str
    expiresAt: str  # ISO date string


class CreateApiKeyResponse(ApiKey):
    apiKey: str  # Raw key, shown once: store it securely
    apiKeyId: str


# --- Auth --------------------------------------------------------------------


class ChallengeResponse(TypedDict):
    nonce: str
    expiresAt: str


class VerifyRequest(TypedDict):
    did: str
    nonce: str
    signature: str  # base64url Ed25519 signature over the nonce


class VerifyResponse(TypedDict):
    token: str
    expiresIn: int


# --- Mail --------------------------------------------------------------------


class _EmailAddress(TypedDict):
    email: str


class EmailAddress(_EmailAddress, total=False):
    name: str


# Functional syntax because `from` is a Python keyword.
Email = TypedDict(
    "Email",
    {
        "id": str,
        "subject": str,
        "from": List[EmailAddress],
        "to": List[EmailAddress],
        "cc": List[EmailAddress],
        "bcc": List[EmailAddress],
        "receivedAt": str,
        "size": int,
        "preview": str,
        "seen": bool,  # True when $seen keyword is set
        "mailboxIds": Dict[str, bool],
        "keywords": Dict[str, bool],
    },
)


class JmapBodyPart(TypedDict, total=False):
    partId: str
    blobId: str
    size: int
    type: str
    charset: str


class _JmapBodyValue(TypedDict):
    value: str


class JmapBodyValue(_JmapBodyValue, total=False):
    isEncodingProblem: bool
    isTruncated: bool


StandingStatus = Literal["ok", "low_balance", "in_debt", "reads_blocked"]
"""How the wallet is doing (``billing.get()["standing"]`` and the ``billing`` notice).

- ``ok``: nothing to do
- ``low_balance``: below about a week of this wallet's own spend (at least $1)
- ``in_debt``: negative; mail to outside addresses is refused (402)
- ``reads_blocked``: an agent wallet more than ``lowBalanceUsd`` in debt; reads
  answer 402 with ``reason: "debt_limit"`` until topped up. Receiving,
  webhooks, deleting and billing keep working.
"""


class BillingNotice(TypedDict):
    """Attached to ``mail.list()``, ``mail.get()`` and ``mail.send()`` results
    while the wallet needs attention. Absent means the balance is fine. When
    present, forward ``topupPage`` to whoever pays for the agent.
    """

    status: Literal["low_balance", "in_debt", "reads_blocked"]
    balanceUsd: float
    lowBalanceUsd: float  # About one week of this wallet's spend, never less than $1
    topupPage: str  # Public top-up page, this agent's address filled in. No login to pay.
    message: str


class EmailWithBody(Email, total=False):
    htmlBody: Union[str, List[JmapBodyPart]]
    textBody: Union[str, List[JmapBodyPart]]
    bodyValues: Dict[str, JmapBodyValue]  # JMAP partId -> body value
    billing: BillingNotice  # Present only while the wallet needs attention


class _ListMailResponse(TypedDict):
    messages: List[Email]
    total: int
    position: int


class ListMailResponse(_ListMailResponse, total=False):
    billing: BillingNotice  # Present only while the wallet needs attention


class _SendMailResponse(TypedDict):
    messageId: str


class SendMailResponse(_SendMailResponse, total=False):
    billing: BillingNotice  # Present when this send left the wallet low or in debt


# --- Mailboxes ---------------------------------------------------------------


class Mailbox(TypedDict):
    id: str
    name: str
    parentId: Optional[str]
    role: Optional[str]
    totalEmails: int
    unreadEmails: int


# --- Health ------------------------------------------------------------------


class HealthChecks(TypedDict):
    database: Literal["ok", "error"]
    stalwart: Literal["ok", "error"]


class _HealthResponse(TypedDict):
    status: Literal["ok", "degraded"]


class HealthResponse(_HealthResponse, total=False):
    checks: HealthChecks


# --- Billing -----------------------------------------------------------------


class Wallet(TypedDict):
    """Whose money pays: the agent's own wallet, or its organisation's."""

    kind: Literal["agent", "org"]
    id: str


class Prices(TypedDict):
    outboundEmailUsd: float  # Per external recipient, every send
    introductionUsd: float  # Added once for a recipient that never wrote to this agent
    storageGbMonthUsd: float  # Per GB-month of mailbox storage, billed daily
    storageFreeBytes: int  # Free storage per mailbox, in bytes


class _Standing(TypedDict):
    status: StandingStatus
    lowBalanceUsd: float


class Standing(_Standing, total=False):
    message: str  # What to do; absent when `ok`


class Topup(TypedDict):
    endpoint: str  # `POST /v1/billing/topup`: see `billing.topup()`
    publicPage: str  # Public page, this agent's address filled in
    method: str
    minAmountUsd: float
    available: bool  # False when card payments are not configured


class _BillingInfo(TypedDict):
    wallet: Wallet
    balanceUsd: float  # Can be negative (storage charged while empty, or a refund)
    meteringEnabled: bool  # False when this deployment does not charge yet
    prices: Prices
    knownContacts: int  # External addresses already corresponded with (no intro fee)
    standing: Standing
    topup: Topup


class BillingInfo(_BillingInfo, total=False):
    # Legacy USDC deposits; deprecated. Null unless crypto billing is configured.
    depositAddresses: Optional[Dict[str, str]]
    acceptedToken: str
    networks: Dict[str, List[str]]


class TopupResponse(TypedDict):
    url: str  # Stripe Checkout URL. Give it to a human to pay by card.
    sessionId: str
    amountUsd: float
    wallet: Wallet


class BalanceTransaction(TypedDict):
    id: str
    # Negative amounts are charges; `deposit` is a top-up; `refund`/`dispute` reverse one.
    type: Literal["deposit", "deduction", "storage", "refund", "dispute"]
    amountUsd: float
    agentId: Optional[str]  # The agent that incurred it (org wallets list every agent's)
    emailCount: Optional[int]  # External recipients billed, for `deduction`
    introductionCount: Optional[int]  # Of those, first-contact recipients
    provider: Optional[str]
    providerRef: Optional[str]
    txHash: Optional[str]  # Deprecated: legacy USDC deposits
    chain: Optional[str]  # Deprecated: legacy USDC deposits
    createdAt: str


class PaymentRequiredDetails(TypedDict, total=False):
    """``error.details`` of a 402 ``PAYMENT_REQUIRED``. Every key is optional."""

    reason: Literal["debt_limit"]  # Reading is paused; absent for a refused send
    wallet: Wallet
    balanceUsd: float
    requiredUsd: float  # The least top-up that makes the request succeed
    topupPage: str  # Public top-up page, this agent's address filled in
    debtLimitUsd: float  # For `debt_limit`: reads resume at or above this balance
    outboundRecipients: int  # For a refused send
    unknownRecipients: List[str]
    pricePerOutboundEmailUsd: float
    pricePerIntroductionUsd: float
    topupEndpoint: str


class ListTransactionsResponse(TypedDict):
    transactions: List[BalanceTransaction]
    total: int
    limit: int
    offset: int


# --- Inbound mail webhooks ---------------------------------------------------


class _WebhookEndpoint(TypedDict):
    id: str
    url: str
    eventTypes: List[str]
    enabled: bool
    createdAt: str


class WebhookEndpoint(_WebhookEndpoint, total=False):
    # Set when repeated delivery failures disabled the endpoint.
    disabledAt: Optional[str]
    disabledReason: Optional[str]


class CreateWebhookEndpointResponse(WebhookEndpoint):
    # Signing secret for `x-mailgi-signature`. Returned once, at creation; absent
    # from `webhooks.list()` and not retrievable later.
    secret: str


InboundMailNotification = TypedDict(
    "InboundMailNotification",
    {
        "event": Literal["mail.received"],
        "agentId": str,
        "messageId": Optional[str],  # RFC Message-ID, unbracketed
        "from": Optional[str],
        "to": List[str],
        "receivedAt": str,
        "size": Optional[int],
        "spam": bool,  # The spam filter flagged it. You are notified either way.
        "fetchUrl": Optional[str],  # `GET /v1/mail/<id>`, or None if the lookup failed
    },
)
InboundMailNotification.__doc__ = """The body Mailgi POSTs to a webhook endpoint when mail arrives: a thin event.

No subject, preview, body or attachment names: read the message with
``mail.get()`` (or ``fetchUrl`` with the API key). That keeps mail content out
of your endpoint's logs.
"""


class WebhookDelivery(TypedDict):
    id: str
    stalwartEventId: str  # The Stalwart ingest event this delivery came from
    agentId: str
    status: str
    attempts: int  # Reset to 0 by a manual resend
    nextAttemptAt: Optional[str]
    lastResponseCode: Optional[int]
    lastResponseBody: Optional[str]  # Truncated excerpt of your endpoint's response
    createdAt: str
    updatedAt: str


class ResendDeliveryResponse(TypedDict):
    id: str
    status: str


class EnableEndpointResponse(TypedDict):
    id: str
    enabled: bool
