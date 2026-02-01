// main.js
import { MemoryGame } from "./games/memory.js";
import { NTDGame } from "./games/ntd.js";
import { CoinTossGame } from "./games/cointoss.js";

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Screen DOM
  // =========================
  const screens = {
    start: document.getElementById("startScreen"),
    help: document.getElementById("helpScreen"),
    game: document.getElementById("gameScreen"),
    result: document.getElementById("resultScreen"),
  };

  const board = document.getElementById("board");
  const countdownEl = document.getElementById("countdown");
  const missArea = document.getElementById("missArea");

  const resultText = document.getElementById("resultText");
  const resultMode = document.getElementById("resultMode");
  const resultPoints = document.getElementById("resultPoints"); // あれば使う
  const timeText = document.getElementById("timeText");

  // footer buttons
  const shotBtn = document.getElementById("shotBtn");
  const helpBtn = document.getElementById("helpBtn");
  const donateBtn = document.getElementById("donateBtn");
  const soundBtn = document.getElementById("soundBtn");

  // help/result buttons
  const backFromHelpBtn = document.getElementById("backFromHelp");
  const backBtn = document.getElementById("backBtn");
  const retryBtn = document.getElementById("retryBtn");

  // basic guard
  if (!screens.start || !screens.game || !board || !countdownEl) {
    alert("必要なHTML idが見つかりません（startScreen/gameScreen/board/countdown）");
    return;
  }

  function setScreen(name) {
    Object.values(screens).forEach((s) => s && s.classList.add("hidden"));
    screens[name]?.classList.remove("hidden");
  }

  // =========================
  // Points (localStorage)
  // =========================
  const LS_POINTS = "qv_points";

  function readInt(key, fallback = 0) {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }
  function writeInt(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }

  let totalPoints = readInt(LS_POINTS, 0);

  // =========================
  // Sound Enabled toggle
  // =========================
  let soundEnabled = true;
  try {
    const saved = localStorage.getItem("soundEnabled");
    if (saved !== null) soundEnabled = saved === "1";
  } catch {}

  function renderSoundIcon() {
    if (!soundBtn) return;
    soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
  }
  renderSoundIcon();

  // =========================
  // SFX (HTMLAudio stable)
  // =========================
  const SFX = {
    beep: new Audio("sound/beep.wav"),
    beep2: new Audio("sound/beep2.wav"),
    go: new Audio("sound/go.wav"),
  };
  Object.values(SFX).forEach((a) => {
    a.preload = "auto";
    a.volume = 1.0;
  });

  let audioUnlocked = false;

  function ensureAudioUnlocked() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // iOS解錠：beepを無音で一瞬再生して止める（goは鳴らさない）
    const a = SFX.beep;
    const v = a.volume;
    a.volume = 0.0;
    try {
      a.currentTime = 0;
    } catch {}
    a.play()
      .then(() => {
        a.pause();
        try {
          a.currentTime = 0;
        } catch {}
        a.volume = v;
      })
      .catch(() => {
        a.volume = v;
      });
  }

  function playSfx(key) {
    if (!soundEnabled) return;
    const base = SFX[key];
    if (!base) return;

    // cloneで同時再生や連打に強くする
    const a = base.cloneNode();
    a.volume = base.volume;
    try {
      a.currentTime = 0;
    } catch {}
    a.play().catch(() => {});
  }

  // =========================
  // Countdown (drift correction)
  // =========================
  let countdownRunning = false;
  let countdownRAF = 0;
  let countdownFinishTimer = 0;

  function cancelCountdown() {
    if (countdownRAF) cancelAnimationFrame(countdownRAF);
    countdownRAF = 0;
    if (countdownFinishTimer) clearTimeout(countdownFinishTimer);
    countdownFinishTimer = 0;
    countdownRunning = false;
  }

  function startCountdown(onFinish) {
    cancelCountdown();
    countdownRunning = true;

    setScreen("game");
    board.innerHTML = "";
    if (missArea) missArea.textContent = "";

    countdownEl.classList.remove("hidden");

    const seq = [3, 2, 1, 0];
    const t0 = performance.now();
    let last = null;

    const tick = () => {
      if (!countdownRunning) return;

      const elapsed = (performance.now() - t0) / 1000;
      const idx = Math.min(3, Math.floor(elapsed));
      const show = seq[idx];

      if (show !== last) {
        countdownEl.textContent = String(show);
        last = show;
        if (show === 0) playSfx("beep2");
        else playSfx("beep");
      }

      // 0を少し見せてから開始
      if (show === 0 && elapsed >= 3.05) {
        countdownFinishTimer = setTimeout(() => {
          if (!countdownRunning) return;
          countdownEl.classList.add("hidden");
          countdownRunning = false;
          onFinish?.();
        }, 180);
        return;
      }

      countdownRAF = requestAnimationFrame(tick);
    };

    // 初回表示を即出す（tick内で鳴る）
    tick();
  }

  // =========================
  // Game switcher
  // =========================
  const games = {
    easy: MemoryGame,
    normal: MemoryGame,
    hard: MemoryGame,
    destroy: NTDGame,
    cointoss: CoinTossGame,
  };

  let currentMode = "easy";
  let currentGame = null;

  function modeLabel(mode) {
    if (mode === "easy") return "EASY";
    if (mode === "normal") return "NORMAL";
    if (mode === "hard") return "HARD";
    if (mode === "destroy") return "NT-D";
    if (mode === "cointoss") return "COIN TOSS";
    return String(mode || "");
  }

  function goStart() {
    cancelCountdown();
    if (currentGame?.destroy) currentGame.destroy(ctx);
    board.innerHTML = "";
    setScreen("start");
  }

  // =========================
  // ctx: games API
  // =========================
  const ctx = {
    board,
    missArea,

    setScreen,
    goStart,

    ensureAudioUnlocked,
    playSfx,

    getMode() {
      return currentMode;
    },

    // ---- Points API ----
    addPoints(n) {
      const add = Number(n) || 0;
      totalPoints += add;
      writeInt(LS_POINTS, totalPoints);
      return totalPoints;
    },
    getPoints() {
      return totalPoints;
    },
    showPointGain(n) {
      const gain = Number(n) || 0;
      if (!gain) return;

      const el = document.createElement("div");
      el.textContent = `+${gain} P`;
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.top = "18%";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 14px";
      el.style.borderRadius = "14px";
      el.style.background = "rgba(0,0,0,0.72)";
      el.style.border = "1px solid rgba(255,255,255,0.18)";
      el.style.color = "#ffd36a";
      el.style.fontWeight = "900";
      el.style.letterSpacing = "0.06em";
      el.style.zIndex = "99999";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);

      setTimeout(() => el.remove(), 1100);
    },

    // ---- Result UI ----
    showResult({ title, timeSec, mode, pointsEarned = 0 }) {
      const m = mode || currentMode;

      if (resultMode) resultMode.textContent = modeLabel(m);
      if (resultText) resultText.textContent = title || "";
      if (timeText) timeText.textContent = timeSec ? `TIME : ${timeSec}s` : "";

      const p = Number(pointsEarned) || 0;

      if (resultPoints) {
        resultPoints.textContent = p
          ? `獲得ポイント：+${p}P（合計 ${totalPoints}P）`
          : `合計 ${totalPoints}P`;
      } else if (timeText) {
        const base = timeText.textContent || "";
        timeText.textContent = p
          ? `${base}   +${p}P（TOTAL ${totalPoints}P）`
          : `${base}   TOTAL ${totalPoints}P`;
      }

      setScreen("result");
    },
  };

  function startSelectedMode() {
    cancelCountdown();

    // 前のゲームを掃除
    if (currentGame?.destroy) currentGame.destroy(ctx);
    board.innerHTML = "";

    currentGame = games[currentMode];
    if (!currentGame) {
      alert("未対応モード: " + currentMode);
      return;
    }

    // コイントスはカウントダウン無しの方が快適（必要ならここ消してもOK）
    if (currentMode === "cointoss") {
      setScreen("game");
      currentGame.start(ctx, { mode: currentMode });
      return;
    }

    startCountdown(() => {
      currentGame.start(ctx, { mode: currentMode });
    });
  }

  // =========================
  // Events
  // =========================
  document.querySelectorAll(".modeBtn").forEach((btn) => {
    btn.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        ensureAudioUnlocked();
        currentMode = btn.dataset.mode || "easy";
        startSelectedMode();
      },
      { passive: false }
    );
  });

  helpBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      setScreen("help");
    },
    { passive: false }
  );

  backFromHelpBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      setScreen("start");
    },
    { passive: false }
  );

  soundBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      soundEnabled = !soundEnabled;
      renderSoundIcon();
      try {
        localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0");
      } catch {}
    },
    { passive: false }
  );

  backBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      goStart();
    },
    { passive: false }
  );

  retryBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      startSelectedMode();
    },
    { passive: false }
  );

  shotBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      playSfx("go");
    },
    { passive: false }
  );

  donateBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      ensureAudioUnlocked();
      // ここは後でPayPay overlay等に差し替え
      alert("支援ありがとうございます！（仮）");
    },
    { passive: false }
  );

  // =========================
  // init
  // =========================
  setScreen("start");
});





