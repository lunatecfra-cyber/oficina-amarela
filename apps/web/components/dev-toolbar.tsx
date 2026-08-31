"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionData = Record<string, unknown> | null;

export function DevToolbar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [openTab, setOpenTab] = useState<"creation" | "tests" | "online" | "tools" | null>(null);

  const [xrayActive, setXrayActive] = useState(false);
  const [godModeActive, setGodModeActive] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGodModeActive(document.cookie.includes("dev_god_mode=true"));
  }, []);

  if (process.env.NODE_ENV !== "development" || !mounted) {
    return null;
  }

  const closeMenu = () => setOpenTab(null);
  const toggleTab = (tab: "creation" | "tests" | "online" | "tools") => {
    if (tab === "tools" && openTab !== "tools") {
      loadSession();
    }
    setOpenTab((prev) => (prev === tab ? null : tab));
  };

  const toggleXray = () => setXrayActive(!xrayActive);

  const toggleGodMode = () => {
    if (godModeActive) {
      document.cookie = "dev_god_mode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setGodModeActive(false);
    } else {
      document.cookie = "dev_god_mode=true; path=/;";
      setGodModeActive(true);
    }
    window.location.reload();
  };

  const hardReset = async () => {
    if (
      confirm("This will clear ALL LocalStorage, SessionStorage, Cookies and log out. Proceed?")
    ) {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const loadSession = async () => {
    if (sessionData) return;
    setLoadingSession(true);
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setSessionData(data);
    } catch {
      setSessionData({ error: "Failed to load local session" });
    } finally {
      setLoadingSession(false);
    }
  };

  return (
    <>
      {xrayActive && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
          * { outline: 1px solid rgba(255, 0, 0, 0.2) !important; }
          div { outline: 1px solid rgba(0, 0, 255, 0.15) !important; }
          span, a, button { outline: 1px dashed rgba(0, 255, 0, 0.35) !important; }
        `,
          }}
        />
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
        {openTab && (
          <div className="mb-3 w-[320px] rounded-xl border border-gold-lo/50 bg-ink-2/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-widest text-gold-lo">
                {openTab === "creation" && "Creation"}
                {openTab === "tests" && "Local Testing"}
                {openTab === "online" && "Online Access"}
                {openTab === "tools" && "Dev Tools"}
              </span>
              <button
                onClick={closeMenu}
                className="text-muted-2 transition-colors hover:text-white"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
              {openTab === "creation" && (
                <>
                  <div className="rounded border border-line bg-surface/50 p-2">
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      Accounts & Profiles
                    </span>
                    <Link
                      href="/criar-conta?role=spokesperson"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      ➔ Create Spokesperson
                    </Link>
                    <Link
                      href="/criar-conta?role=editor"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      ➔ Create Editor
                    </Link>
                  </div>
                  <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                    <span className="mb-2 block text-xs font-semibold text-muted">Actions</span>
                    <Link
                      href="/porta-voz/nova-pauta"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      ➔ New Mission
                    </Link>
                  </div>
                </>
              )}

              {openTab === "tests" && (
                <>
                  <div className="rounded border border-line bg-surface/50 p-2">
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      Quick Login (No Password)
                    </span>
                    <a
                      href="/api/auth/dev-login?role=spokesperson"
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      🔓 Sign in as Spokesperson
                    </a>
                    <a
                      href="/api/auth/dev-login?role=editor"
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      🔓 Sign in as Editor
                    </a>
                    <a
                      href="/api/auth/dev-login?role=admin"
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      🔓 Sign in as Admin / Inspector
                    </a>
                  </div>
                  <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                    <span className="mb-2 block text-xs font-semibold text-muted">Session</span>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full py-1 text-left text-sm text-red-400 hover:text-red-300"
                    >
                      🚪 Log Out
                    </button>
                    <Link
                      href="/api/auth/session"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      🔍 Inspect Session JSON
                    </Link>
                  </div>
                  <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                    <span className="mb-2 block text-xs font-semibold text-muted">Dashboards</span>
                    <Link
                      href="/porta-voz"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      Spokesperson Dashboard
                    </Link>
                    <Link
                      href="/editor"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      Editor Workbench
                    </Link>
                    <Link
                      href="/agenda"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      Editor Schedule
                    </Link>
                    <Link
                      href="/inspetor"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      Inspector Dashboard
                    </Link>
                    <Link
                      href="/ranking"
                      onClick={closeMenu}
                      className="block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      Leaderboard
                    </Link>
                  </div>
                </>
              )}

              {openTab === "online" && (
                <div className="rounded border border-line bg-surface/50 p-2">
                  <span className="mb-2 block text-xs font-semibold text-muted">
                    Production Hub
                  </span>
                  <a
                    href="https://yellowworkshop.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-silver hover:text-gold-hi py-1"
                  >
                    🌐 yellowworkshop.dev ↗
                  </a>
                </div>
              )}

              {openTab === "tools" && (
                <>
                  <div className="rounded border border-line bg-surface/50 p-2">
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      Master Controls
                    </span>
                    <button
                      onClick={toggleGodMode}
                      className="w-full text-left block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      {godModeActive ? "🔓 Disable God Mode" : "🔐 Enable God Mode (Bypass Auth)"}
                    </button>
                  </div>
                  <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                    <span className="mb-2 block text-xs font-semibold text-muted">
                      Layout & Caches
                    </span>
                    <button
                      onClick={toggleXray}
                      className="w-full text-left block text-sm text-silver hover:text-gold-hi py-1"
                    >
                      {xrayActive ? "🟢 X-Ray Active (Disable)" : "🔘 Enable X-Ray Mode"}
                    </button>
                    <button
                      onClick={hardReset}
                      className="w-full text-left block text-sm text-red-400 hover:text-red-300 py-1"
                    >
                      💥 Clear All (Hard Reset)
                    </button>
                  </div>
                  <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                    <span className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                      <span>Current Session</span>
                      <button
                        onClick={() => {
                          setSessionData(null);
                          loadSession();
                        }}
                        className="text-muted hover:text-silver"
                      >
                        ↻
                      </button>
                    </span>
                    <div className="max-h-40 overflow-y-auto rounded bg-ink-2 p-2 text-[10px] font-mono text-muted-2">
                      {loadingSession ? (
                        "Loading..."
                      ) : (
                        <pre>{JSON.stringify(sessionData, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto rounded-full border border-gold-lo/30 bg-surface-2/90 px-2 py-1.5 shadow-xl backdrop-blur-md">
          <div className="mr-2 flex items-center gap-2 pl-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok"></span>
            </span>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-muted-2">
              Dev
            </span>
          </div>

          <button
            onClick={() => toggleTab("creation")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              openTab === "creation"
                ? "bg-gold/20 text-gold-hi"
                : "text-muted hover:bg-surface hover:text-silver"
            }`}
          >
            Creation
          </button>
          <button
            onClick={() => toggleTab("tests")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              openTab === "tests"
                ? "bg-gold/20 text-gold-hi"
                : "text-muted hover:bg-surface hover:text-silver"
            }`}
          >
            Local Tests
          </button>
          <button
            onClick={() => toggleTab("online")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              openTab === "online"
                ? "bg-gold/20 text-gold-hi"
                : "text-muted hover:bg-surface hover:text-silver"
            }`}
          >
            Online
          </button>
          <button
            onClick={() => toggleTab("tools")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              openTab === "tools"
                ? "bg-gold/20 text-gold-hi"
                : "text-muted hover:bg-surface hover:text-silver"
            }`}
          >
            Tools
          </button>

          <Link
            href="/dev"
            title="Full Dev Page"
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-gold-hi"
          >
            ⚙️
          </Link>
        </div>
      </div>
    </>
  );
}
