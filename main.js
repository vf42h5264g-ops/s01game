// main.js
import { MemoryGame } from "./games/memory.js";
import { NTDGame } from "./games/ntd.js";
import { CoinTossGame } from "./games/cointoss.js";

document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 共通ポイント（小数対応：10倍整数で保存）
  // =========================
  const LS_GLOBAL_POINTS_X10 = "qv_global_points_x10";

  function getPoints() {
    const v = Number(localStorage.getItem(LS_GLOBAL_POINTS_X10));
    const x10 = Number.isFinite(v) ? v : 0;
    return x10 / 10;
  }

  function addPoints(n) {
    const curX10 = Math.round(getPoints() * 10);
    const addX10 = Math.round(Number(n) * 10);
    const nextX10 = curX10 + addX10;
    localStorage.setItem(LS_GLOBAL_POINTS_X10, String(nextX10));
    renderPoints();
  }

  function renderPoints() {
    const el = document.getElementById("globalPoints");
    if (!el) return;
    el.textContent = `POINTS: ${getPoints().toFixed(1)}`;
  }

  // =========================
  // Screen refs
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
  const timeText = document.getElementById("timeText");

  const helpBtn = document.getElementById("helpBtn");
  const backFromHelpBtn = document.getElementById("backFromHelp");
  const backBtn = document.getElementById("backBtn");
  const retryBtn = document.getElementById("retryBtn");
  const soundBtn = document.getElementById("soundBtn");

  const donateBtn = document.getElementById("donateBtn");
  const shotBtn = document.getElementById("shotBtn");

  // ===== basic guards =====
  if (!screens.start || !screens.game || !board || !countdownEl) {
    alert("必要なHTML idが見つかりません（startScreen/gameScreen/board/countdown）");
    return;
  }

  function setScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.add("hidden"));
    screens[name]?.classList.remove("hidden");
  }

  // =========================
  // タップ共通（pointerdown + click）
  // ※ sound/donate は click 専用にする（長押し問題回避）
  // =========================
  function onTap(el, handler) {
    if (!el) return;

    // click（確実）
    el.addEventListener("click", (e) => {
      if (el.disabled) return;
      if (el.classList?.contains("hidden")) return;
      try { handler(e); } catch (err) { console.error(err); }
    });

    // pointerdown（レスポンス改善）
    el.addEventListener("pointerdown", (e) => {
      if (el.disabled) return;
      if (el.classList?.contains("hidden")) return;

      e.preventDefault();
      try { handler(e); } catch (err) { console.error(err); }
    }, { passive: false });
  }

  // =========================
  // Sound setting
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

  // ===== HTMLAudio (iPhone安定寄り：clone再生) =====
  const SFX_BASE = {
    beep: new Audio("./sound/beep.wav"),
    beep2: new Audio("./sound/beep2.wav"),
    go: new Audio("./sound/go.wav"),
  };
  Object.values(SFX_BASE).forEach(a => { a.preload = "auto"; a.volume = 1.0; });

  let audioUnlocked = false;
  let audioPrimed = false;

  // iOS解錠（極小音で短く）+ prime
  function ensureAudio() {
    if (audioUnlocked) return;

    audioUnlocked = true;

    const a = SFX_BASE.beep;
    const v = a.volume;

    // 完全0だと効かない端末があるので極小
    a.volume = 0.01;
    try { a.currentTime = 0; } catch {}

    a.play().then(() => {
      a.pause();
      try { a.currentTime = 0; } catch {}
      a.volume = v;
      primeAudioOnce();
    }).catch(() => {
      a.volume = v;
      // 失敗してもprimeは試す
      primeAudioOnce();
    });
  }

  function primeAudioOnce() {
    if (audioPrimed) return;
    audioPrimed = true;

    ["beep", "beep2", "go"].forEach(key => {
      const base = SFX_BASE[key];
      if (!base) return;
      const tmp = base.cloneNode();
      tmp.volume = 0.0;
      try { tmp.currentTime = 0; } catch {}
      tmp.play().then(() => {
        tmp.pause();
        try { tmp.currentTime = 0; } catch {}
      }).catch(() => {});
    });
  }

  function playSfx(key) {
    if (!soundEnabled) return;
    const base = SFX_BASE[key];
    if (!base) return;
    if (!audioUnlocked) return;

    const a = base.cloneNode();
    a.volume = base.volume;
    try { a.currentTime = 0; } catch {}
    a.play().catch(() => {});
  }

  // =========================
  // Countdown
  // =========================
  let countdownRunning = false;
  let raf = 0;
  let finishTimer = 0;

  function cancelCountdown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (finishTimer) clearTimeout(finishTimer);
    finishTimer = 0;
    countdownRunning = false;
  }

  function startCountdown(onFinish) {
    cancelCountdown();
    countdownRunning = true;

    setScreen("game");
    board.innerHTML = "";
    if (missArea) missArea.textContent = "";
    countdownEl.classList.remove("hidden");

    const t0 = performance.now();
    const seq = [3, 2, 1, 0];
    let lastShown = null;
    let firstBeepDone = false;

    const tick = () => {
      if (!countdownRunning) return;

      const elapsed = (performance.now() - t0) / 1000;
      const idx = Math.min(3, Math.floor(elapsed));
      const show = seq[idx];

      if (show !== lastShown) {
        countdownEl.textContent = String(show);
        lastShown = show;

        if (!firstBeepDone) {
          firstBeepDone = true;
          requestAnimationFrame(() => {
            if (!countdownRunning) return;
            if (show === 0) playSfx("beep2");
            else playSfx("beep");
          });
        } else {
          if (show === 0) playSfx("beep2");
          else playSfx("beep");
        }
      }

      if (show === 0 && elapsed >= 3.05) {
        finishTimer = setTimeout(() => {
          if (!countdownRunning) return;
          countdownEl.classList.add("hidden");
          countdownRunning = false;
          onFinish?.();
        }, 180);
        return;
      }

      raf = requestAnimationFrame(tick);
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
    destroy: NTDGame,
    cointoss: CoinTossGame,
  };

  let currentMode = "easy";
  let currentGame = null;

  function modeLabel(mode) {
    if (mode === "easy") return "EASY";
    if (mode === "normal") return "NORMAL";
    if (mode === "hard") return "HARD";
    if (mode === "destroy") return "TEQUILA";
    if (mode === "cointoss") return "COIN";
    return mode;
  }

  function goToStart() {
    cancelCountdown();
    try {
      if (currentGame?.destroy) currentGame.destroy(ctx);
    } catch (e) {
      console.error(e);
    }
    board.innerHTML = "";
    setScreen("start");
  }

  // ctx：ゲームに渡す共通API
  const ctx = {
    board,
    missArea,
    setScreen,
    playSfx,
    ensureAudio,
    goToStart,

    // ★共通ポイントAPI
    addPoints,
    getPoints,

    showResult({ title, timeSec, mode }) {
      if (resultMode) resultMode.textContent = modeLabel(mode);
      if (resultText) resultText.textContent = title || "";
      if (timeText) timeText.textContent = timeSec ? `TIME : ${timeSec}s` : "";
      setScreen("result");
    },

    getMode() { return currentMode; },
  };

  function startSelectedMode() {
    cancelCountdown();

    // 前ゲーム掃除
    try {
      if (currentGame?.destroy) currentGame.destroy(ctx);
    } catch (e) {
      console.error(e);
    }
    board.innerHTML = "";

    currentGame = games[currentMode];
    if (!currentGame) {
      alert("ゲームが見つかりません: " + currentMode);
      goToStart();
      return;
    }

    // コイントスは即開始
    if (currentMode === "cointoss") {
      setScreen("game");
      try {
        currentGame.start(ctx, { mode: currentMode });
      } catch (e) {
        console.error(e);
        alert("ゲーム開始中にエラーが発生しました（Consoleを確認）");
      }
      return;
    }

    startCountdown(() => {
      try {
        currentGame.start(ctx, { mode: currentMode });
      } catch (e) {
        console.error(e);
        alert("ゲーム開始中にエラーが発生しました（Consoleを確認）");
      }
    });
  }

  // =========================
  // Events: mode buttons
  // =========================
  const memorySubModes = document.getElementById("memorySubModes");
let memoryMenuOpen = false;

function setMemoryMenu(open) {
  memoryMenuOpen = open;
  if (memorySubModes) {
    memorySubModes.classList.toggle("hidden", !open);
  }
  const memBtn = document.querySelector('.modeBtn[data-mode="memory"]');
  if (memBtn) memBtn.classList.toggle("isOpen", open);
}

function toggleMemoryMenu() {
  setMemoryMenu(!memoryMenuOpen);
}

document.querySelectorAll(".modeBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    ensureAudio();

    const mode = btn.dataset.mode;

    // MEMORY-GAME はサブメニュー開閉だけ（開始しない）
    if (mode === "memory") {
      toggleMemoryMenu();
      return;
    }

    // EASY/NORMAL/HARD を押したら閉じて開始
    if (mode === "easy" || mode === "normal" || mode === "hard") {
      setMemoryMenu(false);
    } else {
      // 他ゲームを押した時も閉じる
      setMemoryMenu(false);
    }

    currentMode = mode || "easy";
    startSelectedMode();
  });
});


  // Help
  onTap(helpBtn, () => { ensureAudio(); setScreen("help"); });
  onTap(backFromHelpBtn, () => { ensureAudio(); setScreen("start"); });

  // Back / Retry
  onTap(backBtn, () => { ensureAudio(); goToStart(); });
  onTap(retryBtn, () => { ensureAudio(); startSelectedMode(); });

  // Shot
  onTap(shotBtn, () => { ensureAudio(); playSfx("go"); });

  // =========================
  // 🔊 Sound toggle（長押し回避のため click 専用）
  // =========================
  soundBtn?.addEventListener("click", () => {
    ensureAudio();
    soundEnabled = !soundEnabled;
    renderSoundIcon();
    try { localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0"); } catch {}
  });

  // =========================
  // 🤝 Donate（PayPayリンクへ）
  // =========================
  const PAYPAY_URL = "https://qr.paypay.ne.jp/p2p01_ldqe82SQtNdc2a7q";

  donateBtn?.addEventListener("click", () => {
    ensureAudio();
    // 新規タブ（スマホだと同一タブになる場合あり）
    window.open(PAYPAY_URL, "_blank", "noopener,noreferrer");
  });

  // =========================
  // init
  // =========================
  renderPoints();
  setScreen("start");
});




