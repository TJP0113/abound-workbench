"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LangToggle } from "@/components/AppShell";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const { state, t, signIn, signOut, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state === "ready") router.replace("/");
  }, [state, router]);

  const onSignIn = async () => {
    setError("");
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (!code.includes("popup-closed")) setError(t("login.error"));
    } finally {
      setBusy(false);
    }
  };

  let message = "";
  if (state === "denied") message = t("login.denied");
  if (state === "inactive") message = t("login.inactive");
  if (state === "unconfigured") message = t("login.config");

  return (
    <div className="min-h-screen flex flex-col bg-nav text-white">
      <div className="flex justify-end p-4">
        <LangToggle dark />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[400px] flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-on-dark.png" alt="ABOUND CREATION" className="h-[56px] w-auto self-start" />
            <div className="text-[14px] text-[#A3A5AC]">{t("app.sub")}</div>
          </div>
          <div className="bg-white text-ink rounded-[24px] p-6 flex flex-col gap-4">
            <h1 className="m-0 text-[20px] font-bold">{t("login.title")}</h1>
            <p className="m-0 text-[14px] text-muted">{t("login.sub")}</p>
            {message && (
              <div className="text-[13px] leading-relaxed text-danger bg-danger-soft rounded-[10px] px-3 py-2.5">
                {message}
                {user?.email && <div className="mt-1 text-ink-2">{user.email}</div>}
              </div>
            )}
            {error && <div className="text-[13px] text-danger">{error}</div>}
            {state !== "unconfigured" &&
              (state === "denied" || state === "inactive" ? (
                <Button variant="secondary" onClick={() => signOut()}>
                  {t("nav.signOut")}
                </Button>
              ) : (
                <Button variant="primary" onClick={onSignIn} disabled={busy || state === "loading"}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                  </svg>
                  {t("login.button")}
                </Button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
