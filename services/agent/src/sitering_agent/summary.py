"""Post-call summarisation.

Runs once, after the caller hangs up, on the shutdown path. It must be cheap and
must never raise: a failed summary should cost us a dashboard nicety, not the
call record itself.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("sitering.summary")

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
SUMMARY_MODEL = os.environ.get("OPENAI_SUMMARY_MODEL", "gpt-4.1-mini")

# Kept deliberately small and closed — the dashboard filters on these.
OUTCOMES = [
    "booking",          # job booked / appointment agreed
    "quote_request",    # wants a price
    "message",          # general message for the team
    "emergency",        # urgent, likely transferred
    "existing_job",     # chasing work already in progress
    "supplier",         # supplier / trade caller
    "spam",             # cold sales, robocall
    "no_engagement",    # caller hung up or said nothing useful
]

SYSTEM_PROMPT = (
    "You summarise phone calls taken by an AI receptionist for a UK trade business. "
    "Reply with JSON only, matching this schema exactly:\n"
    '{"summary": string, "outcome": string, "caller_name": string|null, '
    '"callback_number": string|null, "postcode": string|null, "urgency": '
    '"emergency"|"soon"|"standard"|null}\n'
    "summary: at most two sentences, written for the business owner skimming a list. "
    "Lead with what the caller wanted and any action needed. British English. "
    f"outcome: exactly one of {OUTCOMES}. "
    "Use null for anything the caller did not provide. Never invent details."
)


def _transcript_to_text(transcript: list[dict[str, Any]], limit: int = 12000) -> str:
    lines = []
    for item in transcript:
        role = item.get("role", "")
        speaker = "Caller" if role == "user" else "Receptionist"
        text = (item.get("text") or "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)[-limit:]


async def summarise_call(
    transcript: list[dict[str, Any]],
    captured: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return {'summary', 'outcome', ...}. Always returns a dict, never raises."""
    fallback = {"summary": None, "outcome": None}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return fallback

    text = _transcript_to_text(transcript)
    if not text.strip():
        return {"summary": "Call ended before anything was said.", "outcome": "no_engagement"}

    user_content = text
    if captured:
        # Details the agent explicitly captured beat anything re-read from prose.
        user_content += f"\n\nStructured details captured during the call:\n{json.dumps(captured)}"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": SUMMARY_MODEL,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
    except Exception:  # noqa: BLE001 - summarisation is best-effort
        logger.exception("call summarisation failed")
        return fallback

    outcome = parsed.get("outcome")
    if outcome not in OUTCOMES:
        logger.warning("model returned unknown outcome %r", outcome)
        outcome = None

    summary = parsed.get("summary")
    if isinstance(summary, str):
        summary = summary.strip()[:1000] or None
    else:
        summary = None

    return {
        "summary": summary,
        "outcome": outcome,
        "caller_name": parsed.get("caller_name"),
        "callback_number": parsed.get("callback_number"),
        "postcode": parsed.get("postcode"),
        "urgency": parsed.get("urgency"),
    }
