const TOKENS = {
  BTC: {
    name: "Bitcoin",
    icon: "₿",
    bg: "linear-gradient(135deg,#f7931a,#ffc246)",
    price: 71842,
    change: 2.84,
    vol: "$38.2B",
    mcap: "$1.41T",
    seed: 42
  },
  ETH: {
    name: "Ethereum",
    icon: "Ξ",
    bg: "#627eea",
    price: 2321,
    change: 1.12,
    vol: "$14.7B",
    mcap: "$279B",
    seed: 17
  },
  SOL: {
    name: "Solana",
    icon: "◎",
    bg: "#9945ff",
    price: 183.44,
    change: -0.77,
    vol: "$3.8B",
    mcap: "$84.7B",
    seed: 73
  },
  BNB: {
    name: "BNB",
    icon: "⬡",
    bg: "#f0b90b",
    price: 416.2,
    change: 0.54,
    vol: "$1.2B",
    mcap: "$62B",
    seed: 28
  }
};
const TFS = ["1H", "4H", "1D", "1W", "1M"];

let activeTok = "BTC";
let activeTf = "1D";
let livePoints = {};
let animFrame;

/* generate seeded pseudorandom price path */
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
function genPath(tok, tf) {
  const t = TOKENS[tok];
  const rng = seededRng(t.seed + TFS.indexOf(tf) * 100);
  const n = 80;
  const pts = [];
  let v = t.price * (1 - 0.04 - rng() * 0.04);
  const drift = t.change / 100 / n;
  for (let i = 0; i < n; i++) {
    v += v * drift + v * (rng() - 0.5) * 0.018;
    pts.push(v);
  }
  pts.push(t.price); // end at real price
  return pts;
}

function ptsToSvg(pts, W, H, pad = 12) {
  const mn = Math.min(...pts),
    mx = Math.max(...pts);
  const range = mx - mn || 1;
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = pad + (1 - (p - mn) / range) * (H - pad * 2);
    return [x, y];
  });
}

function drawChart(tok, tf) {
  const wrap = document.getElementById("chartWrap");
  const W = wrap.offsetWidth || 680,
    H = 200;
  const svg = document.getElementById("chartSvg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const pts = genPath(tok, tf);
  livePoints[tok + tf] = pts;
  const coords = ptsToSvg(pts, W, H);
  const t = TOKENS[tok];
  const isUp = t.change >= 0;
  const color = isUp ? "#caff00" : "#ff2d78";
  const gradId = "cg" + tok + tf;

  const d = coords
    .map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`))
    .join(" ");
  const last = coords[coords.length - 1];

  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="75%" stop-color="${color}" stop-opacity="0.04"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <!-- grid -->
    ${[0.25, 0.5, 0.75]
      .map(
        (y) =>
          `<line x1="0" y1="${y * H}" x2="${W}" y2="${
            y * H
          }" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>`
      )
      .join("")}
    <!-- fill -->
    <path d="${d} L${last[0]},${H} L0,${H} Z" fill="url(#${gradId})"/>
    <!-- line -->
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" opacity="0.9" filter="url(#glow)"/>
    <!-- live dot -->
    <circle cx="${last[0]}" cy="${
    last[1]
  }" r="4" fill="${color}" opacity="0.95"/>
    <circle cx="${last[0]}" cy="${
    last[1]
  }" r="9" fill="none" stroke="${color}" stroke-width="1" opacity="0.3">
      <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>
    </circle>
  `;

  /* update stored coords for hover */
  svg._coords = coords;
  svg._pts = pts;
}

/* hover interactions */
const wrap = document.getElementById("chartWrap");
wrap.addEventListener("mousemove", function (e) {
  const rect = this.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const W = rect.width;
  const svg = document.getElementById("chartSvg");
  if (!svg._coords) return;
  const coords = svg._coords,
    pts = svg._pts;
  const idx = Math.min(
    Math.round((x / W) * (coords.length - 1)),
    coords.length - 1
  );
  const [cx, cy] = coords[idx];
  const yPx = (cy / 200) * rect.height;

  document.getElementById(
    "crosshairLine"
  ).style.cssText = `left:${x}px;opacity:1`;
  document.getElementById("crosshairDot").style.cssText = `left:${
    (cx / svg.viewBox.baseVal.width) * rect.width
  }px;top:${yPx}px;opacity:1`;

  const tt = document.getElementById("tooltip");
  const tok = TOKENS[activeTok];
  document.getElementById("ttPrice").textContent =
    "$" +
    pts[idx].toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  const hoursAgo = Math.round(
    (coords.length - 1 - idx) *
      (activeTf === "1H"
        ? 1 / 60
        : activeTf === "4H"
        ? 4 / 60
        : activeTf === "1D"
        ? 24 / coords.length
        : activeTf === "1W"
        ? 168 / coords.length
        : 720 / coords.length)
  );
  document.getElementById("ttTime").textContent =
    hoursAgo === 0 ? "Now" : hoursAgo + "h ago";

  const ttX = Math.min(x + 14, rect.width - 130);
  tt.style.cssText = `left:${ttX}px;top:${Math.max(yPx - 30, 0)}px;opacity:1`;
});
wrap.addEventListener("mouseleave", () => {
  document.getElementById("crosshairLine").style.opacity = "0";
  document.getElementById("crosshairDot").style.opacity = "0";
  document.getElementById("tooltip").style.opacity = "0";
});

/* token tabs */
function buildTokenTabs() {
  const el = document.getElementById("tokenTabs");
  el.innerHTML = Object.entries(TOKENS)
    .map(
      ([k, t]) => `
    <div class="tok-tab ${k === activeTok ? "active" : ""}" data-tok="${k}">
      <div class="tok-tab__icon" style="background:${
        t.bg.includes("gradient") ? t.bg : t.bg
      };color:#fff;">${t.icon}</div>
      ${k}
    </div>
  `
    )
    .join("");
  el.querySelectorAll(".tok-tab").forEach((tab) => {
    tab.addEventListener("click", function () {
      activeTok = this.dataset.tok;
      updateAll();
    });
  });
}

/* timeframe tabs */
function buildTfTabs() {
  const el = document.getElementById("tfRow");
  el.innerHTML = TFS.map(
    (tf) =>
      `<button class="tf ${
        tf === activeTf ? "active" : ""
      }" data-tf="${tf}">${tf}</button>`
  ).join("");
  el.querySelectorAll(".tf").forEach((btn) => {
    btn.addEventListener("click", function () {
      activeTf = this.dataset.tf;
      updateAll();
    });
  });
}

