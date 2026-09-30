"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  CircleDot,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Save,
  Settings2,
  Square,
  Users,
} from "lucide-react";
import { Room, RoomEvent, createLocalAudioTrack, type LocalAudioTrack } from "livekit-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FISH_LATENCY_MODES,
  GREETING_STYLES,
  LLM_MODELS,
  STT_MODELS,
  TTS_PROVIDERS,
  type TtsProviderId,
} from "@/lib/voice/options";
import type { VoiceProviderSettings } from "@/lib/supabase/types";

/* ─── Types ─────────────────────────────────────────────────────────── */

export type VoiceClientRow = {
  id: string;
  business_name: string;
  owner_name: string;
  trade_type: string | null;
  operating_hours: string | null;
  services_offered: string[];
  greeting_style: string | null;
  custom_instructions: string | null;
  service_areas: string | null;
  callout_fee: string | null;
  assigned_phone_number: string | null;
  twilio_bundle_status: string;
  onboarding_status: string;
  updated_at: string;
};

type SessionStatus = "idle" | "connecting" | "live" | "ended" | "error";

type StudioEvent = {
  id: number;
  kind: "info" | "saved" | "error";
  text: string;
  at: string;
};

type Props = {
  clients: VoiceClientRow[];
  settings: VoiceProviderSettings;
  livekitConfigured: boolean;
};

/* ─── Component ─────────────────────────────────────────────────────── */

