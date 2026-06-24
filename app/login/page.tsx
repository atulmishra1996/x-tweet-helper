import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Sparkles, CalendarClock, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";

const ERRORS: Record<string, string> = {
  x_not_configured: "X OAuth is not configured. Add X_CLIENT_ID and X_CLIENT_SECRET.",
  state_mismatch: "Login session expired. Please try again.",
  oauth_failed: "Could not complete sign-in with X. Please try again.",
  missing_params: "Sign-in was interrupted. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Sign-in failed. Please try again." : null;

  const features = [
    { icon: Sparkles, title: "AI across providers", desc: "OpenAI, Claude, Gemini & Grok — switch any time." },
    { icon: CalendarClock, title: "Create & schedule", desc: "Tweets, threads, and blogs. Post now or later." },
    { icon: BarChart3, title: "Real analytics", desc: "Engagement trends and best-time-to-post." },
    { icon: TrendingUp, title: "Grow on purpose", desc: "Track followers & subscribers; act on what works." },
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-8 py-16 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            X Growth Engine
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Twitter Helper</h1>
          <p className="mt-3 text-muted-foreground">
            Professionalize your X account. Write better, post consistently, and grow your audience with a
            data-driven feedback loop.
          </p>

          {message && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {message}
            </div>
          )}

          <Link
            href="/api/auth/x"
            className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-6 font-medium text-background transition-opacity hover:opacity-90"
          >
            <XLogo /> Continue with X
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            We request permission to read your profile and post on your behalf. Tokens are encrypted at rest.
          </p>
        </div>
      </div>

      <div className="relative hidden flex-col justify-center bg-card px-16 lg:flex">
        <div className="grid max-w-md gap-5">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <f.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
