/* ============================================================
   Offline auth/profile/history helpers.
   No network calls, no CDN, no external service. Everything stays
   in this browser's localStorage.
============================================================ */
(function () {
  "use strict";

  const KEYS = {
    users: "webtest_offline_users_v1",
    session: "webtest_offline_session_v1",
    results: "webtest_offline_results_v1",
    surveys: "webtest_offline_surveys_v1",
    consents: "webtest_offline_consents_v1",
    pendingProfiles: "pending_user_profiles",
    schoolMaster: "webtest_school_master_v1",
    analyticsEvents: "webtest_offline_analytics_events_v1",
    testSessions: "webtest_offline_test_sessions_v1",
    activeTest: "webtest_offline_active_test_v1",
    adminPassHash: "webtest_offline_admin_pass_hash_v1",
    adminSession: "webtest_offline_admin_session_v1"
  };
  const MAX_ANALYTICS_EVENTS = 5000;
  const MAX_TEST_SESSIONS = 1000;

  const COMMON_FACULTIES = [
    "文学部",
    "人文学部",
    "法学部",
    "経済学部",
    "経営学部",
    "商学部",
    "社会学部",
    "国際関係学部",
    "教育学部",
    "理学部",
    "工学部",
    "情報学部",
    "農学部",
    "医学部",
    "薬学部",
    "看護学部",
    "総合政策学部",
    "その他"
  ];
  const LIBERAL_ARTS_FACULTIES = [
    "教養学部",
    "国際教養学部",
    "国際関係学部",
    "文学部",
    "法学部",
    "経済学部",
    "社会学部",
    "教育学部",
    "その他"
  ];
  const SCIENCE_FACULTIES = [
    "理学部",
    "工学部",
    "情報理工学院",
    "生命理工学院",
    "物質理工学院",
    "環境・社会理工学院",
    "医学部",
    "歯学部",
    "薬学部",
    "その他"
  ];
  const WOMENS_FACULTIES = [
    "文学部",
    "家政学部",
    "人間社会学部",
    "国際文化学部",
    "理学部",
    "生活科学部",
    "教育学部",
    "その他"
  ];
  const ARTS_LANGUAGE_FACULTIES = [
    "言語文化学部",
    "国際社会学部",
    "外国語学部",
    "国際教養学部",
    "国際関係学部",
    "その他"
  ];
  const EXACT_FACULTIES = {
    "東京大学": ["法学部", "医学部", "工学部", "文学部", "理学部", "農学部", "経済学部", "教養学部", "教育学部", "薬学部"],
    "京都大学": ["総合人間学部", "文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "薬学部", "工学部", "農学部"],
    "大阪大学": ["文学部", "人間科学部", "外国語学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "基礎工学部"],
    "東北大学": ["文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "農学部"],
    "名古屋大学": ["文学部", "教育学部", "法学部", "経済学部", "情報学部", "理学部", "医学部", "工学部", "農学部"],
    "北海道大学": ["文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "農学部", "獣医学部", "水産学部"],
    "九州大学": ["共創学部", "文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "芸術工学部", "農学部"],
    "一橋大学": ["商学部", "経済学部", "法学部", "社会学部", "ソーシャル・データサイエンス学部"],
    "東京科学大学": ["理学院", "工学院", "物質理工学院", "情報理工学院", "生命理工学院", "環境・社会理工学院", "医学部", "歯学部"],
    "筑波大学": ["人文・文化学群", "社会・国際学群", "人間学群", "生命環境学群", "理工学群", "情報学群", "医学群", "体育専門学群", "芸術専門学群"],
    "千葉大学": ["国際教養学部", "文学部", "法政経学部", "教育学部", "理学部", "工学部", "園芸学部", "医学部", "薬学部", "看護学部"],
    "横浜国立大学": ["教育学部", "経済学部", "経営学部", "理工学部", "都市科学部"],
    "神戸大学": ["文学部", "国際人間科学部", "法学部", "経済学部", "経営学部", "理学部", "医学部", "工学部", "農学部", "海洋政策科学部"],
    "広島大学": ["総合科学部", "文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "生物生産学部", "情報科学部"],
    "岡山大学": ["文学部", "教育学部", "法学部", "経済学部", "理学部", "医学部", "歯学部", "薬学部", "工学部", "農学部", "グローバル・ディスカバリー・プログラム"],
    "金沢大学": ["融合学域", "人間社会学域", "理工学域", "医薬保健学域"],
    "新潟大学": ["人文学部", "教育学部", "法学部", "経済科学部", "理学部", "医学部", "歯学部", "工学部", "農学部", "創生学部"],
    "東京外国語大学": ["言語文化学部", "国際社会学部", "国際日本学部"],
    "東京学芸大学": ["教育学部"],
    "お茶の水女子大学": ["文教育学部", "理学部", "生活科学部", "共創工学部"],
    "奈良女子大学": ["文学部", "理学部", "生活環境学部", "工学部"],
    "電気通信大学": ["情報理工学域"],
    "東京農工大学": ["農学部", "工学部"],
    "熊本大学": ["文学部", "教育学部", "法学部", "理学部", "医学部", "薬学部", "工学部", "情報融合学環"],
    "長崎大学": ["多文化社会学部", "教育学部", "経済学部", "医学部", "歯学部", "薬学部", "情報データ科学部", "工学部", "環境科学部", "水産学部"],
    "信州大学": ["人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部"],
    "静岡大学": ["人文社会科学部", "教育学部", "情報学部", "理学部", "工学部", "農学部", "グローバル共創科学部"],
    "岐阜大学": ["教育学部", "地域科学部", "医学部", "工学部", "応用生物科学部", "社会システム経営学環"],
    "三重大学": ["人文学部", "教育学部", "医学部", "工学部", "生物資源学部"],
    "滋賀大学": ["教育学部", "経済学部", "データサイエンス学部"],
    "京都工芸繊維大学": ["工芸科学部"],
    "和歌山大学": ["教育学部", "経済学部", "システム工学部", "観光学部", "社会インフォマティクス学環"],
    "山口大学": ["人文学部", "教育学部", "経済学部", "理学部", "医学部", "工学部", "農学部", "共同獣医学部", "国際総合科学部"],
    "徳島大学": ["総合科学部", "医学部", "歯学部", "薬学部", "理工学部", "生物資源産業学部"],
    "愛媛大学": ["法文学部", "教育学部", "社会共創学部", "理学部", "医学部", "工学部", "農学部"],
    "香川大学": ["教育学部", "法学部", "経済学部", "医学部", "創造工学部", "農学部"],
    "鹿児島大学": ["法文学部", "教育学部", "理学部", "医学部", "歯学部", "工学部", "農学部", "水産学部", "共同獣医学部"],
    "琉球大学": ["人文社会学部", "国際地域創造学部", "教育学部", "理学部", "医学部", "工学部", "農学部"],
    "大阪公立大学": ["現代システム科学域", "文学部", "法学部", "経済学部", "商学部", "理学部", "工学部", "農学部", "獣医学部", "医学部", "看護学部", "生活科学部"],
    "東京都立大学": ["人文社会学部", "法学部", "経済経営学部", "理学部", "都市環境学部", "システムデザイン学部", "健康福祉学部"],
    "横浜市立大学": ["国際教養学部", "国際商学部", "理学部", "データサイエンス学部", "医学部"],
    "名古屋市立大学": ["医学部", "薬学部", "経済学部", "人文社会学部", "芸術工学部", "看護学部", "総合生命理学部", "データサイエンス学部"],
    "京都府立大学": ["文学部", "公共政策学部", "農学食科学部", "生命理工情報学部", "環境科学部"],
    "兵庫県立大学": ["国際商経学部", "社会情報科学部", "工学部", "理学部", "環境人間学部", "看護学部"],
    "国際教養大学": ["国際教養学部"],
    "会津大学": ["コンピュータ理工学部"],
    "早稲田大学": ["政治経済学部", "法学部", "教育学部", "商学部", "社会科学部", "国際教養学部", "文化構想学部", "文学部", "基幹理工学部", "創造理工学部", "先進理工学部", "人間科学部", "スポーツ科学部"],
    "慶應義塾大学": ["文学部", "経済学部", "法学部", "商学部", "医学部", "理工学部", "総合政策学部", "環境情報学部", "看護医療学部", "薬学部"],
    "上智大学": ["神学部", "文学部", "総合人間科学部", "法学部", "経済学部", "外国語学部", "総合グローバル学部", "国際教養学部", "理工学部"],
    "東京理科大学": ["理学部第一部", "工学部", "薬学部", "創域理工学部", "先進工学部", "経営学部"],
    "国際基督教大学(ICU)": ["教養学部"],
    "明治大学": ["法学部", "商学部", "政治経済学部", "文学部", "理工学部", "農学部", "経営学部", "情報コミュニケーション学部", "国際日本学部", "総合数理学部"],
    "青山学院大学": ["文学部", "教育人間科学部", "経済学部", "法学部", "経営学部", "国際政治経済学部", "総合文化政策学部", "理工学部", "社会情報学部", "地球社会共生学部", "コミュニティ人間科学部"],
    "立教大学": ["文学部", "異文化コミュニケーション学部", "経済学部", "経営学部", "理学部", "社会学部", "法学部", "観光学部", "コミュニティ福祉学部", "現代心理学部", "スポーツウエルネス学部", "Global Liberal Arts Program"],
    "中央大学": ["法学部", "経済学部", "商学部", "理工学部", "文学部", "総合政策学部", "国際経営学部", "国際情報学部"],
    "法政大学": ["法学部", "文学部", "経営学部", "国際文化学部", "人間環境学部", "キャリアデザイン学部", "デザイン工学部", "グローバル教養学部", "経済学部", "社会学部", "現代福祉学部", "スポーツ健康学部", "情報科学部", "理工学部", "生命科学部"],
    "学習院大学": ["法学部", "経済学部", "文学部", "理学部", "国際社会科学部"],
    "成蹊大学": ["経済学部", "経営学部", "法学部", "文学部", "理工学部"],
    "成城大学": ["経済学部", "文芸学部", "法学部", "社会イノベーション学部"],
    "明治学院大学": ["文学部", "経済学部", "社会学部", "法学部", "国際学部", "心理学部", "情報数理学部"],
    "武蔵大学": ["経済学部", "人文学部", "社会学部", "国際教養学部"],
    "國學院大學": ["文学部", "神道文化学部", "法学部", "経済学部", "人間開発学部", "観光まちづくり学部"],
    "芝浦工業大学": ["工学部", "システム理工学部", "デザイン工学部", "建築学部"],
    "東京都市大学": ["理工学部", "建築都市デザイン学部", "情報工学部", "環境学部", "メディア情報学部", "都市生活学部", "人間科学部", "デザイン・データ科学部"],
    "東京電機大学": ["システムデザイン工学部", "未来科学部", "工学部", "理工学部"],
    "日本大学": ["法学部", "文理学部", "経済学部", "商学部", "芸術学部", "国際関係学部", "危機管理学部", "スポーツ科学部", "理工学部", "生産工学部", "工学部", "医学部", "歯学部", "松戸歯学部", "生物資源科学部", "薬学部"],
    "東洋大学": ["文学部", "経済学部", "経営学部", "法学部", "社会学部", "国際学部", "国際観光学部", "情報連携学部", "福祉社会デザイン学部", "健康スポーツ科学部", "理工学部", "総合情報学部", "生命科学部", "食環境科学部"],
    "駒澤大学": ["仏教学部", "文学部", "経済学部", "法学部", "経営学部", "医療健康科学部", "グローバル・メディア・スタディーズ学部"],
    "専修大学": ["経済学部", "法学部", "経営学部", "商学部", "文学部", "人間科学部", "国際コミュニケーション学部", "ネットワーク情報学部"],
    "津田塾大学": ["学芸学部", "総合政策学部"],
    "東京女子大学": ["現代教養学部"],
    "日本女子大学": ["家政学部", "文学部", "人間社会学部", "理学部", "国際文化学部", "建築デザイン学部", "食科学部"],
    "獨協大学": ["外国語学部", "国際教養学部", "経済学部", "法学部"],
    "神奈川大学": ["法学部", "経済学部", "経営学部", "外国語学部", "国際日本学部", "人間科学部", "理学部", "工学部", "建築学部", "化学生命学部", "情報学部"],
    "東海大学": ["文学部", "文化社会学部", "政治経済学部", "法学部", "教養学部", "体育学部", "健康学部", "理学部", "情報理工学部", "建築都市学部", "工学部", "医学部", "海洋学部", "人文学部", "農学部", "国際学部", "児童教育学部", "経営学部", "観光学部"],
    "亜細亜大学": ["経営学部", "経済学部", "法学部", "国際関係学部", "都市創造学部"],
    "帝京大学": ["医学部", "薬学部", "経済学部", "法学部", "文学部", "外国語学部", "教育学部", "理工学部", "医療技術学部", "福岡医療技術学部"],
    "同志社大学": ["神学部", "文学部", "社会学部", "法学部", "経済学部", "商学部", "政策学部", "文化情報学部", "理工学部", "生命医科学部", "スポーツ健康科学部", "心理学部", "グローバル・コミュニケーション学部", "グローバル地域文化学部"],
    "関西学院大学": ["神学部", "文学部", "社会学部", "法学部", "経済学部", "商学部", "人間福祉学部", "国際学部", "教育学部", "総合政策学部", "理学部", "工学部", "生命環境学部", "建築学部"],
    "立命館大学": ["法学部", "経済学部", "経営学部", "産業社会学部", "国際関係学部", "政策科学部", "文学部", "映像学部", "総合心理学部", "食マネジメント学部", "理工学部", "情報理工学部", "生命科学部", "薬学部", "スポーツ健康科学部", "グローバル教養学部"],
    "関西大学": ["法学部", "文学部", "経済学部", "商学部", "社会学部", "政策創造学部", "外国語学部", "人間健康学部", "総合情報学部", "社会安全学部", "システム理工学部", "環境都市工学部", "化学生命工学部", "ビジネスデータサイエンス学部"],
    "近畿大学": ["法学部", "経済学部", "経営学部", "文芸学部", "総合社会学部", "国際学部", "情報学部", "理工学部", "建築学部", "薬学部", "農学部", "医学部", "生物理工学部", "工学部", "産業理工学部"],
    "甲南大学": ["文学部", "理工学部", "経済学部", "法学部", "経営学部", "知能情報学部", "マネジメント創造学部", "フロンティアサイエンス学部", "グローバル教養学環"],
    "京都産業大学": ["経済学部", "経営学部", "法学部", "現代社会学部", "国際関係学部", "外国語学部", "文化学部", "理学部", "情報理工学部", "生命科学部"],
    "龍谷大学": ["文学部", "経済学部", "経営学部", "法学部", "政策学部", "国際学部", "先端理工学部", "社会学部", "農学部", "心理学部"],
    "関西外国語大学": ["英語キャリア学部", "外国語学部", "英語国際学部", "国際共生学部"],
    "京都女子大学": ["文学部", "発達教育学部", "家政学部", "現代社会学部", "法学部", "データサイエンス学部"],
    "同志社女子大学": ["学芸学部", "現代社会学部", "薬学部", "看護学部", "表象文化学部", "生活科学部"],
    "神戸女学院大学": ["文学部", "音楽学部", "人間科学部", "国際学部"],
    "南山大学": ["人文学部", "外国語学部", "経済学部", "経営学部", "法学部", "総合政策学部", "理工学部", "国際教養学部"],
    "名城大学": ["法学部", "経営学部", "経済学部", "外国語学部", "人間学部", "都市情報学部", "情報工学部", "理工学部", "農学部", "薬学部"],
    "中京大学": ["国際学部", "文学部", "心理学部", "法学部", "経済学部", "経営学部", "総合政策学部", "現代社会学部", "工学部", "スポーツ科学部"],
    "愛知大学": ["法学部", "経済学部", "経営学部", "現代中国学部", "国際コミュニケーション学部", "文学部", "地域政策学部"],
    "愛知淑徳大学": ["文学部", "人間情報学部", "心理学部", "創造表現学部", "健康医療科学部", "福祉貢献学部", "交流文化学部", "ビジネス学部", "グローバル・コミュニケーション学部", "食健康科学部"],
    "福岡大学": ["人文学部", "法学部", "経済学部", "商学部", "商学部第二部", "理学部", "工学部", "医学部", "薬学部", "スポーツ科学部"],
    "西南学院大学": ["神学部", "外国語学部", "商学部", "経済学部", "法学部", "人間科学部", "国際文化学部"],
    "東北学院大学": ["文学部", "経済学部", "経営学部", "法学部", "工学部", "教養学部", "地域総合学部", "情報学部", "人間科学部", "国際学部"],
    "北海学園大学": ["経済学部", "経営学部", "法学部", "人文学部", "工学部"],
    "立命館アジア太平洋大学(APU)": ["アジア太平洋学部", "国際経営学部", "サステイナビリティ観光学部"]
  };
  const SCHOOL_GROUPS = [
    {
      group: "国立大学",
      faculties: COMMON_FACULTIES,
      universities: [
        "東京大学", "京都大学", "大阪大学", "東北大学", "名古屋大学", "北海道大学", "九州大学",
        "一橋大学", "筑波大学", "千葉大学", "横浜国立大学", "神戸大学", "広島大学", "岡山大学",
        "金沢大学", "新潟大学", "熊本大学", "長崎大学", "信州大学", "静岡大学", "岐阜大学",
        "三重大学", "滋賀大学", "和歌山大学", "山口大学", "徳島大学", "愛媛大学", "香川大学",
        "鹿児島大学", "琉球大学"
      ],
      overrides: {
        "東京科学大学": SCIENCE_FACULTIES,
        "東京外国語大学": ARTS_LANGUAGE_FACULTIES,
        "東京学芸大学": ["教育学部", "その他"],
        "お茶の水女子大学": WOMENS_FACULTIES,
        "奈良女子大学": WOMENS_FACULTIES,
        "電気通信大学": ["情報理工学域", "その他"],
        "東京農工大学": ["農学部", "工学部", "その他"],
        "京都工芸繊維大学": ["工芸科学部", "その他"]
      }
    },
    {
      group: "公立大学",
      faculties: COMMON_FACULTIES,
      universities: ["大阪公立大学", "東京都立大学", "横浜市立大学", "名古屋市立大学", "京都府立大学", "兵庫県立大学"],
      overrides: {
        "国際教養大学": LIBERAL_ARTS_FACULTIES,
        "会津大学": ["コンピュータ理工学部", "その他"]
      }
    },
    {
      group: "私立大学（関東）",
      faculties: COMMON_FACULTIES,
      universities: [
        "早稲田大学", "慶應義塾大学", "上智大学", "東京理科大学", "明治大学", "青山学院大学",
        "立教大学", "中央大学", "法政大学", "学習院大学", "成蹊大学", "成城大学", "明治学院大学",
        "武蔵大学", "國學院大學", "芝浦工業大学", "東京都市大学", "東京電機大学", "日本大学",
        "東洋大学", "駒澤大学", "専修大学", "獨協大学", "神奈川大学", "東海大学", "亜細亜大学", "帝京大学"
      ],
      overrides: {
        "国際基督教大学(ICU)": LIBERAL_ARTS_FACULTIES,
        "津田塾大学": WOMENS_FACULTIES,
        "東京女子大学": WOMENS_FACULTIES,
        "日本女子大学": WOMENS_FACULTIES
      }
    },
    {
      group: "私立大学（関西）",
      faculties: COMMON_FACULTIES,
      universities: [
        "同志社大学", "関西学院大学", "立命館大学", "関西大学", "近畿大学", "甲南大学",
        "京都産業大学", "龍谷大学", "京都女子大学", "同志社女子大学", "神戸女学院大学"
      ],
      overrides: {
        "関西外国語大学": ARTS_LANGUAGE_FACULTIES
      }
    },
    {
      group: "私立大学（その他）",
      faculties: COMMON_FACULTIES,
      universities: [
        "南山大学", "名城大学", "中京大学", "愛知大学", "愛知淑徳大学", "福岡大学",
        "西南学院大学", "東北学院大学", "北海学園大学"
      ],
      overrides: {
        "立命館アジア太平洋大学(APU)": LIBERAL_ARTS_FACULTIES
      }
    }
  ];

  const nowIso = () => new Date().toISOString();
  const uuid = () =>
    crypto?.randomUUID?.() ||
    `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  function getUsers() {
    return readJson(KEYS.users, []);
  }

  function saveUsers(users) {
    writeJson(KEYS.users, users);
  }

  function getSession() {
    return readJson(KEYS.session, null);
  }

  function setSession(session) {
    writeJson(KEYS.session, session);
  }

  function currentUserSync() {
    const session = getSession();
    if (!session?.userId) return null;
    const user = getUsers().find(u => u.id === session.userId);
    return publicUser(user);
  }

  async function currentUser() {
    return currentUserSync();
  }

  function getAnalyticsEvents() {
    return readJson(KEYS.analyticsEvents, []);
  }

  function getTestSessions() {
    return readJson(KEYS.testSessions, []);
  }

  function saveTestSessions(rows) {
    writeJson(KEYS.testSessions, rows.slice(-MAX_TEST_SESSIONS));
  }

  function appendAnalyticsEvent(eventType, payload = {}) {
    const user = currentUserSync();
    const safePayload = payload && typeof payload === "object" ? payload : { value: payload };
    const event = {
      id: uuid(),
      event_type: String(eventType || "event"),
      created_at: nowIso(),
      user_id: safePayload.user_id ?? user?.id ?? null,
      user_email: safePayload.user_email ?? user?.email ?? null,
      session_id: safePayload.session_id || null,
      ui_mode: safePayload.ui_mode || null,
      mode: safePayload.mode || null,
      question_number: safePayload.question_number ?? safePayload.current_question_number ?? null,
      payload: safePayload
    };
    const rows = getAnalyticsEvents();
    rows.push(event);
    writeJson(KEYS.analyticsEvents, rows.slice(-MAX_ANALYTICS_EVENTS));
    return event;
  }

  function upsertTestSession(sessionPatch) {
    if (!sessionPatch?.session_id) return null;
    const rows = getTestSessions();
    const idx = rows.findIndex(row => row.session_id === sessionPatch.session_id);
    const user = currentUserSync();
    const next = {
      id: idx >= 0 ? rows[idx].id : uuid(),
      user_id: sessionPatch.user_id ?? (idx >= 0 ? rows[idx].user_id : user?.id ?? null),
      user_email: sessionPatch.user_email ?? (idx >= 0 ? rows[idx].user_email : user?.email ?? null),
      started_at: sessionPatch.started_at || (idx >= 0 ? rows[idx].started_at : nowIso()),
      updated_at: nowIso(),
      ...((idx >= 0 && rows[idx]) || {}),
      ...sessionPatch
    };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    saveTestSessions(rows);
    return next;
  }

  function clearActiveTest() {
    localStorage.removeItem(KEYS.activeTest);
  }

  function closeActiveTest(reason = "unknown", extra = {}) {
    const active = readJson(KEYS.activeTest, null);
    if (!active?.session_id || active.status !== "active") return null;
    const closed = upsertTestSession({
      ...active,
      ...extra,
      status: "abandoned",
      abandon_reason: reason,
      abandoned_at: nowIso(),
      updated_at: nowIso()
    });
    clearActiveTest();
    appendAnalyticsEvent("test_abandon", {
      ...closed,
      reason
    });
    return closed;
  }

  function buildSchoolMaster() {
    const customGroups = readJson(KEYS.schoolMaster, []);
    const groups = SCHOOL_GROUPS.map(group => {
      const universityNames = Array.from(new Set(group.universities.concat(Object.keys(group.overrides || {}))))
        .sort((a, b) => a.localeCompare(b, "ja"));
      const overrides = {};
      universityNames.forEach(name => {
        overrides[name] = EXACT_FACULTIES[name] || group.overrides?.[name] || group.faculties;
      });
      return {
        group: group.group,
        universities: universityNames,
        faculties: group.faculties.slice(),
        overrides
      };
    });
    return Array.isArray(customGroups) && customGroups.length ? customGroups : groups;
  }

  window.AuthApp = {
    config: { offline: true },
    ready: Promise.resolve(),
    client: { offline: true },

    async register(profile) {
      const email = String(profile.email || "").trim().toLowerCase();
      const password = String(profile.password || "");
      if (!email) throw new Error("メールアドレスを入力してください");
      if (password.length < 8) throw new Error("パスワードは8文字以上にしてください");
      const users = getUsers();
      if (users.some(u => u.email === email)) {
        throw new Error("このメールアドレスは既に登録されています");
      }
      const user = {
        id: uuid(),
        email,
        passwordHash: await sha256(password),
        nickname: String(profile.nickname || "").trim(),
        university: String(profile.university || "").trim(),
        graduation_year: String(profile.graduation_year || "").trim(),
        first_choice_industry: profile.first_choice_industry || null,
        is_admin: false,
        created_at: nowIso(),
        last_sign_in_at: nowIso()
      };
      users.push(user);
      saveUsers(users);
      writeJson(KEYS.consents, readJson(KEYS.consents, []).concat({
        id: uuid(),
        user_id: user.id,
        consent_type: "terms_privacy",
        agreed: !!profile.consent_terms,
        agreed_at: nowIso(),
        user_agent: navigator.userAgent.slice(0, 300)
      }));
      setSession({ userId: user.id, signedInAt: nowIso() });
      appendAnalyticsEvent("sign_up", {
        user_id: user.id,
        user_email: user.email,
        university: user.university,
        graduation_year: user.graduation_year,
        first_choice_industry: user.first_choice_industry
      });
      return publicUser(user);
    },

    async signIn(email, password) {
      const normalized = String(email || "").trim().toLowerCase();
      const passwordHash = await sha256(String(password || ""));
      const users = getUsers();
      const idx = users.findIndex(u => u.email === normalized && u.passwordHash === passwordHash);
      if (idx < 0) throw new Error("メールアドレスまたはパスワードが違います");
      users[idx].last_sign_in_at = nowIso();
      saveUsers(users);
      setSession({ userId: users[idx].id, signedInAt: nowIso() });
      appendAnalyticsEvent("login", {
        user_id: users[idx].id,
        user_email: users[idx].email
      });
      return publicUser(users[idx]);
    },

    async getUser() {
      return currentUser();
    },

    async getProfile() {
      return currentUser();
    },

    async getSchoolMaster() {
      // Future DB endpoint:
      // const res = await fetch("/api/school-master");
      // return await res.json();
      return buildSchoolMaster();
    },

    async signOut() {
      appendAnalyticsEvent("logout", {});
      localStorage.removeItem(KEYS.session);
    },

    saveAttempt(attempt) {
      const rows = readJson(KEYS.results, []);
      const entry = { id: uuid(), saved_at: nowIso(), ...attempt };
      rows.push(entry);
      writeJson(KEYS.results, rows);
      appendAnalyticsEvent("attempt_saved", {
        session_id: attempt?.session_id || null,
        ui_mode: attempt?.ui_mode || null,
        section_count: attempt?.sections?.length || 0,
        answer_count: attempt?.answers?.length || 0
      });
      return entry;
    },

    saveSurvey(survey) {
      const rows = readJson(KEYS.surveys, []);
      const entry = { id: uuid(), submitted_at: nowIso(), ...survey };
      rows.push(entry);
      writeJson(KEYS.surveys, rows);
      appendAnalyticsEvent("survey_submit", {
        survey_id: entry.id,
        session_id: survey?.session_id || null
      });
      return entry;
    },

    async saveProfileAndResults(data) {
      const rows = readJson(KEYS.pendingProfiles, []);
      const entry = {
        id: uuid(),
        saved_at: nowIso(),
        sync_status: "pending",
        ...data
      };
      rows.push(entry);
      writeJson(KEYS.pendingProfiles, rows);
      appendAnalyticsEvent("profile_submit", {
        session_id: data?.test_result?.session_id || null,
        ui_mode: data?.test_result?.ui_mode || null,
        profile_email: data?.profile?.email || null,
        university: data?.profile?.university || null,
        department: data?.profile?.department || null,
        graduation_year: data?.profile?.graduation_year || null,
        score: data?.test_result?.score ?? null,
        total_questions: data?.test_result?.total_questions ?? null,
        accuracy_percent: data?.test_result?.accuracy_percent ?? null
      });

      // Future online submit:
      // await fetch("/api/submit", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(entry)
      // });

      return entry;
    },

    trackEvent(eventType, payload = {}) {
      return appendAnalyticsEvent(eventType, payload);
    },

    startTestAnalytics(payload = {}) {
      const active = readJson(KEYS.activeTest, null);
      if (active?.session_id && active.status === "active" && active.session_id !== payload.session_id) {
        closeActiveTest("new_test_started", { next_session_id: payload.session_id || null });
      }
      const user = currentUserSync();
      const startedAt = nowIso();
      const session = upsertTestSession({
        status: "active",
        session_id: payload.session_id,
        user_id: user?.id || null,
        user_email: user?.email || null,
        ui_mode: payload.ui_mode || null,
        ui_label: payload.ui_label || null,
        chain: payload.chain || [],
        total_questions: payload.total_questions || 0,
        current_question_number: payload.current_question_number || 1,
        answered_count: payload.answered_count || 0,
        completion_percent: payload.completion_percent || 0,
        started_at: startedAt,
        updated_at: startedAt,
        user_agent: navigator.userAgent.slice(0, 300)
      });
      writeJson(KEYS.activeTest, session);
      appendAnalyticsEvent("test_start", session);
      return session;
    },

    updateTestProgress(payload = {}) {
      const active = readJson(KEYS.activeTest, null);
      if (!payload.session_id && !active?.session_id) return null;
      const sessionId = payload.session_id || active.session_id;
      const merged = upsertTestSession({
        ...(active || {}),
        ...payload,
        session_id: sessionId,
        status: payload.status || active?.status || "active",
        updated_at: nowIso()
      });
      if (merged?.status === "active") writeJson(KEYS.activeTest, merged);
      appendAnalyticsEvent(payload.event_type || "test_progress", {
        ...payload,
        session_id: sessionId
      });
      return merged;
    },

    completeTestAnalytics(payload = {}) {
      const active = readJson(KEYS.activeTest, null);
      const sessionId = payload.session_id || active?.session_id;
      if (!sessionId) return null;
      const completed = upsertTestSession({
        ...(active || {}),
        ...payload,
        session_id: sessionId,
        status: "completed",
        completed_at: payload.completed_at || nowIso(),
        updated_at: nowIso()
      });
      clearActiveTest();
      appendAnalyticsEvent("test_complete", completed);
      return completed;
    },

    abandonTestAnalytics(payload = {}) {
      return closeActiveTest(payload.reason || "unknown", payload);
    },

    getAdminState() {
      return {
        has_passcode: !!localStorage.getItem(KEYS.adminPassHash),
        unlocked: !!readJson(KEYS.adminSession, null)?.unlocked
      };
    },

    async setAdminPasscode(passcode) {
      const value = String(passcode || "");
      if (value.length < 8) throw new Error("管理者キーは8文字以上にしてください");
      const hash = await sha256(value);
      localStorage.setItem(KEYS.adminPassHash, hash);
      writeJson(KEYS.adminSession, { unlocked: true, unlocked_at: nowIso() });
      appendAnalyticsEvent("admin_passcode_set", {});
      return true;
    },

    async unlockAdmin(passcode) {
      const expected = localStorage.getItem(KEYS.adminPassHash);
      if (!expected) throw new Error("管理者キーが未設定です");
      const actual = await sha256(String(passcode || ""));
      if (actual !== expected) throw new Error("管理者キーが違います");
      writeJson(KEYS.adminSession, { unlocked: true, unlocked_at: nowIso() });
      appendAnalyticsEvent("admin_unlock", {});
      return true;
    },

    lockAdmin() {
      localStorage.removeItem(KEYS.adminSession);
      appendAnalyticsEvent("admin_lock", {});
    },

    exportLocalData() {
      return {
        users: getUsers().map(publicUser),
        session: getSession(),
        results: readJson(KEYS.results, []),
        surveys: readJson(KEYS.surveys, []),
        consents: readJson(KEYS.consents, []),
        pending_user_profiles: readJson(KEYS.pendingProfiles, []),
        school_master: buildSchoolMaster(),
        analytics_events: getAnalyticsEvents(),
        test_sessions: getTestSessions(),
        active_test: readJson(KEYS.activeTest, null)
      };
    },

    clearLocalData() {
      Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    :root {
      --bg: #f5f5f7; --panel: #ffffff; --text: #1d1d1f; --muted: #6e6e73;
      --border: #d2d2d7; --accent: #0071e3; --accent-hover: #0077ed;
      --correct: #34c759; --wrong: #ff3b30; --warning: #ff9500;
      --shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", "Yu Gothic", sans-serif;
      background: var(--bg); color: var(--text); line-height: 1.6;
      -webkit-text-size-adjust: 100%;
    }
    .container { max-width: 520px; margin: 0 auto; padding: 28px 16px 48px; }
    .wide { max-width: 1100px; }
    h1 { font-size: 22px; margin: 0 0 14px; }
    h2 { font-size: 17px; margin: 0 0 12px; }
    .panel { background: var(--panel); border-radius: 12px; padding: 20px; box-shadow: var(--shadow); margin-bottom: 16px; }
    label { display: block; font-size: 13px; margin-bottom: 6px; color: var(--muted); }
    input[type="text"], input[type="email"], input[type="password"], select, textarea {
      width: 100%; padding: 12px 14px; border: 1px solid var(--border);
      border-radius: 8px; font-size: 16px; background: #fff; font-family: inherit;
      -webkit-appearance: none; appearance: none;
    }
    select { padding-right: 36px; }
    .field { margin-bottom: 14px; }
    button, .btn {
      background: var(--accent); color: white; border: none;
      padding: 12px 22px; border-radius: 8px; font-size: 15px;
      cursor: pointer; font-family: inherit; transition: background 0.15s;
      min-height: 44px;
    }
    button:hover:not(:disabled) { background: var(--accent-hover); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button.secondary { background: transparent; color: var(--accent); border: 1px solid var(--border); }
    button.danger { background: var(--wrong); }
    .link { color: var(--accent); text-decoration: underline; cursor: pointer; }
    .muted { color: var(--muted); font-size: 13px; }
    .error { background: #fff2f2; color: var(--wrong); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .notice { background: #e8f2ff; color: var(--accent); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .ok { background: #e8f9ee; color: var(--correct); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .consent-row { display: flex; gap: 10px; align-items: flex-start; padding: 12px 0; font-size: 14px; }
    .consent-row input[type="checkbox"] { margin-top: 4px; flex-shrink: 0; width: 20px; height: 20px; }
    .consent-row label { font-size: 14px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    th { background: #f5f5f7; font-weight: 600; position: sticky; top: 0; }
    .table-wrap { overflow-x: auto; max-height: 70vh; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; }
    .hint { font-size: 12px; color: var(--muted); margin-top: 4px; }
    @media (max-width: 640px) {
      .container { padding: 18px 12px 48px; }
      h1 { font-size: 20px; }
      h2 { font-size: 16px; }
      .panel { padding: 16px; border-radius: 10px; }
      .row { gap: 10px; }
      .row > * { width: 100%; }
      .row > button, .row > .btn { width: 100%; }
      .row > a.link { text-align: center; width: 100%; }
      button, .btn { width: 100%; font-size: 15px; }
      button.inline { width: auto; }
      .consent-row { font-size: 14px; }
      .hint { font-size: 12px; }
    }
    @media (min-width: 641px) {
      .row > a.link { width: auto; }
    }
  `;
  document.head.appendChild(style);
})();
