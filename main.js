// main.js
import { MemoryGame } from "./games/memory.js";
import { NTDGame } from "./games/ntd.js";
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

  // donate / shot はあなたの既存仕様に合わせて後で繋げばOK
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

  // ===== sound (あなたの既存の音システムに合わせて入れ替え可) =====
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

  // ここは「あなたが今使ってる WebAudio + fallback」実装に差し替えてOK。
  // 今回は“最小”としてHTMLAudioだけ置いとく（動作確認用）
  const SFX = {
    beep: new Audio("sound/beep.wav"),
    beep2: new Audio("sound/beep2.wav"),
    go: new Audio("sound/go.wav"),
  };
  Object.values(SFX).forEach(a => { a.preload = "auto"; a.volume = 1.0; });

  let audioUnlocked = false;
  function ensureAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    // iOS解錠：無音で一瞬再生
    const a = SFX.beep;
    const v = a.volume;
    a.volume = 0.0;
    try { a.currentTime = 0; } catch {}
    a.play().then(() => {
      a.pause();
      try { a.currentTime = 0; } catch {}
      a.volume = v;
    }).catch(() => { a.volume = v; });
  }

  function playSfx(key) {
    if (!soundEnabled) return;
    const base = SFX[key];
    if (!base) return;
    const a = base.cloneNode();
    a.volume = base.volume;
    try { a.currentTime = 0; } catch {}
    a.play().catch(() => {});
  }

  // ===== countdown（0だけbeep2）=====
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
    missArea && (missArea.textContent = "");
    countdownEl.classList.remove("hidden");

    const t0 = performance.now();
    const seq = [3,2,1,0];
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
    if (mode === "cointoss") return "COIN";
    return mode;
  }

  function goStart() {
    cancelCountdown();
    // overlay等が残るゲームもあるので destroy させる
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
    goStart,
    showResult({ title, timeSec, mode }) {
      // 結果画面を使うゲーム向け（コイントスは自前UIなので使わなくてOK）
      if (resultMode) resultMode.textContent = modeLabel(mode);
      if (resultText) resultText.textContent = title || "";
      if (timeText) timeText.textContent = timeSec ? `TIME : ${timeSec}s` : "";
      setScreen("result");
    },
    getMode() { return currentMode; },
  };

  function startSelectedMode() {
    // 旧ゲーム掃除
    cancelCountdown();
    if (currentGame?.destroy) currentGame.destroy(ctx);
    board.innerHTML = "";

    currentGame = games[currentMode];

    // コイントスは「カウントダウン無し」で即開始の方が気持ちいいので分岐
    if (currentMode === "cointoss") {
      setScreen("game");
      currentGame.start(ctx);
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
    goStart();
  }, { passive: false });

  retryBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    startSelectedMode();
  }, { passive: false });

  // shot/donate は今まで通りここで繋げる
  shotBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    playSfx("go");
  }, { passive: false });

  donateBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudio();
    // ここはあなたのPayPay導線（overlay/別画面）を後で実装
    alert("支援ありがとうございます！(仮)");
  }, { passive: false });

  // init
  setScreen("start");
});

