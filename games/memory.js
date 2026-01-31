// ==============================
// Quattro Vageena : Last Call
// Complete JS / iPhone安定版（WebAudio優先 + 失敗時HTMLAudioフォールバック）
//
// ✅ PayPay投げ銭（donateBtn）追加：QR(paypay.jpg) + URL
// ✅ 支援ボタンが裏に出る/二重になる対策：重複donateBtn削除
// ✅ 音が鳴らない対策：WebAudio失敗→HTMLAudio
// ✅ カウントと音ズレ対策：基準時刻方式（performance.now補正）
// ✅ 0 は beep2.wav
// ✅ NT-D v03負け：ランダム台詞のみ（固定撤去）
// ✅ クリア画面でモード名表示
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  // iPhoneでも原因が分かるように（不要なら消してOK）
  window.onerror = function (msg, url, line, col) {
    alert("JSエラー:\n" + msg + "\n" + line + ":" + col);
  };

  // =====================
  // 定数
  // =====================
  const BACK_SRC = "img/vback.jpg";

  // PayPay（投げ銭）
  const PAYPAY_URL = "https://qr.paypay.ne.jp/p2p01_UmHN8gFjP5JmQwzo";
  const PAYPAY_IMG = "img/paypay.jpg"; // 画像ファイル名は paypay.jpg（imgフォルダ想定）

  // =====================
  // 画面管理
  // =====================
  const screens = {
    start: document.getElementById("startScreen"),
    help: document.getElementById("helpScreen"),
    game: document.getElementById("gameScreen"),
    result: document.getElementById("resultScreen")
  };

  function setScreen(name) {
    Object.values(screens).forEach(s => s && s.classList.add("hidden"));
    screens[name]?.classList.remove("hidden");
  }

  function setStartNeon(on) {
    screens.start?.classList.toggle("neon", !!on);
  }

  // =====================
  // 要素
  // =====================
  const board = document.getElementById("board");
  const countdownEl = document.getElementById("countdown");
  const missArea = document.getElementById("missArea");
  const resultText = document.getElementById("resultText");
  const timeText = document.getElementById("timeText");
  const resultMode = document.getElementById("resultMode"); // 追加済み想定

  const shotBtn = document.getElementById("shotBtn");
  const helpBtn = document.getElementById("helpBtn");
  const soundBtn = document.getElementById("soundBtn");

  // donateBtn 重複対策（裏に隠れてる/二重になるやつを削除）
  const donateBtns = document.querySelectorAll("#donateBtn");
  if (donateBtns.length > 1) {
    donateBtns.forEach((b, i) => { if (i !== 0) b.remove(); });
  }
  const donateBtn = document.getElementById("donateBtn");

  const backFromHelpBtn = document.getElementById("backFromHelp");
  const backBtn = document.getElementById("backBtn");
  const retryBtn = document.getElementById("retryBtn");

  if (!screens.start || !screens.game || !board || !countdownEl || !missArea || !resultText || !timeText) {
    alert("HTMLのIDが合ってない可能性があります。\nboard / countdown / missArea / resultText / timeText を確認してね。");
    return;
  }

  // =====================
  // 状態
  // =====================
  let mode = "easy";
  let first = null;
  let lock = false;
  let miss = 0;
  let startTime = 0;
  let destroySafeOpened = 0;

  // 二重起動防止（カウントダウン）
  let countdownRunning = false;
  let countdownRAF = 0;
  let countdownFinishTimeout = 0;

  // NT-D演出タイマー（スタート画面）
  let ntdTimers = [];

  function cancelCountdown() {
    if (countdownRAF) cancelAnimationFrame(countdownRAF);
    countdownRAF = 0;
    if (countdownFinishTimeout) clearTimeout(countdownFinishTimeout);
    countdownFinishTimeout = 0;
    countdownRunning = false;
  }

  function clearNtdTimers() {
    ntdTimers.forEach(t => clearTimeout(t));
    ntdTimers = [];
  }

  // =====================
  // モード設定（神経衰弱）
  // =====================
  const modeSetting = {
    easy: 3,
    normal: 6,
    hard: 6,
    destroy: 0
  };

  const modeLabel = {
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    destroy: "NT-D"
  };

  function applyBoardLayout() {
    board.classList.remove("layout-easy", "layout-12");
    if (mode === "easy") board.classList.add("layout-easy");
    else board.classList.add("layout-12");
  }

  // =====================
  // サウンド設定（保存）
  // =====================
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

  // =====================
  // NT-D v03負け台詞（ランダム）
  // =====================
  const tequilaLines = [
    "いきまーーっす！",
    "飲めよ国民！",
    "坊やだからさ・・・",
    "ザクとは違うのだよ",
    "見せてもらおうか"
  ];
  function pickTequilaLine() {
    return tequilaLines[Math.floor(Math.random() * tequilaLines.length)];
  }

  // =====================
  // サウンド：WebAudio優先 + HTMLAudioフォールバック
  // =====================
  const SOUND_FILES = {
    beep: "sound/beep.wav",
    beep2: "sound/beep2.wav",
    go: "sound/go.wav",
  };

  // ---- HTMLAudio fallback
  const htmlAudio = {
    beep: new Audio(SOUND_FILES.beep),
    beep2: new Audio(SOUND_FILES.beep2),
    go: new Audio(SOUND_FILES.go),
  };
  Object.values(htmlAudio).forEach(a => {
    a.preload = "auto";
    a.volume = 1.0;
  });

  function playHtml(key) {
    if (!soundEnabled) return;
    const base = htmlAudio[key];
    if (!base) return;

    const a = base.cloneNode();
    a.volume = base.volume;
    try { a.currentTime = 0; } catch {}
    a.play().catch(() => {});
  }

  // ---- WebAudio
  let audioCtx = null;
  let audioReady = false;
  let audioUnlocked = false;
  let audioUnlocking = false;
  let useWebAudio = false;

  const buffers = { beep: null, beep2: null, go: null };

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error("Sound fetch failed: " + url);
    return await res.arrayBuffer();
  }

  async function ensureAudioUnlocked() {
    if (audioUnlocked) return true;
    if (audioUnlocking) return false;

    audioUnlocking = true;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      // 初回デコード
      if (!audioReady) {
        for (const [key, url] of Object.entries(SOUND_FILES)) {
          const ab = await fetchArrayBuffer(url);
          buffers[key] = await new Promise((resolve, reject) => {
            audioCtx.decodeAudioData(
              ab.slice(0),
              (buf) => resolve(buf),
              (err) => reject(err)
            );
          });
        }
        audioReady = true;
      }

      // 無音で1回鳴らして解錠
      const g = audioCtx.createGain();
      g.gain.value = 0.0;
      g.connect(audioCtx.destination);

      const src = audioCtx.createBufferSource();
      src.buffer = buffers.beep;
      src.connect(g);
      src.start(audioCtx.currentTime);
      src.stop(audioCtx.currentTime + 0.01);

      audioUnlocked = true;
      useWebAudio = true;
      return true;
    } catch (e) {
      // フォールバック
      console.log("WebAudio disabled -> fallback to HTMLAudio", e);
      useWebAudio = false;
      audioUnlocked = true;
      return false;
    } finally {
      audioUnlocking = false;
    }
  }

  function playWeb(key, whenSec = null) {
    if (!soundEnabled) return;
    if (!useWebAudio || !audioCtx || !audioReady) return;

    const buf = buffers[key];
    if (!buf) return;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1.0, audioCtx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);

    src.connect(gain);
    gain.connect(audioCtx.destination);

    const t = (whenSec == null) ? audioCtx.currentTime : whenSec;
    src.start(t);
    src.stop(t + Math.min(1.0, buf.duration + 0.05));
  }

  function playSfx(key, whenSec = null) {
    if (!soundEnabled) return;

    if (useWebAudio && whenSec != null) {
      playWeb(key, whenSec);
      return;
    }

    if (useWebAudio) playWeb(key);
    else playHtml(key);
  }

  // =====================
  // 表示（HARD/NT-D）
  // =====================
  function renderStatus() {
    if (mode === "hard") {
      const max = 5;
      missArea.textContent =
        "MISS : " + "✖".repeat(miss) + "・".repeat(Math.max(0, max - miss));
      return;
    }
    if (mode === "destroy") {
      const remain = Math.max(0, 11 - destroySafeOpened);
      missArea.textContent = `SAFE : ${destroySafeOpened}/11   残り ${remain}`;
      return;
    }
    missArea.textContent = "";
  }

  // =====================
  // 投げ銭モーダル
  // =====================
  function showThanksToast() {
    const old = document.getElementById("thanksToast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "thanksToast";
    toast.textContent = "ご支援ありがとうございます！制作の励みになります 🙏";
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 110px)";
    toast.style.zIndex = "99999";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "999px";
    toast.style.background = "rgba(0,0,0,0.72)";
    toast.style.border = "1px solid rgba(255,255,255,0.16)";
    toast.style.color = "#fff";
    toast.style.fontWeight = "800";
    toast.style.letterSpacing = "0.04em";
    toast.style.fontSize = "14px";
    toast.style.boxShadow = "0 18px 44px rgba(0,0,0,0.45)";
    toast.style.pointerEvents = "none";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function openDonateModal() {
    document.getElementById("donateOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "donateOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "99999";
    overlay.style.background = "rgba(0,0,0,0.78)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "18px";

    overlay.addEventListener("pointerdown", (e) => {
      if (e.target === overlay) overlay.remove();
    }, { passive: false });

    const card = document.createElement("div");
    card.style.width = "min(92vw, 420px)";
    card.style.borderRadius = "18px";
    card.style.background = "rgba(20,10,12,0.95)";
    card.style.border = "1px solid rgba(255,255,255,0.12)";
    card.style.boxShadow = "0 24px 60px rgba(0,0,0,0.55)";
    card.style.padding = "16px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";

    const title = document.createElement("div");
    title.textContent = "ご支援（PayPay）";
    title.style.fontWeight = "900";
    title.style.letterSpacing = "0.06em";
    title.style.fontSize = "18px";
    title.style.color = "#fff";

    const msg = document.createElement("div");
    msg.textContent =
      "遊んでくれてありがとうございます！よければPayPayで応援していただけると、とても励みになります。";
    msg.style.opacity = "0.9";
    msg.style.lineHeight = "1.5";
    msg.style.fontSize = "14px";
    msg.style.color = "#fff";

    const img = document.createElement("img");
    img.src = PAYPAY_IMG;
    img.alt = "PayPay QR";
    img.style.width = "100%";
    img.style.borderRadius = "12px";
    img.style.border = "1px solid rgba(255,255,255,0.10)";
    img.style.background = "#fff";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";

    const openBtn = document.createElement("button");
    openBtn.textContent = "PayPayを開く";
    openBtn.style.flex = "1";
    openBtn.style.padding = "12px 14px";
    openBtn.style.borderRadius = "12px";
    openBtn.style.border = "none";
    openBtn.style.cursor = "pointer";
    openBtn.style.fontWeight = "800";

    openBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      window.open(PAYPAY_URL, "_blank", "noopener");
    }, { passive: false });

    const thanksBtn = document.createElement("button");
    thanksBtn.textContent = "送ったよ";
    thanksBtn.style.flex = "1";
    thanksBtn.style.padding = "12px 14px";
    thanksBtn.style.borderRadius = "12px";
    thanksBtn.style.border = "1px solid rgba(255,255,255,0.16)";
    thanksBtn.style.background = "rgba(255,255,255,0.06)";
    thanksBtn.style.color = "#fff";
    thanksBtn.style.cursor = "pointer";
    thanksBtn.style.fontWeight = "800";

    thanksBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      overlay.remove();
      showThanksToast();
    }, { passive: false });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "閉じる";
    closeBtn.style.padding = "10px 12px";
    closeBtn.style.borderRadius = "12px";
    closeBtn.style.border = "none";
    closeBtn.style.cursor = "pointer";

    closeBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      overlay.remove();
    }, { passive: false });

    row.appendChild(openBtn);
    row.appendChild(thanksBtn);

    card.appendChild(title);
    card.appendChild(msg);
    card.appendChild(img);
    card.appendChild(row);
    card.appendChild(closeBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // =====================
  // ボタンイベント
  // =====================
  document.querySelectorAll(".modeBtn").forEach(btn => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ensureAudioUnlocked();

      const selected = btn.dataset.mode;
      mode = selected || "easy";

      // NT-D演出をリセット
      clearNtdTimers();
      const destroyBtn = document.querySelector('.modeBtn[data-mode="destroy"]');
      destroyBtn?.classList.remove("charging");
      screens.start?.classList.remove("flicker");

      // 進行中のカウントダウン停止
      cancelCountdown();

      if (mode !== "destroy") {
        setStartNeon(false);
        startCountdown();
        return;
      }

      // ===== NT-D演出 =====
      setStartNeon(true);
      requestAnimationFrame(() => destroyBtn?.classList.add("charging"));

      ntdTimers.push(setTimeout(() => screens.start?.classList.add("flicker"), 3000));
      ntdTimers.push(setTimeout(() => {
        screens.start?.classList.remove("flicker");
        destroyBtn?.classList.remove("charging");
        startCountdown();
      }, 4000));
    }, { passive: false });
  });

  shotBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    playSfx("go");
  }, { passive: false });

  helpBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    setScreen("help");
  }, { passive: false });

  backFromHelpBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    setScreen("start");
  }, { passive: false });

  soundBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    soundEnabled = !soundEnabled;
    renderSoundIcon();
    try { localStorage.setItem("soundEnabled", soundEnabled ? "1" : "0"); } catch {}
  }, { passive: false });

  donateBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    openDonateModal();
  }, { passive: false });

  backBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    setStartNeon(false);
    setScreen("start");
  }, { passive: false });

  retryBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ensureAudioUnlocked();
    cancelCountdown();
    startCountdown();
  }, { passive: false });

  // =====================
  // カウントダウン（基準時刻方式）
  // 3,2,1: beep / 0: beep2
  // =====================
  function startCountdown() {
    if (countdownRunning) return;

    cancelCountdown();
    countdownRunning = true;

    setScreen("game");
    board.innerHTML = "";
    missArea.innerHTML = "";
    applyBoardLayout();

    miss = 0;
    first = null;
    lock = false;
    destroySafeOpened = 0;
    renderStatus();

    countdownEl.classList.remove("hidden");

    const t0Perf = performance.now();
    const seq = [3, 2, 1, 0];

    // WebAudioが使えるなら“予約”してズレ最小化
    let audioBase = null;
    if (useWebAudio && audioCtx && audioReady) {
      audioBase = audioCtx.currentTime + 0.08; // Safari余裕
      playSfx("beep",  audioBase + 0.0);
      playSfx("beep",  audioBase + 1.0);
      playSfx("beep",  audioBase + 2.0);
      playSfx("beep2", audioBase + 3.0);
    }

    let lastShown = null;

    const tick = () => {
      if (!countdownRunning) return;

      const elapsed = (performance.now() - t0Perf) / 1000;
      const idx = Math.min(3, Math.floor(elapsed));
      const show = seq[idx];

      if (show !== lastShown) {
        countdownEl.textContent = String(show);
        lastShown = show;

        // HTML fallback時のみここで鳴らす（Web予約があるなら鳴らさない）
        if (audioBase == null) {
          if (show === 0) playSfx("beep2");
          else playSfx("beep");
        }
      }

      if (show === 0 && elapsed >= 3.05) {
        countdownFinishTimeout = setTimeout(() => {
          if (!countdownRunning) return;
          countdownEl.classList.add("hidden");
          countdownRunning = false;
          startGame();
        }, 180);
        return;
      }

      countdownRAF = requestAnimationFrame(tick);
    };

    // 初期表示
    countdownEl.textContent = "3";
    lastShown = 3;
    if (audioBase == null) playSfx("beep");

    countdownRAF = requestAnimationFrame(tick);
  }

  // =====================
  // ゲーム開始
  // =====================
  function startGame() {
    if (mode === "destroy") startDestroyGame();
    else startMemoryGame();
  }

  // =====================
  // 通常：神経衰弱
  // =====================
  function startMemoryGame() {
    const total = modeSetting[mode];
    const names = [];

    for (let i = 2; i < 2 + total; i++) {
      names.push("v" + i.toString().padStart(2, "0"));
    }

    const cards = [...names, ...names].sort(() => Math.random() - 0.5);
    startTime = Date.now();

    cards.forEach(name => {
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = BACK_SRC;
      img.dataset.open = "0";

      card.appendChild(img);
      board.appendChild(card);

      card.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (lock || img.dataset.open === "1") return;

        img.src = `img/${name}.jpg`;
        img.dataset.open = "1";

        if (!first) {
          first = img;
        } else {
          lock = true;

          if (first.src === img.src) {
            first = null;
            lock = false;
            checkClearMemory();
          } else {
            setTimeout(() => {
              img.src = BACK_SRC;
              first.src = BACK_SRC;
              img.dataset.open = "0";
              first.dataset.open = "0";
              first = null;
              lock = false;

              miss++;
              renderStatus();
              checkBadEnd();
            }, 800);
          }
        }
      }, { passive: false });
    });
  }

  // =====================
  // NT-D：v03を引いたら負け
  // =====================
  function startDestroyGame() {
    const pool = ["v01", "v02", "v04", "v05", "v06", "v07"];

    const safe11 = Array.from({ length: 11 }, () => {
      return pool[Math.floor(Math.random() * pool.length)];
    });

    const cards = [...safe11, "v03"].sort(() => Math.random() - 0.5);

    startTime = Date.now();
    destroySafeOpened = 0;
    renderStatus();

    cards.forEach(name => {
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = BACK_SRC;
      img.dataset.open = "0";
      img.dataset.name = name;

      card.appendChild(img);
      board.appendChild(card);

      card.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (lock || img.dataset.open === "1") return;

        img.src = `img/${name}.jpg`;
        img.dataset.open = "1";

        if (name === "v03") {
          lock = true;
          playSfx("go"); // めくった瞬間
          setTimeout(() => showTequilaLose(false), 60);
          return;
        }

        destroySafeOpened++;
        renderStatus();

        if (destroySafeOpened >= 11) {
          lock = true;
          setTimeout(() => {
            launchConfetti();
            const time = ((Date.now() - startTime) / 1000).toFixed(1);
            resultText.textContent = "僕にはまだ帰るところがあるんだ";
            timeText.textContent = `TIME : ${time}s`;
            if (resultMode) resultMode.textContent = `MODE : ${modeLabel[mode] || mode}`;
            setScreen("result");
          }, 250);
        }
      }, { passive: false });
    });
  }

  // =====================
  // 判定
  // =====================
  function checkClearMemory() {
    const open = [...document.querySelectorAll(".card img")]
      .every(img => img.dataset.open === "1");

    if (open) {
      launchConfetti();
      const time = ((Date.now() - startTime) / 1000).toFixed(1);
      resultText.textContent = "PERFECT!!";
      timeText.textContent = `TIME : ${time}s`;
      if (resultMode) resultMode.textContent = `MODE : ${modeLabel[mode] || mode}`;
      setScreen("result");
    }
  }

  function checkBadEnd() {
    if (mode === "hard" && miss >= 5) {
      resultText.textContent = "BAD END…";
      timeText.textContent = "";
      if (resultMode) resultMode.textContent = `MODE : ${modeLabel[mode] || mode}`;
      setScreen("result");
    }
  }

  // =====================
  // v03演出（ランダム台詞のみ）
  // =====================
  function showTequilaLose(playSound = true) {
    if (playSound) playSfx("go");

    const old = document.getElementById("tequilaOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "tequilaOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "99999";
    overlay.style.background = "rgba(0,0,0,0.92)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.gap = "16px";

    const img = document.createElement("img");
    img.src = "img/v03.jpg";
    img.alt = "v03";
    img.style.width = "100vw";
    img.style.height = "70vh";
    img.style.objectFit = "contain";

    const line = document.createElement("div");
    line.textContent = pickTequilaLine();
    line.style.color = "#ff3bd4";
    line.style.fontSize = "clamp(18px, 4.8vw, 40px)";
    line.style.fontWeight = "900";
    line.style.letterSpacing = "0.04em";
    line.style.textShadow = "0 0 14px rgba(255, 60, 212, 0.55)";

    const btnRow = document.createElement("div");
    btnRow.style.position = "absolute";
    btnRow.style.left = "0";
    btnRow.style.right = "0";
    btnRow.style.bottom = "18px";
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "center";
    btnRow.style.gap = "12px";
    btnRow.style.padding = "0 16px";

    const retry = document.createElement("button");
    retry.textContent = "もう一度";
    retry.style.padding = "12px 18px";
    retry.style.fontSize = "18px";
    retry.style.borderRadius = "12px";
    retry.style.border = "none";
    retry.style.cursor = "pointer";
    retry.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      overlay.remove();
      cancelCountdown();
      startCountdown();
    }, { passive: false });

    const back = document.createElement("button");
    back.textContent = "モード選択";
    back.style.padding = "12px 18px";
    back.style.fontSize = "18px";
    back.style.borderRadius = "12px";
    back.style.border = "none";
    back.style.cursor = "pointer";
    back.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      overlay.remove();
      setStartNeon(false);
      setScreen("start");
    }, { passive: false });

    btnRow.appendChild(retry);
    btnRow.appendChild(back);

    overlay.appendChild(img);
    overlay.appendChild(line);
    overlay.appendChild(btnRow);

    document.body.appendChild(overlay);
  }

  // =====================
  // 紙吹雪
  // =====================
  function launchConfetti(durationMs = 1200) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.pointerEvents = "none";
    container.style.overflow = "hidden";
    container.style.zIndex = "9999";
    document.body.appendChild(container);

    const endAt = Date.now() + durationMs;

    function spawn() {
      const piece = document.createElement("div");
      piece.style.position = "absolute";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.top = "-10px";
      piece.style.width = 6 + Math.random() * 6 + "px";
      piece.style.height = 10 + Math.random() * 10 + "px";
      piece.style.background = `hsl(${Math.random() * 360},90%,60%)`;
      piece.style.opacity = "0.9";
      piece.style.borderRadius = "2px";

      const drift = (Math.random() * 2 - 1) * 120;
      const fall = 600 + Math.random() * 600;
      const rotate = (Math.random() * 2 - 1) * 720;
      const life = 900 + Math.random() * 700;
      const start = performance.now();

      container.appendChild(piece);

      function animate(t) {
        const p = Math.min(1, (t - start) / life);
        piece.style.transform = `translate(${drift * p}px, ${fall * p}px) rotate(${rotate * p}deg)`;
        piece.style.opacity = (1 - p).toString();
        if (p < 1) requestAnimationFrame(animate);
        else piece.remove();
      }
      requestAnimationFrame(animate);
    }

    const interval = setInterval(() => {
      for (let i = 0; i < 10; i++) spawn();
      if (Date.now() > endAt) {
        clearInterval(interval);
        setTimeout(() => container.remove(), 800);
      }
    }, 100);
  }

  // =====================
  // 初期画面
  // =====================
  setStartNeon(false);
  setScreen("start");
});




