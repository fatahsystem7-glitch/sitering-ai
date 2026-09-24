import { appOrigin } from "@/lib/env";

export function twilioRequestUrl(request: Request, path: string): string {
  const configured = appOrigin();
  if (configured) return `${configured}${path}`;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}${path}`;
  return request.url;
}
