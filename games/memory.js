// games/memory.js
export const MemoryGame = {
  id: "memory",

  destroy(ctx) {
    // boardを空にしてイベントごと捨てる
    if (ctx?.board) ctx.board.innerHTML = "";
    if (ctx?.missArea) ctx.missArea.textContent = "";
  },

  start(ctx, opts = {}) {
    const mode = opts.mode || ctx.getMode?.() || "easy";

    const board = ctx.board;
    const missArea = ctx.missArea;

    const BACK_SRC = "img/vback.jpg";

    // ===== モード別設定 =====
    // 画像種類数：easy 3種(6枚) / normal&hard 6種(12枚)
    const kindCount =
      mode === "easy" ? 3 :
      mode === "normal" ? 6 :
      mode === "hard" ? 6 : 6;

    // クリア時ポイント（好きに調整OK）
    const clearPoints =
      mode === "easy" ? 1 :
      mode === "normal" ? 2 :
      mode === "hard" ? 3 : 0;

    // ===== 盤面レイアウト（CSSクラス） =====
    board.classList.remove("layout-easy", "layout-12");
    if (mode === "easy") board.classList.add("layout-easy");
    else board.classList.add("layout-12");

    // ===== 状態 =====
    let first = null;
    let lock = false;
    let miss = 0;
    const startTime = Date.now();

    function renderStatus() {
      if (!missArea) return;
      if (mode === "hard") {
        const max = 5;
        missArea.textContent =
          "MISS : " + "✖".repeat(miss) + "・".repeat(Math.max(0, max - miss));
      } else {
        missArea.textContent = "";
      }
    }

    function checkBadEnd() {
      if (mode === "hard" && miss >= 5) {
        // BAD END はポイントなし
        ctx.showResult?.({
          title: "BAD END…",
          timeSec: null,
          mode,
          pointsEarned: 0,
        });
        return true;
      }
      return false;
    }

    function checkClear() {
      const open = [...board.querySelectorAll(".card img")]
        .every(img => img.dataset.open === "1");

      if (!open) return;

      const timeSec = ((Date.now() - startTime) / 1000).toFixed(1);

      // ✅ ポイント加算
      const earned = clearPoints;
      if (earned > 0) {
        ctx.addPoints?.(earned);
        ctx.showPointGain?.(earned); // 画面内 +◯P（任意）
      }

      ctx.showResult?.({
        title: "PERFECT!!",
        timeSec,
        mode,
        pointsEarned: earned,
      });
    }

    // ===== デッキ生成 =====
    // v02〜 を使う（kindCount=3なら v02,v03,v04）
    const names = [];
    for (let i = 2; i < 2 + kindCount; i++) {
      names.push("v" + String(i).padStart(2, "0"));
    }
    const cards = [...names, ...names].sort(() => Math.random() - 0.5);

    // ===== 描画 =====
    board.innerHTML = "";
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
        if (lock) return;
        if (img.dataset.open === "1") return;

        // 開く
        img.src = `img/${name}.jpg`;
        img.dataset.open = "1";

        if (!first) {
          first = img;
          return;
        }

        lock = true;

        // 一致
        if (first.dataset.name === img.dataset.name) {
          first = null;
          lock = false;
          checkClear();
          return;
        }

        // 不一致
        setTimeout(() => {
          img.src = BACK_SRC;
          first.src = BACK_SRC;
          img.dataset.open = "0";
          first.dataset.open = "0";
          first = null;
          lock = false;

          miss++;
          renderStatus();
          if (!checkBadEnd()) {
            // 続行
          }
        }, 800);
      }, { passive: false });
    });
  },
};






