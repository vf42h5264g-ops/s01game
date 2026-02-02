// games/cointoss.js
export const CoinTossGame = {
  id: "cointoss",

  destroy(ctx) {
    // boardを空にするだけでイベントも一緒に消える（DOMごと捨てる方式）
    if (ctx?.board) ctx.board.innerHTML = "";
  },

  start(ctx, opt = {}) {
    const board = ctx.board;
    board.innerHTML = "";

    // ========= 画像 =========
    const IMG = {
      HEAD: "img/head.png",
      TAIL: "img/tail.png",
    };

    // 事前ロード（チラつき防止）
    Object.values(IMG).forEach((src) => {
      const im = new Image();
      im.src = src;
    });

    // ========= localStorage keys =========
    const LS = {
      titlePoints: "ct_title_points",
      dailyDate: "ct_daily_date", // "YYYY-MM-DD"
      chainBest: "ct_chain_best",
    };

    // ========= 称号 =========
    const TITLES = [
      { pts: 1, name: "Lucky Beginner" },
      { pts: 5, name: "Lucky Hand" },
      { pts: 10, name: "Luck Adept" },
      { pts: 20, name: "Chain of Luck" },
      { pts: 30, name: "Lord of Luck" },
      { pts: 50, name: "Architect of Fate" },
    ];

    // ========= 共通ユーティリティ =========
    function todayStr() {
      const d = new Date();
      const y = String(d.getFullYear());
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    function readInt(key, fallback) {
      const v = window.localStorage.getItem(key);
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    function writeInt(key, value) {
      window.localStorage.setItem(key, String(value));
    }
    function pickTitle(points) {
      let current = null;
      for (const t of TITLES) if (points >= t.pts) current = t;
      return current ? current.name : "No Title Yet";
    }
    function randResult() {
      return Math.random() < 0.5 ? "HEAD" : "TAIL";
    }
    function wait(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
    function setSpinning(imgEl, spinning) {
      imgEl.classList.toggle("spinning", spinning);
    }
    async function tossAnimation(imgEl, durationMs = 1100) {
      setSpinning(imgEl, true);
      await wait(durationMs);
      setSpinning(imgEl, false);
    }

    // ========= 状態 =========
    const state = {
      tossing: false,
      titlePoints: readInt(LS.titlePoints, 0),
      chainStreak: 0,
      chainBest: readInt(LS.chainBest, 0),
    };

    // ========= UI生成（board内だけで完結） =========
    const root = document.createElement("div");
    root.className = "ctRoot";
    board.appendChild(root);

    // 共通：画面コンテナ
    const screens = {
      start: mkScreen("ctStart"),
      quick: mkScreen("ctQuick hidden"),
      daily: mkScreen("ctDaily hidden"),
      chain: mkScreen("ctChain hidden"),
    };
    Object.values(screens).forEach((s) => root.appendChild(s));

    // ---- START
    screens.start.innerHTML = `
      <div class="ctTitle">COIN TOSS</div>
      <div class="ctSub">Choose a mode</div>

      <div class="ctCard">
        <div class="ctRow">
          <div class="ctLabel">Title</div>
          <div id="ctTitleName" class="ctValue"></div>
        </div>
        <div class="ctRow">
          <div class="ctLabel">Title Points</div>
          <div id="ctTitlePts" class="ctValue"></div>
        </div>
        <div class="ctRow">
          <div class="ctLabel">Daily</div>
          <div id="ctDailyStatus" class="ctValue"></div>
        </div>
      </div>

      <div class="ctBtns">
        <button id="ctBtnQuick">Quick Toss</button>
        <button id="ctBtnDaily">Daily (1/day)</button>
        <button id="ctBtnChain">Chain of Luck</button>
        <button id="ctBtnBack">Back</button>
      </div>
    `;

    // ---- QUICK
    screens.quick.innerHTML = `
      <div class="ctTitle">Quick Toss</div>
      <img id="ctQuickCoin" class="ctCoin" src="${IMG.HEAD}" alt="coin"/>
      <div id="ctQuickResult" class="ctMsg">Tap to toss</div>
      <div class="ctBtns">
        <button id="ctQuickTossBtn">TOSS</button>
        <button data-ct-go="start">Back</button>
      </div>
    `;

    // ---- DAILY
    screens.daily.innerHTML = `
      <div class="ctTitle">Daily Flip</div>
      <img id="ctDailyCoin" class="ctCoin" src="${IMG.HEAD}" alt="coin"/>
      <div id="ctDailyMsg" class="ctMsg">Pick HEAD or TAIL</div>
      <div class="ctBtns">
        <button id="ctDailyPickHead">HEAD</button>
        <button id="ctDailyPickTail">TAIL</button>
        <button id="ctDailyAgainBtn" class="hidden">Back</button>
      </div>
      <button data-ct-go="start" class="ctLink">Back to menu</button>
    `;

    // ---- CHAIN
    screens.chain.innerHTML = `
      <div class="ctTitle">Chain of Luck</div>
      <div class="ctRow ctRowCenter">
        <div>Streak: <b id="ctChainStreak">0</b></div>
        <div>Best: <b id="ctChainBest">0</b></div>
      </div>
      <img id="ctChainCoin" class="ctCoin" src="${IMG.HEAD}" alt="coin"/>
      <div id="ctChainMsg" class="ctMsg">Pick HEAD or TAIL</div>
      <div class="ctBtns">
        <button id="ctChainPickHead">HEAD</button>
        <button id="ctChainPickTail">TAIL</button>
        <button id="ctChainRestartBtn" class="hidden">Restart</button>
      </div>
      <button data-ct-go="start" class="ctLink">Back to menu</button>
    `;

    // ====== 要素参照 ======
    const titleNameEl = screens.start.querySelector("#ctTitleName");
    const titlePointsEl = screens.start.querySelector("#ctTitlePts");
    const dailyStatusEl = screens.start.querySelector("#ctDailyStatus");

    const btnQuick = screens.start.querySelector("#ctBtnQuick");
    const btnDaily = screens.start.querySelector("#ctBtnDaily");
    const btnChain = screens.start.querySelector("#ctBtnChain");
    const btnBack = screens.start.querySelector("#ctBtnBack");

    const quickCoin = screens.quick.querySelector("#ctQuickCoin");
    const quickResult = screens.quick.querySelector("#ctQuickResult");
    const quickTossBtn = screens.quick.querySelector("#ctQuickTossBtn");

    const dailyCoin = screens.daily.querySelector("#ctDailyCoin");
    const dailyMsg = screens.daily.querySelector("#ctDailyMsg");
    const dailyPickHead = screens.daily.querySelector("#ctDailyPickHead");
    const dailyPickTail = screens.daily.querySelector("#ctDailyPickTail");
    const dailyAgainBtn = screens.daily.querySelector("#ctDailyAgainBtn");

    const chainCoin = screens.chain.querySelector("#ctChainCoin");
    const chainMsg = screens.chain.querySelector("#ctChainMsg");
    const chainPickHead = screens.chain.querySelector("#ctChainPickHead");
    const chainPickTail = screens.chain.querySelector("#ctChainPickTail");
    const chainRestartBtn = screens.chain.querySelector("#ctChainRestartBtn");
    const chainStreakEl = screens.chain.querySelector("#ctChainStreak");
    const chainBestEl = screens.chain.querySelector("#ctChainBest");

    // ====== 画面切り替え ======
    function show(name) {
      Object.values(screens).forEach((el) => el.classList.add("hidden"));
      screens[name].classList.remove("hidden");
    }

    function refreshStartUI() {
      titlePointsEl.textContent = String(state.titlePoints);
      titleNameEl.textContent = pickTitle(state.titlePoints);
      const last = window.localStorage.getItem(LS.dailyDate);
      dailyStatusEl.textContent = (last === todayStr()) ? "Completed" : "Available";
    }

    function addTitlePoint(n) {
      state.titlePoints += n;
      writeInt(LS.titlePoints, state.titlePoints);
      refreshStartUI();
    }

    // ====== iPhone向け：pointerdown + click（disabled/hidden ガード） ======
    function onTap(el, fn) {
      if (!el) return;

      el.addEventListener("pointerdown", (e) => {
        if (el.disabled) return;
        if (el.classList?.contains("hidden")) return;
        e.preventDefault();
        ctx?.ensureAudioUnlocked?.();
        fn(e);
      }, { passive: false });

      el.addEventListener("click", (e) => {
        if (el.disabled) return;
        if (el.classList?.contains("hidden")) return;
        ctx?.ensureAudio?.();
        fn(e);
      });
    }

    // ====== 戻る（CT内） ======
    root.querySelectorAll("[data-ct-go='start']").forEach((btn) => {
      onTap(btn, () => {
        // 念のため：投げ中を解除
        state.tossing = false;
        refreshStartUI();
        show("start");
      });
    });

    // START -> 各モード
    onTap(btnQuick, () => { resetQuick(); show("quick"); });
    onTap(btnDaily, () => { enterDaily(); show("daily"); });
    onTap(btnChain, () => { enterChain(); show("chain"); });

    // Back（Quattroへ戻る）
    onTap(btnBack, () => {
  state.tossing = false;
  (ctx?.goStart || ctx?.goToStart || ctx?.goStartScreen)?.call(ctx);
});

    // =========================
    // QUICK
    // =========================
    function resetQuick() {
      quickCoin.src = IMG.HEAD;
      quickResult.textContent = "Tap to toss";
      quickTossBtn.disabled = false;
      state.tossing = false;
    }

    onTap(quickTossBtn, async () => {
      if (state.tossing) return;
      state.tossing = true;

      quickTossBtn.disabled = true;
      quickResult.textContent = "Tossing...";
      ctx?.playSfx?.("beep");

      const r = randResult();
      await tossAnimation(quickCoin, 1100);
      quickCoin.src = IMG[r];

      quickResult.textContent = `Result: ${r}`;
      quickTossBtn.disabled = false;
      state.tossing = false;
    });

    // =========================
    // DAILY
    // - 既に今日完了してたら pick ボタンを無効化
    // - 成功したら：TitlePoint +1 / 共通ポイント +5
    // =========================
    function enterDaily() {
      state.tossing = false;

      dailyCoin.src = IMG.HEAD;
      dailyAgainBtn.classList.add("hidden");

      const last = window.localStorage.getItem(LS.dailyDate);
      const doneToday = (last === todayStr());

      dailyPickHead.disabled = doneToday;
      dailyPickTail.disabled = doneToday;

      if (doneToday) {
        dailyMsg.textContent = "Already completed today. Come back tomorrow!";
        dailyAgainBtn.classList.remove("hidden");
        return;
      }

      dailyMsg.textContent = "Pick HEAD or TAIL";
    }

    async function playDaily(userPick) {
      if (state.tossing) return;

      const last = window.localStorage.getItem(LS.dailyDate);
      if (last === todayStr()) { enterDaily(); return; }

      state.tossing = true;

      dailyPickHead.disabled = true;
      dailyPickTail.disabled = true;

      dailyMsg.textContent = "Tossing...";
      ctx?.playSfx?.("beep");

      const r = randResult();
      await tossAnimation(dailyCoin, 1100);
      dailyCoin.src = IMG[r];

      window.localStorage.setItem(LS.dailyDate, todayStr());

      if (userPick === r) {
        dailyMsg.textContent = "Correct! +1 Title Point / +5 Points";
        addTitlePoint(1);
        ctx?.addPoints?.(5);        // ★共通ポイント +5
        ctx?.playSfx?.("go");
      } else {
        dailyMsg.textContent = `Miss... (Result: ${r})`;
        refreshStartUI();
      }

      dailyAgainBtn.classList.remove("hidden");
      state.tossing = false;
    }

    onTap(dailyPickHead, () => playDaily("HEAD"));
    onTap(dailyPickTail, () => playDaily("TAIL"));

    onTap(dailyAgainBtn, () => {
      state.tossing = false;
      refreshStartUI();
      show("start");
    });

    // =========================
    // CHAIN
    // =========================
    function setGlowByStreak(imgEl, streak) {
      imgEl.classList.remove("glow1", "glow2", "glow3");
      if (streak >= 10) imgEl.classList.add("glow3");
      else if (streak >= 5) imgEl.classList.add("glow2");
      else if (streak >= 3) imgEl.classList.add("glow1");
    }

    function enterChain() {
      state.tossing = false;
      state.chainStreak = 0;

      chainCoin.src = IMG.HEAD;
      chainMsg.textContent = "Pick HEAD or TAIL";
      chainRestartBtn.classList.add("hidden");

      chainPickHead.disabled = false;
      chainPickTail.disabled = false;

      chainBestEl.textContent = String(state.chainBest);
      chainStreakEl.textContent = String(state.chainStreak);
      setGlowByStreak(chainCoin, state.chainStreak);
    }

    async function playChain(userPick) {
      if (state.tossing) return;
      state.tossing = true;

      chainPickHead.disabled = true;
      chainPickTail.disabled = true;

      chainMsg.textContent = "Tossing...";
      ctx?.playSfx?.("beep");

      const r = randResult();
      await tossAnimation(chainCoin, 900);
      chainCoin.src = IMG[r];

      if (userPick === r) {
        state.chainStreak += 1;
        chainStreakEl.textContent = String(state.chainStreak);
        chainMsg.textContent = `Correct! Streak: ${state.chainStreak}`;
        setGlowByStreak(chainCoin, state.chainStreak);

        // ✅ 続行できる時だけ有効化
        chainPickHead.disabled = false;
        chainPickTail.disabled = false;

        state.tossing = false;
        return;
      }

      // ミス：ここからは再開ボタン以外は押せない（disabled + onTapガードで完全停止）
      chainMsg.textContent = `Miss... (Result: ${r}) Final Streak: ${state.chainStreak}`;

      if (state.chainStreak > state.chainBest) {
        state.chainBest = state.chainStreak;
        writeInt(LS.chainBest, state.chainBest);
        chainBestEl.textContent = String(state.chainBest);
        chainMsg.textContent += "  NEW BEST!";
      }

      chainRestartBtn.classList.remove("hidden");
      state.tossing = false;
    }

    onTap(chainPickHead, () => playChain("HEAD"));
    onTap(chainPickTail, () => playChain("TAIL"));
    onTap(chainRestartBtn, () => enterChain());

    // 初期表示
    refreshStartUI();
    show("start");

    // helper
    function mkScreen(className) {
      const d = document.createElement("div");
      d.className = className;
      return d;
    }
  },
};


