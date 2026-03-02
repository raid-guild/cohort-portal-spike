"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabase/client";
import { isOnboardingComplete } from "@/lib/onboarding";

type AuthAction = "email" | "ethereum" | "solana" | null;
type FeedbackTone = "info" | "success" | "error";

export function AuthModal({
  open,
  onClose,
  nextPath,
}: {
  open: boolean;
  onClose: () => void;
  nextPath: string;
}) {
  const supabase = useMemo(() => supabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(
    null,
  );
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsMobile(isMobileBrowser());
    setCurrentUrl(window.location.href);
  }, [open]);

  useEffect(() => {
    if (!open || emailCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setEmailCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailCooldown, open]);

  const routeAfterSession = useCallback(
    async (session: Session) => {
      const { data } = await supabase
        .from("profiles")
        .select("handle, display_name, bio, skills, roles")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const complete = isOnboardingComplete({
        handle: data?.handle ?? "",
        displayName: data?.display_name ?? "",
        bio: data?.bio ?? "",
        skills: data?.skills ?? [],
        roles: data?.roles ?? [],
      });

      const target = complete ? sanitizeNext(nextPath) : "/me?onboarding=1";
      const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      onClose();
      if (target !== current) {
        router.replace(target);
      }
    },
    [nextPath, onClose, pathname, router, searchParams, supabase],
  );

  useEffect(() => {
    if (!open) return;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) return;
        void routeAfterSession(session);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [open, routeAfterSession, supabase]);

  const handleEmailSignIn = async () => {
    const nextEmail = email.trim();
    if (!nextEmail) {
      setFeedback({ tone: "error", text: "Enter an email address to continue." });
      return;
    }
    if (emailCooldown > 0) {
      return;
    }
    setAuthAction("email");
    setLoading(true);
    setFeedback({ tone: "info", text: "Sending magic link..." });
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: { emailRedirectTo: redirectTo },
    });
    setAuthAction(null);
    setLoading(false);
    if (error) {
      setFeedback({ tone: "error", text: error.message });
      return;
    }
    setMagicLinkEmail(nextEmail);
    setEmailCooldown(30);
    setFeedback({
      tone: "success",
      text: `Magic link sent to ${nextEmail}. Check inbox and spam, then click the link to finish sign-in.`,
    });
  };

  const handleWeb3SignIn = async (chain: "ethereum" | "solana") => {
    const action = chain === "ethereum" ? "ethereum" : "solana";
    setAuthAction(action);
    setLoading(true);
    setFeedback({ tone: "info", text: "Opening wallet request..." });
    const wallet = chain === "ethereum" ? resolveEthereumWallet() : null;
    if (chain === "ethereum" && !wallet) {
      setLoading(false);
      setAuthAction(null);
      setFeedback({
        tone: "error",
        text:
        isMobileBrowser()
          ? "No Ethereum wallet was detected in this browser. Open this page in your wallet app browser (MetaMask/Coinbase Wallet) and try again."
          : "No Ethereum wallet was detected. Install or unlock MetaMask/Coinbase Wallet and try again.",
      });
      return;
    }

    // @ts-ignore - Supabase types are out of date for this helper.
    const { error } = await supabase.auth.signInWithWeb3({
      chain,
      statement: "I accept the RaidGuild Cohort Portal terms of service.",
      options: {
        url: window.location.href,
      },
      ...(wallet ? { wallet } : {}),
    });
    setAuthAction(null);
    setLoading(false);
    if (error) {
      setFeedback({ tone: "error", text: error.message });
      return;
    }
    setFeedback({
      tone: "info",
      text: "Wallet request opened. Approve it in your wallet to continue.",
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign in"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use email magic link or a Web3 wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Email</label>
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (feedback?.tone === "error") {
                setFeedback(null);
              }
            }}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            No password needed. We will email you a secure sign-in link.
          </p>
          <button
            type="button"
            onClick={handleEmailSignIn}
            className={buttonClass}
            disabled={loading || !email || emailCooldown > 0}
          >
            {authAction === "email"
              ? "Sending..."
              : emailCooldown > 0
                ? `Resend in ${emailCooldown}s`
                : magicLinkEmail
                  ? "Resend magic link"
                  : "Send magic link"}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Web3 Wallet</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleWeb3SignIn("ethereum")}
              className={buttonClass}
              disabled={loading}
            >
              {authAction === "ethereum" ? "Opening wallet..." : "Sign in with Ethereum"}
            </button>
            <button
              type="button"
              onClick={() => handleWeb3SignIn("solana")}
              className={buttonClass}
              disabled={loading}
            >
              {authAction === "solana" ? "Opening wallet..." : "Sign in with Solana"}
            </button>
          </div>
          {isMobile ? (
            <div className="text-xs text-muted-foreground">
              Ethereum mobile sign-in works best inside a wallet browser.{" "}
              {currentUrl ? (
                <>
                  <a
                    href={buildMetaMaskDappLink(currentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Open in MetaMask
                  </a>
                  {" · "}
                  <a
                    href={buildCoinbaseDappLink(currentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Open in Coinbase Wallet
                  </a>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {feedback ? (
          <div
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live={feedback.tone === "error" ? "assertive" : "polite"}
            className={feedbackClassByTone[feedback.tone]}
          >
            <p>{feedback.text}</p>
            {feedback.tone === "success" && magicLinkEmail ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                <li>Open {magicLinkEmail} inbox.</li>
                <li>Click the sign-in link in the email.</li>
                <li>Return here and continue.</li>
              </ol>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const buttonClass =
  "inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

const feedbackClassByTone: Record<FeedbackTone, string> = {
  info: "rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-sm text-sky-900",
  success:
    "rounded-lg border border-emerald-400 bg-emerald-100 px-3 py-2 text-sm text-emerald-900",
  error: "rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm text-rose-900",
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
};

function resolveEthereumWallet() {
  if (typeof window === "undefined") return null;
  const injected = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!injected) return null;

  const providers = Array.isArray(injected.providers) ? injected.providers : [injected];
  const provider =
    providers.find((item) => typeof item?.request === "function" && item.isMetaMask) ??
    providers.find((item) => typeof item?.request === "function" && item.isCoinbaseWallet) ??
    providers.find((item) => typeof item?.request === "function") ??
    null;

  return provider;
}

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function buildMetaMaskDappLink(url: string) {
  if (!url) return "https://metamask.app.link/";
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://metamask.app.link/dapp/${stripped}`;
}

function buildCoinbaseDappLink(url: string) {
  if (!url) return "https://go.cb-w.com/";
  return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`;
}

function sanitizeNext(raw: string) {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth/callback")) return "/";
  return raw;
}
