// ══════════════════════════════════════════════════════════
// 主應用邏輯 — 離線優先架構
// 資料流：表單 → IndexedDB（本地）→ 範本引擎（離線）或 AI（連網）→ Word 匯出（前端）
// ══════════════════════════════════════════════════════════

const App = {
  state: { company: {}, scope: {}, governance: {}, strategy: {}, risk: {}, metrics: {}, saved: [] },
  sections: {},
  currentReportId: 'default',
  apiKey: '',
  online: navigator.onLine,
  lang: 'zh',

  async init() {
    await Storage.init();
    this.apiKey = localStorage.getItem('esg_api_key') || '';
    this.lang = localStorage.getItem('esg_lang') || 'zh';
    const savedApi = document.getElementById('api-key-input');
    if (savedApi) savedApi.value = this.apiKey;

    // 載入上次的報告
    const saved = await Storage.loadReport(this.currentReportId);
    if (saved) { this.state = saved; this.restoreForm(); }
    this.sections = await Storage.loadSections(this.currentReportId);

    // 監聽連線狀態
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
    this.setOnline(navigator.onLine);

    // 自動儲存（每次輸入）
    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => this.autoSave());
    });

    this.updateProgress();
    this.applyLang();
    this.showPage('company');
  },

  t(key) {
    return (I18N[this.lang] && I18N[this.lang][key]) || (I18N.zh[key]) || key;
  },

  toggleLang() {
    this.lang = this.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('esg_lang', this.lang);
    this.applyLang();
    this.setOnline(this.online);
  },

  applyLang() {
    // 套用所有帶 data-i18n 的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    // 語言切換鈕
    const tog = document.getElementById('lang-toggle');
    if (tog) tog.textContent = this.t('lang_toggle');
    // html lang 屬性
    document.documentElement.lang = this.lang === 'zh' ? 'zh-Hant' : 'en';
    // 若在引用來源頁，重新渲染
    if (document.getElementById('page-references')?.style.display !== 'none') this.renderReferences();
  },

  setOnline(status) {
    this.online = status;
    const badge = document.getElementById('online-status');
    if (badge) {
      badge.textContent = status ? this.t('online') : this.t('offline');
      badge.style.color = status ? '#1D9E75' : '#BA7517';
    }
    document.querySelectorAll('.gen-btn-label').forEach(el => {
      el.textContent = status ? this.t('btn_generate_ai') : this.t('btn_generate_offline');
    });
  },

  renderReferences() {
    const L = this.lang;
    const el = document.getElementById('references-content');
    if (!el) return;
    const w = References.workshop[L];
    const stdRows = References.standards.map(s =>
      `<div class="ref-row"><div class="ref-name">${s[L]}</div><div class="ref-org">${s.org}</div></div>`).join('');
    const regRows = References.regulations.map(r =>
      `<div class="ref-row"><div class="ref-name">${r[L]}</div><div class="ref-org">${r.org}</div></div>`).join('');
    el.innerHTML = `
      <div class="info-banner"><span class="ti">ⓘ</span><span>${this.t('ref_intro')}</span></div>
      <div class="card"><div class="card-title">${this.t('ref_standards')}</div>${stdRows}</div>
      <div class="card"><div class="card-title">${this.t('ref_regulations')}</div>${regRows}</div>
      <div class="card"><div class="card-title">${this.t('ref_workshop')}</div>
        <div class="ref-workshop">
          <div class="ref-ws-title">${w.title}</div>
          <div class="ref-ws-meta">${w.host}　·　${w.date}</div>
          <div class="ref-ws-note">${w.note}</div>
          <a class="ref-ws-link" href="${w.url}" target="_blank" rel="noopener">${w.url}</a>
        </div>
      </div>
      <div class="checklist" style="border-left-color:var(--muted)"><div class="checklist-intro" style="margin-bottom:0">${this.t('ref_disclaimer')}</div></div>`;
  },

  showPage(id) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    if (page) { page.style.display = 'flex'; page.style.flexDirection = 'column'; }
    const nav = document.getElementById('nav-' + id);
    if (nav) nav.classList.add('active');
    if (id === 'compliance') this.runCompliance();
    if (id === 'export') this.updateExport();
    if (id === 'reports') this.renderReportList();
    if (id === 'references') this.renderReferences();
    if (id === 'strategy') {
      this.renderImpactPathway();
      this.renderFinancialLinkage();
      this.renderScenarioPitfalls();
    }
  },

  collectForm() {
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    this.state.company = { name: g('co-name'), id: g('co-id'), capital: g('co-capital'),
      listed: g('co-listed'), year: g('co-year'), industry: g('co-industry') };
    this.state.scope = {
      s1: (+g('s1-fixed') || 0) + (+g('s1-mobile') || 0) + (+g('s1-process') || 0) + (+g('s1-fugitive') || 0),
      s2: g('s2-market'), re: g('s2-re'),
      s3: (+g('s3-1') || 0) + (+g('s3-4') || 0) + (+g('s3-11') || 0) + (+g('s3-other') || 0)
    };
    this.state.governance = { committee: g('gov-committee'), chair: g('gov-chair'),
      frequency: g('gov-freq'), desc: g('gov-desc'), mgr: g('gov-mgr'), mgrDesc: g('gov-mgr-desc'),
      esgPay: g('gov-pay'), esgWeight: g('gov-pay-pct'), payKpi: g('gov-pay-kpi') };
    this.state.strategy = { transitionRisks: g('str-transition'), physicalRisks: g('str-physical'),
      opportunities: g('str-opp'), shortTerm: g('str-short'), midTerm: g('str-mid'),
      longTerm: g('str-long'), scenarioType: g('str-scenario'), scenarioDesc: g('str-scenario-desc') };
    this.state.risk = { idMethod: g('risk-id'), assessMethod: g('risk-assess'),
      ermDesc: g('risk-erm'), supplyDesc: g('risk-supply'), sbt: g('risk-sbt') };
    this.state.metrics = { targetType: g('mt-type'), baseYear: g('mt-base'),
      scope12Target: g('mt-s12'), scope3Target: g('mt-s3'), netZeroYear: g('mt-nz'),
      re100Year: g('mt-re100'), carbonPrice: g('mt-carbon-price'), carbonRange: g('mt-carbon-range'),
      productEnergy: g('mt-product-energy'), pcr: g('mt-pcr') };
    // 章節檢核表項目（勾選）
    const chk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
    this.state.checklist = {
      materialityDoc: chk('chk-materiality'), undisclosedDoc: chk('chk-undisclosed'),
      boundaryConsistent: chk('chk-boundary'), intraGroup: chk('chk-intragroup'),
      assurance: chk('chk-assurance'), financeInvolved: chk('chk-finance'),
      timeDefine: chk('chk-timedefine'), resilience: chk('chk-resilience'),
      ermIntegrate: chk('chk-ermintegrate'), riskMap: chk('chk-riskmap'), supplyChainChk: chk('chk-supplychain'),
      crossIndustry: chk('chk-crossindustry'), targetBase: chk('chk-targetbase'), payroll: chk('chk-payroll'),
      internalControl: chk('chk-internalctrl'), greenwashCheck: chk('chk-greenwash'),
      boardApproval: chk('chk-board'),
      scenarioTool: g('scenario-tool')
    };
    // 共用欄位
    this.state.companyName = this.state.company.name;
    this.state.year = this.state.company.year;
    this.state.capital = this.state.company.capital;
    this.state.sasbCode = this.state.company.industry;
    this.state.reRatio = this.state.scope.re;
    Object.assign(this.state, this.state.governance, this.state.strategy, this.state.risk, this.state.metrics);
    this.state.scope1 = this.state.scope.s1;
    this.state.scope2 = this.state.scope.s2;
    this.state.scope3 = this.state.scope.s3;
  },

  restoreForm() {
    const s = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    const c = this.state.company || {};
    s('co-name', c.name); s('co-id', c.id); s('co-capital', c.capital);
    s('co-listed', c.listed); s('co-year', c.year); s('co-industry', c.industry);
    const g = this.state.governance || {};
    s('gov-committee', g.committee); s('gov-chair', g.chair); s('gov-freq', g.frequency);
    s('gov-desc', g.desc); s('gov-mgr', g.mgr); s('gov-mgr-desc', g.mgrDesc);
    s('gov-pay', g.esgPay); s('gov-pay-pct', g.esgWeight); s('gov-pay-kpi', g.payKpi);
    const st = this.state.strategy || {};
    s('str-transition', st.transitionRisks); s('str-physical', st.physicalRisks);
    s('str-opp', st.opportunities); s('str-scenario', st.scenarioType); s('str-scenario-desc', st.scenarioDesc);
    const r = this.state.risk || {};
    s('risk-id', r.idMethod); s('risk-erm', r.ermDesc); s('risk-supply', r.supplyDesc); s('risk-sbt', r.sbt);
    const m = this.state.metrics || {};
    s('mt-type', m.targetType); s('mt-base', m.baseYear); s('mt-s12', m.scope12Target);
    s('mt-s3', m.scope3Target); s('mt-nz', m.netZeroYear); s('mt-re100', m.re100Year);
    s('mt-carbon-range', m.carbonRange);
  },

  async autoSave() {
    this.collectForm();
    await Storage.saveReport(this.currentReportId, this.state);
    const ind = document.getElementById('save-indicator');
    if (ind) { ind.textContent = '已自動儲存 ' + new Date().toLocaleTimeString('zh-TW'); }
  },

  markDone(section) {
    if (!this.state.saved.includes(section)) this.state.saved.push(section);
    this.autoSave();
    const badge = document.getElementById('badge-' + section);
    if (badge) { badge.textContent = '完成'; badge.className = 'badge badge-done'; }
    this.updateProgress();
  },

  updateProgress() {
    const total = 6;
    const done = Math.min(this.state.saved.length, total);
    const pct = Math.round(done / total * 100);
    const bar = document.getElementById('prog-bar');
    if (bar) bar.style.width = pct + '%';
    const pctEl = document.getElementById('prog-pct');
    if (pctEl) pctEl.textContent = pct + '%';
    const label = document.getElementById('prog-label');
    if (label) label.textContent = done + '/' + total + ' 章節';
  },

  // ── 核心：生成章節（離線範本 或 線上 AI）──
  async generate(sectionKey) {
    this.collectForm();
    const outId = sectionKey + '-output';
    const loadId = sectionKey + '-loading';
    const out = document.getElementById(outId);
    const load = document.getElementById(loadId);
    if (out) { out.classList.remove('visible'); out.textContent = ''; }

    let text = '';
    const useAI = this.online && this.apiKey && document.getElementById('use-ai-' + sectionKey)?.checked !== false;

    if (useAI) {
      // 線上 AI 生成
      if (load) { load.classList.add('visible'); load.querySelector('span').textContent = 'AI 生成中...'; }
      try {
        text = await this.callClaude(sectionKey);
      } catch (e) {
        text = '（AI 連線失敗，改用離線範本）\n\n' + this.offlineGenerate(sectionKey);
      }
      if (load) load.classList.remove('visible');
    } else {
      // 離線範本生成
      if (load) { load.classList.add('visible'); load.querySelector('span').textContent = '離線範本生成中...'; }
      await new Promise(r => setTimeout(r, 300));
      text = this.offlineGenerate(sectionKey);
      if (load) load.classList.remove('visible');
    }

    if (out) { out.textContent = text; out.classList.add('visible'); }
    this.sections[sectionKey] = text;
    await Storage.saveSection(this.currentReportId, sectionKey, text);
  },

  offlineGenerate(sectionKey) {
    if (OfflineTemplates[sectionKey]) {
      return OfflineTemplates[sectionKey](this.state);
    }
    return '（此章節暫無離線範本）';
  },

  // ── 生成重大性判斷底稿──
  generateMaterialityDoc() {
    this.collectForm();
    const text = PracticeGuide.materialityWorkpaper(this.state);
    const out = document.getElementById('materiality-output');
    if (out) { out.textContent = text; out.classList.add('visible'); }
    this.sections['materiality'] = text;
    Storage.saveSection(this.currentReportId, 'materiality', text);
  },

  // ── 渲染財務影響衝擊路徑 ──
  renderImpactPathway() {
    const el = document.getElementById('impact-pathway');
    if (!el) return;
    el.innerHTML = PracticeGuide.impactPathway.map((s, i) => `
      <div class="pathway-step">
        <div class="pathway-num">${s.step}</div>
        <div class="pathway-body">
          <div class="pathway-label">${s.label}</div>
          <div class="pathway-hint">${s.hint}</div>
        </div>
      </div>
      ${i < PracticeGuide.impactPathway.length - 1 ? '<div class="pathway-arrow">↓</div>' : ''}
    `).join('');
  },

  // ── 渲染財會連結科目表 ──
  renderFinancialLinkage() {
    const el = document.getElementById('financial-linkage');
    if (!el) return;
    el.innerHTML = PracticeGuide.financialLinkage.map(r => `
      <div class="linkage-row">
        <div class="linkage-risk">${r.risk}</div>
        <div class="linkage-account">${r.accounts}</div>
        <div class="linkage-form">${r.form}</div>
      </div>`).join('');
  },

  // ── 渲染情境分析誤區檢查 ──
  renderScenarioPitfalls() {
    const el = document.getElementById('scenario-pitfalls');
    if (!el) return;
    el.innerHTML = PracticeGuide.scenarioPitfalls.map(p => `
      <label class="pitfall-item">
        <input type="checkbox" id="pitfall-${p.id}">
        <div><div class="pitfall-label">${p.label}</div><div class="pitfall-check">${p.check}</div></div>
      </label>`).join('');
  },

  async callClaude(sectionKey) {
    const prompts = this.buildPrompt(sectionKey);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompts }]
      })
    });
    if (!resp.ok) throw new Error('API error ' + resp.status);
    const data = await resp.json();
    return data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '（無回應）';
  },

  buildPrompt(sectionKey) {
    const d = this.state;
    const ctx = `公司：${d.companyName || '未填'}，行業 SASB 代碼：${d.sasbCode || '未填'}，資本額：${d.capital || '未知'}億，報告年度：${d.year || ''}。`;
    const base = `你是台灣 IFRS S2 永續揭露顧問，請以繁體中文撰寫正式報告書章節，使用段落文字不要條列。\n${ctx}\n\n`;
    const map = {
      overview: base + `請撰寫「公司概況與報告範圍」（約 350 字），依 IFRS S1 說明報告範圍、組織邊界（合併報表）、重大性評估（參考 SASB ${d.sasbCode}）、法規適用階段。`,
      governance: base + `請撰寫「氣候治理」章節（約 300 字）。委員會：${d.committee || '未填'}，主席：${d.chair || '未填'}，管理層：${d.mgr || '未填'}，薪酬連結：${d.esgPay || '未填'}（權重${d.esgWeight || ''}%）。依 TCFD 治理支柱與 IFRS S2 §6-7。`,
      strategy: base + `請撰寫「氣候策略與財務影響分析」（約 400 字）。轉型風險：${d.transitionRisks || '未填'}。實體風險：${d.physicalRisks || '未填'}。機會：${d.opportunities || '未填'}。情境分析：${d.scenarioType || '未填'}。依 TCFD 策略支柱與 IFRS S2 §10-22，需連結財務報表科目。`,
      risk: base + `請撰寫「風險管理」章節（約 300 字）。辨識方法：${d.idMethod || '未填'}。ERM 整合：${d.ermDesc || '未填'}。供應商 SBT 比率：${d.sbt || ''}%。依 TCFD 風險管理支柱與 IFRS S2 §23-25。`,
      metrics: base + `請撰寫「氣候指標與目標」（約 350 字）。目標類型：${d.targetType || '未填'}，基準年：${d.baseYear || ''}，Scope1+2 目標減 ${d.scope12Target || ''}%，Scope3 目標減 ${d.scope3Target || ''}%，淨零 ${d.netZeroYear || ''} 年，RE100 ${d.re100Year || ''} 年，內部碳價 ${d.carbonRange || '未設定'} USD/噸。依 IFRS S2 §26-38 與 SASB TC-HW 指標。`
    };
    return map[sectionKey] || base;
  },

  // ── 合規檢查（純離線）──
  runCompliance() {
    this.collectForm();
    const d = this.state;
    const items = [
      // A. 揭露範圍與重大性
      { label: '公司基本資料', desc: '名稱、資本額、行業別', status: d.company.name ? 'pass' : 'fail', req: '必填' },
      { label: 'SASB 行業識別', desc: '確認 SASB 行業別', status: (d.company.industry && d.company.industry !== 'other') ? 'pass' : 'warn', req: 'IFRS S1 §54-58' },
      { label: '重大性判斷底稿', desc: '量化＋質性判斷過程已留底稿', status: d.checklist?.materialityDoc ? 'pass' : 'warn', req: 'IFRS S1 §17-18' },
      { label: '未揭露資訊留底', desc: '如個別碳價格另存底稿備查', status: d.checklist?.undisclosedDoc ? 'pass' : 'warn', req: 'IFRS S1 §B29' },
      // B. 報導邊界
      { label: '報導個體一致', desc: '與財務報表報導個體一致', status: d.checklist?.boundaryConsistent ? 'pass' : 'warn', req: 'IFRS S1 §20' },
      { label: '集團內交易辨識', desc: '內部交易未重複計列', status: d.checklist?.intraGroup ? 'pass' : 'warn', req: 'IFRS S1 §20' },
      // C. GHG 數據
      { label: '範疇一 GHG 數據', desc: '直接排放', status: d.scope.s1 > 0 ? 'pass' : 'fail', req: '溫盤辦法' },
      { label: '範疇二 GHG（市場基礎）', desc: 'IFRS S2 強制', status: +d.scope.s2 > 0 ? 'pass' : 'fail', req: 'IFRS S2 §29' },
      { label: '範疇三 GHG', desc: '首次適用後第4年起（前3年得不揭露）', status: d.scope.s3 > 0 ? 'pass' : 'warn', req: 'IFRS S2 §B19' },
      { label: '範疇一二第三方確信', desc: '金管會規定須取得確信意見', status: d.checklist?.assurance ? 'pass' : 'warn', req: '金管會' },
      // D. 財務連結
      { label: '財會單位實質參與', desc: '財務影響金額具表單/系統勾稽', status: d.checklist?.financeInvolved ? 'pass' : 'warn', req: 'IFRS S1 §29' },
      { label: '當期＋預期財務影響', desc: '得先以質性表達', status: d.strategy.scenarioDesc ? 'pass' : 'warn', req: 'IFRS S2 §16' },
      // E. 治理與策略
      { label: '氣候治理架構', desc: '董事會監督機制', status: d.governance.committee ? 'pass' : 'fail', req: 'IFRS S2 §6' },
      { label: '薪酬連結機制', desc: '以當期財報認列薪酬為基礎', status: (d.governance.esgPay || '').includes('是') ? 'pass' : 'warn', req: 'IFRS S2 §6(a)(v)' },
      { label: '氣候風險識別', desc: '轉型與實體風險', status: d.strategy.transitionRisks ? 'pass' : 'fail', req: 'IFRS S2 §10' },
      { label: '時間區間定義', desc: '短中長期須定義並連結策略規劃期', status: (d.strategy.shortTerm && d.strategy.midTerm) ? 'pass' : 'warn', req: 'IFRS S2 §10(d)' },
      { label: '情境分析（韌性評估）', desc: '定位為假設推演，韌性評估每年更新', status: (d.strategy.scenarioType || '').includes('完成') ? 'pass' : (d.strategy.scenarioType || '').includes('豁免') ? 'warn' : 'fail', req: 'IFRS S2 §22' },
      // F. 指標目標
      { label: '減碳目標', desc: '基準年、里程碑、碳權使用、NDC對比', status: d.metrics.baseYear ? 'pass' : 'warn', req: 'IFRS S2 §33-36' },
      { label: '內部碳價格', desc: '若已採用需揭露', status: d.metrics.carbonRange ? 'pass' : 'warn', req: 'IFRS S2 §29(f)' },
      { label: 'SASB 行業指標', desc: '7項跨行業＋行業基礎指標', status: this.state.saved.includes('metrics') ? 'pass' : 'warn', req: 'IFRS S2 §32' },
      // G. 內控與程序
      { label: '永續資訊納入內控', desc: '2025/1/1 起列年度必要稽核項目', status: d.checklist?.internalControl ? 'pass' : 'warn', req: '金管會' },
      { label: '防漂綠檢視', desc: '資料可追溯、與業務財報相匹配', status: d.checklist?.greenwashCheck ? 'pass' : 'warn', req: '年報準則' },
      { label: '專章經董事會通過', desc: '與財報同日申報', status: d.checklist?.boardApproval ? 'pass' : 'warn', req: '年報準則 §7.2' }
    ];
    const list = document.getElementById('compliance-list');
    let pass = 0, warn = 0, fail = 0;
    if (list) {
      list.innerHTML = '';
      items.forEach(item => {
        if (item.status === 'pass') pass++; else if (item.status === 'warn') warn++; else fail++;
        list.innerHTML += `<div class="compliance-item ${item.status}">
          <div class="compliance-label">${item.label}<span class="status-dot ${item.status}"></span></div>
          <div class="compliance-desc">${item.desc} · <span style="color:#0F6E56">${item.req}</span></div></div>`;
      });
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('c-pass', pass); set('c-warn', warn); set('c-fail', fail);
    this.complianceStats = { pass, warn, fail, total: items.length };
  },

  updateExport() {
    this.collectForm();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ex-done', this.state.saved.length);
    const cap = parseFloat(this.state.company.capital) || 0;
    set('ex-reg', cap >= 100 ? '第一階段' : cap >= 50 ? '第二階段' : cap > 0 ? '第三階段' : '—');
    if (this.complianceStats) {
      set('ex-comp', Math.round(this.complianceStats.pass / this.complianceStats.total * 100) + '%');
    }
  },

  // ── Word 匯出（純前端）──
  async exportWord() {
    this.collectForm();
    // 確保所有章節都有內容（沒生成的用離線範本補上）
    ['overview', 'governance', 'strategy', 'risk', 'metrics'].forEach(key => {
      if (!this.sections[key]) this.sections[key] = this.offlineGenerate(key);
    });
    const btn = document.getElementById('export-word-btn');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }
    const result = await DocxExport.export(this.state, this.sections);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-file-download"></i> 匯出 Word 報告書'; }
    const status = document.getElementById('export-status');
    if (status) {
      status.textContent = result.success ? '✓ Word 檔已下載' : '✗ 匯出失敗：' + result.error;
      status.style.color = result.success ? '#1D9E75' : '#A32D2D';
    }
  },

  // ── 多報告管理 ──
  async renderReportList() {
    const reports = await Storage.listReports();
    const list = document.getElementById('report-list');
    if (!list) return;
    if (reports.length === 0) { list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:1rem">尚無儲存的報告</div>'; return; }
    list.innerHTML = reports.map(r => `
      <div class="report-item">
        <div><div style="font-weight:500">${r.data?.company?.name || '未命名報告'}</div>
        <div style="font-size:11px;color:var(--muted)">${r.data?.company?.year || ''} · 更新於 ${new Date(r.updatedAt).toLocaleString('zh-TW')}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="App.switchReport('${r.id}')">開啟</button>
          <button class="btn btn-sm" onclick="App.deleteReport('${r.id}')">刪除</button>
        </div>
      </div>`).join('');
  },

  async newReport() {
    const name = prompt('請輸入新報告名稱：');
    if (!name) return;
    this.currentReportId = 'report-' + Date.now();
    this.state = { company: { name }, scope: {}, governance: {}, strategy: {}, risk: {}, metrics: {}, saved: [] };
    this.sections = {};
    await Storage.saveReport(this.currentReportId, this.state);
    this.restoreForm();
    this.showPage('company');
  },

  async switchReport(id) {
    this.currentReportId = id;
    this.state = await Storage.loadReport(id) || { company: {}, scope: {}, saved: [] };
    this.sections = await Storage.loadSections(id);
    this.restoreForm();
    this.updateProgress();
    this.showPage('company');
  },

  async deleteReport(id) {
    if (!confirm('確定刪除此報告？此動作無法復原。')) return;
    await Storage.deleteReport(id);
    this.renderReportList();
  },

  // ── API Key 管理 ──
  saveApiKey() {
    const val = document.getElementById('api-key-input').value.trim();
    this.apiKey = val;
    localStorage.setItem('esg_api_key', val);
    const status = document.getElementById('api-status');
    if (status) { status.textContent = val ? '✓ API Key 已儲存（僅存於本機）' : 'API Key 已清除'; }
  },

  // ── 資料備份 ──
  async backupData() {
    const json = await Storage.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    window.saveAs(blob, `esg備份_${new Date().toISOString().slice(0, 10)}.json`);
  },

  async restoreData(input) {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const count = await Storage.importAll(text);
    alert(`已匯入 ${count} 份報告`);
    this.renderReportList();
  }
};

