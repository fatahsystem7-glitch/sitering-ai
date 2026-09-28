"""Runtime config loading for the sitering-ai voice agent.

The agent is multi-tenant: nothing about a client is baked into the image.
On every inbound call we resolve the dialled UK number against Supabase and
build the agent from whatever that tenant has configured in the dashboard.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("sitering.config")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

DEFAULT_PROMPT = (
    "You are an AI receptionist for a UK trade business. Be warm, brief and "
    "practical. Capture the caller's name, contact number, postcode and a short "
    "description of the job. Use British English."
)
DEFAULT_GREETING = "Hello, thanks for calling. How can I help today?"


@dataclass(slots=True)
class TenantAgentConfig:
    """Everything the worker needs to serve one inbound call."""

    tenant_id: str | None = None
    business_name: str = "the business"
    trade: str | None = None
    phone_number_id: str | None = None
    e164: str | None = None
    agent_config_id: str | None = None
    display_name: str = "Receptionist"
    system_prompt: str = DEFAULT_PROMPT
    greeting: str = DEFAULT_GREETING
    voice_id: str = os.environ.get("FISH_DEFAULT_VOICE_ID", "933563129e564b19a115bedd57b7406a")
    tts_model: str = os.environ.get("FISH_TTS_MODEL", "s2.1-pro")
    llm_model: str = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
    language: str = "en-GB"
    temperature: float = 0.5
    business_hours: dict[str, Any] = field(default_factory=dict)
    escalation_number: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    is_fallback: bool = False

    @classmethod
    def fallback(cls, dialled: str | None = None) -> "TenantAgentConfig":
        return cls(e164=dialled, is_fallback=True)

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "TenantAgentConfig":
        known = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        clean = {k: v for k, v in row.items() if k in known and v is not None}
        clean.setdefault("system_prompt", DEFAULT_PROMPT)
        clean.setdefault("greeting", DEFAULT_GREETING)
        if "temperature" in clean:
            clean["temperature"] = float(clean["temperature"])
        return cls(**clean)

    def instructions(self) -> str:
        """Compose the final system prompt sent to the LLM."""
        parts = [self.system_prompt.strip()]
        if self.business_name:
            parts.append(f"You are answering calls for {self.business_name}.")
        if self.business_hours:
            parts.append(f"Business hours (JSON): {self.business_hours}.")
        if self.escalation_number:
            parts.append(
                "If the caller has an emergency or explicitly demands a human, tell them "
                "you are putting them through and call the transfer_to_human tool."
            )
        parts.append(
            "Keep replies to one or two short sentences -- this is a phone call, not chat. "
            "Never invent prices, availability or engineer names."
        )
        return "\n\n".join(parts)


def _headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_config_for_number(dialled: str) -> TenantAgentConfig:
    """Resolve tenant config from the dialled number via the Supabase RPC."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        logger.warning("Supabase not configured; using fallback agent config")
        return TenantAgentConfig.fallback(dialled)

    url = f"{SUPABASE_URL}/rest/v1/rpc/agent_config_for_number"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=_headers(), json={"dialled": dialled})
            resp.raise_for_status()
            row = resp.json()
    except Exception:  # noqa: BLE001 - never fail a live call on a lookup error
        logger.exception("config lookup failed for %s", dialled)
        return TenantAgentConfig.fallback(dialled)

    if not row:
        logger.warning("no tenant mapped to dialled number %s", dialled)
        return TenantAgentConfig.fallback(dialled)

    return TenantAgentConfig.from_row(row)


async def log_call_start(cfg: TenantAgentConfig, room: str, caller: str | None) -> str | None:
    """Insert a call row; returns its id so we can close it out later."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and cfg.tenant_id):
        return None
    payload = {
        "tenant_id": cfg.tenant_id,
        "phone_number_id": cfg.phone_number_id,
        "room_name": room,
        "from_e164": caller,
        "to_e164": cfg.e164,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/calls",
                headers={**_headers(), "Prefer": "return=representation"},
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()[0]["id"]
    except Exception:  # noqa: BLE001
        logger.exception("failed to log call start")
        return None


async def log_call_end(
    call_id: str | None,
    transcript: list[dict[str, Any]],
    summary: str | None = None,
    duration_secs: int | None = None,
    outcome: str | None = None,
    ended_at: str | None = None,
) -> None:
    """Close out the call row with duration, transcript and an LLM summary."""
    if not (call_id and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return

    payload: dict[str, Any] = {
        "ended_at": ended_at or datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
    }
    if summary is not None:
        payload["summary"] = summary
    if duration_secs is not None:
        payload["duration_secs"] = duration_secs
    if outcome is not None:
        payload["outcome"] = outcome

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/calls?id=eq.{call_id}",
                headers=_headers(),
                json=payload,
            )
            resp.raise_for_status()
    except Exception:  # noqa: BLE001
        logger.exception("failed to log call end")
