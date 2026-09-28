"""Contract tests for the LiveKit objects the shutdown hook touches.

We can't place a real phone call in CI, but almost everything that could break
in `_on_shutdown` is a *shape* assumption about livekit-agents:

  * session.history          -> ChatContext
  * ChatContext.items        -> list of ChatMessage | FunctionCall | FunctionCallOutput
  * ChatMessage.role         -> str
  * ChatMessage.text_content -> str | None
  * FunctionCall has NO text_content (our filter relies on this to skip tool calls)
  * session.userdata raises ValueError if it was never set

These break on a library upgrade, silently, and you'd only find out when a
transcript came back empty. Pinning them here is cheap.

Skipped automatically if livekit-agents isn't installed, so the suite still
runs in a bare environment.
"""

import pytest

livekit = pytest.importorskip("livekit.agents", reason="livekit-agents not installed")

from livekit.agents import AgentSession, JobContext, RoomInputOptions  # noqa: E402
from livekit.agents.llm import ChatContext, ChatMessage, FunctionCall  # noqa: E402


def _history_to_transcript(items):
    """EXACT copy of the comprehension in agent._on_shutdown."""
    return [
        {"role": item.role, "text": item.text_content}
        for item in items
        if getattr(item, "text_content", None)
    ]


def test_chat_context_exposes_items():
    ctx = ChatContext.empty()
    assert hasattr(ctx, "items")
    assert isinstance(ctx.items, list)


def test_chat_message_has_role_and_text_content():
    ctx = ChatContext.empty()
    ctx.add_message(role="user", content="My boiler is leaking.")
    item = ctx.items[0]
    assert isinstance(item, ChatMessage)
    assert item.role == "user"
    assert item.text_content == "My boiler is leaking."


def test_transcript_extraction_matches_agent_logic():
    ctx = ChatContext.empty()
    ctx.add_message(role="assistant", content="Hello, how can I help?")
    ctx.add_message(role="user", content="I need a quote.")

    transcript = _history_to_transcript(ctx.items)
    assert transcript == [
        {"role": "assistant", "text": "Hello, how can I help?"},
        {"role": "user", "text": "I need a quote."},
    ]


def test_function_calls_are_skipped_not_crashed_on():
    """FunctionCall has no .role — if our filter ever evaluated it, we'd 500
    on the shutdown path and lose the whole transcript."""
    assert not hasattr(FunctionCall, "text_content")

    ctx = ChatContext.empty()
    ctx.add_message(role="user", content="Book me in.")
    ctx.items.append(
        FunctionCall(call_id="c1", name="capture_job_details", arguments="{}")
    )
    ctx.add_message(role="assistant", content="Done.")

    transcript = _history_to_transcript(ctx.items)
    assert [t["role"] for t in transcript] == ["user", "assistant"]


def test_empty_messages_are_filtered_out():
    ctx = ChatContext.empty()
    ctx.add_message(role="user", content="")
    assert _history_to_transcript(ctx.items) == []


def test_session_exposes_userdata_and_history_properties():
    assert isinstance(AgentSession.userdata, property)
    assert isinstance(AgentSession.history, property)


def test_userdata_raises_when_never_initialised():
    """We pass userdata={} at construction. If that's ever dropped, the shutdown
    hook would raise here rather than returning None — hence the guard."""
    session = AgentSession()
    with pytest.raises(ValueError):
        _ = session.userdata


def test_userdata_dict_supports_the_operations_the_tool_uses():
    session = AgentSession(userdata={})
    session.userdata.setdefault("enquiries", []).append({"caller_name": "Sam"})
    assert session.userdata["enquiries"] == [{"caller_name": "Sam"}]
    assert (session.userdata or {}).get("enquiries")


def test_job_context_shutdown_and_participant_apis_exist():
    for method in ("add_shutdown_callback", "wait_for_participant", "connect"):
        assert callable(getattr(JobContext, method, None)), method


def test_agent_session_start_accepts_room_input_options():
    import inspect

    params = inspect.signature(AgentSession.start).parameters
    assert "room_input_options" in params
    assert "room" in params
    assert RoomInputOptions is not None


def test_fishaudio_tts_accepts_our_exact_kwargs():
    fishaudio = pytest.importorskip("livekit.plugins.fishaudio")
    import inspect

    params = inspect.signature(fishaudio.TTS.__init__).parameters
    for kwarg in ("api_key", "model", "voice_id", "latency_mode"):
        assert kwarg in params, f"fishaudio.TTS lost the {kwarg} kwarg"


def test_fishaudio_low_latency_mode_is_available():
    """The brief calls for ultra-low latency; 'low' must remain a valid mode."""
    import typing

    from livekit.plugins.fishaudio.tts import LatencyMode

    assert "low" in typing.get_args(LatencyMode)
