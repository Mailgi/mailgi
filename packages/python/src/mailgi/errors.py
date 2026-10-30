"""Errors raised by :class:`mailgi.MailgiClient`. Mirrors ``errors.ts``."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional, cast

from .types import PaymentRequiredDetails


class MailgiError(Exception):
    """Base class for every error the client raises.

    ``details`` is the API's ``error.details``, when it sent any.
    """

    details: Optional[Mapping[str, Any]]

    def __init__(
        self,
        message: str,
        status_code: int,
        code: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.message!r}, status_code={self.status_code}, code={self.code!r})"


class BadRequestError(MailgiError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message, 400, "BAD_REQUEST")


class UnauthorizedError(MailgiError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, 401, "UNAUTHORIZED")


class NotFoundError(MailgiError):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(message, 404, "NOT_FOUND")


class ConflictError(MailgiError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message, 409, "CONFLICT")


class PaymentRequiredError(MailgiError):
    """402: the wallet cannot pay.

    Either a send it cannot cover (nothing was sent), or
    (``details["reason"] == "debt_limit"``) its debt is past the limit and
    reading is paused. Forward ``details["topupPage"]`` to whoever pays, then
    retry.
    """

    details: PaymentRequiredDetails

    def __init__(
        self,
        message: str = "Payment required",
        details: Optional[PaymentRequiredDetails] = None,
    ) -> None:
        super().__init__(message, 402, "PAYMENT_REQUIRED", cast(Dict[str, Any], details or {}))

    @property
    def reads_blocked(self) -> bool:
        """True when this is the read block, not a refused send."""
        return self.details.get("reason") == "debt_limit"


# Same names as the TypeScript SDK, for code ported from it.
AgentMailboxError = MailgiError
