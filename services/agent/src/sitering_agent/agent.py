"""sitering-ai LiveKit voice agent worker.

Architecture: slimmed LiveKit agent-starter layout.
  STT   -> Deepgram (swap freely)
  LLM   -> OpenAI (OPENAI_API_KEY)
  TTS   -> Fish Audio via livekit-plugins-fishaudio (FISH_API_KEY)
  State -> Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)

There is no Cartesia / ElevenLabs anywhere in this tree by design.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from livekit import api
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, fishaudio, openai, silero

from .config import TenantAgentConfig, fetch_config_for_number, log_call_end, log_call_start
from .summary import summarise_call

load_dotenv()
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("sitering.agent")


class ReceptionistAgent(Agent):
    def __init__(self, cfg: TenantAgentConfig) -> None:
        super().__init__(instructions=cfg.instructions())
        self.cfg = cfg

    @function_tool()
    async def capture_job_details(
        self,
        ctx: RunContext,
        caller_name: str,
        callback_number: str,
        postcode: str,
        job_description: str,
        urgency: str = "standard",
    ) -> str:
        """Record the caller's job enquiry. Call this once you have the details."""
        logger.info(
            "job captured tenant=%s %s",
            self.cfg.tenant_id,
            json.dumps(
                {
                    "caller_name": caller_name,
                    "callback_number": callback_number,
                    "postcode": postcode,
                    "urgency": urgency,
                }
            ),
        )
        ctx.session.userdata.setdefault("enquiries", []).append(
            {
                "caller_name": caller_name,
                "callback_number": callback_number,
                "postcode": postcode,
                "job_description": job_description,
                "urgency": urgency,
            }
        )
        return "Details recorded. Confirm them back to the caller and say the team will be in touch."

    @function_tool()
    async def transfer_to_human(self, ctx: RunContext, reason: str) -> str:
        """Transfer the live call to the tenant's escalation number."""
        target = self.cfg.escalation_number
        if not target:
            return "No transfer number is configured. Take a message instead."

        room = ctx.session._room_io._room  # noqa: SLF001 - starter pattern
        participant = next(iter(room.remote_participants.values()), None)
        if participant is None:
            return "Could not find the caller to transfer."

        logger.info("transferring tenant=%s reason=%s", self.cfg.tenant_id, reason)
        async with api.LiveKitAPI() as lk:
            await lk.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=room.name,
                    participant_identity=participant.identity,
                    transfer_to=f"tel:{target}",
                    play_dialtone=True,
                )
            )
        return "Transferring now."


def _dialled_number(ctx: JobContext) -> str | None:
    """Pull the dialled (called) number out of SIP participant attributes."""
    for p in ctx.room.remote_participants.values():
        attrs = p.attributes or {}
        for key in ("sip.trunkPhoneNumber", "sip.dialedNumber", "sip.to"):
            if attrs.get(key):
                return attrs[key]
    # dispatch metadata fallback: {"to": "+44...", "from": "+44..."}
    try:
        meta = json.loads(ctx.job.metadata or "{}")
        return meta.get("to") or meta.get("dialled")
    except json.JSONDecodeError:
        return None


def _caller_number(ctx: JobContext) -> str | None:
    for p in ctx.room.remote_participants.values():
        attrs = p.attributes or {}
        if attrs.get("sip.phoneNumber"):
            return attrs["sip.phoneNumber"]
    return None


def prewarm(proc) -> None:  # noqa: ANN001 - livekit ProcInfo
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    # Wait for the SIP participant so we can read the dialled number.
    await ctx.wait_for_participant()

    dialled = _dialled_number(ctx)
    caller = _caller_number(ctx)
    cfg = await fetch_config_for_number(dialled) if dialled else TenantAgentConfig.fallback()
    logger.info(
        "call room=%s dialled=%s tenant=%s fallback=%s",
        ctx.room.name, dialled, cfg.tenant_id, cfg.is_fallback,
    )

    call_id = await log_call_start(cfg, ctx.room.name, caller)

    session: AgentSession = AgentSession(
        userdata={},
        vad=ctx.proc.userdata.get("vad") or silero.VAD.load(),
        stt=deepgram.STT(model="nova-3", language="en-GB"),
        llm=openai.LLM(model=cfg.llm_model, temperature=cfg.temperature),
        # ---- Fish Audio TTS: the only TTS in this codebase ----
        # latency_mode defaults to 'balanced' in the plugin; 'low' is what makes
        # this feel like a real receptionist rather than a voicemail robot.
        tts=fishaudio.TTS(
            model=cfg.tts_model,
            voice_id=cfg.voice_id,
            api_key=os.environ["FISH_API_KEY"],
            latency_mode=os.environ.get("FISH_LATENCY_MODE", "low"),
        ),
    )

    # Clock starts when the caller is connected, not when the worker booted.
    started_at = datetime.now(timezone.utc)

    async def _on_shutdown() -> None:
        ended_at = datetime.now(timezone.utc)
        duration_secs = max(0, int((ended_at - started_at).total_seconds()))

        history = [
            {"role": item.role, "text": item.text_content}
            for item in session.history.items
            if getattr(item, "text_content", None)
        ]

        # Anything capture_job_details() recorded is more reliable than
        # re-reading the transcript, so feed it to the summariser.
        captured = (session.userdata or {}).get("enquiries") or []

        result = await summarise_call(history, captured)

        logger.info(
            "call ended room=%s tenant=%s duration=%ss outcome=%s",
            ctx.room.name, cfg.tenant_id, duration_secs, result.get("outcome"),
        )

        await log_call_end(
            call_id,
            history,
            summary=result.get("summary"),
            duration_secs=duration_secs,
            outcome=result.get("outcome"),
            ended_at=ended_at.isoformat(),
        )

    ctx.add_shutdown_callback(_on_shutdown)

    await session.start(
        room=ctx.room,
        agent=ReceptionistAgent(cfg),
        room_input_options=RoomInputOptions(),
    )

    await session.say(cfg.greeting, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name=os.environ.get("LIVEKIT_AGENT_NAME", "sitering-receptionist"),
        )
    )
