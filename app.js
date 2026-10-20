// app.js: complete single file
const D = window.DATA;
const app = document.getElementById("app");
const routes = {};

const style = document.createElement("style");
style.textContent = `
  tr.row-champ td { background: #FFC72C !important; color: #0B4429; font-weight: 700; }
  tr.row-silver td { background: #B8C4CC !important; color: #0B4429; font-weight: 600; }
  td, th { font-variant-numeric: tabular-nums; }
  table { min-width: 100%; }
`;
document.head.appendChild(style);

const CATS = ["PTS", "REB", "AST", "3PM", "STL", "BLK", "TO", "FG%", "FT%"];
const CAT_LABEL = { PTS: "Points", REB: "Rebounds", AST: "Assists", "3PM": "3-pointers",
  STL: "Steals", BLK: "Blocks", TO: "Turnovers (lowest is best)", "FG%": "FG%", "FT%": "FT%" };

const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const seasonLabel = y => `${y - 1}-${String(y).slice(2)}`;
const pct = v => v == null ? "N/A" : Number(v).toFixed(2) + "%";
const na = v => (v === null || v === undefined || v === "") ? "N/A" : v;
const X = D.extra || {};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Season 2022 is 2021-22, so Oct to Dec dates fall in the year before the season label
function fullDate(season, date) {
  if (!date || date.startsWith("date not")) return "Date not recorded";
  const mi = MONTHS.indexOf(date.split(" ")[0]);
  const yr = mi >= 9 ? season - 1 : season;
  return `${date}, ${yr}`;
}
// Sort key from a date such as "Feb 13 12:34 PM, 2023" (time removed before parsing)
function dateKey(season, date) {
  const f = fullDate(season, date);
  if (f === "Date not recorded") return 0;
  const d = Date.parse(f.replace(/\s\d{1,2}:\d{2}\s[AP]M/, ""));
  return isNaN(d) ? 0 : d;
}

