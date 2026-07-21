"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMansePlayer, type MansePlayer, type PlayerSnapshot, type ProviderKind } from "@manse/runtime-web";
import { GAME_CONFIG, type GameLocale } from "./game-config";

const PACK_URL = `/packs/${GAME_CONFIG.slug}/manse.pack.json`;
const EMPTY: Pick<PlayerSnapshot, "phase" | "provider" | "tier" | "renderer" | "cameraActive" | "targetProgress" | "caption"> = {
  phase: "idle",
  provider: "simulated",
  tier: "A",
  renderer: null,
  cameraActive: false,
  targetProgress: null,
  caption: null,
};

const UI_COPY = {
  ko: {
    kicker: "Manse 독립 게임",
    privacy: "카메라 영상은 이 기기에만 머물러요 · 계정 불필요 · 분석 도구 없음",
    language: "언어",
    player: "반짝별 잡기 게임 플레이어",
    stage: "모션 게임 플레이 영역",
    needsAttention: "확인이 필요해요",
    starting: "시작하는 중",
    complete: "완료",
    chooseMode: "플레이 방법을 선택하세요",
    cameraLocal: "카메라는 기기 안에서만 작동해요",
    simulatorLive: "포인터 시뮬레이터 실행 중",
    runtimeReady: "런타임 준비됨",
    tier: "등급",
    startIntro: "먼저 포인터로 시작해 보세요. 카메라 모드는 선택 사항이며, 직접 선택한 뒤에만 권한을 요청해요.",
    playPointer: "포인터로 플레이",
    useCamera: "카메라 사용",
    comfort: "안전하고 편안하게 움직일 수 있는 공간을 골라 주세요.",
    restartPointer: "포인터로 다시 시작",
    switchCamera: "카메라로 전환",
    startError: "게임을 시작할 수 없어요. 다시 시도해 주세요.",
    footer: "Manse가 만들었으며 오픈 소스 Manse 엔진으로 작동합니다. 움직임이 불편하면 언제든 멈추세요.",
    source: "소스 보기 ↗",
  },
  en: {
    kicker: "Independent Manse game",
    privacy: "Camera stays on this device · no account · no analytics",
    language: "Language",
    player: "Morning Star Catch game player",
    stage: "Interactive motion game stage",
    needsAttention: "Needs attention",
    starting: "Starting",
    complete: "Complete",
    chooseMode: "Choose how to play",
    cameraLocal: "Camera stays on device",
    simulatorLive: "Pointer simulator live",
    runtimeReady: "Runtime ready",
    tier: "tier",
    startIntro: "Start with the pointer simulator. Camera mode is optional and asks permission only after you choose it.",
    playPointer: "Play with pointer",
    useCamera: "Use my camera",
    comfort: "Choose a private, comfortable play space.",
    restartPointer: "Restart with pointer",
    switchCamera: "Switch to camera",
    startError: "The game could not start. Please try again.",
    footer: "Created by Manse and powered by the open-source Manse engine. Stop whenever movement feels uncomfortable.",
    source: "View source ↗",
  },
} as const;

function isGameLocale(value: string | null): value is GameLocale {
  return value === "ko" || value === "en";
}

