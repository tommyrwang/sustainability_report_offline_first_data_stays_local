// ══════════════════════════════════════════════════════════
// 前端 Word 匯出模組 — 完全在瀏覽器內生成 .docx，無需伺服器
// 依賴 docx.js (UMD global: window.docx) 與 FileSaver (window.saveAs)
// ══════════════════════════════════════════════════════════

const DocxExport = {

  buildReport(state, sections) {
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak
    } = window.docx;

    const co = state.company || {};
    const bdr = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };

    const H1 = (t) => new Paragraph({
      spacing: { before: 360, after: 180 },
      children: [new TextRun({ text: t, bold: true, size: 30, color: "9E2B25", font: "Microsoft JhengHei" })]
    });
    const H2 = (t) => new Paragraph({
      spacing: { before: 260, after: 120 },
      children: [new TextRun({ text: t, bold: true, size: 24, color: "9C6B1E", font: "Microsoft JhengHei" })]
    });
    const P = (t) => new Paragraph({
      spacing: { before: 60, after: 120 }, alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: t, size: 22, font: "Microsoft JhengHei" })]
    });
    const refLine = (t) => new Paragraph({
      spacing: { before: 40, after: 120 },
      children: [new TextRun({ text: t, italics: true, size: 18, color: "888888", font: "Microsoft JhengHei" })]
    });

    const children = [];

    // ── 封面 ──
    children.push(new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: co.name || "公司名稱", size: 40, bold: true, color: "9E2B25", font: "Microsoft JhengHei" })] }));
    children.push(new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${co.year || ""}年度`, size: 32, color: "9C6B1E", font: "Microsoft JhengHei" })] }));
    children.push(new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "氣候相關財務揭露永續資訊報告書", size: 36, bold: true, font: "Microsoft JhengHei" })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "依循 TCFD ・ IFRS S1 / S2 ・ SASB 編製", size: 22, color: "555555", font: "Microsoft JhengHei" })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 },
      children: [new TextRun({ text: `SASB 行業別：${co.industry || "—"}　｜　適用階段：${this.getStage(co.capital)}`, size: 20, color: "888888", font: "Microsoft JhengHei" })] }));
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ── 各章節 ──
    const order = [
      ["overview", "第一章　公司概況與報告範圍", "IFRS S1"],
      ["governance", "第二章　氣候治理", "TCFD ／ IFRS S2 §6-7"],
      ["strategy", "第三章　氣候策略與財務影響分析", "TCFD ／ IFRS S2 §10-22"],
      ["risk", "第四章　風險管理", "TCFD ／ IFRS S2 §23-25"],
      ["metrics", "第五章　氣候指標與目標", "TCFD ／ IFRS S2 §26-38 ／ SASB"]
    ];

    order.forEach(([key, title, ref], idx) => {
      children.push(H1(title));
      children.push(refLine(`依循 ${ref} 編製`));
      const content = (sections && sections[key]) || "（本章節內容尚未生成，請於系統中填寫並生成後再匯出。）";
      content.split("\n").filter(x => x.trim()).forEach(para => {
        children.push(P(para.trim()));
      });
      if (idx < order.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
    });

    // ── 附錄 A：GHG 排放明細 ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(H1("附錄 A　溫室氣體排放明細表"));
    children.push(refLine("依循 GHG Protocol / ISO 14064-1，符合環境部盤查規定"));
    const s = state.scope || {};
    children.push(this.ghgTable(state));

    // ── 附錄 B：SASB 對照 ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(H1("附錄 B　SASB 產業指標對照表"));
    children.push(refLine(`SASB ${co.industry || "行業"}準則揭露指標`));
    children.push(this.sasbTable(state));

    // ── 附錄 C：引用來源 ──
    children.push(new Paragraph({ children: [new PageBreak()] }));
    const isEn = (typeof App !== 'undefined' && App.lang === 'en');
    children.push(H1(isEn ? "Appendix C　References" : "附錄 C　引用來源"));
    if (typeof References !== 'undefined') {
      const L = isEn ? 'en' : 'zh';
      children.push(H2(isEn ? "International Standards" : "國際準則"));
      References.standards.forEach(s => children.push(P(`· ${s[L]}（${s.org}）`)));
      children.push(H2(isEn ? "Taiwan Regulations" : "台灣法規"));
      References.regulations.forEach(r => children.push(P(`· ${r[L]}（${r.org}）`)));
      children.push(H2(isEn ? "Reference Workshop" : "參考工作坊"));
      const w = References.workshop[L];
      children.push(P(w.title));
      children.push(P(`${w.host}　·　${w.date}`));
      children.push(refLine(w.note));
      children.push(P(w.url));
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: "Microsoft JhengHei", size: 22 } } } },
      sections: [{
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children
      }]
    });

    return doc;
  },

  ghgTable(state) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType } = window.docx;
    const bdr = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
    const s = state.scope || {};

    const cell = (text, opts = {}) => new TableCell({
      borders: bdrs, width: { size: opts.w || 3000, type: WidthType.DXA },
      shading: opts.head ? { fill: "9E2B25", type: ShadingType.CLEAR } : (opts.alt ? { fill: "F6E7E5", type: ShadingType.CLEAR } : undefined),
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20, bold: !!opts.head, color: opts.head ? "FFFFFF" : "000000", font: "Microsoft JhengHei" })] })]
    });

    const rows = [
      new TableRow({ children: [cell("排放範疇", { head: true, w: 3600 }), cell("排放量（公噸 CO₂e）", { head: true, w: 3000 }), cell("查證狀態", { head: true, w: 2400 })] }),
      new TableRow({ children: [cell("範疇一（直接排放）", { alt: true }), cell(s.s1 || "0", { alt: true }), cell("第三方查證", { alt: true })] }),
      new TableRow({ children: [cell("範疇二（購買電力，市場基礎）"), cell(s.s2 || "0"), cell("第三方查證")] }),
      new TableRow({ children: [cell("範疇三（價值鏈）", { alt: true }), cell(s.s3 || "（首年豁免）", { alt: true }), cell("—", { alt: true })] }),
      new TableRow({ children: [cell("再生電力使用比率"), cell((s.re || "0") + "%"), cell("SASB TC-HW-130a")] })
    ];

    return new Table({ width: { size: 9000, type: WidthType.DXA }, rows });
  },

  sasbTable(state) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType } = window.docx;
    const bdr = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
    const s = state.scope || {};
    const m = state.metrics || {};

    const cell = (text, opts = {}) => new TableCell({
      borders: bdrs, width: { size: opts.w || 3000, type: WidthType.DXA },
      shading: opts.head ? { fill: "9C6B1E", type: ShadingType.CLEAR } : (opts.alt ? { fill: "F5EBD9", type: ShadingType.CLEAR } : undefined),
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20, bold: !!opts.head, color: opts.head ? "FFFFFF" : "000000", font: "Microsoft JhengHei" })] })]
    });

    const rows = [
      new TableRow({ children: [cell("揭露主題", { head: true, w: 3000 }), cell("SASB 代碼", { head: true, w: 2400 }), cell("揭露值", { head: true, w: 3600 })] }),
      new TableRow({ children: [cell("能源管理", { alt: true }), cell("TC-HW-130a.1", { alt: true }), cell(`再生電力 ${s.re || "0"}%`, { alt: true })] }),
      new TableRow({ children: [cell("產品能效改善"), cell("TC-HW-410a.1"), cell(m.productEnergy || "請填寫")] }),
      new TableRow({ children: [cell("永續材料（PCR）比率", { alt: true }), cell("TC-HW-410a.2", { alt: true }), cell(m.pcr || "請填寫", { alt: true })] }),
      new TableRow({ children: [cell("供應商 SBT/RE100 承諾"), cell("TC-HW-430a"), cell((state.risk?.sbt || "0") + "%")] })
    ];

    return new Table({ width: { size: 9000, type: WidthType.DXA }, rows });
  },

  getStage(capital) {
    const cap = parseFloat(capital) || 0;
    if (cap >= 100) return "第一階段（2026）";
    if (cap >= 50) return "第二階段（2027）";
    if (cap > 0) return "第三階段（2028）";
    return "未定";
  },

  async export(state, sections) {
    try {
      const doc = this.buildReport(state, sections);
      const blob = await window.docx.Packer.toBlob(doc);
      const filename = `${(state.company?.name || "永續報告書")}_${state.company?.year || ""}_氣候相關財務揭露.docx`;
      window.saveAs(blob, filename);
      return { success: true };
    } catch (e) {
      console.error("匯出失敗", e);
      return { success: false, error: e.message };
    }
  }
};

if (typeof module !== 'undefined') module.exports = DocxExport;
