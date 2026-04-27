/* ============================================================
   問題生成モジュール（完全オフライン / APIキー不要 / 課金ゼロ）
   - 計数 (num): アルゴリズム生成
   - 言語 (ja): テンプレート + スロット置換 による動的生成
   - 英語 (en): 会話テンプレート + スロット置換 による動的生成
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

  function genTable() {
    const def = pick(NUM_TABLE_THEMES);
    const rowCount = rand(4, 5);
    const colCount = rand(4, 5);
    const rows = pickN(def.rows, rowCount);
    const cols = def.kind === "years" ? yearList(colCount) : rankList(colCount);
    const data = rows.map(() => cols.map(() => rand(def.min, def.max)));
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
      passage: "", theme: def.theme, note: `単位: ${def.unit}`, chartType: "table",
      chartData: { table_markdown: table_md, pie_items: [], chart_categories: [], chart_series: [], unit: def.unit },
      questions: [{ statement, choices, correct_index, explanation }]
    };
  }

  function genTableBlank() {
    const def = pick(NUM_TABLE_THEMES);
    const rowCount = rand(4, 5);
    const colCount = rand(4, 5);
    const rows = pickN(def.rows, rowCount);
    const cols = def.kind === "years" ? yearList(colCount) : rankList(colCount);
    const data = rows.map(() => cols.map(() => rand(def.min, def.max)));
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

    const rowTotal = totals[blankR];
    const explanation = `${rows[blankR]} の合計 ${fmt(rowTotal)} から他の列を引いて ${fmt(correct)}${def.unit}`;
    const dist = (i) => [correct * 1.1, correct * 0.9, correct - rand(50, 200), correct + rand(50, 200)][i - 1] || correct + rand(-300, 300);
    const { choices, correct_index } = buildChoices(correct, dist, { unit: " " + def.unit, decimals: 0 });

    return {
      passage: "", theme: def.theme, note: `表の ? の値を計算しなさい（単位: ${def.unit}）`, chartType: "table_blank",
      chartData: { table_markdown: table_md, pie_items: [], chart_categories: [], chart_series: [], unit: def.unit },
      questions: [{ statement: "表中の ? に入る値として最も近いものはどれか。", choices, correct_index, explanation }]
    };
  }

  function genPie() {
    const def = pick(NUM_PIE_THEMES);
    const count = rand(4, 5);
    const labels = pickN(def.items, count);
    const raw = labels.map(() => rand(5, 40));
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    const pcts = raw.map(v => Math.round(v / sumRaw * 1000) / 10);
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
      passage: "", theme: def.theme, note: `${def.absTotalLabel}: ${fmt(absTotal)}${def.absUnit}`, chartType: "pie",
      chartData: { table_markdown: "", pie_items, chart_categories: [], chart_series: [], unit: "%" },
      questions: [{ statement, choices, correct_index, explanation }]
    };
  }

  function genBar() {
    const def = pick(NUM_BARLINE_THEMES);
    const catCount = rand(4, 6);
    const seriesCount = rand(2, 3);
    const cats = yearList(catCount);
    const seriesNames = pickN(def.seriesPool, seriesCount);
    const series = seriesNames.map(name => ({ name, values: cats.map(() => rand(def.min, def.max)) }));
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
      const a = series[si].values[ci], b = series[si].values[ci2];
      correct = (b - a) / a * 100;
      statement = `${series[si].name}の${cats[ci]}から${cats[ci2]}への増加率は約何%か。`;
      explanation = `(${fmt(b)} - ${fmt(a)}) / ${fmt(a)} × 100 = ${roundTo(correct, 1)}%`;
      decimals = 1; unit = " %";
    } else {
      let si2 = rand(0, seriesCount - 1);
      while (si2 === si && seriesCount > 1) si2 = rand(0, seriesCount - 1);
      const a = series[si].values[ci], b = series[si2].values[ci];
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
      passage: "", theme: def.theme, note: `単位: ${def.unit}`, chartType: "bar",
      chartData: { table_markdown: "", pie_items: [], chart_categories: cats, chart_series: series, unit: def.unit },
      questions: [{ statement, choices, correct_index, explanation }]
    };
  }

  function genLine() {
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
  //  言語 (ja) テンプレート生成
  //  - 600〜800字 / 評論文 / 起承転結 or 序論・本論・結論
  //  - 4問（A/B/C がそれぞれ最低1つ、Aが2つの場合あり）
  //  - スロットは意味を変えず表層の文言のみ差し替える
  // ==========================================================

  function resolveSlots(slotDefs) {
    const out = {};
    for (const key of Object.keys(slotDefs)) out[key] = pick(slotDefs[key]);
    return out;
  }

  const JA_TEMPLATES = [
    // 1. 効率 vs 熟慮 のトレードオフ
    {
      slots: {
        field: ["行政運営", "企業経営", "学校教育", "医療現場", "司法手続", "地方自治"],
        fast: ["迅速な意思決定", "数値目標の達成", "業務の標準化", "成果主義の徹底"],
        slow: ["関係者との十分な対話", "多面的な検証", "時間的余裕の確保", "少数意見の吸収"],
        ex_fast: ["決裁過程の短縮", "人員配置の見直し", "マニュアル化の推進", "定量指標への一元化"],
        ex_slow: ["合議の場の設置", "第三者による監査", "現場からの提案機会", "複数案の比較検討"],
        risk: ["現場の疲弊と離職", "制度の形骸化", "本来の目的との乖離", "関係者の信頼失墜"],
        closing: ["目的と手段を取り違えない態度", "具体と抽象を行き来する視座", "当事者感覚を失わない姿勢", "目的に照らした柔軟な運用"]
      },
      passageFn: (s) =>
`近年、${s.field}の分野では${s.fast}が重視される傾向がますます強まっている。${s.ex_fast}といった施策はその典型的な表れであり、短期的な成果という点において一定の評価を得ている側面は否定しがたい。しかし、${s.fast}を過度に追求することは、必然的に${s.slow}の軽視を伴いがちだという指摘は、歴史を振り返れば繰り返されてきた論点である。${s.ex_slow}といった本来的な営みが省略される状況下では、${s.risk}が顕在化する局面も決して少なくない。もっとも、両者は本質的に排他的な関係にあるわけではない。目的・対象・時間軸の相違に応じて両者の比重を柔軟に調整することができれば、むしろ相補的に機能しうるというのが、実務家の間で近年次第に共有されつつある見解である。数値指標のみに依拠した意思決定が当初の目的を見失わせる事例は、既に多くの現場で報告されており、安易な単純化に警鐘が鳴らされている状況と言える。重要なのは、${s.fast}と${s.slow}のいずれか一方に全面的に傾くのではなく、${s.closing}を組織の文化として継続的に定着させることであろう。そうでなければ、いかに洗練された制度設計を導入しようとも、本来の目的を達成しないまま形式のみが残存する結果を招きかねず、結局は現場の疲弊と制度への不信だけを生む事態となる。`,
      qa: [
        { s: (s) => `本文は${s.fast}と${s.slow}のどちらか一方に偏るべきだと結論付けている。`, a: "B", e: "本文は両者のバランス調整が重要であり、一方への偏重は形骸化を招くと述べている。" },
        { s: (s) => `${s.slow}の軽視は、${s.risk}を招く可能性があると本文は指摘している。`, a: "A", e: "「${slow}といった本来的な営みが省略されるとき、${risk}が顕在化する」と明記されている。" },
        { s: (s) => `${s.field}において${s.fast}を徹底した組織の生産性は、そうでない組織の約2倍に達するとの調査がある。`, a: "C", e: "本文にそのような定量的な調査結果の言及はない。" },
        { s: (s) => `両者のバランスを状況に応じて調整することで、${s.fast}と${s.slow}は両立しうると本文は述べている。`, a: "A", e: "「両者は本質的に排他的なものではない…相補的に機能しうる」と整合する。" }
      ]
    },

    // 2. グローバル化の功罪
    {
      slots: {
        domain: ["貿易", "金融市場", "労働移動", "情報流通", "文化交流", "技術標準"],
        benefit: ["選択肢の拡大", "価格の低廉化", "知識の共有", "規模の経済"],
        cost: ["地域産業の衰退", "所得格差の拡大", "文化的画一化", "脆弱性の連鎖"],
        ex_benefit: ["消費者の選択肢が飛躍的に増えたこと", "専門知が国境を越えて還流すること", "遠隔地の需要を捉えた成長", "国際共同研究の活発化"],
        ex_cost: ["雇用の空洞化", "地域共同体の衰退", "少数言語の消滅", "供給網の途絶リスク"],
        adjustment: ["再配分政策の拡充", "地域保護の選別的導入", "教育機会の再設計", "国際協調の枠組み強化"],
        closing: ["単純な賛否では捉えられない構造的な問題", "損失の分布に注意を払う必要性", "勝者と敗者の両方に目を向ける姿勢", "恩恵を広く行き渡らせる制度設計"]
      },
      passageFn: (s) =>
`${s.domain}におけるグローバル化は、過去数十年にわたって人々の生活と社会構造に広範な変化をもたらしてきた。その恩恵として、${s.benefit}が繰り返し指摘されており、${s.ex_benefit}といった現象は多くの先行研究によって確認されている。とりわけ情報技術や物流網の発達は、従来地理的制約のもとで達成が困難とされてきた取引や交流を容易にし、地球規模での結びつきを日常の一部へと変貌させた。他方で、グローバル化には見過ごされがちな副作用が伴うことも、次第に明らかになってきている。${s.cost}という形で現れる影響は、${s.ex_cost}として具体化する場合があり、関係者の間で深刻な議論を呼んできた経緯がある。恩恵を受ける層と不利益を被る層が明確に分かれる局面では、社会の分断や制度への信頼の揺らぎといった二次的な問題も観察されている。ここで重要なのは、グローバル化そのものを称揚するか全面的に否定するかという単純な二者択一の議論ではない。むしろ${s.adjustment}を通じて、恩恵を広く行き渡らせると同時に、不利益を被る層への手当てを制度として組み込むことこそが、喫緊の政策課題であると言える。結局のところグローバル化は、${s.closing}として捉え直す必要があり、一面的な評価に止まらない多層的な議論が、いま改めて求められているのだと言えよう。`,
      qa: [
        { s: (s) => `グローバル化は${s.benefit}をもたらすと同時に、${s.cost}という副作用をも伴うと本文は述べている。`, a: "A", e: "本文は恩恵と副作用の両面を明示的に論じている。" },
        { s: (s) => `本文はグローバル化を全面的に否定し、その撤回を主張している。`, a: "B", e: "本文は「二者択一ではない」と述べ、恩恵を認めたうえでの制度的対応を論じている。" },
        { s: (s) => `グローバル化に反対する大規模な抗議運動は、主要国の首都で毎年開催されている。`, a: "C", e: "本文に具体的な抗議運動の記述はない。" },
        { s: (s) => `${s.adjustment}は、グローバル化の恩恵を広く行き渡らせるための手段として位置づけられている。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 3. 技術と倫理
    {
      slots: {
        tech: ["生成AI", "遺伝子編集", "自動運転", "顔認証技術", "脳-機械インターフェース", "合成生物学"],
        promise: ["医療の飛躍的向上", "生産性の劇的改善", "障害の克服", "新しい表現の獲得"],
        concern: ["判断責任の所在", "個人の自律性の侵害", "社会的格差の固定化", "予測困難な二次影響"],
        actor: ["開発企業", "研究者コミュニティ", "規制当局", "利用者自身"],
        institution: ["倫理審査の透明化", "説明責任の明文化", "試用範囲の段階的拡大", "第三者評価の制度化"],
        caveat: ["技術の進歩は止められないとの前提", "国際的な制度差による空洞化", "利益と負担の非対称性", "可逆性の確保の困難さ"],
        closing: ["社会が受容可能な範囲を継続的に問い直す姿勢", "立場の異なる声を丁寧に拾う対話の場", "便益と被害の均衡を再定義する作業", "人間中心の視座を失わない制度設計"]
      },
      passageFn: (s) =>
`${s.tech}は、${s.promise}という期待とともに急速な社会実装が進んでいる分野である。関連する技術指標の改善は目覚ましく、数年前には理論上も実装上も不可能と見なされていた応用が次々と実現しているのが現状である。しかし、実装の広がりに伴って${s.concern}という問題が次第に浮上してきていることも、もはや見逃すことはできない。このような課題に対して、${s.actor}に責任の所在を委ねるだけでは明らかに不十分であり、${s.institution}といった制度的な手当てが並行して求められる段階に入っている。実際に諸外国の議論においても、技術そのものの規制のみならず、開発プロセスの透明化や利害関係者間の対話の場の確保といった論点が、包括的な枠組みの中核を占めるようになってきた。とはいえ、制度の整備は常に技術の進歩に遅れがちであり、${s.caveat}といった条件もあって、万能の枠組みを最初から設計することは極めて難しい。ゆえに肝要なのは、一度定めた規則に安住することなく、${s.closing}を常に維持していくことだと言えるだろう。技術が社会に埋め込まれていくプロセスは、人々の価値観そのものを変容させる契機でもあるのだから、受容のあり方を不断に検討し直す営みこそが、社会の健全さを長期的に支える基盤となると考えられる。`,
      qa: [
        { s: (s) => `${s.tech}の社会実装においては、${s.institution}が必要であると本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は${s.tech}の開発を即時中止するべきだと主張している。`, a: "B", e: "本文は制度整備と不断の検討を求めており、即時中止は主張していない。" },
        { s: (s) => `${s.tech}に関する国際条約は、すでに複数の主要国間で締結済みである。`, a: "C", e: "本文に国際条約の締結状況に関する記述はない。" },
        { s: (s) => `${s.tech}の進歩に対して、制度の整備は後追いになりがちだと本文は指摘している。`, a: "A", e: "「制度の整備は常に技術の進歩に遅れがち」と明記されている。" }
      ]
    },

    // 4. 環境と経済
    {
      slots: {
        issue: ["気候変動対策", "生物多様性の保全", "海洋プラスチック問題", "水資源の保護"],
        ease: ["制度的な免責", "情報公開の不十分さ", "短期業績への圧力", "消費者の関心の低さ"],
        driver: ["規制強化", "投資家からの要請", "消費者行動の変化", "技術革新の進展"],
        approach: ["サプライチェーン全体での取り組み", "第三者認証の活用", "長期契約による供給安定", "開示基準の国際標準化"],
        obstacle: ["初期コストの高さ", "計測基準の不統一", "技能を持つ人材の不足", "短期収益との相反"],
        progress: ["一部業種での先行事例", "投資家行動の静かな変化", "若年層の就業選好への影響", "地方自治体レベルでの実践"],
        closing: ["長期視点と短期業績の両立", "制度的圧力と市場インセンティブの連動", "可視化と説明責任の徹底", "段階的でも着実な進展"]
      },
      passageFn: (s) =>
`${s.issue}をめぐっては、長らく企業の自主的な取り組みに期待する姿勢が支配的であった。しかしその背景には、${s.ease}という構造があり、結果として実効性を欠くケースが少なくなかったことも、冷静な検証によって明らかになってきている。こうした状況を変えつつある主要な要因が、${s.driver}である。その圧力を受けて、多くの企業が${s.approach}へと舵を切り始めており、単なる広報上の対応を超え、戦略として環境対応を事業構造に組み込む動きが広がっている。格付け機関や金融市場がこの動向を反映しはじめた点も、企業行動を後押しする大きな要素となっていると指摘される。もっとも、こうした変化にも${s.obstacle}という課題が付きまとうことは看過できない。先行事例の成果が業界を超えて広く共有されにくいことや、投下コストと効果の発現時期にずれが生じることが、取り組みを萎縮させる一因となっているのが実態である。とはいえ、${s.progress}という形で、水面下では着実な変化も確実に確認できる段階に入ってきた。肝要なのは、${s.closing}を制度と実務の両面から継続的に支えていくことであり、環境と経済を単なる対立項として捉える古い枠組みからは、もはや本質的な答えを導くことはできない段階に、私たちは入っていると言えるだろう。`,
      qa: [
        { s: (s) => `${s.driver}は、企業の環境対応を後押しする要因として機能していると本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `${s.issue}に関する企業の取り組みは、自主性に委ねるのが最も効果的だと本文は結論付けている。`, a: "B", e: "本文は自主性のみでは実効性を欠くとし、外部圧力の役割を認めている。" },
        { s: (s) => `日本企業の環境関連投資額は、過去5年で約3倍に増加している。`, a: "C", e: "本文に定量的な投資額の記述はない。" },
        { s: (s) => `環境対応の取り組みには、${s.obstacle}という課題が存在すると本文は指摘している。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 5. 教育と自律
    {
      slots: {
        stage: ["初等教育", "中等教育", "高等教育", "社会人教育"],
        old: ["画一的な知識の伝達", "正答主義", "暗記中心の指導", "標準テストへの最適化"],
        new: ["探究型の学び", "協働による問題解決", "自己調整学習", "多様な評価の導入"],
        rationale: ["予測困難な将来への備え", "学習者の主体性の涵養", "個別の資質に応じた支援", "生涯にわたる学びの基盤形成"],
        challenge: ["教員の負担増", "評価の客観性確保", "家庭環境との相互作用", "教材・設備の整備"],
        risk: ["格差の固定化", "基礎学力の軽視", "評価疲れ", "表層的な活動化"],
        closing: ["目的に立ち返る不断の検討", "現場の裁量を支える制度的余裕", "学習者の声を拾う仕組み", "実践知の共有"]
      },
      passageFn: (s) =>
`${s.stage}の現場においては、${s.old}から${s.new}への転換の必要性が長らく議論されてきたテーマである。${s.rationale}という観点から、新しい学び方の理念は広く共有されており、先進的な学校や意欲的な教員による実践報告も年々増加傾向にある。ただし、理念の普及と現場での実質的な定着との間には、依然として大きな乖離が存在することも直視すべき事実である。${s.challenge}といった要因が、現場の変革の進行を難しくしていることは、これまで多くの論者によって繰り返し指摘されてきた点である。さらに、新しい方法論が十分な下支えを伴わないまま性急に導入された場合、かえって${s.risk}を招くおそれもあると警告されている。それは決して理念そのものの否定を意味するのではなく、むしろ理念を実装する段階での条件整備の不備が原因となっているケースが多い、と解するのが妥当であろう。ゆえに今必要とされているのは、理念の是非をめぐる抽象的議論に終始することではなく、${s.closing}を通じて、制度と実践の両面から丁寧に条件を整えていく作業である。教育改革は一朝一夕に成立するような営みではなく、短期的な成果指標だけで拙速に評価を下すことに対しては、慎重であるべきだと考えられる。`,
      qa: [
        { s: (s) => `${s.new}の導入は、条件整備が不十分な場合に${s.risk}を招くおそれがあると本文は指摘している。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は${s.old}こそが望ましい教育方法であると結論付けている。`, a: "B", e: "本文は新しい学び方の理念を肯定しつつ、条件整備の重要性を説いている。" },
        { s: (s) => `OECD の調査によれば、${s.new}を採用した学校の生徒の学習意欲は平均で30%向上している。`, a: "C", e: "本文に定量的な調査結果の記述はない。" },
        { s: (s) => `教育改革は短期の成果指標だけでは評価しきれないと本文は述べている。`, a: "A", e: "本文末尾に同趣旨の記述がある。" }
      ]
    },

    // 6. 情報と社会
    {
      slots: {
        medium: ["ソーシャルメディア", "ニュースアプリ", "オンライン検索", "動画共有サービス"],
        positive: ["情報アクセスの平等化", "多様な視点への接触", "市民の発信機会", "リアルタイムの対話"],
        negative: ["エコーチェンバーの形成", "誤情報の拡散", "注意力の断片化", "感情的対立の増幅"],
        mechanism: ["推薦アルゴリズム", "エンゲージメント最適化", "匿名性の構造", "広告モデルの経済性"],
        userAction: ["情報の出所を意識する姿勢", "多様なソースへのアクセス", "一次情報への遡及", "立場の違いへの想像力"],
        systemicAction: ["透明性の確保", "健全性指標の開示", "規制と自主規律の組み合わせ", "教育との連携"],
        closing: ["個人の注意力と社会の熟議の質", "情報生態系の持続可能性", "民主主義の基盤となる共通の現実認識", "市民としての情報的主体性"]
      },
      passageFn: (s) =>
`${s.medium}は、${s.positive}をもたらす画期的な手段であると同時に、${s.negative}という深刻な副作用をも生み出している両義的な存在である。その背景には、${s.mechanism}が人々の注目を引き続けることを設計原理の中核に据えていることがある。利用者の滞在時間を最大化しようとする構造は、結果として刺激的で情動的な情報を優先しがちであり、静かで複雑で時間のかかる議論は埋もれやすいという傾向が、多数の実証研究によって確認されている。この問題に対応するためには、利用者側の${s.userAction}が重要であると同時に、それだけでは到底不十分であることも率直に認める必要がある。設計主体による${s.systemicAction}、加えて社会全体での議論と制度設計が並行して求められる段階に、私たちは既に入っている。個人の努力のみに責任を負わせる発想は、問題の構造的性質を見誤ることにつながりかねない。肝要なのは、情報を巡る課題を個人の心がけだけに還元せず、${s.closing}という水準で捉え直すことであり、技術と制度、利用と設計の双方向で継続的に調整を図るべき複雑な問題として位置づけることである。短期的な対処療法では、根本的な構造は変わらないのだから、長期的な視座に立った地道な取り組みが、何より欠かせないと言えるだろう。`,
      qa: [
        { s: (s) => `${s.medium}が抱える副作用の背景には、${s.mechanism}の設計原理があると本文は指摘している。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は、情報を巡る課題は個人の心がけだけで解決できると結論付けている。`, a: "B", e: "本文は個人の対応だけでは不十分であり、制度的対応が必要だと述べている。" },
        { s: (s) => `日本では${s.medium}の利用時間が、一日平均3時間を超えている。`, a: "C", e: "本文に利用時間に関する記述はない。" },
        { s: (s) => `${s.medium}の課題は、長期視座での継続的な取り組みが必要だと本文は述べている。`, a: "A", e: "本文末尾に同趣旨の記述がある。" }
      ]
    },

    // 7. 医療と個人
    {
      slots: {
        topic: ["検診プログラム", "予防医療", "慢性疾患の管理", "終末期医療"],
        benefit: ["早期発見による治療機会の拡大", "生活の質の維持", "医療費の抑制", "社会参加の継続"],
        cost: ["過剰診断のリスク", "不要な不安の喚起", "医療資源の偏在", "画一的プログラムの限界"],
        choice_factor: ["リスク・便益の個別評価", "年齢や既往歴を踏まえた判断", "本人の価値観の反映", "信頼できる情報の提示"],
        obstacle: ["情報の非対称性", "制度設計上の硬直性", "判断を支える人材の不足", "経済的格差の影響"],
        progress: ["共同意思決定モデルの普及", "地域医療連携の深化", "予防教育の拡充", "データ活用の進展"],
        closing: ["一律の施策と個別の選択の両立", "エビデンスと価値観の接続", "医療提供者と受け手の協働", "長期的な視点での資源配分"]
      },
      passageFn: (s) =>
`${s.topic}をめぐる議論は、近年になって大きな変化を見せている領域である。かつては${s.benefit}が強調され、幅広い普及の推進が自明視されていた時代があった。しかし、${s.cost}という側面も少しずつ社会的に認知されるようになり、単純な普及万能論では語り尽くせない複雑な局面に、私たちは入っていることを認めざるを得ない。こうしたなかで改めて重要な論点として浮上しているのが、${s.choice_factor}に基づく個別判断の尊重である。もっとも、その実現には${s.obstacle}といった現実的な課題が横たわっており、制度的にも人的にも一定の下支えが不可欠となる。担当者の経験や判断に依存する形で運用されている領域も少なくなく、標準化と個別性のバランスは常に難しい課題として残り続けている。一方で、${s.progress}といった動きは静かに拡大しており、将来的な展望を描く上での重要な手がかりとなっている。結局のところ、${s.topic}に求められているのは、${s.closing}を政策・臨床・市民参加の各レベルで粘り強く進めていく姿勢であろう。どの立場に立つにせよ、事実と価値を丁寧に切り分けながら、当事者の人生観に寄り添う医療の姿が、これからの社会的合意形成の焦点になっていくものと思われる。`,
      qa: [
        { s: (s) => `${s.topic}には${s.benefit}と${s.cost}の両面があると本文は述べている。`, a: "A", e: "本文冒頭で両面が明示されている。" },
        { s: (s) => `本文は${s.topic}の普及を単純に推進することが最適解だと結論付けている。`, a: "B", e: "本文は「単純な普及万能論では語れない」と述べている。" },
        { s: (s) => `日本の${s.topic}受診率は、OECD諸国のなかで最も高い水準にある。`, a: "C", e: "本文に国際比較の記述はない。" },
        { s: (s) => `${s.topic}には、${s.choice_factor}に基づく個別判断が重要だと本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 8. 働き方と裁量
    {
      slots: {
        trend: ["テレワークの広がり", "ジョブ型雇用の導入", "副業の解禁", "成果評価への移行"],
        autonomy: ["時間と場所の柔軟性", "業務配分の自由度", "キャリア形成の主体性", "学び直しの機会"],
        responsibility: ["成果の明確化", "自己管理能力の重視", "健康管理の自己責任化", "評価基準の可視化"],
        risk: ["孤立感の増加", "長時間労働の潜在化", "評価の恣意性", "機会格差の拡大"],
        support: ["上司による支援的関与", "同僚間の学び合い", "制度面での安全網", "技術基盤の整備"],
        culture: ["心理的安全性の醸成", "信頼に基づくマネジメント", "対話を重視する組織風土", "多様性への感受性"],
        closing: ["裁量と支援のバランス", "個人の自律と組織の連帯", "制度と文化の両輪", "長期的な生産性と幸福度"]
      },
      passageFn: (s) =>
`${s.trend}は、多くの働き手に${s.autonomy}をもたらした一方で、同時に${s.responsibility}を強く求める性格を併せ持った、両義的な変化である。この二面性は、しばしば「自由と責任はセット」という簡潔な表現で語られることが多いが、実際の職場においては、その配分のあり方をめぐって、予想以上に深刻な問題として浮上する場面が珍しくない。裁量の拡大が必ずしも働きやすさを保証するわけではなく、むしろ${s.risk}という副作用が顕在化するケースも少なくないのが実情である。このような事態を回避するためには、個人の自律性を尊重しつつも、${s.support}を通じて必要な支援を並行して提供する仕組みが欠かせない。特に新しい働き方に十分慣れていない層に対しては、急激な制度変更は逆効果になりかねず、段階的な移行期間と継続的なフォローが重要となる。さらに、${s.culture}の醸成は、制度以上に本質的に機能する要素であり、数値化しにくいがゆえに軽視されがちな面もあるが、長期的な成否を分ける決定的要因となる。要するに、${s.trend}が本来持つ真の価値は、${s.closing}が成り立つ条件下でこそ発揮されるのであり、単に制度を導入しただけでは持続的な成果にはつながらない。制度設計と組織文化の両面での粘り強い取り組みが、これからの職場に強く求められていると言える。`,
      qa: [
        { s: (s) => `${s.trend}は${s.autonomy}と${s.responsibility}という二面性を持つと本文は述べている。`, a: "A", e: "本文冒頭と整合する。" },
        { s: (s) => `本文は${s.trend}を導入すれば自動的に職場の働きやすさが向上すると結論付けている。`, a: "B", e: "本文は制度導入だけでは持続的成果にならないと述べている。" },
        { s: (s) => `${s.trend}を導入した企業では、従業員の離職率が平均15%低下している。`, a: "C", e: "本文に定量的な調査結果の記述はない。" },
        { s: (s) => `${s.culture}の醸成は、制度以上に機能しうる要素だと本文は指摘している。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 9. 市場と規制
    {
      slots: {
        sector: ["金融市場", "デジタルプラットフォーム", "医薬品流通", "エネルギー供給"],
        merit: ["参入の自由", "価格競争の促進", "イノベーションの誘発", "消費者選択肢の拡大"],
        failure: ["情報の非対称性", "外部不経済", "寡占化の進行", "システミックリスク"],
        tool: ["開示義務の強化", "参入要件の見直し", "監督体制の整備", "第三者評価の導入"],
        tension: ["規制コストと便益", "保護主義への逸脱", "グローバル競争力", "技術変化への追随"],
        lesson: ["過去の金融危機の教訓", "他国制度との比較", "業界自律の限界", "消費者行動の実証研究"],
        closing: ["市場の効率と公平の両立", "柔軟で継続的な制度見直し", "事後救済と事前予防の組み合わせ", "国際協調と自国事情の調整"]
      },
      passageFn: (s) =>
`${s.sector}は、${s.merit}という観点から自由な市場の典型として語られることが多い領域である。もっとも、実際の運営においては${s.failure}という形で市場の失敗が顕在化しやすく、何らかの規制的関与なしに安定的・持続的に機能することは極めて難しい、というのが近年の実証研究が示している知見でもある。${s.tool}はそうした介入の代表的な手段であり、近年は${s.lesson}を踏まえて制度の再設計が国際的に議論されてきた。ただし、規制の強化には常に${s.tension}というジレンマが不可避的に伴うものであり、過剰な介入は本来の市場機能そのものを損なう可能性もある点には、十分な留意が必要である。規制の効果と副作用を精緻に見極めるための分析ツールも整備されつつあるが、それでも完璧な予測は困難な領域である。そのため、制度設計者に求められるのは、一回きりの完成を目指すことではなく、社会・技術・国際環境の変化に応じて${s.closing}を実現する、柔軟かつ継続的な姿勢であると言える。結局のところ${s.sector}の健全性は、市場の活力と公的関与の適切な組み合わせによってこそ成り立つのであり、どちらか一方のみに全面的に依拠することは、理念的には美しく見えても実務上は破綻しがちである、という歴史的教訓は繰り返し確認されてきた。過去の教訓に学びつつ、現状を丁寧に観察する姿勢が、なお強く求められ続けている。`,
      qa: [
        { s: (s) => `${s.sector}では、${s.failure}が顕在化しやすく、規制的関与が必要になる場面があると本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は${s.sector}において規制を全廃することが最も効率的だと主張している。`, a: "B", e: "本文は市場の活力と公的関与の組み合わせを重視している。" },
        { s: (s) => `${s.sector}における規制強化は、必ず GDP を押し上げる効果をもつとされる。`, a: "C", e: "本文にそのような因果関係の記述はない。" },
        { s: (s) => `制度設計には、変化に応じた継続的な見直しが必要だと本文は述べている。`, a: "A", e: "「柔軟な姿勢」と整合する。" }
      ]
    },

    // 10. 地域社会と住民
    {
      slots: {
        theme: ["公共交通の維持", "空き家問題への対応", "地域医療の確保", "コミュニティの再構築"],
        pressure: ["人口減少の加速", "高齢化の深刻化", "財政の逼迫", "若年層の流出"],
        conventional: ["行政主導の画一的施策", "採算重視の事業整理", "広域的な集約化", "民間委託の拡大"],
        alternative: ["住民参加型の計画", "小さな単位での実験", "複数主体の連携", "既存資源の転用"],
        condition: ["合意形成の丁寧さ", "情報公開と説明", "初期コストの共有", "長期的な視点の確保"],
        example: ["コミュニティバスの運行", "空き家のシェア拠点化", "医師と住民の協働", "地域通貨の試行"],
        closing: ["画一的な解の限界", "地域の固有性に根ざした模索", "小さな成功の積み重ね", "制度と慣習の橋渡し"]
      },
      passageFn: (s) =>
`${s.theme}は、多くの地方自治体にとって、もはや先送りできない喫緊の政策課題となっている。その背景には、${s.pressure}といった構造的な要因があり、従来型の${s.conventional}だけでは到底十分な対応が難しい局面に、我々は立たされている。そこで近年強く注目されているのが、${s.alternative}というアプローチである。${s.example}のような具体的な取り組みは、規模こそ決して大きくはないが、地域ごとの固有の文脈に即した解決の可能性を示す、きわめて貴重な事例として評価されつつある。全国で画一的な答えを求める姿勢では拾いきれない、細やかな需要と地域資源の組み合わせが、こうした取り組みから見えてくるのだ。もっとも、こうしたアプローチを広く展開するためには、${s.condition}が不可欠であり、拙速な模倣や形式だけの導入は失敗を招きやすい点は強調されるべきである。重要なのは、${s.closing}を政策立案の段階と現場実践の両面で同時に意識し、地域ごとに異なる条件を丁寧に尊重することだろう。全国一律の解を性急に求める発想からは、真に機能する施策はなかなか生まれにくい。むしろ、小さな実験を重ねながら、学びを丁寧に共有し、制度を漸進的に進化させていく態度こそが、これからの地域運営の現場には強く求められている姿勢だと言えるだろう。`,
      qa: [
        { s: (s) => `${s.theme}への対応として、${s.alternative}が注目されていると本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は、全国一律の解が${s.theme}に対して最も有効だと主張している。`, a: "B", e: "本文は「全国一律の解からは機能する施策は生まれにくい」と述べている。" },
        { s: (s) => `総務省の調査では、${s.example}を導入した自治体の約7割が人口流出の抑制に成功している。`, a: "C", e: "本文に定量的な調査結果の記述はない。" },
        { s: (s) => `拙速な模倣や形だけの導入は失敗を招きやすいと本文は指摘している。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 11. 科学と不確実性
    {
      slots: {
        field: ["気候科学", "疫学", "経済予測", "地震予知"],
        nature: ["扱う系の複雑性", "観測データの制約", "倫理的制約による実験困難", "再現性の限界"],
        public_expect: ["確実な答え", "明快な因果関係", "即座に使える結論", "全会一致の見解"],
        practice: ["確率的表現", "不確実性の明示", "複数シナリオの提示", "暫定的結論の更新"],
        tension: ["政治的決定との非対称性", "メディア報道の単純化", "市民の科学リテラシー", "学界内部の異論"],
        solution: ["コミュニケーションの設計", "透明性の徹底", "対話型の情報発信", "教育との連動"],
        closing: ["不確実性と付き合う社会的成熟", "科学と政策の適切な距離", "長期視野での信頼の醸成", "誤りを認める文化"]
      },
      passageFn: (s) =>
`${s.field}は、${s.nature}ゆえに、本質的な不確実性を抱え込むことが避けられない領域である。それにもかかわらず、社会は往々にして${s.public_expect}を科学に対して求めがちであり、両者の間には埋めがたい認識のずれが生じやすい。科学者たちが${s.practice}を日常的に用いるのは、単なる慎重さや保身からではなく、その領域における知のあり方そのものを誠実に反映した結果である。しかし、現実には${s.tension}といった要因が、科学と社会の建設的な対話を難しくしている。特に、結論が急がれる政策決定の場面では、不確実性そのものが、判断からの「逃げ」と受け止められてしまうことさえある。こうした状況を改善していくためには、${s.solution}が不可欠であり、研究者の側にも社会の側にも、それぞれが果たすべき役割について根本的な見直しが求められる段階に入っている。一方的な情報提供ではなく、双方向の対話を前提とした制度設計が、今後の鍵を握ると言えるだろう。根本的に必要とされているのは、${s.closing}であり、科学の限界を正確に伝え、その限界を踏まえたうえで、なお可能な意思決定を社会とともに設計していく姿勢である。不確実性を完全に排除することはできなくとも、それを適切に共有しながら前へ進む方法は確かに存在する、というのが、現代の科学政策論の到達点の一つだと言えるだろう。`,
      qa: [
        { s: (s) => `${s.field}は本質的な不確実性を抱えていると本文は述べている。`, a: "A", e: "本文冒頭と整合する。" },
        { s: (s) => `本文は科学が常に確実な答えを提供できると主張している。`, a: "B", e: "本文は「本質的な不確実性」を認める立場を明確にしている。" },
        { s: (s) => `${s.field}の研究予算は、過去10年で約2倍に拡大している。`, a: "C", e: "本文に研究予算の記述はない。" },
        { s: (s) => `${s.field}と社会との対話には、${s.solution}が不可欠だと本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    },

    // 12. 言語と文化
    {
      slots: {
        aspect: ["若者言葉", "外来語の氾濫", "方言の衰退", "敬語の変容"],
        worry: ["伝統的表現の喪失", "世代間の断絶", "文化的アイデンティティの希薄化", "論理的思考の劣化"],
        positive_view: ["言語の自然な変化", "新しい表現の創造性", "多様性の反映", "社会変化への適応"],
        example_change: ["語彙の借用と定着", "文法構造の簡略化", "意味の拡張と転用", "新しい敬意表現の出現"],
        context: ["メディア環境の変化", "国際交流の拡大", "世代構成の変動", "教育制度の改変"],
        balance: ["変化の受容と継承の努力", "規範と実態の距離", "表現の自由と共通基盤", "記録保存と現役運用"],
        closing: ["固定的な正しさを絶対視しない態度", "多様な表現の共存を認める姿勢", "変化を観察する冷静な目", "文化継承の創造的な実践"]
      },
      passageFn: (s) =>
`${s.aspect}は、しばしば${s.worry}を引き起こす現象として、批判的な文脈で語られることが多い。たしかに、失われていく表現に対する惜別の情は十分に理解できるし、${s.example_change}のような現象は、既存の言語秩序を根底から揺るがすかのように見える場面もある。しかし、言語そのものの歴史を長い時間軸で見渡してみれば、こうした変化を${s.positive_view}として把握する方が、はるかに妥当な場面も少なくない。${s.context}という現代特有の背景のもとでは、言語がそれに応じて柔軟に変化していくのは、ある意味で必然とも言える現象である。古くから確立されてきた文法や語彙もまた、さらに古い時代の視点から見れば「乱れ」であった事例には事欠かない。とはいえ、変化を無条件に肯定することもまた、単純すぎる態度であることも忘れてはならない。伝統的な表現の積み重ねが持つ豊かさは、すぐには代替されえない独自の価値を確実に含んでいるからだ。したがって求められているのは、${s.balance}という総合的な視座であり、${s.closing}を日常的に養っていくことが、言語と文化の健全さを長期的に支える基盤となると考えられる。言語を巡る議論は、しばしば感情的な色彩を帯びがちであるが、冷静な観察と価値判断とを丁寧に区別する姿勢こそが、建設的な対話の前提となる、と言えるだろう。`,
      qa: [
        { s: (s) => `${s.aspect}は、${s.positive_view}として捉えうる側面もあると本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" },
        { s: (s) => `本文は${s.aspect}を、文化の衰退として全面的に否定している。`, a: "B", e: "本文は変化を「言語の自然な変化」として肯定的に捉える視点も示している。" },
        { s: (s) => `${s.aspect}の広がりは、若年層の国語成績の低下と統計的に相関している。`, a: "C", e: "本文に統計的相関の記述はない。" },
        { s: (s) => `変化を無条件に肯定することも単純すぎる態度だと本文は述べている。`, a: "A", e: "本文に同趣旨の記述がある。" }
      ]
    }
  ];

  function generateJaPassage() {
    const tmpl = pick(JA_TEMPLATES);
    const slots = resolveSlots(tmpl.slots);
    const passage = tmpl.passageFn(slots);
    // JA は固定 ABC 順だが、設問の並び順をシャッフルして A/B/C のパターンを崩す
    const shuffledQa = shuffle(tmpl.qa);
    const questions = shuffledQa.map(q => ({
      statement: q.s(slots),
      choices: JA_CHOICES.slice(),
      correct_index: { A: 0, B: 1, C: 2 }[q.a],
      explanation: typeof q.e === "function" ? q.e(slots) : q.e
    }));
    return { passage, questions };
  }

  // ==========================================================
  //  英語 (en) 会話テンプレート
  //  - 約100〜150 words、対話 4〜5 往復
  //  - CEFR A2〜B1 / 英検準2〜2級レベル
  //  - 3問 × 5択、factual / inferential / paraphrase の混合
  // ==========================================================

  const EN_TEMPLATES = [
    // 1. Travel planning
    {
      slots: {
        A: ["Mike", "Ken", "Taro", "David", "Ryan"],
        B: ["Dad", "Mom", "Uncle Bob", "Grandpa", "Aunt Kate"],
        dest: ["Kyoto", "Osaka", "Nagoya", "Sapporo", "Fukuoka"],
        train: ["the Shinkansen", "the express train", "the new bullet train"],
        positive: ["fast and comfortable", "safe and punctual", "clean and quiet", "efficient and reliable"],
        view: ["Mt Fuji", "the mountains", "the coastline", "the rice fields"],
        season: ["in spring", "in autumn", "in summer", "in winter"],
        plus: ["the Railway Museum", "the old castle", "the famous market", "the river walk"],
        timelabel: ["next month", "next week", "in July", "during the holidays"]
      },
      passageFn: (s) =>
`${s.B}: ${s.A}, last time you were in the UK, you seemed to enjoy the train journey very much.
${s.A}: Yes. The Eurostar was amazing! You know I like trains, especially fast ones.
${s.B}: You know what, we will ride ${s.train} during our trip to ${s.dest} ${s.timelabel}!
${s.A}: Great! ${s.train} is ${s.positive}. It has many different carriage designs, and each one looks quite modern.
${s.B}: Yes, it is also efficient for long-distance travel and rarely cancelled due to weather conditions. The seats are comfortable, so you can relax, see wonderful views of ${s.view} ${s.season} outside the window, and enjoy the ride for hours without feeling tired.
${s.A}: That sounds perfect. How long does it take to reach ${s.dest}?
${s.B}: About three hours from Tokyo, which is much faster than driving. We can also buy local food at the station before boarding.
${s.A}: I also want to visit ${s.plus} to learn more about the local culture and history.`,
      qa: [
        {
          s: (s) => `According to the conversation, ${s.train} is efficient for...`,
          choices: (s) => ["a short-distance trip", "a long-distance trip", "a day trip", "a solo trip", "a family trip"],
          correct: 1,
          e: (s) => "本文に「efficient for long-distance travel」と明記されている。"
        },
        {
          s: (s) => `When will ${s.A} and ${s.B} visit ${s.dest}?`,
          choices: (s) => [
            "tomorrow",
            s.timelabel === "next week" ? "next week" : "next week",
            s.timelabel === "next month" ? "next month" : "next month",
            "next year",
            "next winter"
          ],
          correct: (s) => (s.timelabel === "next week" ? 1 : s.timelabel === "next month" ? 2 : s.timelabel === "in July" ? 2 : s.timelabel === "during the holidays" ? 2 : 2),
          e: (s) => `本文で訪問時期は「${s.timelabel}」と示されている。`
        },
        {
          s: (s) => `What does ${s.B} say about ${s.train}?`,
          choices: (s) => [
            "Its seats are not comfortable.",
            "It is often cancelled due to bad weather.",
            "It is ideal for very short trips only.",
            `It is ${s.positive.split(" and ")[0]} and good for long-distance travel.`,
            "It has no different carriage designs."
          ],
          correct: 3,
          e: (s) => `${s.B} は ${s.train} を「efficient for long-distance travel」かつ「rarely cancelled」と述べている。`
        }
      ]
    },

    // 2. Workplace - new meeting format
    {
      slots: {
        A: ["Ryan", "Sam", "Chris", "Alex", "Jordan"],
        B: ["his manager", "the team leader", "his colleague Anna", "his colleague Paul"],
        freq: ["every Monday", "every Tuesday", "every Friday", "every morning"],
        time: ["at 9:00", "at 9:30", "at 10:00", "at 8:45"],
        length: ["ten", "fifteen", "twenty"],
        count: ["three", "four", "five"],
        benefit: ["his work connects to team goals", "he shares progress quickly", "he spots obstacles early", "he plans his week better"]
      },
      passageFn: (s) =>
`${s.A} joined a marketing team last month and has started attending a short meeting ${s.freq} ${s.time}. In the meeting, each member reports ${s.count} things in order: what was done last week, what is planned for this week, and any blockers that need team support. The meeting lasts only ${s.length} minutes in total, so people must speak briefly and clearly.
${s.A} finds this format very helpful because he can see how ${s.benefit} from day one. He can also ask questions and learn from senior members without waiting for a private meeting.
When he has a problem, his team can usually help him on the same day, which saves a lot of time. ${s.B} also says that this format keeps everyone informed about each other's progress without sending many long emails.
At first, ${s.A} was a little nervous about speaking in front of the team, but now he feels comfortable sharing updates.`,
      qa: [
        {
          s: (s) => `When does the meeting take place?`,
          choices: (s) => [
            `${s.freq} at 8:30`,
            `${s.freq} ${s.time}`,
            `every afternoon ${s.time}`,
            `only on Mondays at 10:00`,
            `twice a week ${s.time}`
          ],
          correct: 1,
          e: (s) => `本文に「${s.freq} ${s.time}」と明記されている。`
        },
        {
          s: (s) => `How long does the meeting last?`,
          choices: (s) => [
            "Five minutes",
            `${s.length} minutes`,
            "Thirty minutes",
            "One hour",
            "Two hours"
          ],
          correct: 1,
          e: (s) => `本文に「lasts ${s.length} minutes」と明記されている。`
        },
        {
          s: (s) => `What does ${s.A} like about the meeting?`,
          choices: (s) => [
            "Free snacks are served.",
            `He can see how ${s.benefit}.`,
            "He can skip it when busy.",
            "His manager praises him every time.",
            "It replaces all other meetings."
          ],
          correct: 1,
          e: (s) => "本文に「helpful because he can see how ~」と記述がある。"
        }
      ]
    },

    // 3. Shopping - shirt
    {
      slots: {
        item: ["shirt", "jacket", "pair of trousers", "hoodie"],
        size: ["medium", "small", "large"],
        day: ["Thursday", "Monday", "Wednesday", "Friday"],
        price: ["3,500 yen", "4,200 yen", "5,000 yen", "2,980 yen"]
      },
      passageFn: (s) =>
`Customer: Excuse me. Do you have this ${s.item} in ${s.size}? I can only find the other sizes on the shelf.
Clerk: Let me check the stockroom for you. One moment please. I'm sorry, we sold the last ${s.size} this morning to another customer.
Customer: That's too bad. I really like this design. Is there any chance you'll have more soon?
Clerk: Yes, you're in luck. The same design will arrive on ${s.day} of next week. The price will stay at ${s.price}, the same as today.
Customer: That's great. Could you hold one for me when it arrives?
Clerk: Of course. Please leave your name and phone number at the counter, and we'll call you as soon as the new stock is ready.
Customer: Thank you so much. I can come back after work any day that week.
Clerk: No problem. We usually hold reserved items for three days, which should give you plenty of time.`,
      qa: [
        {
          s: (s) => `What size does the customer want?`,
          choices: (s) => ["extra small", "small", "medium", "large", "extra large"],
          correct: (s) => ({ "small": 1, "medium": 2, "large": 3 }[s.size] ?? 2),
          e: (s) => `本文冒頭で「in ${s.size}」を探していると明言している。`
        },
        {
          s: (s) => `Why is the size unavailable now?`,
          choices: (s) => [
            "It was never carried.",
            "It was sold this morning.",
            "It is discontinued.",
            "It is on a display case only.",
            "It is reserved for another customer."
          ],
          correct: 1,
          e: (s) => "店員の「we sold the last ~ this morning」と整合する。"
        },
        {
          s: (s) => `When will the new stock arrive?`,
          choices: (s) => ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          correct: (s) => ({ "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4 }[s.day] ?? 3),
          e: (s) => `本文に「arrive on ${s.day}」と明記されている。`
        }
      ]
    },

    // 4. University dormitory
    {
      slots: {
        name: ["Yuki", "Hana", "Akiko", "Noa", "Riko"],
        mins: ["five", "seven", "ten"],
        meals: ["three", "two", "all"],
        club: ["photography club", "tennis club", "drama club", "music circle", "debate society"]
      },
      passageFn: (s) =>
`${s.name} started university last month. She chose to live in a dormitory on campus because it takes only ${s.mins} minutes to walk to her classrooms. The rent is a little higher than a nearby apartment, but ${s.meals} meals a day are included in the price, which makes daily life very simple.
She also likes the study rooms, which are open until midnight and always quiet. ${s.name} says the hardest part of dormitory life is that the private rooms are quite small, but she can share common areas with friends from different departments. Living together also helps her practice English with international students.
Next week, she plans to join the ${s.club} to meet more students and try something new outside her regular studies. Her parents were a little worried at first, but now they say she looks happier and more confident than before.`,
      qa: [
        {
          s: (s) => `Why did ${s.name} choose the dormitory?`,
          choices: (s) => [
            "It is the cheapest option in the city.",
            "It is off campus.",
            `It is only ${s.mins} minutes from her classrooms.`,
            "Her friend recommended it.",
            "It has a private swimming pool."
          ],
          correct: 2,
          e: (s) => `本文に「only ${s.mins} minutes to walk to her classrooms」とある。`
        },
        {
          s: (s) => `What is included in the rent?`,
          choices: (s) => [
            "Laundry service",
            `${s.meals} meals a day`,
            "A car park",
            "A private bathroom",
            "A monthly bus pass"
          ],
          correct: 1,
          e: (s) => `本文に「${s.meals} meals a day are included」と明記されている。`
        },
        {
          s: (s) => `What will ${s.name} do next week?`,
          choices: (s) => [
            "Move to a new apartment",
            "Buy a new laptop",
            `Join the ${s.club}`,
            "Apply for a scholarship",
            "Visit her parents"
          ],
          correct: 2,
          e: (s) => `本文末尾に「plans to join the ${s.club}」とある。`
        }
      ]
    },

    // 5. Health / exercise
    {
      slots: {
        doc: ["Dr. Sato", "Dr. Smith", "Dr. Tanaka", "Dr. Brown"],
        minutes: ["150", "120", "180"],
        activity: ["walking", "cycling", "swimming", "jogging"],
        breakMin: ["45", "30", "60"]
      },
      passageFn: (s) =>
`${s.doc} often advises adults to do at least ${s.minutes} minutes of moderate physical activity each week. Many simple activities count toward this goal, for example ${s.activity}, light jogging in the park, or even fast walking to the station every morning. Small changes in daily habits can make a big difference over time.
People who sit for long hours at work should stand up or stretch every ${s.breakMin} minutes. This helps reduce back pain and improves blood circulation, especially in the legs. ${s.doc} adds that drinking enough water during the day is also important, because many people forget to do so when they are busy.
Starting small is much better than trying to do too much at once, because people who begin slowly are more likely to keep going for many months or even years. ${s.doc} recommends choosing one activity you enjoy and doing it with a friend or family member to make it a habit.`,
      qa: [
        {
          s: (s) => `How many minutes of moderate activity per week does ${s.doc} recommend?`,
          choices: (s) => ["30 minutes", "60 minutes", "90 minutes", `${s.minutes} minutes`, "300 minutes"],
          correct: 3,
          e: (s) => `本文に「at least ${s.minutes} minutes」と明記されている。`
        },
        {
          s: (s) => `Which activity is NOT mentioned in the passage?`,
          choices: (s) => [s.activity, "light jogging", "fast walking", "weightlifting", "standing up"],
          correct: 3,
          e: (s) => "weightlifting は本文に言及されていない。"
        },
        {
          s: (s) => `How often should people who sit for long hours take a break?`,
          choices: (s) => ["Every 15 minutes", "Every 30 minutes", `Every ${s.breakMin} minutes`, "Every 90 minutes", "Every 2 hours"],
          correct: 2,
          e: (s) => `本文に「every ${s.breakMin} minutes」と明記されている。`
        }
      ]
    },

    // 6. Library / study plan
    {
      slots: {
        name1: ["Emma", "Lucy", "Mia", "Sofia"],
        name2: ["Liam", "Noah", "Ethan", "Jack"],
        subject: ["history", "biology", "economics", "literature"],
        day: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        hour: ["two", "three", "four"],
        place: ["the main library", "the study hall", "the group study room", "the quiet zone"]
      },
      passageFn: (s) =>
`${s.name1}: Have you decided when to start studying for the ${s.subject} exam next month?
${s.name2}: I was thinking this ${s.day}. Do you want to join me? Studying with a friend is easier than alone.
${s.name1}: Sure, that sounds great. How many hours do you plan to study in one day?
${s.name2}: About ${s.hour} hours. It will be enough time to review the main chapters and check our weak points.
${s.name1}: Let's meet at ${s.place}. It has big desks and quiet zones, so it's perfect for serious study.
${s.name2}: Good idea. I'll bring my notes and some coloured pens, and you can bring the textbook if you have one.
${s.name1}: Perfect. Should we also bring snacks? A long study session makes me hungry.
${s.name2}: Yes, let's do that. See you at ${s.place} right after lunch.`,
      qa: [
        {
          s: (s) => `What subject are they going to study?`,
          choices: (s) => ["mathematics", s.subject, "physics", "chemistry", "geography"],
          correct: 1,
          e: (s) => `本文に「the ${s.subject} exam」とある。`
        },
        {
          s: (s) => `How long does ${s.name2} plan to study?`,
          choices: (s) => ["about one hour", `about ${s.hour} hours`, "about five hours", "the whole day", "only 30 minutes"],
          correct: 1,
          e: (s) => `本文で ${s.name2} は「About ${s.hour} hours」と述べている。`
        },
        {
          s: (s) => `Where will they meet?`,
          choices: (s) => ["at a coffee shop", "at home", s.place, "in the park", "in the classroom"],
          correct: 2,
          e: (s) => `本文で ${s.place} を集合場所としている。`
        }
      ]
    },

    // 7. Restaurant menu
    {
      slots: {
        restName: ["Sakura Restaurant", "Green Leaf", "Harbor Cafe", "Maple Kitchen"],
        interval: ["two", "three", "four"],
        topic: ["local produce", "seasonal fruit", "fresh seafood", "regional vegetables"],
        recommend: ["weekends", "Friday nights", "public holidays"],
        free: ["weekday lunches", "weekday mornings", "Wednesday afternoons"]
      },
      passageFn: (s) =>
`${s.restName}, near the main station, is well known for its carefully planned seasonal menu. Every ${s.interval} months, the head chef replaces about half of the dishes with new ones inspired by ${s.topic}. The chef visits local farms and markets to choose the freshest items before creating each new menu.
Reservations are strongly recommended on ${s.recommend}, because many customers come from nearby offices and nearby towns after work. However, ${s.free} usually have seats without booking, so visitors can try the restaurant more easily during those times.
The owner also says that young customers enjoy taking pictures of the colorful dishes and sharing them online with friends, which has brought even more people to the restaurant recently. Some dishes have become so popular that they stay on the menu beyond the original season.`,
      qa: [
        {
          s: (s) => `How often does the menu change?`,
          choices: (s) => ["Every month", `Every ${s.interval} months`, "Every six months", "Every year", "Only in summer"],
          correct: 1,
          e: (s) => `本文に「Every ${s.interval} months」と明記されている。`
        },
        {
          s: (s) => `What inspires the new dishes?`,
          choices: (s) => ["international trends", s.topic, "customer surveys", "famous chefs abroad", "children's menus"],
          correct: 1,
          e: (s) => `本文に「inspired by ${s.topic}」とある。`
        },
        {
          s: (s) => `When is it easier to get a seat without booking?`,
          choices: (s) => [s.recommend, s.free, "New Year's Day", "Saturday evenings", "all Sunday lunches"],
          correct: 1,
          e: (s) => `本文に「${s.free} usually have seats without booking」とある。`
        }
      ]
    },

    // 8. Smartphone review
    {
      slots: {
        brand: ["TechBrand", "StarPhone", "NovaTech", "BluePeak"],
        battery: ["30", "24", "36"],
        increase: ["15", "10", "20"],
        feature: ["three lenses", "a foldable screen", "waterproof body", "a stylus pen"]
      },
      passageFn: (s) =>
`The new smartphone from ${s.brand} has a strong battery that lasts up to ${s.battery} hours on a single charge, even with heavy use. It also features ${s.feature}, which is the main selling point of this year's model and a clear improvement over the previous version.
However, the price has risen by about ${s.increase}% compared with last year's version, mainly because of higher part costs. Many reviewers agree that the hardware is excellent and the design is attractive, but they question whether the higher price is really worth paying for people who only use their phone for calls, messaging, and simple apps.
For heavy users who take many photos or play demanding games, the new model might be a very good choice. However, casual users may find the previous model more than enough for their everyday needs, and the older model is now available at a lower price.`,
      qa: [
        {
          s: (s) => `How long does the battery last on a single charge?`,
          choices: (s) => ["12 hours", "20 hours", `${s.battery} hours`, "48 hours", "72 hours"],
          correct: 2,
          e: (s) => `本文に「up to ${s.battery} hours」と明記されている。`
        },
        {
          s: (s) => `By what percentage has the price risen?`,
          choices: (s) => ["5%", "8%", `${s.increase}%`, "25%", "40%"],
          correct: 2,
          e: (s) => `本文に「by about ${s.increase}%」と明記されている。`
        },
        {
          s: (s) => `What do reviewers question?`,
          choices: (s) => [
            "Whether the screen is large enough.",
            "Whether the brand will survive.",
            "Whether the battery is safe.",
            "Whether the higher price is worth it for casual users.",
            "Whether the phone works abroad."
          ],
          correct: 3,
          e: (s) => "本文に「question whether the higher price is worth paying ~」とある。"
        }
      ]
    },

    // 9. Recycling
    {
      slots: {
        before: ["Monday", "Tuesday", "Wednesday"],
        after: ["Thursday", "Friday", "Saturday"],
        warnCount: ["three", "two", "four"]
      },
      passageFn: (s) =>
`The city office announced a new recycling programme that will start this spring. Under the new rules, residents must separate plastics into two categories: food containers such as bottles and trays, and other plastics such as wrappers and bags. Clear instructions will be printed on new stickers for each bin.
The collection day for plastics will move from ${s.before} to ${s.after}, so residents will need to update their weekly routine. Any items placed in the wrong bag will receive a written warning on the spot from the collection staff. After ${s.warnCount} warnings, the resident may have to pay a small fine as a final step.
The city office explained that the new system is intended to improve recycling quality, not to punish residents for honest mistakes. Staff members will also visit neighborhoods to explain the rules during the first month, and printed guides will be delivered to each home.`,
      qa: [
        {
          s: (s) => `On which day will plastics be collected under the new programme?`,
          choices: (s) => ["Monday", "Tuesday", "Wednesday", s.after, "Sunday"],
          correct: 3,
          e: (s) => `本文に「move from ${s.before} to ${s.after}」と明記されている。`
        },
        {
          s: (s) => `How many categories will plastics be divided into?`,
          choices: (s) => ["One", "Two", "Three", "Four", "It varies by house."],
          correct: 1,
          e: (s) => "本文に「two categories」と明記されている。"
        },
        {
          s: (s) => `What happens after several warnings?`,
          choices: (s) => [
            "The resident gets a prize.",
            "A free new bin is provided.",
            `After ${s.warnCount} warnings, a small fine may be charged.`,
            "The resident is evicted.",
            "Nothing happens at all."
          ],
          correct: 2,
          e: (s) => `本文に「After ${s.warnCount} warnings, the resident may have to pay a small fine」とある。`
        }
      ]
    },

    // 10. National park
    {
      slots: {
        years: ["fifty", "forty", "sixty"],
        protectTarget: ["native birds", "rare plants", "local wildlife", "old forests"],
        weekday: ["3,000", "2,500", "4,000"],
        weekend: ["5,000", "4,500", "6,000"]
      },
      passageFn: (s) =>
`A large national park in the north was established about ${s.years} years ago in order to protect ${s.protectTarget} and preserve the natural forest area. Visitor numbers have grown so much over the past decade that the park now asks people to reserve their entry slots online before arriving.
The system limits daily entry to ${s.weekday} people on weekdays and ${s.weekend} people on weekends and national holidays. Rangers explain that this limit helps reduce noise and protect wildlife from too much human presence, especially during breeding seasons in spring.
Some visitors say the reservation system is a little inconvenient, but most agree that keeping the park quiet is much more important than pure convenience. Guided nature tours led by park rangers are also offered twice a day, which many first-time visitors say they truly enjoy, because the guides share stories about the plants and animals that are hard to notice without help.`,
      qa: [
        {
          s: (s) => `Why was the park originally established?`,
          choices: (s) => ["To promote tourism", `To protect ${s.protectTarget}`, "To train rangers", "To plant new trees", "To allow camping"],
          correct: 1,
          e: (s) => `本文に「protect ${s.protectTarget}」とある。`
        },
        {
          s: (s) => `How many visitors are allowed on weekdays?`,
          choices: (s) => ["500", "1,500", s.weekday, s.weekend, "10,000"],
          correct: 2,
          e: (s) => `本文に「${s.weekday} people on weekdays」と明記されている。`
        },
        {
          s: (s) => `What is the main purpose of the reservation system?`,
          choices: (s) => [
            "To increase park income.",
            "To reduce noise and protect wildlife.",
            "To hire more rangers.",
            "To build new hiking trails.",
            "To test a new booking app."
          ],
          correct: 1,
          e: (s) => "本文に「reduce noise and protect wildlife」と明記されている。"
        }
      ]
    },

    // 11. Bike lanes / city
    {
      slots: {
        city: ["Harbor City", "River City", "Pine City", "Oak City"],
        startKm: ["40", "30", "50"],
        nowKm: ["200", "180", "220"],
        save: ["thirty", "twenty", "forty"]
      },
      passageFn: (s) =>
`Over the past decade, ${s.city} has invested heavily in expanding its bicycle lane network. The total length of dedicated lanes has grown from just ${s.startKm} km to more than ${s.nowKm} km, with new lanes separated from car traffic by painted lines or low barriers.
Recent surveys show that commuters who switched from driving to cycling save about ${s.save} minutes per day during peak hours. They also report better physical health, a lower transport cost, and a more enjoyable start to their working day. The city has noticed fewer traffic jams in the central area as a result.
The city is now planning to add shower rooms and bicycle parking at major office buildings to make cycling even easier for commuters. Some drivers have complained about reduced road space, but overall the project is considered successful, and similar plans are being discussed in nearby towns.`,
      qa: [
        {
          s: (s) => `How long was the bicycle lane network ten years ago?`,
          choices: (s) => ["10 km", s.startKm + " km", "100 km", s.nowKm + " km", "500 km"],
          correct: 1,
          e: (s) => `本文に「grown from ${s.startKm} km」と明記されている。`
        },
        {
          s: (s) => `How much time do commuters save each day by cycling?`,
          choices: (s) => ["about 5 minutes", "about 15 minutes", `about ${s.save} minutes`, "about one hour", "about 2 hours"],
          correct: 2,
          e: (s) => `本文に「about ${s.save} minutes per day」と明記されている。`
        },
        {
          s: (s) => `The time-saving is compared to...`,
          choices: (s) => [
            "walking",
            "riding buses",
            "driving during peak hours",
            "taking the train",
            "using ride-share services"
          ],
          correct: 2,
          e: (s) => "本文に「during peak hours」と「switched from driving to cycling」と整合する。"
        }
      ]
    },

    // 12. Single-use plastics island
    {
      slots: {
        year: ["2027", "2028", "2030"],
        damage: ["coral reefs", "beach sand", "marine wildlife", "fishing areas"],
        industry: ["small retailers", "local cafes", "traditional markets", "family shops"]
      },
      passageFn: (s) =>
`A small island in the Pacific recently announced a plan to ban single-use plastics by the end of ${s.year}. The government says that marine debris has seriously damaged ${s.damage} and reduced tourism income noticeably over the past ten years. Many local fishers have also reported smaller catches.
However, some critics argue that the timeline is too short for a full transition. They worry that ${s.industry} will lose money if they cannot find cheap alternatives to plastic products quickly enough. In response, the government promises financial support, staff training, and shared purchasing of paper-based products to help small businesses make the change more smoothly.
Environmental groups welcome the decision and hope other islands in the region will follow the same path. They also point out that early action could attract eco-conscious tourists and create new green jobs for young local people.`,
      qa: [
        {
          s: (s) => `By when will the island ban single-use plastics?`,
          choices: (s) => ["2024", "2025", "2026", `${s.year}`, "2040"],
          correct: 3,
          e: (s) => `本文に「by ${s.year}」と明記されている。`
        },
        {
          s: (s) => `What reason does the government give for the ban?`,
          choices: (s) => [
            "It was ordered by the UN.",
            `Marine debris has damaged ${s.damage}.`,
            "Plastics are too expensive to import.",
            "Children asked for it.",
            "The plastic industry has collapsed."
          ],
          correct: 1,
          e: (s) => `本文に「damaged ${s.damage}」とある。`
        },
        {
          s: (s) => `What do critics worry about?`,
          choices: (s) => [
            "The ban will not help the environment.",
            "Air quality will get worse.",
            `${s.industry} may lose money if they cannot find cheap alternatives.`,
            "Tourism will grow too fast.",
            "The ban is illegal under trade law."
          ],
          correct: 2,
          e: (s) => `本文に「${s.industry} will lose money」とある。`
        }
      ]
    }
  ];

  function generateEnPassage() {
    const tmpl = pick(EN_TEMPLATES);
    const slots = resolveSlots(tmpl.slots);
    const passage = tmpl.passageFn(slots);
    // 設問の並び順もシャッフル
    const shuffledQa = shuffle(tmpl.qa);
    const questions = shuffledQa.map(q => {
      const origChoices = q.choices(slots);
      const correctIdx = typeof q.correct === "function" ? q.correct(slots) : q.correct;
      const explanation = typeof q.e === "function" ? q.e(slots) : q.e;
      // 選択肢自体もシャッフル（正解位置を毎回ランダムに）
      const correctText = origChoices[correctIdx];
      const shuffled = shuffle(origChoices);
      const newCorrectIdx = shuffled.indexOf(correctText);
      return {
        statement: q.s(slots),
        choices: shuffled,
        correct_index: newCorrectIdx,
        explanation
      };
    });
    return { passage, questions };
  }

  function buildJaSession(n) {
    const out = [];
    const usedTemplates = [];
    for (let i = 0; i < n; i++) out.push(generateJaPassage());
    return out;
  }
  function buildEnSession(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(generateEnPassage());
    return out;
  }

  window.Generators = {
    num: genNum,
    buildJaSession,
    buildEnSession,
    templateCounts: { ja: JA_TEMPLATES.length, en: EN_TEMPLATES.length }
  };
})();
