"""Tests for post-call summarisation.

No network: we exercise the transcript shaping and every no-API / bad-response
path, because those are the ones that run during an incident.
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sitering_agent.summary import OUTCOMES, _transcript_to_text, summarise_call  # noqa: E402

TRANSCRIPT = [
    {"role": "assistant", "text": "Hello, you've reached Dave's Plumbing. How can I help?"},
    {"role": "user", "text": "Hi, my boiler's leaking. I'm in SE15."},
    {"role": "assistant", "text": "Sorry to hear that. Can I take your name and number?"},
    {"role": "user", "text": "Sam Okafor, 07700 900123."},
]


def test_transcript_renders_with_speaker_labels():
    text = _transcript_to_text(TRANSCRIPT)
    assert "Caller: Hi, my boiler's leaking. I'm in SE15." in text
    assert "Receptionist: Hello, you've reached Dave's Plumbing." in text


def test_transcript_skips_empty_and_missing_text():
    text = _transcript_to_text(
        [{"role": "user", "text": ""}, {"role": "user"}, {"role": "user", "text": "  ok  "}]
    )
    assert text == "Caller: ok"


def test_transcript_is_tail_truncated():
    long_transcript = [{"role": "user", "text": "x" * 500} for _ in range(100)]
    text = _transcript_to_text(long_transcript, limit=1000)
    assert len(text) == 1000


def test_returns_fallback_without_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = asyncio.run(summarise_call(TRANSCRIPT))
    assert result == {"summary": None, "outcome": None}


def test_empty_transcript_short_circuits(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    result = asyncio.run(summarise_call([]))
    assert result["outcome"] == "no_engagement"
    assert "before anything was said" in result["summary"]


def test_network_failure_returns_fallback_not_exception(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    # Point at a port nothing is listening on.
    monkeypatch.setattr("sitering_agent.summary.OPENAI_URL", "http://127.0.0.1:1/v1/chat")
    result = asyncio.run(summarise_call(TRANSCRIPT))
    assert result == {"summary": None, "outcome": None}


def test_outcome_vocabulary_is_closed():
    # The dashboard filters on these; adding one is a deliberate schema change.
    assert OUTCOMES == [
        "booking",
        "quote_request",
        "message",
        "emergency",
        "existing_job",
        "supplier",
        "spam",
        "no_engagement",
    ]


@pytest.mark.parametrize("bad", [None, [], [{"role": "user"}]])
def test_never_raises_on_odd_input(bad, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    result = asyncio.run(summarise_call(bad or []))
    assert isinstance(result, dict)
    assert "summary" in result and "outcome" in result
