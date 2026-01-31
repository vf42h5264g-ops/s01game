// games/ntd.js
// =====================================
// NT-D Game
// - v03 を引いたら即負け
// - safe: v01,v02,v04,v05,v06,v07 から 11枚（重複あり） + v03を1枚 = 12枚
// - safe 11枚めくり切ったら勝ち
// - v03負け時：ランダム台詞のみ表示（固定文なし）
// =====================================

export const NtdGame = {
  id: "destroy",

  _active: false,
  _timers: [],
  _overlayEl: null,

  destroy(ctx) {
    this._active = false;

    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];

    if (this._overlayEl) {
      this._overlayEl.remove();
      this._overlayEl = null;
    }

    if (ctx?.board) {
      ctx.board.innerHTML = "";
      ctx.board.classList.remove("layout-easy", "layout-12");
    }
    if (ctx?.missArea) ctx.missArea.textContent = "";
  },

  start(ctx, opt = {}) {
    this.destroy(ctx);
    this._active = true;

    const mode = opt.mode || ctx.getMode?.() || "destroy"; // 念のため
    const BACK_SRC = "img/vback.jpg";

    // 盤面レイアウトは 12枚
    ctx.board.classList.remove("layout-easy", "layout-12");
    ctx.board.classList.add("layout-12");

    // 台詞（ランダム）
    const lines = [
      "いきまーーっす！",
      "飲めよ国民！",
      "坊やだからさ・・・",
      "ザクとは違うのだよ",
      "見せてもらおうか",
    ];
    const pickLine = () => lines[Math.floor(Math.random() * lines.length)];

    // カード生成
    const pool = ["v01", "v02", "v04", "v05", "v06", "v07"];

    const safe11 = Array.from({ length: 11 }, () => {
      return pool[Math.floor(Math.random() * pool.length)];
    });

    const cards = [...safe11, "v03"].sort(() => Math.random() - 0.5);

    let lock = false;
    let safeOpened = 0;
    const startTime = Date.now();

    const renderStatus = () => {
      if (!ctx.missArea) return;
      const remain = Math.max(0, 11 - safeOpened);
      ctx.missArea.textContent = `SAFE : ${safeOpened}/11   残り ${remain}`;
    };
    renderStatus();

    const showLoseOverlay = (lineText) => {
      if (!this._active) return;

      // 既存があれば消す
      if (this._overlayEl) {
        this._overlayEl.remove();
        this._overlayEl = null;
      }

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

      // ✅ ランダム台詞のみ
      const line = document.createElement("div");
      line.textContent = lineText;
      line.style.color = "#ff3bd4";
      line.style.fontSize = "clamp(18px, 4.8vw, 40px)";
      line.style.fontWeight = "900";
      line.style.letterSpacing = "0.04em";
      line.style.textShadow = "0 0 14px rgba(255, 60, 212, 0.55)";

      // ボタン行
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

      retry.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          if (!this._active) return;
          overlay.remove();
          this._overlayEl = null;
          // NT-Dを再スタート
          this.start(ctx, { mode: "destroy" });
        },
        { passive: false }
      );

      const back = document.createElement("button");
      back.textContent = "モード選択";
      back.style.padding = "12px 18px";
      back.style.fontSize = "18px";
      back.style.borderRadius = "12px";
      back.style.border = "none";
      back.style.cursor = "pointer";

      back.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          overlay.remove();
          this._overlayEl = null;
          // main.js 側で start画面に戻す関数を用意してある想定
          ctx.goToStart?.();
        },
        { passive: false }
      );

      btnRow.appendChild(retry);
      btnRow.appendChild(back);

      overlay.appendChild(img);
      overlay.appendChild(line);
      overlay.appendChild(btnRow);

      document.body.appendChild(overlay);
      this._overlayEl = overlay;
    };

    // 盤面描画
    ctx.board.innerHTML = "";

    cards.forEach((name) => {
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = BACK_SRC;
      img.dataset.open = "0";
      img.dataset.name = name;

      card.appendChild(img);
      ctx.board.appendChild(card);

      card.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          if (!this._active) return;
          if (lock) return;
          if (img.dataset.open === "1") return;

          img.src = `img/${name}.jpg`;
          img.dataset.open = "1";

          // v03 = 即負け
          if (name === "v03") {
            lock = true;

            // めくった瞬間に音
            ctx.playSfx?.("go");

            // UIは少しだけ遅らせる（視認性のため）
            const t = setTimeout(() => {
              if (!this._active) return;
              showLoseOverlay(pickLine());
            }, 60);
            this._timers.push(t);
            return;
          }

          // safe
          safeOpened++;
          renderStatus();

          if (safeOpened >= 11) {
            lock = true;

            const t = setTimeout(() => {
              if (!this._active) return;
              const timeSec = ((Date.now() - startTime) / 1000).toFixed(1);

              // 勝利表示（Result画面）
              ctx.showResult?.({
                title: "SURVIVED!!",
                timeSec,
                mode,
              });
            }, 200);
            this._timers.push(t);
          }
        },
        { passive: false }
      );
    });
  },
};





