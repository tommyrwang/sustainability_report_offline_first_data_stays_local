// ══════════════════════════════════════════════════════════
// 離線範本引擎 — 無需連網即可生成符合準則格式的報告章節
// 依循 TCFD 四大支柱 + IFRS S1/S2 + SASB
// ══════════════════════════════════════════════════════════

const OfflineTemplates = {

  // ── 第一章：氣候治理 ──
  governance(d) {
    const parts = [];
    parts.push(`${d.companyName || '本公司'}董事會為公司氣候相關議題之最高治理單位，轄下設置功能性委員會執行董事會之氣候相關決策。`);

    if (d.committee) {
      parts.push(`公司設立「${d.committee}」，${d.chair ? `由${d.chair}，` : ''}作為氣候相關風險與機會發展之最高權責單位，對董事會負責，並${d.frequency || '定期向董事會報告'}。`);
    }

    if (d.mgr) {
      parts.push(`在管理階層方面，${d.companyName || '本公司'}的氣候相關議題由${d.mgr}領導，負責蒐集與分析集團整體之氣候風險與機會資訊，制定永續發展策略與氣候轉型策略，並定期向委員會報告氣候相關議題之趨勢、影響與執行績效。`);
      if (d.mgrDesc) parts.push(d.mgrDesc);
    }

    if (d.esgPay && d.esgPay.includes('是')) {
      let payText = `為落實對 ESG 相關長期經營績效之重視，${d.companyName || '本公司'}將 ESG 與氣候相關目標納入薪酬政策`;
      if (d.esgWeight) payText += `，設定 ESG 目標權重為 ±${d.esgWeight}%`;
      payText += '。';
      if (d.esgKpi) payText += `薪酬連結之具體氣候指標包括：${d.esgKpi}。`;
      parts.push(payText);
    }

    parts.push('本章節依循 TCFD 治理支柱之揭露建議、IFRS S2 第 6-7 段（治理）及 IFRS S1 第 6 段（治理）之要求編製。');
    return parts.join('\n\n');
  },

  // ── 第二章：氣候策略 ──
  strategy(d) {
    const parts = [];
    parts.push(`${d.companyName || '本公司'}參考 TCFD 揭露建議${d.sasbCode ? `及 SASB ${d.sasbCode} 行業揭露主題` : ''}，並考量自身營業特性，據以辨識相關氣候風險與機會，依「風險衝擊程度」、「風險潛在脆弱度」與「風險發生機率」三維度綜合考量後進行氣候風險分級。`);

    if (d.transitionRisks) {
      parts.push(`在轉型風險方面，本公司辨識出下列重大項目：${d.transitionRisks}`);
    }
    if (d.physicalRisks) {
      parts.push(`在實體風險方面：${d.physicalRisks}`);
    }
    if (d.opportunities) {
      parts.push(`在氣候機會方面，本公司辨識出：${d.opportunities}`);
    }

    // 時間區間
    if (d.shortTerm || d.midTerm || d.longTerm) {
      let timeText = '本公司將氣候相關風險與機會之時間區間與內部策略決策時程進行連結：';
      const terms = [];
      if (d.shortTerm) terms.push(`短期（${d.shortTerm}）`);
      if (d.midTerm) terms.push(`中期（${d.midTerm}）`);
      if (d.longTerm) terms.push(`長期（${d.longTerm}）`);
      timeText += terms.join('、') + '。';
      parts.push(timeText);
    }

    // 情境分析
    if (d.scenarioType) {
      let scenText = `氣候情境分析部分，本公司採用${d.scenarioType}`;
      if (d.scenarioDesc) scenText += `。${d.scenarioDesc}`;
      else scenText += '，導入積極減碳情境（IPCC SSP1-RCP 2.6）及高度暖化情境（SSP5-RCP 8.5）進行實體風險評估，並參酌國發會淨零路徑進行在地政策模擬，評估氣候變遷對財務之潛在影響。';
      parts.push(scenText);

      // 韌性評估與情境分析之區分
      parts.push('本公司謹將情境分析定位為假設性推演之分析工具（what if），旨在探索不同假設下之風險與機會，而非對未來之精確預測；氣候韌性評估則為對情境分析結果之解讀（so what），並依 IFRS S2 要求逐年更新。');

      if (d.scenarioType.includes('豁免')) {
        parts.push('依 IFRS S2 首次適用之過渡規定，本年度對氣候情境之量化財務影響採豁免揭露，並將於後續年度補充完整量化數據。');
      }
    }

    parts.push('本章節依循 TCFD 策略支柱之揭露建議及 IFRS S2 第 10-22 段（策略與決策有用性）之要求編製。所辨認之各項風險與機會均依「外部風險事件鑑別 → 受影響價值鏈環節 → 可能性與影響評估 → 因應策略與決策 → 對財務資訊之影響」之衝擊路徑進行分析。');
    return parts.join('\n\n');
  },

  // ── 第三章：風險管理 ──
  risk(d) {
    const parts = [];
    parts.push(`${d.companyName || '本公司'}將氣候風險鑑別與評估納入企業整體風險管理（ERM）流程，以辨識、分析、評量、回應、監督及審查之循環式流程進行氣候風險管理。`);

    if (d.riskId) {
      parts.push(`風險辨識方面：${d.riskId}`);
    }
    if (d.riskAssess) {
      parts.push(`風險評量方面：${d.riskAssess}`);
    }
    if (d.riskErm) {
      parts.push(`與企業整體風險管理之整合：${d.riskErm}`);
    } else {
      parts.push('氣候變遷相關風險已整合至本公司風險管理政策與作業程序之中，與策略、營運、財務、災害等風險構面並列管理，並透過 PDCA 循環定期檢討風險管理方案之有效性。');
    }

    // 供應鏈
    if (d.supplyChain || d.sbtRatio) {
      let supText = '在供應鏈氣候風險管理方面';
      if (d.supplyChain) supText += `，${d.supplyChain}`;
      if (d.sbtRatio) supText += `。截至報告年度，本公司已有 ${d.sbtRatio}% 之關鍵供應商承諾設定科學基礎減碳目標（SBT）或 RE100`;
      supText += '。';
      parts.push(supText);
    }

    parts.push('本章節依循 TCFD 風險管理支柱之揭露建議及 IFRS S2 第 23-25 段之要求編製，供應鏈管理部分並參考 SASB TC-HW-430a 揭露主題。');
    return parts.join('\n\n');
  },

  // ── 第四章：指標與目標 ──
  metrics(d) {
    const parts = [];
    parts.push(`${d.companyName || '本公司'}肩負品牌領導者之使命，制定符合科學基礎之減碳目標，並定期揭露溫室氣體排放數據與目標達成情形。`);

    // GHG 排放
    if (d.s1Total || d.s2Market || d.s3Total) {
      let ghgText = '在溫室氣體排放方面，本公司依循 GHG Protocol 及 ISO 14064-1 進行盤查：';
      const emissions = [];
      if (d.s1Total) emissions.push(`範疇一（直接排放）${Number(d.s1Total).toLocaleString()} 公噸 CO₂e`);
      if (d.s2Market) emissions.push(`範疇二（市場基礎）${Number(d.s2Market).toLocaleString()} 公噸 CO₂e`);
      if (d.s3Total) emissions.push(`範疇三（價值鏈）${Number(d.s3Total).toLocaleString()} 公噸 CO₂e`);
      ghgText += emissions.join('、') + '。';
      parts.push(ghgText);
    }

    // 目標
    if (d.targetType || d.baseYear) {
      let targetText = `減碳目標方面，本公司採用${d.targetType || '科學基礎減碳目標'}`;
      if (d.baseYear) targetText += `，以 ${d.baseYear} 年為基準年`;
      targetText += '。';
      const goals = [];
      if (d.s12Target) goals.push(`承諾 2030 年營運碳排放（Scope 1+2）較基準年減量 ${d.s12Target}%`);
      if (d.s3Target) goals.push(`價值鏈碳排放（Scope 3）較基準年減量 ${d.s3Target}%`);
      if (d.netZero) goals.push(`並於 ${d.netZero} 年達成淨零排放`);
      if (d.re100) goals.push(`於 ${d.re100} 年達成 100% 使用再生能源（RE100）`);
      if (goals.length) targetText += goals.join('，') + '。';
      parts.push(targetText);
    }

    // 再生能源（SASB）
    if (d.reRatio) {
      parts.push(`再生能源使用方面，截至報告年度本公司再生電力使用比率達 ${d.reRatio}%（對應 SASB TC-HW-130a 揭露指標）。`);
    }

    // 內部碳價
    if (d.carbonPrice && d.carbonPrice.includes('是') && d.carbonRange) {
      parts.push(`為因應碳有價化趨勢，本公司導入內部碳價機制，採影子價格形式，制定 ${d.carbonRange} 美元/公噸 CO₂e 之碳價，用以驅動各部門進行主動減碳投資決策。本機制符合 IFRS S2 第 33 段之強制揭露要求。`);
    }

    parts.push('本章節依循 TCFD 指標與目標支柱之揭露建議及 IFRS S2 第 26-38 段之要求編製，並參考 SASB TC-HW-130a、TC-HW-410a 揭露指標。');
    return parts.join('\n\n');
  },

  // ── 第零章：公司概況與報告範圍 ──
  overview(d) {
    const parts = [];
    parts.push(`本報告書為${d.companyName || '本公司'}${d.year || ''}年度氣候相關財務揭露報告書，依循 IFRS S1（永續相關財務資訊揭露之一般規定）及 IFRS S2（氣候相關揭露）編製，並整合 TCFD 建議書及 SASB 行業揭露主題。`);

    parts.push('揭露定位：本專章採財務重大性（投資人觀點），與採影響重大性之永續報告書（GRI＋TCFD＋SASB）分屬不同法源與法律責任，兩者定位清楚區隔。本專章依金管會認可之 ISSB 準則編製，並經董事會決議通過。');

    parts.push(`報告範圍：本報告書之報導個體與財務報表報導個體一致（S1.20），組織邊界採合併財務報告邊界，資訊蒐集範圍涵蓋子公司；集團內交易之實質已辨識，避免內部交易重複計列。`);

    if (d.sasbCode) {
      parts.push(`重大性評估：本公司依 IFRS S1 財務重大性原則（定義與 IAS 1 一致），並參考 SASB ${d.sasbCode} 行業準則識別行業特定重大議題，量化與質性因子並重。重大性判斷過程之底稿已留存，未納入揭露但屬相關之資訊亦另存底稿備查，以回應利害關係人及主管機關查核。重大性評估為持續性循環，將於每年度重新檢視。`);
    }

    // 確信
    parts.push('確信：本公司範疇一及範疇二溫室氣體排放資訊依金管會規定取得獨立第三方確信意見並揭露。');

    // 法規階段（含淨值替代門檻與精確 Scope 3 時程）
    const cap = parseFloat(d.capital) || 0;
    if (cap >= 100) {
      parts.push('適用時程：本公司屬金管會 IFRS 永續揭露準則第一階段適用對象（實收資本額 100 億元以上，或無面額／每股非 10 元者以淨值 200 億元替代），自 2026 會計年度起強制適用 IFRS S1 及 S2，年報永續資訊專章與年度財務報告同日申報。範疇三排放自首次適用 ISSB 準則後第 4 個會計年度起適用，適用前三年度得不揭露。');
    } else if (cap >= 50) {
      parts.push('適用時程：本公司屬金管會 IFRS 永續揭露準則第二階段適用對象（實收資本額 50 至 100 億元，或淨值 100 至 200 億元），自 2027 會計年度起強制適用。');
    } else if (cap > 0) {
      parts.push('適用時程：本公司屬金管會 IFRS 永續揭露準則第三階段適用對象，自 2028 會計年度起強制適用。');
    }

    return parts.join('\n\n');
  }
};

if (typeof module !== 'undefined') module.exports = OfflineTemplates;
