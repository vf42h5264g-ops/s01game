// games/memory.js
// =====================================
// MemoryGame (EASY / NORMAL / HARD)
// - EASY  : 3種類×2=6枚 (v02,v03,v04)
// - NORMAL: 6種類×2=12枚 (v02..v07)
// - HARD  : NORMALと同じ + ミス5回でBAD END
// =====================================

export const MemoryGame = {
  id: "memory",

  // 内部状態（destroyで止めるため）
  _active: false,
  _timers: [],

  destroy(ctx) {
    this._active = false;
    // 反転待ちタイマー等を全消し
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];
    // 盤面を消す（イベントもDOMごと消える）
    if (ctx?.board) {
      ctx.board.innerHTML = "";
      ctx.board.classList.remove("layout-easy", "layout-12");
    }
    if (ctx?.missArea) ctx.missArea.textContent = "";
  },

  start(ctx, opt = {}) {
    // 直前の残骸を掃除
    this.destroy(ctx);
    this._active = true;

    const mode = opt.mode || ctx.getMode?.() || "easy";

    const BACK_SRC = "img/vback.jpg";

    // --- 盤面レイアウト
    ctx.board.classList.remove("layout-easy", "layout-12");
    if (mode === "easy") ctx.board.classList.add("layout-easy");
    else ctx.board.classList.add("layout-12");

    // --- ミス表示
    let miss = 0;
    const HARD_MAX_MISS = 5;

    const renderStatus = () => {
      if (!ctx.missArea) return;

      if (mode === "hard") {
        const left = Math.max(0, HARD_MAX_MISS - miss);
        ctx.missArea.textContent =
          "MISS : " + "✖".repeat(miss) + "・".repeat(left);
      } else {
        ctx.missArea.textContent = "";
      }
    };

    renderStatus();

    // --- カード構成
    const totalKinds = (mode === "easy") ? 3 : 6; // easy=3 / normal,hard=6
    const names = [];
    for (let i = 2; i < 2 + totalKinds; i++) {
      names.push("v" + i.toString().padStart(2, "0"));
    }

    // v02.. を2枚ずつ
    const cards = [...names, ...names].sort(() => Math.random() - 0.5);

    // --- 状態
    let firstImg = null;
    let lock = false;
    let startTime = Date.now();
    let openedCount = 0;

    // --- 1枚生成
    const makeCard = (name) => {
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = BACK_SRC;
      img.alt = name;
      img.dataset.open = "0";
      img.dataset.name = name;

      card.appendChild(img);

      card.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          if (!this._active) return;
          if (lock) return;
          if (img.dataset.open === "1") return;

          // open
          img.src = `img/${name}.jpg`;
          img.dataset.open = "1";
          openedCount++;

          // SE（好みで：めくり音をbeepにするなど）
          // ctx.playSfx?.("beep");

          if (!firstImg) {
            firstImg = img;
            return;
          }

          // 2枚目
          lock = true;

          const isMatch = firstImg.dataset.name === img.dataset.name;

          if (isMatch) {
            // 当たり
            firstImg = null;
            lock = false;

            // クリア判定
            if (openedCount >= cards.length) {
              // クリア
              const timeSec = ((Date.now() - startTime) / 1000).toFixed(1);
              // ctx.playSfx?.("go");
              ctx.showResult?.({
                title: "PERFECT!!",
                timeSec,
                mode,
              });
            }
            return;
          }

          // 外れ：少し見せて戻す
          const t = setTimeout(() => {
            if (!this._active) return;

            img.src = BACK_SRC;
            firstImg.src = BACK_SRC;

            img.dataset.open = "0";
            firstImg.dataset.open = "0";

            openedCount -= 2;

            firstImg = null;
            lock = false;

            miss++;
            renderStatus();

            // HARD：BAD END
            if (mode === "hard" && miss >= HARD_MAX_MISS) {
              ctx.showResult?.({
                title: "BAD END…",
                timeSec: null,
                mode,
              });
            }
          }, 800);

          this._timers.push(t);
        },
        { passive: false }
      );

      return card;
    };

    // --- 盤面描画
    ctx.board.innerHTML = "";
    cards.forEach((name) => {
      ctx.board.appendChild(makeCard(name));
    });
  },
};




