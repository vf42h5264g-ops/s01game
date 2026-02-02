import { CARDS } from "../cards/cards.js";

export const GachaGame = {
  id: "gacha",

  destroy(ctx) {
    if (ctx?.board) ctx.board.innerHTML = "";
  },

  start(ctx) {
    const board = ctx.board;
    board.innerHTML = "";

    const LS = {
      owned: "card_owned_v1",   // { [cardId]: count }
      shards:"card_shards_v1",  // number
    };

    const COST = 10;

    const RARITY_RATE = [
      { rarity: "N",  p: 0.75 },
      { rarity: "R",  p: 0.20 },
      { rarity: "SR", p: 0.045 },
      { rarity: "SSR",p: 0.005 },
    ];

    const readJSON = (k, fb) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : fb; } catch { return fb; } };
    const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    const readInt = (k, fb=0) => { try { const n = Number(localStorage.getItem(k)); return Number.isFinite(n) ? n : fb; } catch { return fb; } };
    const writeInt = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };

    let owned = readJSON(LS.owned, {});
    let shards = readInt(LS.shards, 0);

    const root = document.createElement("div");
    root.className = "cdRoot";
    board.appendChild(root);

    root.innerHTML = `
      <div class="cdHeader">
        <div class="cdTitle">CARDDASS</div>
        <div class="cdSub">共通Pで引ける・集める（バトルは後で実装）</div>
      </div>

      <div class="cdPanel">
        <div>所持P: <b id="cdP"></b> / 欠片: <b id="cdShards"></b></div>
        <div class="cdBtns">
          <button id="cdRoll">ガチャ（${COST}P）</button>
          <button id="cdBack">Back</button>
        </div>
        <div class="cdNote">重複：欠片+1（SR/SSRは+3）</div>
      </div>

      <div id="cdResult" class="cdResult"></div>

      <div class="cdLibrary">
        <div class="cdLibHead">
          <div>LIBRARY</div>
          <button id="cdReset" class="cdDanger">図鑑リセット</button>
        </div>
        <div id="cdGrid" class="cdGrid"></div>
      </div>
    `;

    const pEl = root.querySelector("#cdP");
    const shardsEl = root.querySelector("#cdShards");
    const gridEl = root.querySelector("#cdGrid");
    const resultEl = root.querySelector("#cdResult");

    const onTap = (el, fn) => {
      if (!el) return;
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); ctx?.ensureAudioUnlocked?.(); fn(e); }, { passive:false });
      el.addEventListener("click", (e) => { ctx?.ensureAudioUnlocked?.(); fn(e); });
    };

    const handIcon = (hand) => hand === "rock" ? "✊" : hand === "scissors" ? "✌" : "✋";

    const rarityClass = (r) => r === "SSR" ? "rarSSR" : r === "SR" ? "rarSR" : r === "R" ? "rarR" : "rarN";

    function refreshTop() {
      pEl.textContent = String(ctx.getPoints?.() ?? 0);
      shardsEl.textContent = String(shards);
    }

    // テンプレ背景にステータスを重ねた “カード表示”
    function renderCardHTML(card, locked=false, count=0) {
      if (locked) {
        return `
          <div class="cdCardMini locked">
            <div class="cdMiniTop">???</div>
            <div class="cdMiniMid">？？？</div>
          </div>
        `;
      }

      return `
        <div class="cdCardMini ${rarityClass(card.rarity)}">
          <div class="cdMiniTop">${card.rarity} / ${card.id}</div>
          <div class="cdMiniMid">${card.name}</div>
          <div class="cdMiniBot">
            <span>P${card.power}</span>
            <span>${handIcon(card.hand)}</span>
            <span>x${count}</span>
          </div>
        </div>
      `;
    }

    function renderGrid() {
      gridEl.innerHTML = "";
      CARDS.forEach((c) => {
        const cnt = owned[c.id] || 0;
        const cell = document.createElement("div");
        cell.innerHTML = renderCardHTML(c, cnt === 0, cnt);
        const cardEl = cell.firstElementChild;

        // 詳細表示（クリックで大きく表示）
        onTap(cardEl, () => {
          if (cnt === 0) return;
          resultEl.innerHTML = renderBigCard(c, cnt, false, 0);
        });

        gridEl.appendChild(cardEl);
      });
    }

    function pickRarity() {
      const r = Math.random();
      let acc = 0;
      for (const it of RARITY_RATE) { acc += it.p; if (r <= acc) return it.rarity; }
      return "N";
    }

    function pickCardByRarity(rarity) {
      const list = CARDS.filter(c => c.rarity === rarity);
      return list[Math.floor(Math.random() * list.length)];
    }

    function renderBigCard(card, count, isDup, shardGain) {
      // ここで “あなたのテンプレ画像” を背景にしてカードダス感を出す
      // artは今はテンプレ固定でOK。カード個別に画像を持たせたくなったら art を差し替えるだけ。
      return `
        <div class="cdBigWrap">
          <div class="cdBig ${rarityClass(card.rarity)} ${card.rarity==="SSR" ? "shine":""}">
            <div class="cdBigBg" style="background-image:url('${card.art}')"></div>

            <div class="cdBigTop">
              <div>${card.rarity}</div>
              <div>${card.id}</div>
            </div>

            <div class="cdBigName">${card.name}</div>

            <div class="cdBigStats">
              <div class="stat">P${card.power}</div>
              <div class="stat">${handIcon(card.hand)}</div>
              <div class="stat">x${count}</div>
            </div>

            <div class="cdBigFoot">
              <div>${isDup ? "DUPLICATE" : "NEW!"}</div>
              <div>${isDup ? `欠片 +${shardGain}` : ""}</div>
            </div>
          </div>
        </div>
      `;
    }

    onTap(root.querySelector("#cdRoll"), () => {
      // 1) 消費
      const ok = ctx?.spendPoints?.(COST);
      if (!ok) {
        resultEl.innerHTML = `<div class="cdMsg">ポイントが足りない！（${COST}P必要）</div>`;
        return;
      }

      // 2) 抽選
      const rarity = pickRarity();
      const card = pickCardByRarity(rarity);

      // 3) 所持更新
      const prev = owned[card.id] || 0;
      const isDup = prev > 0;
      owned[card.id] = prev + 1;
      writeJSON(LS.owned, owned);

      let shardGain = 0;
      if (isDup) {
        shardGain = (rarity === "SR" || rarity === "SSR") ? 3 : 1;
        shards += shardGain;
        writeInt(LS.shards, shards);
      }

      // 4) 表示
      resultEl.innerHTML = renderBigCard(card, owned[card.id], isDup, shardGain);
      renderGrid();
      refreshTop();

      // 5) SFX
      if (rarity === "SSR") ctx.playSfx?.("go");
      else ctx.playSfx?.("beep");
    });

    onTap(root.querySelector("#cdBack"), () => (ctx.goStart || ctx.goToStart)?.());

    onTap(root.querySelector("#cdReset"), () => {
      owned = {};
      shards = 0;
      writeJSON(LS.owned, owned);
      writeInt(LS.shards, shards);
      resultEl.innerHTML = "";
      renderGrid();
      refreshTop();
    });

    // 初期描画
    refreshTop();
    renderGrid();
  }
};

