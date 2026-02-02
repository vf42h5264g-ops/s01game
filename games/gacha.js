// games/gacha.js
export const GachaGame = {
  id: "gacha",

  destroy(ctx) {
    if (ctx?.board) ctx.board.innerHTML = "";
  },

  start(ctx) {
    const board = ctx.board;
    board.innerHTML = "";

    const LS = {
      owned: "gacha_owned_v1",     // { id: count }
      shards: "gacha_shards_v1",   // number
      last: "gacha_last_v1",       // last card id
    };

    const COST = 10; // 1回10P（好きに変更OK）

    // ==== カード定義（まずは20枚くらいから）====
    // あとで「画像URL」「説明」「攻撃/HP」など増やしてカードっぽくできる
    const POOL = [
      { id: "N_001", name: "アーリーリサイタル", rarity: "N" },
      { id: "N_002", name: "雑用猫", rarity: "N" },
      { id: "N_003", name: "ミニ樽テキーラ", rarity: "N" },
      { id: "R_001", name: "運命のコイントス", rarity: "R" },
      { id: "R_002", name: "夜更かしマイスター", rarity: "R" },
      { id: "SR_001", name: "赤絨毯の城", rarity: "SR" },
      { id: "SR_002", name: "必殺トス", rarity: "SR" },
      { id: "SSR_001", name: "Quattro Vageena", rarity: "SSR" },
    ];

    // ==== レア抽選（確率は好きに調整）====
    const RARITY_RATE = [
      { rarity: "N",  p: 0.75 },
      { rarity: "R",  p: 0.20 },
      { rarity: "SR", p: 0.045 },
      { rarity: "SSR",p: 0.005 },
    ];

    function readJSON(key, fallback) {
      try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : fallback;
      } catch {
        return fallback;
      }
    }
    function writeJSON(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
    function readInt(key, fallback = 0) {
      try {
        const n = Number(localStorage.getItem(key));
        return Number.isFinite(n) ? n : fallback;
      } catch { return fallback; }
    }
    function writeInt(key, v) {
      try { localStorage.setItem(key, String(v)); } catch {}
    }

    let owned = readJSON(LS.owned, {});     // { cardId: count }
    let shards = readInt(LS.shards, 0);

    // ==== UI ====
    const root = document.createElement("div");
    root.className = "gachaRoot";
    board.appendChild(root);

    root.innerHTML = `
      <div class="gachaHeader">
        <div class="gachaTitle">CARDDASS</div>
        <div class="gachaSub">共通ポイントで回せる懐かしカードダス</div>
      </div>

      <div class="gachaPanel">
        <div class="gachaRow">
          <div>所持P: <b id="gachaP"></b></div>
          <div>欠片: <b id="gachaShards"></b></div>
        </div>
        <div class="gachaRow">
          <button id="gachaRoll">1回まわす（${COST}P）</button>
          <button id="gachaBack">Back</button>
        </div>
        <div class="gachaNote">※重複は欠片+1（SR以上は+3）</div>
      </div>

      <div id="gachaResult" class="gachaResult hidden"></div>

      <div class="gachaCollection">
        <div class="gachaCollectionHead">
          <div>COLLECTION</div>
          <button id="gachaClear" class="gachaDanger">図鑑リセット</button>
        </div>
        <div id="gachaGrid" class="gachaGrid"></div>
      </div>
    `;

    const pEl = root.querySelector("#gachaP");
    const shardsEl = root.querySelector("#gachaShards");
    const rollBtn = root.querySelector("#gachaRoll");
    const backBtn = root.querySelector("#gachaBack");
    const resultEl = root.querySelector("#gachaResult");
    const gridEl = root.querySelector("#gachaGrid");
    const clearBtn = root.querySelector("#gachaClear");

    function rarityColorClass(r) {
      if (r === "SSR") return "rarSSR";
      if (r === "SR") return "rarSR";
      if (r === "R") return "rarR";
      return "rarN";
    }

    function refreshTop() {
      pEl.textContent = String(ctx.getPoints?.() ?? 0);
      shardsEl.textContent = String(shards);
    }

    function renderGrid() {
      const ownedSet = new Set(Object.keys(owned));
      gridEl.innerHTML = "";

      POOL.forEach((c) => {
        const cell = document.createElement("div");
        const have = ownedSet.has(c.id);
        const count = owned[c.id] || 0;

        cell.className = `gachaCardMini ${rarityColorClass(c.rarity)} ${have ? "" : "locked"}`;
        cell.innerHTML = `
          <div class="miniTop">${c.rarity}</div>
          <div class="miniName">${have ? c.name : "？？？"}</div>
          <div class="miniCount">${have ? `x${count}` : ""}</div>
        `;
        gridEl.appendChild(cell);
      });
    }

    function pickRarity() {
      const r = Math.random();
      let acc = 0;
      for (const it of RARITY_RATE) {
        acc += it.p;
        if (r <= acc) return it.rarity;
      }
      return "N";
    }

    function pickCardByRarity(rarity) {
      const list = POOL.filter((c) => c.rarity === rarity);
      return list[Math.floor(Math.random() * list.length)];
    }

    function showResultCard(card, isDup, shardGain) {
      resultEl.classList.remove("hidden");
      resultEl.innerHTML = `
        <div class="gachaCard ${rarityColorClass(card.rarity)} ${card.rarity === "SSR" ? "shine" : ""}">
          <div class="cardTop">
            <div class="cardRarity">${card.rarity}</div>
            <div class="cardId">${card.id}</div>
          </div>
          <div class="cardName">${card.name}</div>
          <div class="cardBottom">
            <div>${isDup ? "DUPLICATE" : "NEW!"}</div>
            <div>${isDup ? `欠片 +${shardGain}` : ""}</div>
          </div>
        </div>
      `;
    }

    function onTap(el, fn) {
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        ctx?.ensureAudioUnlocked?.();
        fn(e);
      }, { passive: false });
      el.addEventListener("click", (e) => {
        ctx?.ensureAudioUnlocked?.();
        fn(e);
      });
    }

    onTap(rollBtn, () => {
      const haveP = ctx.getPoints?.() ?? 0;
      if (haveP < COST) {
        resultEl.classList.remove("hidden");
        resultEl.innerHTML = `<div class="gachaMsg">ポイントが足りない！ (${COST}P必要)</div>`;
        return;
      }

      // 1) 消費（addPointsは増加専用の実装が多いので、ここは set 方式を避ける）
      // いまの main.js は addPoints が「加算のみ」なので、消費は localStorage直書きが必要
      // ただし “共通ポイント” を一元管理したいので、main.js側に spendPoints を足すのがベスト。
      // ここでは暫定：負の加算を許容してる場合だけ引く。無理なら次の節で main.js 改修。
      if (ctx.addPoints && ctx.addPoints.length >= 1) {
        // ctx.addPoints が負数を弾く実装だと減らない → 次の節で spendPoints を追加して対応
        const before = ctx.getPoints?.() ?? 0;
        const after = before - COST;
        if (after === before) {
          resultEl.classList.remove("hidden");
          resultEl.innerHTML = `<div class="gachaMsg">消費API未実装。main.jsに spendPoints を追加して！</div>`;
          return;
        }
      }

      // 2) 抽選
      const rarity = pickRarity();
      const card = pickCardByRarity(rarity);

      // 3) 所持更新
      const prev = owned[card.id] || 0;
      const isDup = prev > 0;
      owned[card.id] = prev + 1;
      writeJSON(LS.owned, owned);
      localStorage.setItem(LS.last, card.id);

      let shardGain = 0;
      if (isDup) {
        shardGain = (rarity === "SR" || rarity === "SSR") ? 3 : 1;
        shards += shardGain;
        writeInt(LS.shards, shards);
      }

      // 4) 表示
      showResultCard(card, isDup, shardGain);
      renderGrid();
      refreshTop();

      // 5) SFX
      if (rarity === "SSR") ctx.playSfx?.("go");
      else ctx.playSfx?.("beep");
    });

    onTap(backBtn, () => {
      (ctx.goStart || ctx.goToStart)?.();
    });

    onTap(clearBtn, () => {
      // 図鑑リセット（ポイントは触らない）
      owned = {};
      shards = 0;
      writeJSON(LS.owned, owned);
      writeInt(LS.shards, shards);
      resultEl.classList.add("hidden");
      renderGrid();
      refreshTop();
    });

    // 初期描画
    refreshTop();
    renderGrid();
  },
};