// GHG 即時圖表更新（離線）
function updateScopeChart() {
  const g = (id) => +document.getElementById(id)?.value || 0;
  const s1 = g('s1-fixed') + g('s1-mobile') + g('s1-process') + g('s1-fugitive');
  const s2 = g('s2-market');
  const s3 = g('s3-1') + g('s3-4') + g('s3-11') + g('s3-other');
  const total = s1 + s2 + s3;
  const el = document.getElementById('scope-preview');
  if (!el) return;
  if (total === 0) { el.textContent = '輸入數據後自動更新'; return; }
  const pct = (v) => total > 0 ? Math.round(v / total * 100) : 0;
  el.innerHTML = `
    <div class="scope-bar"><div class="scope-label"><span>範疇一</span><span>${s1.toLocaleString()} 公噸（${pct(s1)}%）</span></div><div class="scope-track"><div class="scope-fill" style="width:${pct(s1)}%;background:#1D9E75"></div></div></div>
    <div class="scope-bar"><div class="scope-label"><span>範疇二</span><span>${s2.toLocaleString()} 公噸（${pct(s2)}%）</span></div><div class="scope-track"><div class="scope-fill" style="width:${pct(s2)}%;background:#378ADD"></div></div></div>
    <div class="scope-bar"><div class="scope-label"><span>範疇三</span><span>${s3.toLocaleString()} 公噸（${pct(s3)}%）</span></div><div class="scope-track"><div class="scope-fill" style="width:${pct(s3)}%;background:#BA7517"></div></div></div>
    <div style="font-size:12px;color:var(--muted);margin-top:8px">總排放量：${total.toLocaleString()} 公噸 CO₂e</div>`;
}

