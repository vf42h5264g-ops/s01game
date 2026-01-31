// main.js
import { MemoryGame } from "./games/memory.js";
import { NtdGame } from "./games/ntd.js";       // ★ import名を合わせる
import { CoinTossGame } from "./games/cointoss.js";

document.addEventListener("DOMContentLoaded", () => {
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
      // 解錠後に prime（デコード促進）を一度だけ
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

    // 3種類を無音でチョン再生→停止（環境によっては効く）
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

  // ※ onFinish: カウント後にゲーム開始処理
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

        // ★初回だけ「解錠直後の音ズレ/多重」を避けるため、1フレーム遅らせて鳴らす
        // （iPhoneで“初回だけピコピコ鳴り響く”の対策）
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
    destroy: NtdGame,      // ★ NtdGame に統一
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
    if (currentGame?.destroy) currentGame.destroy(ctx);
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

    // ★ ntd.js が呼ぶ名前に合わせる
    goToStart,

    // Memory/NT-D が使う Result 画面共通表示
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
    if (currentGame?.destroy) currentGame.destroy(ctx);
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
      currentGame.start(ctx, { mode: currentMode });
      return;
    }

    startCountdown(() => {
      currentGame.start(ctx, { mode: currentMode });
    });
  }

  // ===== events =====
  document.querySelectorAll(".modeBtn").forEach(btn => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();

      // ★最初の操作で必ず音解錠（ここで “解錠+prime” まで完了）
      ensureAudio();

      currentMode = btn.dataset.mode || "easy";
      startSelectedMode();
    }, { passive: false });
  });

  helpBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    setScreen("help");
  }, { passive: false });

  backFromHelpBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    setScreen("start");
  }, { passive: false });

  soundBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    soundEnabled = !soundEnabled;
    renderSoundIcon();
    try { localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0"); } catch {}
  }, { passive: false });

  backBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    goToStart();
  }, { passive: false });

  retryBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    startSelectedMode();
  }, { passive: false });

  shotBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    playSfx("go");
  }, { passive: false });

  donateBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    // PayPay導線は後でここに実装
    alert("支援ありがとうございます！(仮)");
  }, { passive: false });

  // init
  setScreen("start");
});