// Sortable table. Click a header to sort; click again to reverse.
function mount(el, cols, rows, opts = {}) {
  let data = rows.slice(), key = null, asc = true;
  const draw = () => {
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>${cols.map(c =>
      `<th data-k="${c.key}" class="${c.num ? "num" : ""}">${esc(c.label)} <span class="arrow">↕</span></th>`
    ).join("")}</tr></thead><tbody>${data.map(r =>
      `<tr class="${opts.rowClass ? opts.rowClass(r) : ""}">${cols.map(c => {
        const raw = c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? "");
        const shown = (typeof raw === "number" && !Number.isInteger(raw)) ? raw.toFixed(2) : raw;
        return `<td class="${c.num ? "num" : ""}">${esc(shown)}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>`;
    el.querySelectorAll("th").forEach(th => th.onclick = () => {
      const k = th.dataset.k;
      asc = key === k ? !asc : true;
      key = k;
      data.sort((a, b) => {
        const ck = (cols.find(c => c.key === k) || {}).sortKey || k; const x = a[ck], y = b[ck];
        if (typeof x === "number" && typeof y === "number") return asc ? x - y : y - x;
        const sx = String(x ?? ""), sy = String(y ?? "");
        return asc ? sx.localeCompare(sy) : sy.localeCompare(sx);
      });
      draw();
    });
  };
  draw();
}

// Picker: a dropdown above one table at a time, like the Managers page.
// options: [{label, value}]; render(container, value) draws the chosen view.
function picker(el, options, render) {
  el.innerHTML = `<select class="search">${options.map(o =>
    `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select><div class="pkb"></div>`;
  const sel = el.querySelector(":scope > select");
  const box = el.querySelector(":scope > .pkb");
  const go = () => render(box, sel.value);
  sel.onchange = go;
  go();
}

// Home
routes.home = () => {
  app.innerHTML = `<h1>Champions</h1><div class="card" id="champs"></div>
    <h2>Overall record</h2>
    <p class="note">Win % counts a tie as half a win. Seasons completed excludes 2027.
      Ranked out of ${D.home.ranked_of} managers.</p>
    <div id="rec"></div>`;
  document.getElementById("champs").innerHTML = [...D.home.champions].reverse().map(c =>
    `<div class="champ"><span class="season">${seasonLabel(c.season)}</span><span>${esc(c.name)}</span></div>`
  ).join("");
  mount(document.getElementById("rec"), [
    { key: "rank", label: "Rank", num: true, fmt: v => na(v) },
    { key: "name", label: "Manager" },
    { key: "seasons_played", label: "Seasons", num: true },
    { key: "w", label: "W", num: true },
    { key: "l", label: "L", num: true },
    { key: "t", label: "T", num: true },
    { key: "win_pct", label: "Win %", num: true, fmt: pct },
    { key: "titles", label: "Titles", num: true },
    { key: "rs_last", label: "Last in RS", num: true },
    { key: "playoff_apps", label: "Playoffs", num: true },
    { key: "playoff_misses", label: "Playoff misses", num: true },
  ], D.home.record);
};

// Seasons: ordered by final position, champion gold, runner-up silver
routes.seasons = arg => {
  const years = Object.keys(D.seasons).map(Number).sort((a, b) => b - a);
  const season = arg && D.seasons[arg] ? Number(arg) : years[0];
  const rows = D.seasons[season];
  app.innerHTML = `<h1>Season ${seasonLabel(season)}</h1>
    <div class="toggle">${years.map(y =>
      `<button class="${y === season ? "on" : ""}" onclick="location.hash='seasons/${y}'">${seasonLabel(y)}</button>`
    ).join("")}</div>
    <p class="note">Gold: champion. Silver: grand final runner-up. Green: playoffs.
      Red text: last in the regular season. Ordered by final position. Click a heading to sort.</p>
    <div id="standings"></div>`;
  mount(document.getElementById("standings"), [
    { key: "final_pos", label: "Final pos", num: true, fmt: v => na(v) },
    { key: "name", label: "Manager" },
    { key: "team_name", label: "Team" },
    { key: "record", label: "W-L-T", num: true },
    { key: "rs_pos", label: "RS pos", num: true, fmt: v => na(v) },
    { key: "draft_pick", label: "Draft pick", num: true, fmt: v => na(v) },
    { key: "status", label: "Result" },
  ], rows, {
    rowClass: r => r.won_gf ? "row-champ"
      : r.made_gf ? "row-silver"
      : r.made_playoffs ? "row-playoff"
      : r.rs_last ? "row-last" : "",
  });
};

// Managers: one page per person
routes.people = arg => {
  const list = D.people;
  const current = list.find(p => p.person_id === arg) || list[0];
  const options = list.map(p =>
    `<option value="${esc(p.person_id)}" ${p.person_id === current.person_id ? "selected" : ""}>${esc(p.name)}</option>`
  ).join("");
  app.innerHTML = `<h1>Managers</h1>
    <select class="search" onchange="location.hash='people/'+this.value">${options}</select>
    <div id="person"></div>`;
  renderManager(current);
};

function renderManager(p) {
  const d = p.draft;
  const best = d && d.most_drafted ? d.most_drafted : null;
  document.getElementById("person").innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">${esc(p.name)}</h2>
      <p>Seasons completed: <b>${p.seasons_played}</b> · Titles: <b>${p.titles}</b> ·
        Grand finals: <b>${p.gf_apps}</b> · Playoffs: <b>${p.playoff_apps}</b> · Playoff misses: <b>${p.playoff_misses}</b></p>
      <p>Overall record: <b>${p.w}-${p.l}-${p.t}</b> (${pct(p.win_pct)}) · Rank:
        <b>${p.rank != null ? "#" + p.rank + " of " + D.home.ranked_of : "N/A"}</b></p>
      <p>Last in regular season: <b>${p.rs_last}</b> · Hall of Shame: <b>${p.hall_9_0}</b> nine-category weeks,
        <b>${p.hall_0_9}</b> zero-category weeks</p>
      <p>Playoff record: <b>${p.po_w}-${p.po_l}</b> · Grand final record: <b>${p.gf_w}-${p.gf_l}</b></p>
      <p>Most drafted: <b>${best ? esc(best.players.join(", ")) + " (" + best.count + " times)" : "N/A"}</b></p>
      <p>Average draft %: <b>${d ? pct(d.avg_pct) : "N/A"}</b></p>
    </div>
    <h2>By season</h2><div id="ps"></div>
    <h2>Category records</h2>
    <div class="toggle">
      <button id="kr" class="on">Regular season</button>
      <button id="kp">Playoffs</button>
    </div>
    <select class="search" id="cat">${CATS.map(c =>
      `<option value="${c}">${esc(CAT_LABEL[c])}</option>`).join("")}</select>
    <div id="pr"></div>
    <h2>Season averages (per roster player, weekly)</h2><div id="sa"></div>`;

  mount(document.getElementById("ps"), [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
    { key: "team_name", label: "Team this season" },
    { key: "record", label: "W-L-T" },
    { key: "rs_pos", label: "RS pos", num: true, fmt: v => na(v) },
    { key: "draft_pick", label: "Draft pick", num: true, fmt: v => na(v) },
    { key: "final_pos", label: "Final pos", num: true, fmt: v => na(v) },
    { key: "status", label: "Result" },
  ], p.season_rows);

  let kind = "regular";
  const drawRecords = () => {
    const cat = document.getElementById("cat").value;
    const rec = p.records && p.records[kind] && p.records[kind][cat];
    const box = document.getElementById("pr");
    if (!rec) { box.innerHTML = `<p class="note">No data for this category.</p>`; return; }
    box.innerHTML = `<h3>Best five</h3><div id="pb"></div><h3>Worst five</h3><div id="pw"></div>`;
    weekTable(document.getElementById("pb"), rec.best);
    weekTable(document.getElementById("pw"), rec.worst);
  };
  document.getElementById("kr").onclick = () => {
    kind = "regular";
    document.getElementById("kr").classList.add("on");
    document.getElementById("kp").classList.remove("on");
    drawRecords();
  };
  document.getElementById("kp").onclick = () => {
    kind = "playoffs";
    document.getElementById("kp").classList.add("on");
    document.getElementById("kr").classList.remove("on");
    drawRecords();
  };
  document.getElementById("cat").onchange = drawRecords;
  drawRecords();

  mount(document.getElementById("sa"), [
    { key: "cat", label: "Category" },
    { key: "best", label: "Best weekly avg", num: true, fmt: v => v ?? "N/A" },
    { key: "best_season", label: "Season", num: true, fmt: v => v ? seasonLabel(v) : "N/A" },
    { key: "worst", label: "Worst weekly avg", num: true, fmt: v => v ?? "N/A" },
    { key: "worst_season", label: "Season", num: true, fmt: v => v ? seasonLabel(v) : "N/A" },
  ], CATS.map(c => {
    const s = p.season_avgs && p.season_avgs[c];
    return { cat: CAT_LABEL[c],
      best: s ? s.best.avg : null, best_season: s ? s.best.season : null,
      worst: s ? s.worst.avg : null, worst_season: s ? s.worst.season : null };
  }));
}

// Shared week-level table used by Managers and Category Records
function weekTable(el, list) {
  mount(el, [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
    { key: "week", label: "Week", num: true },
    { key: "opp", label: "Opponent" },
    { key: "value", label: "Total", num: true },
    { key: "per", label: "Per roster player", num: true },
  ], list);
}

// Draft: teams ordered by draft-luck percentile
routes.draft = () => {
  const picks = pid => {
    const p = D.people.find(x => x.person_id === pid);
    return p && p.draft ? p.draft.picks : [];
  };
  const bestPick = pid => {
    const pk = picks(pid);
    return pk.length ? Math.min(...pk.map(k => k.pick)) : null;
  };
  const picksText = pid => {
    const pk = picks(pid);
    return pk.length ? pk.map(k => `${seasonLabel(k.season)}: #${k.pick}`).join(", ") : "N/A";
  };
  app.innerHTML = `<h1>Draft luck</h1>
    <p class="note">Percentile = (teams − first pick) ÷ (teams − 1). Higher is luckier.
      Seasons show each first-round pick. Most drafted counts every pick, including 2027.</p>
    <div id="draft"></div>`;
  mount(document.getElementById("draft"), [
    { key: "name", label: "Manager" },
    { key: "avg_pct", label: "Avg draft %", num: true, fmt: pct },
    { key: "best_pick", label: "Best draft pick", num: true, fmt: v => na(v) },
    { key: "most_count", label: "Most drafted (times)", num: true },
    { key: "most_players", label: "Most drafted player(s)" },
    { key: "seasons", label: "Drafts", num: true },
    { key: "picks_text", label: "Season: draft pick" },
  ], D.draft.map(r => ({
    ...r,
    best_pick: bestPick(r.person_id),
    most_count: r.most_drafted ? r.most_drafted.count : "",
    most_players: r.most_drafted ? r.most_drafted.players.join(", ") : "",
    picks_text: picksText(r.person_id),
  })));
};

// Finals: choose one table at a time
routes.finals = () => {
  const F = D.finals;
  const wl = F.playoff_wl
    .map(r => {
      const g = r.w + r.l;
      return { ...r, pct: g ? (r.w / g) * 100 : null };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.w - a.w);
  const countCols = [
    { key: "name", label: "Manager" },
    { key: "count", label: "Total", num: true },
  ];
  const tables = [
    { label: "Grand finals won", cols: countCols, rows: F.titles },
    { label: "Grand final appearances", cols: countCols, rows: F.gf_apps },
    { label: "Playoff appearances", cols: countCols, rows: F.playoff_apps },
    { label: "Playoff misses", cols: countCols, rows: F.playoff_misses },
    { label: "Playoff match record (sorted by win %)", rows: wl, cols: [
      { key: "name", label: "Manager" },
      { key: "w", label: "W", num: true },
      { key: "l", label: "L", num: true },
      { key: "pct", label: "Win %", num: true, fmt: v => v == null ? "N/A" : pct(v) },
    ] },
    { label: "Champions by draft slot (worst slot to win first)", rows: F.champion_slots, cols: [
      { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
      { key: "name", label: "Champion" },
      { key: "draft_pick", label: "Draft pick", num: true, fmt: v => na(v) },
    ] },
  ];
  app.innerHTML = `<h1>Finals</h1><div id="fin"></div>`;
  picker(document.getElementById("fin"),
    tables.map((t, i) => ({ label: t.label, value: String(i) })),
    (box, v) => { const t = tables[+v]; mount(box, t.cols, t.rows); });
};

// Championship teams
routes.champions = () => {
  const rosters = (X.champion_rosters || []).map(r => ({
    season: r.season,
    name: r.name,
    count: r.players.length || "N/A",
    players: r.players.length ? r.players.join(", ") : "No lineup data",
  })).sort((a, b) => b.season - a.season);
  app.innerHTML = `<h1>Championship teams</h1>
    <p class="note">The roster each champion used in its grand final week (ESPN week 22 lineup).
      Data available 2022 to 2026. 2021 has no lineup data in the feed.</p>
    <div id="cc"></div>`;
  const tables = [
    { label: "Champion rosters", cols: [
      { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
      { key: "name", label: "Champion" },
      { key: "count", label: "Players", num: true },
      { key: "players", label: "Roster used in grand final week" },
    ], rows: rosters },
    { label: "Players used across championship teams", cols: [
      { key: "player", label: "NBA player" },
      { key: "appearances", label: "Appearances", num: true },
    ], rows: X.champion_player_counts || [] },
  ];
  picker(document.getElementById("cc"),
    tables.map((t, i) => ({ label: t.label, value: String(i) })),
    (box, v) => { const t = tables[+v]; mount(box, t.cols, t.rows); });
};

// Trades: totals, then details newest to oldest
routes.trades = () => {
  const totals = D.trades.map(t => ({
    name: t.name,
    total: t.total_trades,
    players: t.players_traded_away,
    best: t.best_trades,
    best_season: t.best_trades_season,
    most_players: t.most_players,
    avg_trades: t.avg_trades_per_season ?? "",
    avg_players: t.avg_players_per_season ?? "",
    seasons: t.seasons_2022_2026,
  })).sort((a, b) => b.total - a.total);

  const details = (D.site_trades || []).map(t => ({
    season: t.season,
    date: fullDate(t.season, t.date),
    key: dateKey(t.season, t.date),
    side_a: t.side_a.name,
    sent_a: t.side_a.sent.length ? t.side_a.sent.join(", ") : "not recorded",
    side_b: t.side_b.name,
    sent_b: t.side_b.sent.length ? t.side_b.sent.join(", ") : "not recorded",
  })).sort((a, b) => b.key - a.key);

  app.innerHTML = `<h1>Trades</h1>
    <p class="note">Player trades only; draft-pick trades are excluded. Total trades counts each trade once for
      each manager involved. Players traded away counts the players each manager sent. Seasons 2022 to 2026.</p>
    <h2>Totals per manager</h2><div id="tt"></div>
    <h2>Trade details (newest first)</h2><div id="td"></div>`;

  mount(document.getElementById("tt"), [
    { key: "name", label: "Manager" },
    { key: "total", label: "Total trades", num: true },
    { key: "players", label: "Players traded away", num: true },
    { key: "best", label: "Most trades in a season", num: true },
    { key: "best_season", label: "Season of most trades", num: true, fmt: v => v ? seasonLabel(v) : "N/A" },
    { key: "most_players", label: "Most players traded in a season", num: true },
    { key: "avg_trades", label: "Avg trades per season", num: true, fmt: v => v === "" ? "N/A" : v },
    { key: "avg_players", label: "Avg players traded per season", num: true, fmt: v => v === "" ? "N/A" : v },
    { key: "seasons", label: "Seasons", num: true },
  ], totals);

  mount(document.getElementById("td"), [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
      { key: "date", label: "Date", sortKey: "key" },
    { key: "side_a", label: "Side A" },
    { key: "sent_a", label: "Sent by A" },
    { key: "side_b", label: "Side B" },
    { key: "sent_b", label: "Sent by B" },
  ], details);
};

// Adds: choose one table at a time
routes.adds = () => {
  const totals = D.adds.map(a => ({
    name: a.name,
    total: a.total_adds,
    avg: a.avg_adds_per_season ?? "",
    best: a.best_adds,
    best_season: a.best_adds_season,
    seasons: a.seasons_2022_2026,
  })).sort((a, b) => b.total - a.total);

  const perSeason = [];
  Object.keys(X.adds_top_per_season || {}).map(Number).sort((a, b) => b - a).forEach(s =>
    X.adds_top_per_season[s].forEach(r =>
      perSeason.push({ season: s, rank: r.rank, player: r.player, count: r.count })));
  const top1 = perSeason.filter(r => r.rank === 1);
  const perMgrSeason = X.adds_per_manager_per_season || [];
  const perMgrOverall = X.adds_top_per_manager || [];

  const playerCols = [
    { key: "rank", label: "Rank", num: true },
    { key: "player", label: "NBA player" },
    { key: "count", label: "Times added", num: true },
  ];
  const playerCols2 = [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
    { key: "rank", label: "Rank", num: true },
    { key: "player", label: "NBA player" },
    { key: "count", label: "Times added", num: true },
  ];

  const tables = [
    { label: "Totals per manager", render: c => mount(c, [
        { key: "name", label: "Manager" },
        { key: "total", label: "Total adds", num: true },
        { key: "avg", label: "Avg per season", num: true, fmt: v => v === "" ? "N/A" : v },
        { key: "best", label: "Most adds in a season", num: true },
        { key: "best_season", label: "Season of most adds", num: true, fmt: v => v ? seasonLabel(v) : "N/A" },
        { key: "seasons", label: "Seasons", num: true },
      ], totals) },
    { label: "Top 5 most added players, all time (2022 to 2026)", render: c =>
      mount(c, playerCols, X.adds_top_all_time || []) },
    { label: "Most added player each season (top 1)", render: c =>
      mount(c, playerCols2, top1) },
    { label: "Top 5 most added players per season", render: c =>
      mount(c, playerCols2, perSeason) },
    { label: "Most added player per manager, per season", render: c => {
        const names = [...new Set(perMgrSeason.map(r => r.name))].sort();
        picker(c, names.map(n => ({ label: n, value: n })), (box, v) => mount(box, [
          { key: "season", label: "Season", num: true, fmt: x => seasonLabel(x) },
          { key: "count", label: "Times added", num: true },
          { key: "players", label: "Most added player(s)" },
        ], perMgrSeason.filter(r => r.name === v)));
      } },
    { label: "Most added player per manager, overall", render: c => mount(c, [
        { key: "name", label: "Manager" },
        { key: "count", label: "Times added", num: true },
        { key: "players", label: "Most added player(s)" },
        { key: "seasons", label: "Data years" },
      ], perMgrOverall) },
  ];

  app.innerHTML = `<h1>Adds</h1>
    <p class="note">Total adds (feed): free-agent and waiver adds from the transaction feed.
      Player tables cover ${esc(X.adds_years || "2022 to 2026")}. 2021 and 2027 are not in this data.
      Feed totals are higher than ESPN's ACQ column; the cause is not confirmed.</p>
    <div id="adt"></div>`;
  picker(document.getElementById("adt"),
    tables.map((t, i) => ({ label: t.label, value: String(i) })),
    (box, v) => tables[+v].render(box));
};

// Hall of Shame: 0-9 weeks, newest first
routes.shame = () => {
  const rows = D.hall_of_shame
    .filter(r => r.record === "0-9")
    .slice()
    .sort((a, b) => b.season - a.season || b.week - a.week);
  app.innerHTML = `<h1>Hall of Shame</h1>
    <p class="note">Regular-season weeks where a manager won none of the nine categories (0-9).
      Shows the manager who lost all nine and who beat them. Newest first. Playoffs are not included.</p>
    <div id="sh"></div>`;
  mount(document.getElementById("sh"), [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
    { key: "week", label: "Week", num: true },
    { key: "name", label: "Manager (0 categories)" },
    { key: "opponent", label: "Beaten by" },
  ], rows);
};

// Hall of Fame: 9-0 weeks, newest first
routes.fame = () => {
  const rows = D.hall_of_shame
    .filter(r => r.record === "9-0")
    .slice()
    .sort((a, b) => b.season - a.season || b.week - a.week);
  app.innerHTML = `<h1>Hall of Fame</h1>
    <p class="note">Regular-season weeks where a manager won all nine categories (9-0).
      Shows the winner and the manager they beat. Newest first. Playoffs are not included.</p>
    <div id="hf"></div>`;
  mount(document.getElementById("hf"), [
    { key: "season", label: "Season", num: true, fmt: v => seasonLabel(v) },
    { key: "week", label: "Week", num: true },
    { key: "name", label: "Manager (9 categories)" },
    { key: "opponent", label: "Beat" },
  ], rows);
};

// Category Records: one table structure for every category
routes.records = () => {
  app.innerHTML = `<h1>Category records</h1>
    <p class="note">Per roster player uses each season's non-IR roster size. FG% and FT% are rates.</p>
    <div class="toggle">
      <button id="rr" class="on">Regular season</button>
      <button id="rp">Playoffs</button>
    </div>
    <select class="search" id="rc-cat">${CATS.map(c =>
      `<option value="${c}">${esc(CAT_LABEL[c])}</option>`).join("")}</select>
    <h2>Best five</h2><div id="rb"></div>
    <h2>Worst five</h2><div id="rw"></div>`;
  let which = "regular";
  const draw = () => {
    const cat = document.getElementById("rc-cat").value;
    const r = D.records[which][cat];
    weekTable(document.getElementById("rb"), r.best);
    weekTable(document.getElementById("rw"), r.worst);
  };
  document.getElementById("rr").onclick = () => {
    which = "regular";
    document.getElementById("rr").classList.add("on");
    document.getElementById("rp").classList.remove("on");
    draw();
  };
  document.getElementById("rp").onclick = () => {
    which = "playoffs";
    document.getElementById("rp").classList.add("on");
    document.getElementById("rr").classList.remove("on");
    draw();
  };
  document.getElementById("rc-cat").onchange = draw;
  draw();
};

function route() {
  const [name, arg] = (location.hash || "#home").slice(1).split("/");
  (routes[name] || routes.home)(arg);
  document.querySelectorAll("nav a").forEach(a =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + name));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// Show any error on the page instead of leaving "Unlocking…"
setTimeout(() => {
  try { route(); }
  catch (e) {
    app.innerHTML = "<pre style='white-space:pre-wrap;color:#FFC72C'>" + esc(e.stack || e.message) + "</pre>";
  }
}, 0);