export function GameClient() {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MansePlayer | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);
  const [locale, setLocale] = useState<GameLocale>(GAME_CONFIG.defaultLocale);
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = UI_COPY[locale];
  const localizedGame = GAME_CONFIG.localized[locale];

  const boot = useCallback(async (provider: ProviderKind) => {
    const container = stageRef.current;
    if (container === null) return;
    const runId = ++runIdRef.current;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const previousPlayer = playerRef.current;
    playerRef.current = null;
    if (previousPlayer !== null) await previousPlayer.destroy().catch(() => undefined);
    if (runId !== runIdRef.current) return;

    const player = createMansePlayer({
      container,
      locale,
      provider,
      captions: true,
      reducedStimulation: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onEvent: (event) => {
        if (runId !== runIdRef.current) return;
        if (event.type === "error") setError(copy.startError);
      },
    });
    playerRef.current = player;
    unsubscribeRef.current = player.subscribe((next) => {
      if (runId === runIdRef.current) setSnapshot(next);
    });
    try {
      await player.load(PACK_URL);
      await player.setup();
      await player.play();
    } catch {
      if (runId === runIdRef.current) setError(copy.startError);
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  }, [copy.startError, locale]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    let storedLocale: string | null = null;
    try {
      storedLocale = window.localStorage.getItem("manse-locale");
    } catch {
      // The browser language remains a safe fallback if storage is unavailable.
    }
    const browserLocale: GameLocale = navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
    const preferredLocale = isGameLocale(storedLocale) ? storedLocale : browserLocale;
    setLocale(preferredLocale);
    document.documentElement.lang = preferredLocale;

    return () => {
      runIdRef.current += 1;
      unsubscribeRef.current?.();
      const currentPlayer = playerRef.current;
      playerRef.current = null;
      if (currentPlayer !== null) void currentPlayer.destroy().catch(() => undefined);
    };
  }, []);

  const switchLocale = async (nextLocale: GameLocale) => {
    if (nextLocale === locale || busy) return;
    setBusy(true);
    setError(null);
    const runId = ++runIdRef.current;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const currentPlayer = playerRef.current;
    playerRef.current = null;
    if (currentPlayer !== null) await currentPlayer.destroy().catch(() => undefined);
    if (runId !== runIdRef.current) return;

    setSnapshot({ ...EMPTY });
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    try {
      window.localStorage.setItem("manse-locale", nextLocale);
    } catch {
      // Locale selection still works when storage is blocked.
    }
    setBusy(false);
  };

  const start = (provider: ProviderKind) => {
    setBusy(true);
    setError(null);
    void boot(provider);
  };

  const movePointer = (clientX: number, clientY: number) => {
    if (busy || snapshot.provider !== "simulated") return;
    const bounds = stageRef.current?.getBoundingClientRect();
    if (bounds === undefined || bounds.width === 0 || bounds.height === 0) return;
    try {
      playerRef.current?.setPointer((clientX - bounds.left) / bounds.width, (clientY - bounds.top) / bounds.height);
    } catch {
      // Mode changes can overlap one final pointer event.
    }
  };

  const progress = snapshot.targetProgress;
  const status = error !== null
    ? copy.needsAttention
    : busy
      ? copy.starting
      : snapshot.phase === "complete"
        ? copy.complete
        : snapshot.phase === "idle"
          ? copy.chooseMode
          : snapshot.cameraActive
            ? copy.cameraLocal
            : copy.simulatorLive;

  return (
    <main>
      <header className="game-hero">
        <div className="hero-topline">
          <p className="kicker">{copy.kicker}</p>
          <div className="locale-switcher" role="group" aria-label={copy.language}>
            <span>{copy.language}</span>
            <button
              type="button"
              className={locale === "ko" ? "active" : undefined}
              aria-pressed={locale === "ko"}
              disabled={busy}
              onClick={() => void switchLocale("ko")}
              lang="ko"
            >
              KO
            </button>
            <button
              type="button"
              className={locale === "en" ? "active" : undefined}
              aria-pressed={locale === "en"}
              disabled={busy}
              onClick={() => void switchLocale("en")}
              lang="en"
            >
              EN
            </button>
          </div>
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>{localizedGame.title}</h1>
            <p className="summary">{localizedGame.summary}</p>
            <div className="privacy-line"><span aria-hidden="true" /> {copy.privacy}</div>
          </div>
          <figure className="hero-art">
            <img
              src={GAME_CONFIG.heroImageUrl}
              width="1672"
              height="941"
              alt={localizedGame.heroAlt}
            />
          </figure>
        </div>
      </header>

      <section className="player-shell" aria-label={copy.player}>
        <div className="player-bar">
          <span><i className={error === null ? "status-dot" : "status-dot status-error"} aria-hidden="true" /> {status}</span>
          <span>{snapshot.renderer ?? copy.runtimeReady} · {copy.tier} {snapshot.tier}</span>
        </div>
        <div
          className="stage"
          ref={stageRef}
          onPointerDown={(event) => {
            // Let clicks on interactive children through instead of retargeting them to the stage.
            if ((event.target as HTMLElement).closest("button, a")) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            movePointer(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => movePointer(event.clientX, event.clientY)}
          aria-label={copy.stage}
        >
          {snapshot.phase === "idle" && (
            <div className="start-card">
              <p>{copy.startIntro}</p>
              <div className="actions">
                <button type="button" onClick={() => start("simulated")} disabled={busy}>{copy.playPointer}</button>
                <button className="secondary" type="button" onClick={() => start("mediapipe")} disabled={busy}>{copy.useCamera}</button>
              </div>
            </div>
          )}
        </div>
        <div className="player-footer" aria-live="polite">
          <span role={error === null ? undefined : "alert"}>{error ?? snapshot.caption ?? copy.comfort}</span>
          <strong>{progress === null ? "—" : `${progress.completed} / ${progress.total}`}</strong>
        </div>
        {snapshot.phase !== "idle" && (
          <div className="restart-row">
            <button type="button" onClick={() => start("simulated")} disabled={busy}>{copy.restartPointer}</button>
            <button className="text-button" type="button" onClick={() => start("mediapipe")} disabled={busy}>{copy.switchCamera}</button>
          </div>
        )}
      </section>

      <footer>
        <p>{copy.footer}</p>
        <a href={GAME_CONFIG.sourceUrl}>{copy.source}</a>
      </footer>
    </main>
  );
}
