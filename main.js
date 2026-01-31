// main.js
import { MemoryGame } from "./games/memory.js";
import { NtdGame } from "./games/ntd.js";
import { CoinTossGame } from "./games/cointoss.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: main.js running");

  // ===== Screen =====
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

  // ===== tap handler (pointerdown + click) =====
  // pointerdown が効かない環境でも click で必ず動くようにする
  function onTap(el, handler) {
    if (!el) return;

    // click: 確実に発火する保険
    el.addEventListener("click", (e) => {
      try { handler(e); } catch (err) { console.error(err); }
    });

    // pointerdown: 体感レスポンス改善 + iOSでの音解錠にも使える
    el.addEventListener(
      "pointerdown",
      (e) => {
        // iOSのタップハイライトやスクロール暴発を抑える
        e.preventDefault();
        try { handler(e); } catch (err) { console.error(err); }
      },
      { passive: false }
    );
  }

  // ===== sound setting =====
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
    beep: new Audio("sound/beep.wav"),
    beep2: new Audio("sound/beep2.wav"),
    go: new Audio("sound/go.wav"),
  };
  Object.values(SFX_BASE).forEach(a => { a.preload = "auto"; a.volume = 1.0; });

  let audioUnlocked = false;
  let audioPrimed = false;

  // iOS解錠（無音で短く） + 初回の「ピコピコ」を抑えるため prime を一度だけ
  function ensureAudio() {
    if (audioUnlocked) return;

    audioUnlocked = true;

    // 解錠は beep だけでOK（goを触らない）
    const a = SFX_BASE.beep;
    const v = a.volume;
    a.volume = 0.0;
    try { a.currentTime = 0; } catch {}

    a.play().then(() => {
      a.pause();
      try { a.currentTime = 0; } catch {}
      a.volume = v;
      primeAudioOnce();
    }).catch(() => {
      a.volume = v;
      primeAudioOnce();
    });
  }

  // デコード促進（音は鳴らさない/聞こえないようにする）
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

    // iOSは未解錠だと鳴らないことがあるので保険
    if (!audioUnlocked) return;

    const a = base.cloneNode();
    a.volume = base.volume;
    try { a.currentTime = 0; } catch {}
    a.play().catch(() => {});
  }

  // ===== countdown（基準時刻方式 + 初回ピコピコ抑制）=====
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

        // 初回だけ音の多重/ズレを抑制
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

  // ===== game switcher =====
  const games = {
    easy: MemoryGame,
    normal: MemoryGame,
    hard: MemoryGame,
    destroy: NtdGame,
    cointoss: CoinTossGame,
  };

  let currentMode = "easy";
  let currentGame = null;

  function modeLabel(mode) {
    if (mode === "easy") return "EASY";
    if (mode === "normal") return "NORMAL";
    if (mode === "hard") return "HARD";
    if (mode === "destroy") return "NT-D";
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

    // コイントスはカウントダウン無しで即開始
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

  // ===== events =====
  document.querySelectorAll(".modeBtn").forEach(btn => {
    onTap(btn, () => {
      ensureAudio();
      currentMode = btn.dataset.mode || "easy";
      startSelectedMode();
    });
  });

  onTap(helpBtn, () => { ensureAudio(); setScreen("help"); });

  onTap(backFromHelpBtn, () => { ensureAudio(); setScreen("start"); });

  onTap(soundBtn, () => {
    ensureAudio();
    soundEnabled = !soundEnabled;
    renderSoundIcon();
    try { localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0"); } catch {}
  });

  onTap(backBtn, () => { ensureAudio(); goToStart(); });

  onTap(retryBtn, () => { ensureAudio(); startSelectedMode(); });

  onTap(shotBtn, () => { ensureAudio(); playSfx("go"); });

  onTap(donateBtn, () => {
    ensureAudio();
    alert("支援ありがとうございます！(仮)");
  });

  // init
  setScreen("start");
});