export function VoiceConfigStudio({ clients, settings: initialSettings, livekitConfigured }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [client, setClient] = useState<VoiceClientRow | null>(clients[0] ?? null);
  const [clientLoading, setClientLoading] = useState(false);

  const [settings, setSettings] = useState<VoiceProviderSettings>(initialSettings);
  const [ttsProviderId, setTtsProviderId] = useState<TtsProviderId>(initialSettings.tts_provider);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const micRef = useRef<LocalAudioTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const eventSeq = useRef(0);
  const activeClientRef = useRef<string>("");

  activeClientRef.current = clientId;

  const logEvent = useCallback((kind: StudioEvent["kind"], text: string) => {
    eventSeq.current += 1;
    setEvents((prev) =>
      [
        ...prev,
        {
          id: eventSeq.current,
          kind,
          text,
          at: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        },
      ].slice(-60),
    );
  }, []);

  /* ── Client selection ─────────────────────────────────────────── */

  async function selectClient(id: string) {
    setClientId(id);
    setFormMessage(null);
    const known = clients.find((c) => c.id === id) ?? null;
    setClient(known);
    setClientLoading(true);
    try {
      const res = await fetch(`/api/admin/voice/config?client_id=${id}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.client) setClient(json.client as VoiceClientRow);
    } catch {
      /* the locally-known row is already shown */
    } finally {
      setClientLoading(false);
    }
  }

  /* ── Live session ─────────────────────────────────────────────── */

  const handleData = useCallback(
    (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as {
          type: string;
          changes?: Record<string, unknown>;
          text?: string;
        };

        if (message.type === "config.update" && message.changes) {
          const pretty = Object.entries(message.changes)
            .map(([key, value]) => `${humanize(key)}: ${formatValue(value)}`)
            .join(" · ");
          logEvent("saved", `Saved to Supabase — ${pretty || "no changes"}`);

          // Live-merge into the panel and re-select fresh data.
          setClient((prev) =>
            prev
              ? {
                  ...prev,
                  ...(message.changes as Partial<VoiceClientRow>),
                }
              : prev,
          );
          void refreshClient();
        } else if (message.text) {
          logEvent("info", message.text);
        }
      } catch {
        /* non-JSON data message — ignore */
      }
    },
    [logEvent],
  );

  async function refreshClient() {
    const id = activeClientRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/voice/config?client_id=${id}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.client) setClient(json.client as VoiceClientRow);
    } catch {
      /* keep the optimistic merge */
    }
  }

  async function startSession() {
    if (!clientId) return;
    setStatus("connecting");
    setStatusMessage(null);
    setEvents([]);
    logEvent("info", "Requesting a live voice session…");

    try {
      const res = await fetch("/api/admin/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Could not start the session.");
      }
      if (Array.isArray(json.warnings)) {
        json.warnings.forEach((w: string) => logEvent("error", w));
      }

      const { url, token, room: roomName, dispatched } = json as {
        url: string;
        token: string;
        room: string;
        dispatched: boolean;
      };

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.DataReceived, (payload) => handleData(payload as unknown as Uint8Array));

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio" && audioRef.current) {
          audioRef.current.srcObject = new MediaStream([track.mediaStreamTrack]);
          audioRef.current.play().catch(() => /* autoplay blocked until a click */ {});
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeaking(speakers.length > 0);
      });

      room.on(RoomEvent.Disconnected, () => {
        setStatus((prev) => (prev === "live" ? "ended" : prev));
        setSpeaking(false);
      });

      await room.connect(url, token);
      logEvent("info", `Connected to room ${roomName}${dispatched ? "" : " (agent dispatch unconfirmed)"}.`);
      logEvent("info", "Speak naturally — confirm each detail and it saves instantly.");

      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
      });
      micRef.current = mic;
      await room.localParticipant.publishTrack(mic);
      setMicMuted(false);
      setStatus("live");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The session could not start.";
      setStatus("error");
      setStatusMessage(message);
      logEvent("error", message);
      await teardown();
    }
  }

  async function teardown() {
    micRef.current?.stop();
    micRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    await roomRef.current?.disconnect().catch(() => undefined);
    roomRef.current = null;
  }

  async function endSession() {
    await teardown();
    setStatus("ended");
    setSpeaking(false);
  }

  function toggleMic() {
    const mic = micRef.current;
    if (!mic) return;
    if (mic.isMuted) {
      mic.unmute();
      setMicMuted(false);
    } else {
      mic.mute();
      setMicMuted(true);
    }
  }

  useEffect(() => {
    return () => {
      // Unmount safety: never leave the mic open.
      micRef.current?.stop();
      void roomRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  /* ── Manual save ───────────────────────────────────────────────── */

  async function saveManual(form: FormData) {
    if (!clientId) return;
    setFormBusy(true);
    setFormMessage(null);
    try {
      const services = String(form.get("services") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/voice/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          business_name: String(form.get("business_name") ?? "").trim(),
          operating_hours: String(form.get("operating_hours") ?? "").trim(),
          greeting_style: String(form.get("greeting_style") ?? "").trim(),
          custom_instructions: String(form.get("custom_instructions") ?? "").trim(),
          service_areas: String(form.get("service_areas") ?? "").trim(),
          callout_fee: String(form.get("callout_fee") ?? "").trim(),
          ...(services.length > 0 ? { services } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed.");
      setClient(json.client as VoiceClientRow);
      setFormMessage("Saved to the client's record.");
      logEvent("saved", "Manual edit saved to Supabase.");
    } catch (cause) {
      setFormMessage(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  /* ── Provider settings save ────────────────────────────────────── */

  async function saveSettings(form: FormData) {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/admin/voice/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tts_provider: String(form.get("tts_provider") ?? settings.tts_provider),
          tts_model: String(form.get("tts_model") ?? settings.tts_model),
          tts_voice: String(form.get("tts_voice") ?? ""),
          stt_model: String(form.get("stt_model") ?? settings.stt_model),
          llm_model: String(form.get("llm_model") ?? settings.llm_model),
          fish_latency_mode: String(form.get("fish_latency_mode") ?? settings.fish_latency_mode),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed.");
      setSettings(json.settings as VoiceProviderSettings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const ttsProvider = TTS_PROVIDERS.find((p) => p.id === ttsProviderId) ?? TTS_PROVIDERS[0];
  const ttsModelKnown = ttsProvider.models.some((m) => m.id === settings.tts_model);
  const sessionLive = status === "live" || status === "connecting";

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.business_name.localeCompare(b.business_name)),
    [clients],
  );

  if (clients.length === 0) {
    return (
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={18} className="text-violet-400" /> No client accounts yet
          </CardTitle>
          <CardDescription>
            Once a contractor completes the onboarding form their account appears
            here, ready to be configured by voice.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <audio ref={audioRef} className="hidden" />

      {/* ── Session card ── */}
      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio size={18} className="text-violet-400" />
            Live voice configuration session
          </CardTitle>
          <CardDescription>
            Launch a WebRTC session and configure the receptionist by talking.
            Each parameter is confirmed back to you and saved the moment you
            agree — no forms, no ceremony.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client account</Label>
              <Select
                value={clientId}
                onValueChange={selectClient}
                disabled={sessionLive}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client account" />
                </SelectTrigger>
                <SelectContent>
                  {sortedClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.business_name}
                      {c.assigned_phone_number ? ` · ${c.assigned_phone_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {status === "live" ? (
                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={toggleMic}
                  >
                    {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    {micMuted ? "Unmute" : "Mute"}
                  </Button>
                  <Button type="button" variant="destructive" className="flex-1" onClick={endSession}>
                    <Square size={16} /> End session
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  disabled={!clientId || status === "connecting" || !livekitConfigured}
                  onClick={startSession}
                >
                  {status === "connecting" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <AudioLines size={16} />
                  )}
                  {status === "connecting" ? "Connecting…" : "Launch live voice session"}
                </Button>
              )}
            </div>
          </div>

          {!livekitConfigured && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-300">
              LiveKit is not configured on this deployment. Set LIVEKIT_URL,
              LIVEKIT_API_KEY and LIVEKIT_API_SECRET, then run the voice agent
              with <code className="font-mono">npm run agent</code> to enable
              live sessions.
            </p>
          )}
          {statusMessage && status === "error" && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {statusMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge
              variant={status === "live" ? "default" : "secondary"}
              className={cn(
                "gap-1.5",
                status === "live" && "bg-emerald-500 text-emerald-950",
              )}
            >
              <CircleDot
                size={12}
                className={cn(status === "live" && "animate-pulse")}
              />
              {status === "live" ? "Session live" : "No session"}
            </Badge>
            {status === "live" && (
              <span className="text-xs text-muted-foreground">
                {speaking ? "Agent is speaking…" : micMuted ? "Your mic is muted" : "Listening…"}
              </span>
            )}
            {client && (
              <span className="text-xs text-muted-foreground">
                Configuring: <strong className="text-foreground">{client.business_name}</strong>
              </span>
            )}
          </div>

          {events.length > 0 && (
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-3.5 font-mono text-xs">
              {events.map((e) => (
                <p
                  key={e.id}
                  className={cn(
                    "flex gap-2",
                    e.kind === "saved" && "text-emerald-400",
                    e.kind === "error" && "text-red-400",
                    e.kind === "info" && "text-muted-foreground",
                  )}
                >
                  <span className="text-muted-foreground/60">{e.at}</span>
                  <span>{e.text}</span>
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Receptionist parameters ── */}
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 size={18} className="text-violet-400" />
              Receptionist parameters
              {clientLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription>
              Live values for the selected account — updated automatically as
              you confirm them in the voice session, or edit and save by hand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {client ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveManual(new FormData(e.currentTarget));
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="business_name">Business name</Label>
                  <Input
                    id="business_name"
                    name="business_name"
                    key={`bn-${client.id}-${client.business_name}`}
                    defaultValue={client.business_name}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="operating_hours">Operating hours</Label>
                    <Input
                      id="operating_hours"
                      name="operating_hours"
                      key={`oh-${client.id}-${client.operating_hours}`}
                      defaultValue={client.operating_hours ?? ""}
                      placeholder="Mon–Fri 8am–6pm, emergencies 24/7"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="greeting_style">Greeting style</Label>
                    <Select
                      name="greeting_style"
                      defaultValue={client.greeting_style ?? GREETING_STYLES[0]}
                      key={`gs-${client.id}-${client.greeting_style}`}
                    >
                      <SelectTrigger id="greeting_style">
                        <SelectValue placeholder="Pick a tone" />
                      </SelectTrigger>
                      <SelectContent>
                        {GREETING_STYLES.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="services">Services — one per line</Label>
                  <Textarea
                    id="services"
                    name="services"
                    rows={4}
                    key={`sv-${client.id}-${client.services_offered.join("|")}`}
                    defaultValue={client.services_offered.join("\n")}
                    placeholder={"Emergency callouts\nRepairs & maintenance\nQuotes & surveys"}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="service_areas">Service areas</Label>
                    <Input
                      id="service_areas"
                      name="service_areas"
                      key={`sa-${client.id}-${client.service_areas}`}
                      defaultValue={client.service_areas ?? ""}
                      placeholder="Leeds, Bradford, Wakefield"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="callout_fee">Callout fee</Label>
                    <Input
                      id="callout_fee"
                      name="callout_fee"
                      key={`cf-${client.id}-${client.callout_fee}`}
                      defaultValue={client.callout_fee ?? ""}
                      placeholder="£75 + VAT"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom_instructions">Extra instructions</Label>
                  <Textarea
                    id="custom_instructions"
                    name="custom_instructions"
                    rows={3}
                    key={`ci-${client.id}-${client.custom_instructions}`}
                    defaultValue={client.custom_instructions ?? ""}
                    placeholder="Anything the receptionist must know or never promise."
                  />
                </div>

                {formMessage && (
                  <p className="text-sm text-muted-foreground">{formMessage}</p>
                )}

                <Button type="submit" disabled={formBusy}>
                  {formBusy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save to client record
                </Button>
              </form>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Select a client account above.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Modular provider settings ── */}
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AudioLines size={18} className="text-violet-400" />
              Voice pipeline providers
            </CardTitle>
            <CardDescription>
              The modular stack the agent assembles itself from at the start of
              every session. Applies to both customer calls and this studio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSettings(new FormData(e.currentTarget));
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tts_provider">Speech (TTS) provider</Label>
                  <Select
                    name="tts_provider"
                    value={ttsProviderId}
                    onValueChange={(v) => setTtsProviderId(v as TtsProviderId)}
                  >
                    <SelectTrigger id="tts_provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ttsProvider.description}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tts_model">TTS model</Label>
                  <Select
                    name="tts_model"
                    defaultValue={ttsModelKnown ? settings.tts_model : ttsProvider.models[0].id}
                    key={ttsProviderId}
                  >
                    <SelectTrigger id="tts_model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ttsProvider.models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stt_model">Listening (STT) model</Label>
                  <Select name="stt_model" defaultValue={settings.stt_model}>
                    <SelectTrigger id="stt_model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STT_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm_model">Conversation (LLM) model</Label>
                  <Select name="llm_model" defaultValue={settings.llm_model}>
                    <SelectTrigger id="llm_model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fish_latency_mode">Fish Audio latency mode</Label>
                  <Select name="fish_latency_mode" defaultValue={settings.fish_latency_mode}>
                    <SelectTrigger id="fish_latency_mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FISH_LATENCY_MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tts_voice">TTS voice (optional)</Label>
                  <Input
                    id="tts_voice"
                    name="tts_voice"
                    defaultValue={settings.tts_voice ?? ""}
                    placeholder="Fish voice clone id — blank for default"
                  />
                </div>
              </div>

              {settingsError && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  {settingsError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={settingsSaving}>
                  {settingsSaving ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : settingsSaved ? (
                    <Check size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  {settingsSaved ? "Saved" : settingsSaving ? "Saving…" : "Save provider settings"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Applied from the next session onward.
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bTts\b/g, "TTS");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "(cleared)";
  return String(value);
}
