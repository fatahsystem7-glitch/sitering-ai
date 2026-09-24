import { ListUpdate, RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { SipClient } from "livekit-server-sdk";
import { appOrigin } from "@/lib/env";
import { toE164 } from "@/lib/phone";
import { twilioClient } from "@/lib/telephony/sms";

const TRUNK_NAME = "sitering-inbound";
const DISPATCH_NAME = "sitering-inbound-dispatch";

export function agentName(): string {
  return process.env.LIVEKIT_AGENT_NAME?.trim() || "sitering-receptionist";
}

function sipClient(): SipClient {
  const url = process.env.LIVEKIT_URL?.trim();
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !key || !secret) {
    throw new Error("LiveKit credentials are not configured.");
  }
  const httpUrl = url.replace(/^ws/i, "http");
  return new SipClient(httpUrl, key, secret);
}

export async function ensureLivekitNumber(e164: string): Promise<{ trunkId: string; dispatchRuleId: string }> {
  const sip = sipClient();
  const trunks = await sip.listSipInboundTrunk();
  let trunk = trunks.find((item) => item.name === TRUNK_NAME) ?? trunks[0];
  if (!trunk) {
    trunk = await sip.createSipInboundTrunk(TRUNK_NAME, [e164], {
      metadata: "sitering-ai",
      krispEnabled: true,
    });
  } else if (!trunk.numbers.includes(e164)) {
    trunk = await sip.updateSipInboundTrunkFields(trunk.sipTrunkId, {
      numbers: new ListUpdate({ add: [e164] }),
    });
  }

  const rules = await sip.listSipDispatchRule();
  let rule = rules.find((item) => item.name === DISPATCH_NAME);
  if (!rule) {
    rule = await sip.createSipDispatchRule(
      { type: "individual", roomPrefix: "sitering-" },
      {
        name: DISPATCH_NAME,
        trunkIds: [trunk.sipTrunkId],
        metadata: "sitering-ai",
        roomConfig: new RoomConfiguration({
          agents: [new RoomAgentDispatch({ agentName: agentName() })],
        }),
      },
    );
  }
  return { trunkId: trunk.sipTrunkId, dispatchRuleId: rule.sipDispatchRuleId };
}

export async function purchaseUkNumber(): Promise<string> {
  const origin = appOrigin();
  if (!origin) throw new Error("Set APP_URL before buying a number, so Twilio knows where to send the call.");
  const client = twilioClient();
  const available = await client.availablePhoneNumbers("GB").local.list({
    voiceEnabled: true,
    smsEnabled: true,
    limit: 1,
  });
  const candidate = available[0]?.phoneNumber;
  if (!candidate) {
    throw new Error("Twilio has no UK local numbers available on this account right now.");
  }
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: candidate,
    voiceUrl: `${origin}/api/twilio/voice`,
    voiceMethod: "POST",
    statusCallback: `${origin}/api/twilio/status`,
    statusCallbackMethod: "POST",
  });
  const e164 = toE164(purchased.phoneNumber);
  if (!e164) throw new Error("Twilio returned a number that could not be normalised.");
  return e164;
}

export async function pointExistingNumber(e164: string): Promise<void> {
  const origin = appOrigin();
  if (!origin) return;
  const client = twilioClient();
  const matches = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
  const match = matches[0];
  if (!match) return;
  await client.incomingPhoneNumbers(match.sid).update({
    voiceUrl: `${origin}/api/twilio/voice`,
    voiceMethod: "POST",
    statusCallback: `${origin}/api/twilio/status`,
    statusCallbackMethod: "POST",
  });
}