function updateTimeline() {
  const cap = parseFloat(document.getElementById('co-capital')?.value) || 0;
  const el = document.getElementById('timeline-auto');
  if (!el) return;
  if (cap >= 100) el.innerHTML = '<strong style="color:#A32D2D">第一階段</strong>：2026 年會計年度強制適用，年報須於 <strong>2027 年 3 月 16 日</strong>前公告。首年可豁免 Scope 3。';
  else if (cap >= 50) el.innerHTML = '<strong style="color:#BA7517">第二階段</strong>：2027 年會計年度強制適用，年報於 <strong>2028 年 3 月 16 日</strong>前公告。';
  else if (cap > 0) el.innerHTML = '<strong style="color:#185FA5">第三階段</strong>：2028 年會計年度強制適用，年報於 <strong>2029 年 3 月 16 日</strong>前公告。';
  else el.textContent = '填寫實收資本額後自動判斷適用時程';
}

function updateSasb() {
  const ind = document.getElementById('co-industry')?.value;
  const map = {
    'TC-HW': '科技硬體（TC-HW）— 五大主題：能源管理、產品生命週期管理、供應鏈管理、原物料採購（衝突礦產）、產品安全。',
    'TC-SC': '半導體（TC-SC）— 重點：能源管理、水資源、廢棄物、供應鏈管理。',
    'IF-BK': '銀行（IF-BK）— 重點：氣候風險融資暴露、永續融資比率。',
    'CN-CM': '水泥（CN-CM）— 重點：製程排放、能源管理、空氣品質。',
    'RT-AA': '航空（TR-AL）— 重點：燃油效率、永續航空燃料。',
    'EM-EP': '電力（EM-EP）— 重點：排放強度、再生能源裝置容量。',
    'FB-BV': '食品飲料（FB-BV）— 重點：GHG 排放、水資源、食品安全。',
    'other': '請至 SASB 官網查詢對應行業別。'
  };
  const el = document.getElementById('sasb-info');
  if (el) el.innerHTML = map[ind] || '';
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  // 註冊 Service Worker（PWA 離線核心）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(e => console.log('SW 註冊失敗', e));
  }
});
