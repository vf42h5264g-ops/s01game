// main.js
import { MemoryGame } from "./games/memory.js";
import { NTDGame } from "./games/ntd.js";
import { CoinTossGame } from "./games/cointoss.js";
import { GachaGame } from "./games/gacha.js";

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
  const resultPoints = document.getElementById("resultPoints");
  const timeText = document.getElementById("timeText");

  // footer buttons
  const shotBtn = document.getElementById("shotBtn");
  const helpBtn = document.getElementById("helpBtn");
  const donateBtn = document.getElementById("donateBtn");
  const soundBtn = document.getElementById("soundBtn");

  // help/result buttons
  const backFromHelpBtn = document.getElementById("backFromHelp");
  const backBtn = document.getElementById("backBtn"); // モード選択
  const retryBtn = document.getElementById("retryBtn"); // もう1回

  // start screen memory sub menu
  const memorySubModes = document.getElementById("memorySubModes");

  // basic guard
  if (!screens.start || !screens.game || !board || !countdownEl) {
    alert("必要なHTML idが見つかりません（startScreen/gameScreen/board/countdown）");
    return;
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

  function renderPoints() {
    const el = document.getElementById("globalPoints");
    if (!el) return;
    el.textContent = `POINTS: ${Math.floor(Number(totalPoints || 0))}`;
  }


  // =========================
  // Screen switch
  // =========================
  function setScreen(name) {
    Object.values(screens).forEach((s) => s && s.classList.add("hidden"));
    screens[name]?.classList.remove("hidden");

    // ★スタートへ戻るたびにポイント表示同期
    if (name === "start") {
      renderPoints();
    }
  }

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

    // iOS解錠：beepを無音で一瞬再生して止める
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

    tick();
  }

  // =========================
  // Game switcher
  // =========================
  const games = {
    easy: MemoryGame,
    normal: MemoryGame,
    hard: MemoryGame,
    destroy: NTDGame, // HTML側 data-mode="destroy"（TEQUILA-GAME）に合わせる
    cointoss: CoinTossGame,
    gacha: GachaGame, // ★追加
  };

  // data-mode の吸収
  function normalizeMode(raw) {
    const m = String(raw || "").toLowerCase().trim();

    if (m === "eazy") return "easy";
    if (m === "heard") return "hard";

    if (m === "nt-d" || m === "ntd" || m === "tequila") return "destroy";
    if (m === "coin" || m === "cointoss" || m === "coin-toss") return "cointoss";

    if (m === "easy" || m === "normal" || m === "hard" || m === "destroy" || m === "cointoss" || m === "gacha") return m;

    // 重要：memory は「開始しない」のでここでeasyに丸めない（呼び元で分岐）
    return "";
  }

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

  // overlay 等の残骸を強制で消す
  function hardCleanup() {
    document.getElementById("tequilaOverlay")?.remove();
    document.getElementById("donateOverlay")?.remove();
  }

  // =========================
  // Tap helper（pointerdown + click）
  // =========================
  function bindTap(el, handler) {
    if (!el) return;
    const h = (e) => {
      e.preventDefault?.();
      handler(e);
    };
    el.addEventListener("pointerdown", h, { passive: false });
    el.addEventListener("click", h, { passive: false });
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
    const add = Math.floor(Number(n) || 0);
    if (add <= 0) return totalPoints;

    totalPoints = Math.floor(Number(totalPoints) || 0) + add;
    writeInt(LS_POINTS, totalPoints);
    renderPoints();
    return totalPoints;
  },


  spendPoints(n) {
    const cost = Number(n) || 0;
    if (cost <= 0) return false;
    if (totalPoints < cost) return false;

    totalPoints -= cost;
    writeInt(LS_POINTS, totalPoints);

    renderPoints();
    return true;
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

  // =========================
  // Lifecycle
  // =========================
  function destroyCurrentGame() {
    try {
      if (currentGame?.destroy) currentGame.destroy(ctx);
    } catch {}
    currentGame = null;
  }

  function goStart() {
    cancelCountdown();
    destroyCurrentGame();
    hardCleanup();

    board.innerHTML = "";
    if (missArea) missArea.textContent = "";
    countdownEl.classList.add("hidden");

    // ★memoryサブメニューは閉じておく
    memorySubModes?.classList.add("hidden");

    setScreen("start");
  }

  function startSelectedMode() {
    cancelCountdown();

    destroyCurrentGame();
    hardCleanup();
    board.innerHTML = "";
    if (missArea) missArea.textContent = "";

    currentGame = games[currentMode];
    if (!currentGame) {
      alert("未対応モード: " + currentMode);
      goStart();
      return;
    }

    // コイントスはカウントダウン無し
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

  // --- Start Screen: MEMORY-GAME entry (open/close sub modes, NOT start) ---
  const startRoot = screens.start;
  // =========================
// Events
// =========================

// --- Start Screen: unified handler (works for .modeBtn and .hit buttons) ---
const startRoot = screens.start;

// memory のトグル判定（memoryボタンだけは「開始」じゃなくて「サブ表示」）
function isMemoryEntry(el) {
  return el?.dataset?.mode && String(el.dataset.mode).toLowerCase() === "memory";
}

bindTap(startRoot, (e) => {
  // startRoot 自体に bindTap してるので、e.target から拾う
  const target = e.target.closest("[data-mode]");
  if (!target) return;

  ensureAudioUnlocked();

  const raw = target.dataset.mode;

  // MEMORY-GAME は開始せず、サブモード開閉
  if (String(raw).toLowerCase() === "memory") {
    memorySubModes?.classList.toggle("hidden");
    return;
  }

  // サブモード (easy/normal/hard) など
  const m = normalizeMode(raw);
  if (!m) return;

  currentMode = m;

  // memoryサブは閉じる
  memorySubModes?.classList.add("hidden");

  // ガチャはカウントダウン無しが気持ちいい（現行踏襲）
  if (currentMode === "gacha") {
    setScreen("game");
    destroyCurrentGame();
    hardCleanup();
    board.innerHTML = "";
    if (missArea) missArea.textContent = "";
    currentGame = games[currentMode];
    currentGame.start(ctx, { mode: currentMode });
    return;
  }

  // それ以外は通常開始
  startSelectedMode();
});

// --- Help ---
bindTap(helpBtn, () => {
  ensureAudioUnlocked();
  setScreen("help");
});

bindTap(backFromHelpBtn, () => {
  ensureAudioUnlocked();
  setScreen("start");
});

// --- Sound ---
bindTap(soundBtn, () => {
  ensureAudioUnlocked();
  soundEnabled = !soundEnabled;
  renderSoundIcon();
  try {
    localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0");
  } catch {}
});

// --- Result Buttons ---
bindTap(backBtn, () => {
  ensureAudioUnlocked();
  goStart();
});

bindTap(retryBtn, () => {
  ensureAudioUnlocked();
  startSelectedMode();
});

// --- Footer ---
bindTap(shotBtn, () => {
  ensureAudioUnlocked();
  playSfx("go");
});

bindTap(donateBtn, () => {
  ensureAudioUnlocked();
  alert("支援ありがとうございます！（仮）");
});

 

  // =========================
  // init
  // =========================
  renderPoints();
  setScreen("start");
});






