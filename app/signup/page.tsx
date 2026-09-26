import { redirect } from "next/navigation";

/** Legacy route — the public onboarding form is the single signup path. */
export default function SignupRedirect() {
  redirect("/onboarding");
}
