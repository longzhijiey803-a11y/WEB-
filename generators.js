/* ============================================================
   問題生成モジュール（完全オフライン / APIキー不要 / 課金ゼロ）
   - 計数 (num): アルゴリズム生成（実質無制限の組み合わせ）
   - 言語 (ja): 手書きプール + 設問/選択肢シャッフル
   - 英語 (en): 手書きプール + 設問シャッフル
   ============================================================ */
(function () {
  "use strict";

  const JA_CHOICES = [
    "文脈の論理から明らかに正しい。または正しい内容を含んでいる。",
    "文脈の論理から明らかに間違っている。または間違った内容を含んでいる。",
    "問題文の内容だけからでは、設問文は論理的に導けない。"
  ];

  // ---------- 乱数ユーティリティ ----------
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickN(arr, n) {
    const c = arr.slice();
    const out = [];
    while (out.length < n && c.length) {
      out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    }
    return out;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function roundTo(v, decimals) {
    const k = Math.pow(10, decimals);
    return Math.round(v * k) / k;
  }
  function fmt(n) { return Number.isFinite(n) ? n.toLocaleString() : String(n); }

  // 5つの選択肢を重複なく作り、正解 index を返す
  function buildChoices(correct, distractorFn, opts = {}) {
    const unit = opts.unit || "";
    const fmtFn = opts.fmt || (v => fmt(roundTo(v, opts.decimals ?? 1)));
    const seen = new Set();
    const correctStr = fmtFn(correct) + unit;
    seen.add(correctStr);
    const items = [correctStr];
    let attempts = 0;
    while (items.length < 5 && attempts < 200) {
      attempts++;
      const d = distractorFn(items.length);
      if (!Number.isFinite(d)) continue;
      const s = fmtFn(d) + unit;
      if (seen.has(s)) continue;
      seen.add(s);
      items.push(s);
    }
    // どうしても足りないときはランダムノイズで穴埋め
    while (items.length < 5) {
      const noise = correct * (0.5 + Math.random() * 1.8) + (Math.random() < 0.5 ? -10 : 10) * items.length;
      const s = fmtFn(noise) + unit;
      if (!seen.has(s)) { seen.add(s); items.push(s); }
      else items.push(fmtFn(correct + items.length * 7.3) + unit);
    }
    const shuffled = shuffle(items);
    return {
      choices: shuffled,
      correct_index: shuffled.indexOf(correctStr)
    };
  }

  // ==========================================================
  //  計数 (num) ジェネレータ
  // ==========================================================

  const NUM_COMPANY_NAMES = ["A社", "B社", "C社", "D社", "E社", "F社", "G社"];
  const NUM_COUNTRY_NAMES = ["日本", "米国", "ドイツ", "英国", "フランス", "韓国", "中国", "インド", "豪州", "カナダ"];
  const NUM_DEPT_NAMES = ["営業部", "開発部", "製造部", "管理部", "総務部", "企画部", "人事部"];
  const NUM_PRODUCT_NAMES = ["製品α", "製品β", "製品γ", "製品δ", "製品ε"];
  const NUM_CITY_NAMES = ["東京", "大阪", "名古屋", "福岡", "札幌", "仙台", "広島", "神戸"];

  const NUM_TABLE_THEMES = [
    { theme: "主要企業の売上高推移", rows: NUM_COMPANY_NAMES, colBase: "年度", unit: "億円", min: 150, max: 4500, kind: "years" },
    { theme: "国別の輸出額推移", rows: NUM_COUNTRY_NAMES, colBase: "年度", unit: "十億ドル", min: 40, max: 1800, kind: "years" },
    { theme: "部門別人員数", rows: NUM_DEPT_NAMES, colBase: "年度", unit: "人", min: 25, max: 520, kind: "years" },
    { theme: "製品別販売数量", rows: NUM_PRODUCT_NAMES, colBase: "年度", unit: "千個", min: 80, max: 1400, kind: "years" },
    { theme: "都市別人口推移", rows: NUM_CITY_NAMES, colBase: "年度", unit: "万人", min: 55, max: 1500, kind: "years" },
    { theme: "業種別平均年収", rows: ["IT", "金融", "製造", "小売", "医療", "建設"], colBase: "職位", unit: "万円", min: 320, max: 1400, kind: "ranks" }
  ];
  const NUM_PIE_THEMES = [
    { theme: "国内スマートフォン市場シェア", items: ["Aブランド", "Bブランド", "Cブランド", "Dブランド", "その他"], unit: "%", total: 100, absTotalLabel: "総出荷台数", absMin: 1800, absMax: 4200, absUnit: "万台" },
    { theme: "エネルギー消費構成", items: ["石油", "天然ガス", "石炭", "再生可能", "原子力"], unit: "%", total: 100, absTotalLabel: "全消費量", absMin: 3200, absMax: 7800, absUnit: "PJ" },
    { theme: "予算配分", items: ["人件費", "材料費", "設備費", "広告費", "その他"], unit: "%", total: 100, absTotalLabel: "総予算", absMin: 450, absMax: 1200, absUnit: "億円" },
    { theme: "年代別利用者構成", items: ["10代", "20代", "30代", "40代", "50代以上"], unit: "%", total: 100, absTotalLabel: "全利用者", absMin: 80, absMax: 580, absUnit: "万人" },
    { theme: "業種別就業者構成", items: ["サービス", "製造", "卸売小売", "建設", "その他"], unit: "%", total: 100, absTotalLabel: "全就業者", absMin: 5600, absMax: 6800, absUnit: "千人" }
  ];
  const NUM_BARLINE_THEMES = [
    { theme: "主要企業の売上高推移", seriesPool: NUM_COMPANY_NAMES, unit: "億円", min: 200, max: 3800, catKind: "years" },
    { theme: "国別の輸出額推移", seriesPool: NUM_COUNTRY_NAMES, unit: "十億ドル", min: 60, max: 1600, catKind: "years" },
    { theme: "商品カテゴリー別売上", seriesPool: ["食品", "日用品", "衣料", "家電", "その他"], unit: "百万円", min: 800, max: 5200, catKind: "years" },
    { theme: "地域別の来客数", seriesPool: ["関東", "関西", "中部", "東北", "九州"], unit: "千人", min: 120, max: 1800, catKind: "years" },
    { theme: "観光客数の推移", seriesPool: NUM_COUNTRY_NAMES, unit: "万人", min: 30, max: 720, catKind: "years" }
  ];

  function yearList(count) {
    const endYear = 2020 + rand(0, 4);
    const start = endYear - count + 1;
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(`${start + i}年`);
    return arr;
  }
  function rankList(count) {
    const base = ["主任", "係長", "課長", "部長", "本部長"];
    return base.slice(0, count);
  }

  // --- table (6 cols × 5 rows) ---
  function genTable() {
    const def = pick(NUM_TABLE_THEMES);
    const rowCount = rand(4, 5);
    const colCount = rand(4, 5);
    const rows = pickN(def.rows, rowCount);
    const cols = def.kind === "years" ? yearList(colCount) : rankList(colCount);
    const data = rows.map(() => cols.map(() => rand(def.min, def.max)));

    // 設問タイプ抽選
    const qType = pick(["ratio", "sum", "max_row", "growth_rate", "diff"]);
    let statement, correct, explanation, decimals = 1, unit = "";

    const r1 = rand(0, rowCount - 1);
    const r2 = rand(0, rowCount - 1);
    const c1 = rand(0, colCount - 1);
    let c2 = rand(0, colCount - 1);
    while (c2 === c1 && colCount > 1) c2 = rand(0, colCount - 1);

    if (qType === "ratio") {
      const a = data[r1][c1], b = data[r1][c2];
      correct = a / b;
      statement = `${rows[r1]}の${cols[c1]}は、同${rows[r1]}の${cols[c2]}の約何倍か。`;
      explanation = `${fmt(a)}${def.unit} ÷ ${fmt(b)}${def.unit} = ${roundTo(correct, 2)} 倍`;
      decimals = 2; unit = " 倍";
    } else if (qType === "sum") {
      correct = data.reduce((s, row) => s + row[c1], 0);
      statement = `${cols[c1]}における全${def.rows === NUM_COMPANY_NAMES ? "社" : def.rows === NUM_COUNTRY_NAMES ? "国" : def.rows === NUM_DEPT_NAMES ? "部門" : "項目"}の合計は約いくつか。`;
      explanation = `${data.map(row => fmt(row[c1])).join(" + ")} = ${fmt(correct)}${def.unit}`;
      decimals = 0; unit = " " + def.unit;
    } else if (qType === "max_row") {
      let maxV = -Infinity, maxIdx = 0;
      for (let i = 0; i < rowCount; i++) if (data[i][c1] > maxV) { maxV = data[i][c1]; maxIdx = i; }
      correct = maxV;
      statement = `${cols[c1]}において最も値が大きい${def.rows === NUM_COMPANY_NAMES ? "企業" : def.rows === NUM_COUNTRY_NAMES ? "国" : def.rows === NUM_DEPT_NAMES ? "部門" : "項目"}の値はいくつか。`;
      explanation = `最大は ${rows[maxIdx]} の ${fmt(maxV)}${def.unit}`;
      decimals = 0; unit = " " + def.unit;
    } else if (qType === "growth_rate") {
      const a = data[r1][c1], b = data[r1][c2];
      correct = (b - a) / a * 100;
      statement = `${rows[r1]}の${cols[c1]}から${cols[c2]}への増加率は約何%か。`;
      explanation = `(${fmt(b)} - ${fmt(a)}) / ${fmt(a)} × 100 = ${roundTo(correct, 1)}%`;
      decimals = 1; unit = " %";
    } else {
      const a = data[r1][c1], b = data[r2][c1];
      correct = Math.abs(a - b);
      statement = `${cols[c1]}における${rows[r1]}と${rows[r2]}の差はいくつか。`;
      explanation = `|${fmt(a)} - ${fmt(b)}| = ${fmt(correct)}${def.unit}`;
      decimals = 0; unit = " " + def.unit;
    }

    const dist = (i) => {
      // よくある計算ミス由来
      if (qType === "ratio") return [correct * 10, 1 / correct, correct - 1, correct * 0.5 + 0.3, correct + 0.5][i - 1] || correct * (1 + 0.15 * i);
      if (qType === "sum") return [correct * 1.1, correct * 0.9, correct + data[0][c1], correct - data[0][c1]][i - 1] || correct + rand(50, 300);
      if (qType === "max_row") return [correct * 1.1, correct * 0.9, correct - rand(10, 80), correct + rand(10, 80)][i - 1] || correct - rand(20, 100);
      if (qType === "growth_rate") return [correct - 10, correct + 10, -correct, correct * 0.5][i - 1] || correct + rand(-15, 15);
      return [correct * 2, correct * 0.5, correct + 50, correct - 50][i - 1] || correct + rand(-100, 100);
    };

    const { choices, correct_index } = buildChoices(correct, dist, { unit, decimals });

    const table_md = (() => {
      const header = "| | " + cols.join(" | ") + " |";
      const sep = "|" + Array(cols.length + 1).fill("---").join("|") + "|";
      const body = rows.map((r, i) => "| " + r + " | " + data[i].map(v => fmt(v)).join(" | ") + " |").join("\n");
      return [header, sep, body].join("\n");
    })();

    return {
      passage: "",
      theme: def.theme,
      note: `単位: ${def.unit}`,
      chartType: "table",
      chartData: {
        table_markdown: table_md,
        pie_items: [],
        chart_categories: [],
        chart_series: [],
        unit: def.unit
      },
      questions: [{
        statement,
        choices,
        correct_index,
        explanation
      }]
    };
  }

  // --- table_blank ---
  function genTableBlank() {
    const def = pick(NUM_TABLE_THEMES);
    const rowCount = rand(4, 5);
    const colCount = rand(4, 5);
    const rows = pickN(def.rows, rowCount);
    const cols = def.kind === "years" ? yearList(colCount) : rankList(colCount);
    const data = rows.map(() => cols.map(() => rand(def.min, def.max)));

    // 行合計列を最終列として追加し、1 セルを "?" に
    const totals = data.map(row => row.reduce((a, b) => a + b, 0));
    const headerCols = cols.concat(["合計"]);
    const fullRows = data.map((row, i) => row.concat([totals[i]]));

    const blankR = rand(0, rowCount - 1);
    const blankC = rand(0, colCount - 1);
    const correct = fullRows[blankR][blankC];

    const table_md = (() => {
      const header = "| | " + headerCols.join(" | ") + " |";
      const sep = "|" + Array(headerCols.length + 1).fill("---").join("|") + "|";
      const body = fullRows.map((r, i) => {
        const cells = r.map((v, j) => (i === blankR && j === blankC) ? "?" : fmt(v));
        return "| " + rows[i] + " | " + cells.join(" | ") + " |";
      }).join("\n");
      return [header, sep, body].join("\n");
    })();

    const rowSumExBlank = fullRows[blankR].reduce((a, b, j) => j === blankC ? a : a + b, 0) - totals[blankR];
    const rowTotal = totals[blankR];
    const explanation = `${rows[blankR]} の合計 ${fmt(rowTotal)} から他の列を引く: ${fmt(rowTotal)} - ${fmt(-rowSumExBlank)} = ${fmt(correct)}${def.unit}`;

    const dist = (i) => [correct * 1.1, correct * 0.9, correct - rand(50, 200), correct + rand(50, 200)][i - 1] || correct + rand(-300, 300);
    const { choices, correct_index } = buildChoices(correct, dist, { unit: " " + def.unit, decimals: 0 });

    return {
      passage: "",
      theme: def.theme,
      note: `表の ? の値を計算しなさい（単位: ${def.unit}）`,
      chartType: "table_blank",
      chartData: {
        table_markdown: table_md,
        pie_items: [],
        chart_categories: [],
        chart_series: [],
        unit: def.unit
      },
      questions: [{
        statement: "表中の ? に入る値として最も近いものはどれか。",
        choices,
        correct_index,
        explanation
      }]
    };
  }

  // --- pie ---
  function genPie() {
    const def = pick(NUM_PIE_THEMES);
    const count = rand(4, 5);
    const labels = pickN(def.items, count);
    // 合計100%になるようランダム割合
    const raw = labels.map(() => rand(5, 40));
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    const pcts = raw.map(v => Math.round(v / sumRaw * 1000) / 10);
    // 丸め誤差吸収
    const diff = +(100 - pcts.reduce((a, b) => a + b, 0)).toFixed(1);
    pcts[0] = +(pcts[0] + diff).toFixed(1);

    const pie_items = labels.map((label, i) => ({ label, value: pcts[i] }));

    const absTotal = rand(def.absMin, def.absMax);
    const qType = pick(["share_to_abs", "diff_share", "ratio"]);

    let statement, correct, explanation, decimals = 1, unit = "";
    const idx = rand(0, count - 1);
    let idx2 = rand(0, count - 1);
    while (idx2 === idx && count > 1) idx2 = rand(0, count - 1);

    if (qType === "share_to_abs") {
      correct = absTotal * pcts[idx] / 100;
      statement = `${def.theme}において、${labels[idx]}が占める割合は${pcts[idx]}%である。${def.absTotalLabel}が${fmt(absTotal)}${def.absUnit}のとき、${labels[idx]}は約いくつか。`;
      explanation = `${fmt(absTotal)} × ${pcts[idx]}% = ${roundTo(correct, 1)}${def.absUnit}`;
      decimals = 0; unit = " " + def.absUnit;
    } else if (qType === "diff_share") {
      correct = Math.abs(pcts[idx] - pcts[idx2]);
      statement = `${labels[idx]}と${labels[idx2]}の構成比の差は約何ポイントか。`;
      explanation = `|${pcts[idx]} - ${pcts[idx2]}| = ${roundTo(correct, 1)} ポイント`;
      decimals = 1; unit = " ポイント";
    } else {
      correct = pcts[idx] / pcts[idx2];
      statement = `${labels[idx]}の構成比は${labels[idx2]}の約何倍か。`;
      explanation = `${pcts[idx]} ÷ ${pcts[idx2]} = ${roundTo(correct, 2)} 倍`;
      decimals = 2; unit = " 倍";
    }

    const dist = (i) => {
      if (qType === "share_to_abs") return [absTotal * pcts[idx2] / 100, correct * 2, correct / 2, correct + absTotal * 0.05, correct - absTotal * 0.05][i - 1] || correct + rand(-100, 100);
      if (qType === "diff_share") return [correct + 5, correct - 3, correct * 2, pcts[idx], pcts[idx2]][i - 1] || correct + rand(-5, 5);
      return [1 / correct, correct - 1, correct + 0.3, correct * 0.5][i - 1] || correct + 0.2 * i;
    };
    const { choices, correct_index } = buildChoices(correct, dist, { unit, decimals });

    return {
      passage: "",
      theme: def.theme,
      note: `${def.absTotalLabel}: ${fmt(absTotal)}${def.absUnit}`,
      chartType: "pie",
      chartData: {
        table_markdown: "",
        pie_items,
        chart_categories: [],
        chart_series: [],
        unit: "%"
      },
      questions: [{
        statement,
        choices,
        correct_index,
        explanation
      }]
    };
  }

  // --- bar ---
  function genBar() {
    const def = pick(NUM_BARLINE_THEMES);
    const catCount = rand(4, 6);
    const seriesCount = rand(2, 3);
    const cats = yearList(catCount);
    const seriesNames = pickN(def.seriesPool, seriesCount);
    const series = seriesNames.map(name => ({
      name,
      values: cats.map(() => rand(def.min, def.max))
    }));

    const qType = pick(["series_peak", "year_leader", "growth", "ratio_same_year"]);
    let statement, correct, explanation, decimals = 1, unit = " " + def.unit;
    const si = rand(0, seriesCount - 1);
    const ci = rand(0, catCount - 1);
    let ci2 = rand(0, catCount - 1);
    while (ci2 === ci && catCount > 1) ci2 = rand(0, catCount - 1);

    if (qType === "series_peak") {
      const vs = series[si].values;
      const peakV = Math.max(...vs);
      const peakIdx = vs.indexOf(peakV);
      correct = peakV;
      statement = `${series[si].name}のピーク時の値は約いくつか（${def.unit}）。`;
      explanation = `${series[si].name}は${cats[peakIdx]}にピーク ${fmt(peakV)}${def.unit}`;
      decimals = 0;
    } else if (qType === "year_leader") {
      const vals = series.map(s => s.values[ci]);
      const maxV = Math.max(...vals);
      correct = maxV;
      const leader = series[vals.indexOf(maxV)].name;
      statement = `${cats[ci]}において最も値が大きい系列の値はいくつか（${def.unit}）。`;
      explanation = `${cats[ci]}の最大は ${leader} の ${fmt(maxV)}${def.unit}`;
      decimals = 0;
    } else if (qType === "growth") {
      const a = series[si].values[ci];
      const b = series[si].values[ci2];
      correct = (b - a) / a * 100;
      statement = `${series[si].name}の${cats[ci]}から${cats[ci2]}への増加率は約何%か。`;
      explanation = `(${fmt(b)} - ${fmt(a)}) / ${fmt(a)} × 100 = ${roundTo(correct, 1)}%`;
      decimals = 1; unit = " %";
    } else {
      let si2 = rand(0, seriesCount - 1);
      while (si2 === si && seriesCount > 1) si2 = rand(0, seriesCount - 1);
      const a = series[si].values[ci];
      const b = series[si2].values[ci];
      correct = a / b;
      statement = `${cats[ci]}における${series[si].name}は${series[si2].name}の約何倍か。`;
      explanation = `${fmt(a)} ÷ ${fmt(b)} = ${roundTo(correct, 2)} 倍`;
      decimals = 2; unit = " 倍";
    }

    const dist = (i) => {
      if (qType === "growth") return [correct + 10, correct - 10, -correct, correct * 0.5, correct * 2][i - 1] || correct + rand(-20, 20);
      if (qType === "ratio_same_year") return [1 / correct, correct + 0.5, correct - 0.3, correct * 2][i - 1] || correct + 0.3 * i;
      return [correct * 1.15, correct * 0.85, correct - rand(80, 300), correct + rand(80, 300)][i - 1] || correct + rand(-200, 200);
    };
    const { choices, correct_index } = buildChoices(correct, dist, { unit, decimals });

    return {
      passage: "",
      theme: def.theme,
      note: `単位: ${def.unit}`,
      chartType: "bar",
      chartData: {
        table_markdown: "",
        pie_items: [],
        chart_categories: cats,
        chart_series: series,
        unit: def.unit
      },
      questions: [{
        statement,
        choices,
        correct_index,
        explanation
      }]
    };
  }

  // --- line ---
  function genLine() {
    // bar とほぼ同じデータ構造、チャート種別のみ差し替え
    const base = genBar();
    base.chartType = "line";
    return base;
  }

  function genNum(index) {
    const rotation = ["table", "pie", "bar", "line", "table_blank"];
    const t = rotation[index % rotation.length];
    switch (t) {
      case "table": return genTable();
      case "pie": return genPie();
      case "bar": return genBar();
      case "line": return genLine();
      case "table_blank": return genTableBlank();
    }
  }

  // ==========================================================
  //  言語 (ja) プール
  // ==========================================================

  // correct_answer: "A" = 正しい、"B" = 間違い、"C" = 判断不能
  const JA_POOL = [
    {
      passage: "近代以降の民主主義は、単に多数決によって意思決定を行う制度ではない。むしろ、少数者の権利を保障し、公開された議論を通じて政策の是非を検証する過程そのものに価値があるとされている。近年、世論調査や SNS 上の反応を即時に政治判断へ反映しようとする傾向が強まっているが、これを民主主義の深化と評価する声と、熟議を軽視した衆愚政治だと批判する声が並立している。制度の設計においては、迅速性と熟慮のバランスをどう取るかが今後の課題である。",
      qa: [
        { s: "民主主義の本質は、多数決による効率的な意思決定の仕組みにある。", a: "B", e: "本文は「単に多数決ではない」と明言し、少数者の権利保障や熟議の過程に価値があるとしている。" },
        { s: "SNSを通じた即時の政治判断の反映を、本文は無条件に民主主義の進展として肯定している。", a: "B", e: "本文では肯定的評価と批判的評価が並立していると述べており、無条件の肯定はしていない。" },
        { s: "少数者の権利保障は、多数決原理と両立し得る民主主義の重要な要素である。", a: "A", e: "本文は「少数者の権利を保障し」と述べ、民主主義の本質的要素に位置付けている。" },
        { s: "熟議の軽視が実際に政策の質を低下させた事例が、複数の国で確認されている。", a: "C", e: "本文には具体的事例やその国際比較に関する記述はない。" }
      ]
    },
    {
      passage: "選挙制度は各国で多様だが、比例代表制と小選挙区制は最も代表的な二類型である。比例代表制は各政党の得票率に比例して議席を配分するため民意を細かく反映しやすい一方、連立政権が常態化して意思決定が遅れるという批判もある。小選挙区制は大政党を有利にするが、政権交代を起こしやすく責任の所在が明確になる。いずれの方式にも利点と欠点があり、どちらが優れていると一概に断ずることはできない。",
      qa: [
        { s: "比例代表制は、得票率に応じた議席配分により多様な民意を反映しやすい。", a: "A", e: "本文に「各政党の得票率に比例して議席を配分するため民意を細かく反映しやすい」と明記されている。" },
        { s: "小選挙区制では、連立政権の常態化により政策決定が停滞しがちである。", a: "B", e: "連立の常態化は比例代表制の特徴として述べられており、小選挙区制の説明ではない。" },
        { s: "比例代表制と小選挙区制のどちらが優れているかは、一概に断定できない。", a: "A", e: "本文末尾で「一概に断ずることはできない」と明言している。" },
        { s: "日本では衆議院で両制度を並立させた選挙方式が採用されている。", a: "C", e: "本文には日本の具体的制度に関する記述は一切ない。" }
      ]
    },
    {
      passage: "自由市場では、価格は需要と供給の交点で決まるとされる。しかし、現実には企業の寡占、情報の非対称性、外部不経済の存在などによって、理論通りの価格形成が阻害される場面が多い。政府が規制や税制を通じて市場に介入するのは、こうした市場の失敗を補正するためである。ただし、介入が過剰になれば資源配分の効率を損ない、逆に経済活動を停滞させる恐れがあるため、介入のタイミングと範囲には慎重な判断が求められる。",
      qa: [
        { s: "市場の失敗を補正する目的で、政府が規制や税制を用いて市場に介入することがある。", a: "A", e: "本文に「市場の失敗を補正するため」政府が介入すると明記されている。" },
        { s: "政府介入は常に経済活動を活性化させる効果をもつ。", a: "B", e: "本文は過剰な介入は経済を停滞させる恐れがあると述べており、常に活性化させるとはしていない。" },
        { s: "価格は理論上、需要と供給の交点で決まると考えられている。", a: "A", e: "本文第1文にそのまま記述がある。" },
        { s: "外部不経済の典型例としては、工場の排煙による健康被害が挙げられる。", a: "C", e: "外部不経済の具体例は本文に示されていない。" }
      ]
    },
    {
      passage: "インフレーションとは、財やサービスの価格が全般的かつ持続的に上昇する現象を指す。適度なインフレは経済成長の兆候とされ、企業の投資意欲を刺激する効果があるとされる。しかし、賃金の伸びが物価上昇に追いつかない場合、家計の実質購買力は低下し、生活水準が悪化する。中央銀行は金利操作や資産買入れなどを通じて物価水準を安定させる役割を担うが、その政策効果が顕れるまでには一定の時間を要する。",
      qa: [
        { s: "適度なインフレは、企業の投資意欲を刺激する効果があるとされている。", a: "A", e: "本文に「適度なインフレは…投資意欲を刺激する効果がある」と記載がある。" },
        { s: "賃金の上昇が物価上昇を上回る場合、家計の実質購買力は低下する。", a: "B", e: "本文は賃金が追いつかないときに購買力が低下すると述べており、逆の内容である。" },
        { s: "中央銀行の物価安定政策は、即時に効果が現れるわけではない。", a: "A", e: "本文末尾に「政策効果が顕れるまでには一定の時間を要する」とある。" },
        { s: "日本では2%のインフレ目標が明示的に採用されている。", a: "C", e: "本文には特定の国の目標値に関する記述はない。" }
      ]
    },
    {
      passage: "人工知能の進歩は、医療診断や自動運転など広範な分野に恩恵をもたらしている。とりわけ大規模言語モデルは、自然言語処理の領域で人間に匹敵する性能を示すようになった。一方で、生成物の正確性を保証できないこと、著作権の扱いが不明確であること、判断プロセスが不透明であることなどが課題として指摘されている。技術的な性能向上と並行して、社会的受容性を確保するための制度整備が急務である。",
      qa: [
        { s: "大規模言語モデルは、自然言語処理において人間並みの性能を示す段階に達している。", a: "A", e: "本文に「自然言語処理の領域で人間に匹敵する性能」と明記されている。" },
        { s: "AI の生成物は、常に事実として正確であると保証されている。", a: "B", e: "本文は「生成物の正確性を保証できない」を課題として挙げている。" },
        { s: "AI の社会実装には、技術の向上と並行した制度整備が必要とされている。", a: "A", e: "本文末尾にそのまま同趣旨の記述がある。" },
        { s: "EU では生成 AI を包括的に規制する法律が既に全面施行されている。", a: "C", e: "本文には具体的な国・地域の法規制に関する記述はない。" }
      ]
    },
    {
      passage: "量子コンピュータは、従来の古典計算機とは異なる原理で動作し、特定の問題では指数関数的な高速化が期待されている。ただし、現時点では量子ビットのノイズやエラー訂正の問題が十分に解決されておらず、実用段階には至っていない。研究開発は各国で活発に行われており、暗号技術への影響が懸念される一方、創薬や最適化問題への応用にも期待が寄せられている。",
      qa: [
        { s: "量子コンピュータは、現時点で実用段階に到達している。", a: "B", e: "本文は「実用段階には至っていない」と明記している。" },
        { s: "量子コンピュータは、暗号技術の分野に影響を及ぼしうる可能性がある。", a: "A", e: "「暗号技術への影響が懸念される」と述べられている。" },
        { s: "量子ビットのノイズとエラー訂正は、実用化に向けた主要な技術的課題である。", a: "A", e: "本文中にそのまま同趣旨の記述がある。" },
        { s: "Google は 2019 年に量子超越を達成したと発表している。", a: "C", e: "本文に特定の企業や出来事の記述はない。" }
      ]
    },
    {
      passage: "気候変動は、二酸化炭素をはじめとする温室効果ガスの大気中濃度の増加によって引き起こされているとされる。その影響は熱波や豪雨、海面上昇といった極端事象の増加として顕在化しており、社会経済への打撃も深刻化している。国際社会はパリ協定のもとで産業革命以前からの気温上昇を1.5度に抑える目標を掲げているが、各国の削減ペースは一様ではなく、目標達成に向けた道筋は依然として不透明である。",
      qa: [
        { s: "パリ協定は、産業革命以前からの気温上昇を 1.5 度以内に抑える目標を定めている。", a: "A", e: "本文にその目標が明記されている。" },
        { s: "気候変動の影響として、熱波や豪雨といった極端事象の減少が観察されている。", a: "B", e: "本文は「極端事象の増加として顕在化」と述べており、逆の記述である。" },
        { s: "各国の排出削減ペースには差があり、目標達成の見通しは立っていない。", a: "A", e: "本文末尾に同趣旨の記述がある。" },
        { s: "日本は 2030 年までに温室効果ガスを 46% 削減する目標を掲げている。", a: "C", e: "本文に日本の具体的削減目標は示されていない。" }
      ]
    },
    {
      passage: "脱炭素社会の実現には、発電部門の低炭素化だけでなく、産業・運輸・民生の各部門における省エネ技術の普及が不可欠である。再生可能エネルギーの導入は急速に進んでいるものの、天候に依存する発電量の変動をどう平準化するかが課題となっている。蓄電池や水素エネルギーの活用、電力系統の広域融通など、複数のアプローチを組み合わせる必要がある。単一の技術で問題を解決できるという楽観論は避けるべきだろう。",
      qa: [
        { s: "再生可能エネルギーの変動性は、蓄電池や水素など複数の手段の組み合わせで対処するのが現実的である。", a: "A", e: "本文に「複数のアプローチを組み合わせる必要がある」と記述されている。" },
        { s: "脱炭素は発電部門の低炭素化のみで達成できるとされている。", a: "B", e: "本文は産業・運輸・民生の各部門の省エネも不可欠だと述べている。" },
        { s: "単一の技術によって脱炭素の課題を解決するのは困難である。", a: "A", e: "「楽観論は避けるべき」という末尾の記述と整合する。" },
        { s: "水素エネルギーは、2030 年時点で日本のエネルギー供給の 10% を占めると予想されている。", a: "C", e: "本文に具体的な将来比率は示されていない。" }
      ]
    },
    {
      passage: "教育における「学力」は、従来、知識の量や正答率で測られる傾向が強かった。しかし近年では、知識を活用して未知の問題を解決する能力、他者と協働する能力、自己調整しながら学び続ける力などが重視されるようになっている。OECD の調査でも、こうした非認知能力の育成が将来の労働生産性や市民性と関連することが示されている。学校現場でも、こうした変化に対応した授業設計が求められている。",
      qa: [
        { s: "近年の学力観は、知識の量のみを評価する方向に収斂している。", a: "B", e: "本文は知識の活用・協働・自己調整など多面的能力が重視されていると述べている。" },
        { s: "非認知能力は、将来の労働生産性などと関連することが示されている。", a: "A", e: "本文に「非認知能力の育成が将来の労働生産性や市民性と関連する」とある。" },
        { s: "学校現場では、新しい学力観に応じた授業設計の工夫が求められている。", a: "A", e: "本文末尾に同趣旨の記述がある。" },
        { s: "日本の PISA 順位は OECD 平均を下回っている。", a: "C", e: "本文には特定国の順位に関する記述はない。" }
      ]
    },
    {
      passage: "オンライン学習の普及により、時間や場所の制約を超えて教育機会にアクセスすることが可能になった。特に、大学の講義を無料で公開する MOOC は世界中の学習者に新たな学びの場を提供している。一方で、受講を修了する割合が低いこと、対面での交流から得られる刺激が得にくいことなど、オンライン教育特有の課題も存在する。対面とオンラインを組み合わせたハイブリッド型の学習設計が、現在では一般的になりつつある。",
      qa: [
        { s: "MOOC は、時間と場所の制約を超えて教育にアクセスする手段の一つである。", a: "A", e: "本文冒頭と整合する。" },
        { s: "オンライン教育には、修了率が低いという課題が存在する。", a: "A", e: "本文に「受講を修了する割合が低い」と明記されている。" },
        { s: "オンライン学習は対面学習に完全に取って代わる見込みである。", a: "B", e: "本文はハイブリッド型が一般的になっていると述べており、代替ではない。" },
        { s: "Coursera は 2012 年に設立された代表的な MOOC プラットフォームである。", a: "C", e: "本文に特定企業の設立年の記述はない。" }
      ]
    },
    {
      passage: "公衆衛生の観点からは、特定の疾病を早期に発見するための検診の普及が重要であるとされてきた。しかし近年、過剰診断や偽陽性による不安・負担の問題が指摘されるようになり、検診のあり方を見直す議論が進んでいる。検診によって得られる便益と受診者が被る不利益を総合的に比較し、対象年齢や頻度を最適化するエビデンスベースの政策立案が求められている。",
      qa: [
        { s: "公衆衛生上、検診の普及は古くから重要とされてきた。", a: "A", e: "本文冒頭に同趣旨の記述がある。" },
        { s: "近年の議論は、検診が常に利益のみをもたらすとの前提に基づいている。", a: "B", e: "本文は過剰診断や偽陽性の問題を指摘しており、この前提は採っていない。" },
        { s: "受診者の不利益も考慮して、検診設計を最適化すべきだと述べられている。", a: "A", e: "本文末尾に同趣旨の記述がある。" },
        { s: "乳がん検診の開始年齢として国際的に推奨されるのは 40 歳である。", a: "C", e: "本文に具体的な推奨年齢の記述はない。" }
      ]
    },
    {
      passage: "感染症対策において、ワクチンは集団免疫を形成する中心的な手段である。しかし、ワクチン接種の意思決定は個人の判断に委ねられるため、忌避感情や情報の偏りが接種率を引き下げる要因となりうる。公的機関が科学的根拠を分かりやすく示すリスクコミュニケーションは、単なる広報ではなく、対話の姿勢を前提とした継続的な取り組みであることが求められる。",
      qa: [
        { s: "ワクチンは集団免疫の形成に中心的な役割を果たしている。", a: "A", e: "本文冒頭に同趣旨の記述がある。" },
        { s: "リスクコミュニケーションは、一方的な広報で完結するのが効果的だとされる。", a: "B", e: "本文は対話の姿勢を前提とする継続的取り組みが必要だと述べている。" },
        { s: "接種率の低下要因として、忌避感情や情報の偏りが挙げられている。", a: "A", e: "本文にそのまま同趣旨の記述がある。" },
        { s: "COVID-19 のワクチン接種率は、世界全体で 80% を超えた。", a: "C", e: "本文に具体的数値は示されていない。" }
      ]
    },
    {
      passage: "長時間労働の是正は、個人の健康保持だけでなく、組織の生産性向上にも寄与すると考えられている。欧州の一部では、勤務時間外の業務連絡を制限する「つながらない権利」が法制化されており、日本でも議論が始まっている。一方、成果を時間ではなく成果物で評価する制度への移行は、業務の属人化を招く恐れもあるため、評価基準の設計を慎重に行う必要がある。",
      qa: [
        { s: "欧州の一部では「つながらない権利」が法制化されている。", a: "A", e: "本文に同趣旨の記述がある。" },
        { s: "成果物評価への移行は、評価基準の設計を不要にする。", a: "B", e: "本文は設計を慎重に行う必要があると述べており、逆の内容である。" },
        { s: "長時間労働の是正は、組織の生産性向上にも資する可能性がある。", a: "A", e: "本文冒頭と整合する。" },
        { s: "日本の平均労働時間は OECD 平均を大きく上回る。", a: "C", e: "本文に具体的な国際比較の数値は示されていない。" }
      ]
    },
    {
      passage: "テレワークは柔軟な働き方を可能にする一方で、労働者の孤立感や勤務時間の把握の難しさといった新たな課題も生んでいる。企業には、オンラインでのコミュニケーション機会を意図的に設計し、メンタルヘルスの観点からも配慮することが求められている。制度整備と同時に、マネージャーの役割も従来の時間管理型から、成果と自律性を重視する支援型へ移行していく必要がある。",
      qa: [
        { s: "テレワークの導入には、労働者の孤立感への対処が課題となる。", a: "A", e: "本文冒頭と整合する。" },
        { s: "テレワーク下では、マネージャーには依然として時間管理型の役割が求められる。", a: "B", e: "本文は支援型への移行が必要だと述べており、逆の内容である。" },
        { s: "テレワーク下のメンタルヘルスへの配慮は、企業の重要な課題である。", a: "A", e: "本文に同趣旨の記述がある。" },
        { s: "日本のテレワーク実施率は、コロナ禍以降 30% を超えた水準で推移している。", a: "C", e: "本文に具体的数値は示されていない。" }
      ]
    },
    {
      passage: "グローバル化は、財やサービスの国境を越えた移動を促進し、消費者に多様な選択肢をもたらしてきた。しかし、サプライチェーンの長大化は地政学リスクに対する脆弱性を高める側面もあり、近年は重要物資の調達先を複数化する「フレンドショアリング」などの動きも見られる。効率性と安全保障のバランスをどう取るかは、各国の政策課題となっている。",
      qa: [
        { s: "サプライチェーンの長大化は、地政学リスクへの脆弱性を高める側面がある。", a: "A", e: "本文に同趣旨の記述がある。" },
        { s: "フレンドショアリングとは、調達先を単一の国に絞る戦略を指す。", a: "B", e: "本文は「複数化する」動きとして紹介しており、逆の内容である。" },
        { s: "各国は効率性と安全保障のバランスを政策課題としている。", a: "A", e: "本文末尾と整合する。" },
        { s: "2023 年の世界貿易額は前年比で減少した。", a: "C", e: "本文に具体的な貿易統計は示されていない。" }
      ]
    },
    {
      passage: "国際援助は、途上国の貧困削減やインフラ整備に一定の成果を上げてきたが、援助の効果が必ずしも持続しないという指摘もある。ドナー主導で決定される事業は現地のニーズと乖離することがあり、受益国の制度整備や人材育成を伴わない援助は短期的な効果に終わる恐れがある。現地のオーナーシップを尊重し、自立的発展を支援する方向への転換が進んでいる。",
      qa: [
        { s: "国際援助は常に持続可能な成果をもたらす。", a: "B", e: "本文は持続しないという指摘や短期的効果に終わる恐れを述べている。" },
        { s: "受益国の制度整備や人材育成を伴う援助は、長期的な発展に資すると考えられている。", a: "A", e: "本文末尾と整合する。" },
        { s: "ドナー主導の事業は、現地ニーズと乖離する場合がある。", a: "A", e: "本文に同趣旨の記述がある。" },
        { s: "日本の ODA 予算は、2022 年度で 1 兆円を超えている。", a: "C", e: "本文に具体的な予算額は示されていない。" }
      ]
    }
  ];

  // ==========================================================
  //  英語 (en) プール
  // ==========================================================

  const EN_POOL = [
    {
      passage: "Emma: I've been thinking about our summer trip. Should we fly to Hokkaido or drive there?\nLiam: Driving takes almost a full day. Flying is faster, but we'd have to rent a car at the airport anyway.\nEmma: True. But flying is usually cheaper if we book three months in advance.\nLiam: Let's check the prices tonight. If the fare is under 20,000 yen per person, we'll fly.",
      qa: [
        { s: "What is the main topic of the conversation?", choices: ["Planning a business meeting", "Choosing transport for a summer trip", "Renting a new apartment in Hokkaido", "Comparing hotel prices", "Selecting a restaurant for dinner"], correct: 1, e: "2人は夏の旅行で飛行機と車のどちらを使うかを話し合っている。" },
        { s: "Under what condition will they fly?", choices: ["If driving takes less than half a day", "If they cannot rent a car at the airport", "If the flight costs less than 20,000 yen per person", "If they book a hotel near the airport", "If the weather forecast is good"], correct: 2, e: "Liam の最後のセリフで「1人 2 万円未満なら飛ぶ」と条件を示している。" },
        { s: "What does Emma suggest about flying?", choices: ["It is always the safest option", "It is cheaper when booked in advance", "It requires less luggage", "It is only cheaper in winter", "It needs a passport even for domestic flights"], correct: 1, e: "Emma は「3ヶ月前に予約すれば通常安い」と述べている。" }
      ]
    },
    {
      passage: "Sophie: Dad, the train to the airport runs every ten minutes on weekdays.\nDad: Good. What about on Sunday? Our flight is Sunday morning.\nSophie: It runs every twenty minutes before 8 a.m. and every fifteen minutes after that.\nDad: Let's leave the house by 5:40 then, just to be safe.",
      qa: [
        { s: "How often does the train run on weekdays?", choices: ["Every 5 minutes", "Every 10 minutes", "Every 15 minutes", "Every 20 minutes", "Every 30 minutes"], correct: 1, e: "Sophie は平日は 10 分間隔と説明している。" },
        { s: "When will they leave the house?", choices: ["At 5:00 a.m.", "At 5:40 a.m.", "At 6:00 a.m.", "At 7:00 a.m.", "At 8:00 a.m."], correct: 1, e: "Dad が「5:40 に出よう」と述べている。" },
        { s: "Why does the father want to leave early?", choices: ["To avoid traffic on the highway", "To have breakfast at the airport", "To be safe since their flight is Sunday morning", "To buy gifts before boarding", "To pick up a colleague on the way"], correct: 2, e: "「just to be safe」という理由と日曜朝のフライトという文脈から判断できる。" }
      ]
    },
    {
      passage: "Ryan recently joined a marketing team that uses a weekly stand-up meeting. Every Monday at 9:30 a.m., each member reports three things: what was done last week, what is planned this week, and any obstacles. Meetings last 15 minutes. Ryan finds the format helpful because he can quickly see how his work connects to the overall goals.",
      qa: [
        { s: "When does the stand-up meeting take place?", choices: ["Monday at 8:30 a.m.", "Monday at 9:30 a.m.", "Tuesday at 9:30 a.m.", "Friday at 5:00 p.m.", "Wednesday at 10:00 a.m."], correct: 1, e: "本文に「Every Monday at 9:30 a.m.」とある。" },
        { s: "How long is the meeting?", choices: ["Five minutes", "Ten minutes", "Fifteen minutes", "Thirty minutes", "One hour"], correct: 2, e: "「Meetings last 15 minutes」と明記。" },
        { s: "What does Ryan appreciate about the meeting?", choices: ["Free coffee is provided", "He can skip it when busy", "He sees how his work fits the overall goals", "His manager praises him publicly", "It replaces all other meetings"], correct: 2, e: "「how his work connects to the overall goals」が helpful だと述べている。" }
      ]
    },
    {
      passage: "Manager: We have two candidates for the developer role. One has ten years of experience but asks for a high salary. The other is a junior with strong potential.\nHR: If we hire the senior, we can assign advanced tasks immediately. The junior will need six months of training.\nManager: Let's interview the senior again next week before we decide.",
      qa: [
        { s: "What are the two speakers discussing?", choices: ["A new office location", "Choosing between two developer candidates", "Designing a training program", "Buying development tools", "Firing an employee"], correct: 1, e: "冒頭で 2 人の候補者について議論していることが分かる。" },
        { s: "What is the main disadvantage of the junior candidate?", choices: ["Too old for the team", "Has no coding skills at all", "Needs six months of training before productive", "Lives too far from the office", "Already has a different job offer"], correct: 2, e: "HR が「junior は 6 ヶ月の training が必要」と指摘している。" },
        { s: "What will the manager do next?", choices: ["Hire the junior immediately", "Interview the senior again next week", "Cancel the recruitment", "Ask both candidates to work together", "Post a new job advertisement"], correct: 1, e: "Manager の最後のセリフに「interview the senior again next week」とある。" }
      ]
    },
    {
      passage: "Yuki started university last month. She chose to live in a dormitory on campus because it takes only five minutes to reach her classrooms. The rent is slightly higher than a private apartment, but meals are included three times a day. She plans to join the photography club next week.",
      qa: [
        { s: "Why did Yuki choose the dormitory?", choices: ["It is the cheapest option", "It is within five minutes of her classrooms", "Her friend recommended it", "It has a gym", "It is off campus"], correct: 1, e: "本文に「only five minutes to reach her classrooms」とある。" },
        { s: "What is included with the dormitory rent?", choices: ["Laundry service", "Three meals a day", "A private car park", "Free internet", "A monthly bus pass"], correct: 1, e: "「meals are included three times a day」と明記。" },
        { s: "What will Yuki do next week?", choices: ["Change dormitories", "Buy a camera", "Join the photography club", "Apply for a scholarship", "Move back home"], correct: 2, e: "本文末尾に「plans to join the photography club next week」とある。" }
      ]
    },
    {
      passage: "Professor Brown announced that the final exam will consist of two parts: a written section worth 60% and an oral presentation worth 40%. Students must pass both sections to get credit. The presentation topic must be submitted by May 10, and the written exam is on June 20.",
      qa: [
        { s: "What percentage of the final grade comes from the oral presentation?", choices: ["20%", "30%", "40%", "50%", "60%"], correct: 2, e: "oral presentation は 40% と明記。" },
        { s: "What is required to get credit?", choices: ["Pass only the written section", "Pass only the presentation", "Pass both sections", "Attend all lectures", "Submit a thesis"], correct: 2, e: "「Students must pass both sections」とある。" },
        { s: "When must students submit their presentation topic?", choices: ["By April 10", "By May 10", "By June 10", "By June 20", "By July 1"], correct: 1, e: "「must be submitted by May 10」と明記。" }
      ]
    },
    {
      passage: "Customer: Do you have this shirt in medium? I can only find small and large.\nClerk: Let me check the stockroom. ... I'm sorry, we sold the last medium this morning. However, the same design will arrive on Thursday.\nCustomer: Could you hold one for me when it comes in?\nClerk: Of course. Please leave your name and phone number at the counter.",
      qa: [
        { s: "What size does the customer want?", choices: ["Extra small", "Small", "Medium", "Large", "Extra large"], correct: 2, e: "冒頭で medium を探していると明言している。" },
        { s: "Why is the size unavailable?", choices: ["The store never carried it", "It was sold this morning", "It is a discontinued product", "The supplier cancelled the order", "It is locked in a display case"], correct: 1, e: "店員が「we sold the last medium this morning」と述べている。" },
        { s: "What will the customer do next?", choices: ["Buy a small size instead", "Leave name and phone number at the counter", "Visit another store", "Wait in the store until Thursday", "Cancel the purchase entirely"], correct: 1, e: "店員の最後のセリフで「Please leave your name and phone number」とある。" }
      ]
    },
    {
      passage: "The restaurant near the station is famous for its seasonal menu. Every three months, the chef replaces half of the dishes with new ones inspired by local produce. Reservations are recommended on weekends, though weekday lunches usually have seats available without booking.",
      qa: [
        { s: "How often does the menu change?", choices: ["Every month", "Every two months", "Every three months", "Every six months", "Once a year"], correct: 2, e: "「Every three months」と明記。" },
        { s: "What inspires the new dishes?", choices: ["Foreign cuisines", "Local produce", "Customer surveys", "Online trends", "The chef's travels abroad"], correct: 1, e: "「inspired by local produce」とある。" },
        { s: "When are reservations especially recommended?", choices: ["Weekday lunches", "Weekday dinners", "Weekends", "Holidays only", "Never"], correct: 2, e: "「Reservations are recommended on weekends」と記述。" }
      ]
    },
    {
      passage: "Dr. Sato recommends that adults engage in at least 150 minutes of moderate physical activity per week. Walking, cycling and swimming all qualify. People who sit for long hours should take short breaks every 45 minutes to reduce the risk of back pain and poor circulation.",
      qa: [
        { s: "How many minutes of moderate activity per week does Dr. Sato recommend?", choices: ["30 minutes", "60 minutes", "100 minutes", "150 minutes", "300 minutes"], correct: 3, e: "「at least 150 minutes」と明記。" },
        { s: "Which activity is NOT mentioned as qualifying?", choices: ["Walking", "Cycling", "Swimming", "Weightlifting", "None of the above"], correct: 3, e: "本文は walking / cycling / swimming のみを挙げている。" },
        { s: "How often should people who sit for long hours take breaks?", choices: ["Every 15 minutes", "Every 30 minutes", "Every 45 minutes", "Every 60 minutes", "Every 90 minutes"], correct: 2, e: "「every 45 minutes」と明記。" }
      ]
    },
    {
      passage: "Hiro: I joined a basketball team two months ago. I practice twice a week after work.\nMina: Isn't that exhausting?\nHiro: At first, yes. But I sleep better now and my shoulders feel less stiff. I've also lost about two kilos.\nMina: That's impressive. Maybe I should try something too.",
      qa: [
        { s: "How often does Hiro practice basketball?", choices: ["Once a week", "Twice a week", "Three times a week", "Every day", "Only on weekends"], correct: 1, e: "本文に「twice a week after work」とある。" },
        { s: "Which of the following does Hiro NOT mention as a benefit?", choices: ["Better sleep", "Less shoulder stiffness", "Weight loss", "Improved eyesight", "None of the above"], correct: 3, e: "視力については言及されていない。" },
        { s: "How does Mina react to Hiro's experience?", choices: ["She criticizes his routine", "She shows interest in trying something too", "She invites him to dinner", "She warns him about injuries", "She asks for his coach's number"], correct: 1, e: "Mina は「Maybe I should try something too」と関心を示している。" }
      ]
    },
    {
      passage: "The new smartphone model from TechBrand features a camera with three lenses and a battery that lasts up to 30 hours on a single charge. However, the price has increased by 15% compared to the previous model. Reviewers agree that the camera is excellent but question whether the higher price is justified for casual users.",
      qa: [
        { s: "How long does the battery last?", choices: ["10 hours", "15 hours", "20 hours", "30 hours", "48 hours"], correct: 3, e: "「up to 30 hours on a single charge」と明記。" },
        { s: "By what percentage has the price increased?", choices: ["5%", "10%", "15%", "20%", "25%"], correct: 2, e: "「increased by 15%」と記述。" },
        { s: "What do reviewers question?", choices: ["Whether the camera works in the dark", "Whether the price is justified for casual users", "Whether the battery is safe", "Whether the brand will continue", "Whether the screen is large enough"], correct: 1, e: "「question whether the higher price is justified for casual users」とある。" }
      ]
    },
    {
      passage: "Streaming services have changed how people watch films. Viewers can now access thousands of titles without going to a rental shop. One downside, however, is that licences expire regularly, so a film available today may be gone next month. Some users record their favourites to avoid losing access.",
      qa: [
        { s: "What is one downside of streaming services mentioned?", choices: ["The image quality is poor", "Internet speed is always slow", "Licences expire regularly", "Subtitles are not available", "Subscription is mandatory for life"], correct: 2, e: "「licences expire regularly」と明記。" },
        { s: "Why do some users record their favourites?", choices: ["To share with friends illegally", "Because the streaming service requested it", "To avoid losing access when licences expire", "Because recording gives better quality", "To sell them later"], correct: 2, e: "「to avoid losing access」と記述。" },
        { s: "According to the passage, what has changed thanks to streaming?", choices: ["People no longer watch films", "Rental shops have increased", "People can access thousands of titles without going to a rental shop", "Film prices have doubled", "Cinemas charge higher fees"], correct: 2, e: "「access thousands of titles without going to a rental shop」と述べている。" }
      ]
    },
    {
      passage: "The city announced a new recycling programme this spring. Residents must separate plastics into two categories: containers and others. Collection day for plastics will move from Tuesday to Thursday. Residents who place items incorrectly will receive a written warning; after three warnings, a fine may be imposed.",
      qa: [
        { s: "On which day will plastics now be collected?", choices: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], correct: 3, e: "「move from Tuesday to Thursday」と明記。" },
        { s: "How many categories will plastics be divided into?", choices: ["One", "Two", "Three", "Four", "Five"], correct: 1, e: "「two categories: containers and others」と記述。" },
        { s: "What happens after three warnings?", choices: ["A written thank-you note", "A new bin is provided", "A fine may be imposed", "The resident is evicted", "Nothing happens"], correct: 2, e: "「after three warnings, a fine may be imposed」とある。" }
      ]
    },
    {
      passage: "A national park in the north was established fifty years ago to protect native birds. Visitor numbers have grown so much that the park now asks visitors to reserve slots online. The system limits daily entry to 3,000 people on weekdays and 5,000 on weekends. Rangers explain that this helps reduce noise and protect wildlife.",
      qa: [
        { s: "Why was the park originally established?", choices: ["To promote tourism", "To protect native birds", "To test new forestry methods", "To train park rangers", "To grow rare flowers"], correct: 1, e: "「to protect native birds」と明記。" },
        { s: "How many visitors are allowed on weekdays?", choices: ["1,000", "2,000", "3,000", "5,000", "10,000"], correct: 2, e: "「3,000 people on weekdays」とある。" },
        { s: "According to the rangers, what is the purpose of the reservation system?", choices: ["To increase park revenue", "To reduce noise and protect wildlife", "To hire more rangers", "To build new hiking trails", "To collect visitor data for marketing"], correct: 1, e: "「helps reduce noise and protect wildlife」と記述。" }
      ]
    },
    {
      passage: "Harbour City has invested in expanding its bicycle lane network over the past decade. The total length of dedicated lanes has grown from 40 km to over 200 km. Surveys show that commuters who switched to cycling save about thirty minutes per day compared to driving during peak hours.",
      qa: [
        { s: "How long was the bicycle lane network ten years ago?", choices: ["10 km", "40 km", "100 km", "200 km", "300 km"], correct: 1, e: "「grown from 40 km」と明記。" },
        { s: "How much time do commuters save per day by switching to cycling?", choices: ["About 10 minutes", "About 20 minutes", "About 30 minutes", "About 45 minutes", "About one hour"], correct: 2, e: "「save about thirty minutes per day」と記述。" },
        { s: "Against what mode of transport is the time-saving compared?", choices: ["Walking", "Buses", "Trains", "Driving during peak hours", "Ride-share services"], correct: 3, e: "「compared to driving during peak hours」とある。" }
      ]
    },
    {
      passage: "A small island in the Pacific has recently announced plans to ban single-use plastics by 2027. The government argues that marine debris has damaged coral reefs and reduced tourism income. Critics say the timeline is too short and will hurt small retailers. Officials promise subsidies to help businesses transition.",
      qa: [
        { s: "By when will the island ban single-use plastics?", choices: ["By 2025", "By 2026", "By 2027", "By 2030", "By 2035"], correct: 2, e: "「ban single-use plastics by 2027」と明記。" },
        { s: "What is one reason the government gives for the ban?", choices: ["It will create diplomatic tension", "Marine debris has damaged coral reefs", "Plastics are too expensive to import", "Children have requested it", "It was demanded by the UN"], correct: 1, e: "「marine debris has damaged coral reefs」とある。" },
        { s: "What do critics say about the plan?", choices: ["It will not help the environment", "It is too ambitious environmentally", "The timeline is too short and will hurt small retailers", "It will raise tourism revenue", "It is illegal under trade law"], correct: 2, e: "「timeline is too short and will hurt small retailers」と記述。" }
      ]
    }
  ];

  // プールエントリを出題可能な形に正規化
  function normalizeJa(entry) {
    const map = { A: 0, B: 1, C: 2 };
    const questions = entry.qa.map(q => ({
      statement: q.s,
      choices: JA_CHOICES.slice(),
      correct_index: map[q.a],
      explanation: q.e
    }));
    return { passage: entry.passage, questions };
  }
  function normalizeEn(entry) {
    const questions = entry.qa.map(q => ({
      statement: q.s,
      choices: q.choices.slice(),
      correct_index: q.correct,
      explanation: q.e
    }));
    return { passage: entry.passage, questions };
  }

  // セッション毎にプールをシャッフルし、必要数を先頭から取り出す
  function buildJaSession(count) {
    const shuffled = shuffle(JA_POOL);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(normalizeJa(shuffled[i % shuffled.length]));
    }
    return out;
  }
  function buildEnSession(count) {
    const shuffled = shuffle(EN_POOL);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(normalizeEn(shuffled[i % shuffled.length]));
    }
    return out;
  }

  window.Generators = {
    num: genNum,
    buildJaSession,
    buildEnSession,
    poolSizes: { ja: JA_POOL.length, en: EN_POOL.length }
  };
})();