function updateHeader() {
  const t = TOKENS[activeTok];
  const isUp = t.change >= 0;
  document.getElementById("tokenIcon").textContent = t.icon;
  document.getElementById("tokenIcon").style.background = t.bg;
  document.getElementById("tokenIcon").style.color = "#fff";
  document.getElementById("tokenSym").textContent = activeTok;
  document.getElementById("tokenName").innerHTML =
    t.name + ' <span class="live-dot"></span>Live';
  document.getElementById("priceEl").textContent =
    "$" + t.price.toLocaleString("en", { minimumFractionDigits: 2 });
  document.getElementById("priceEl").style.color = isUp ? "#caff00" : "#ff2d78";
  document.getElementById("deltaEl").textContent =
    (isUp ? "▲ +" : "▼ ") + Math.abs(t.change).toFixed(2) + "%";
  document.getElementById("deltaEl").className =
    "delta " + (isUp ? "up" : "down");

  const pts = genPath(activeTok, activeTf);
  const mn = Math.min(...pts),
    mx = Math.max(...pts);
  document.getElementById("statHigh").textContent =
    "$" + mx.toLocaleString("en", { maximumFractionDigits: 2 });
  document.getElementById("statLow").textContent =
    "$" + mn.toLocaleString("en", { maximumFractionDigits: 2 });
  document.getElementById("statVol").textContent = t.vol;
  document.getElementById("statMcap").textContent = t.mcap;
}

function updateAll() {
  buildTokenTabs();
  buildTfTabs();
  updateHeader();
  drawChart(activeTok, activeTf);
}

/* live price tick */
setInterval(() => {
  const t = TOKENS[activeTok];
  const drift = (Math.random() - 0.49) * t.price * 0.0008;
  t.price = Math.max(t.price + drift, 1);
  updateHeader();

  // extend chart path
  const svg = document.getElementById("chartSvg");
  if (svg._pts) {
    const newPt = t.price;
    const pts = [...svg._pts.slice(1), newPt];
    const W = wrap.offsetWidth || 680;
    const coords = ptsToSvg(pts, W, 200);
    svg._coords = coords;
    svg._pts = pts;
    drawChart(activeTok, activeTf);
  }
}, 2000);

updateAll();
window.addEventListener("resize", () => drawChart(activeTok, activeTf));
