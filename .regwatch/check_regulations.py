#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
法規自動檢索比對腳本
每週由 GitHub Actions 觸發，抓取各法規來源頁面，與 baseline.json 比對，
偵測是否有變動（以頁面內容雜湊 + 關鍵字掃描為基礎），輸出報告。

設計原則：
- 只做「偵測與通知」，不自動改動應用程式碼（合規判讀需人工確認）。
- 偵測到變動時，產生 changes.md 供 GitHub Actions 開成 Issue。
- 更新 baseline.json 的 last_checked 與 content_hash。
"""

import json
import hashlib
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).parent
BASELINE = BASE_DIR / "baseline.json"
CHANGES_OUT = BASE_DIR / "changes.md"
HASH_STORE = BASE_DIR / "hashes.json"

# 台北時區
TPE = timezone(timedelta(hours=8))
NOW = datetime.now(TPE).strftime("%Y-%m-%d %H:%M")
TODAY = datetime.now(TPE).strftime("%Y-%m-%d")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "identity",
    "Connection": "close",
}


def fetch(url, timeout=30):
    """抓取頁面純文字內容，失敗時回傳 None。政府網站偶有 403，視為無法連線而非變動。"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                text = raw.decode(charset, errors="ignore")
            except (LookupError, TypeError):
                text = raw.decode("utf-8", errors="ignore")
            return text
    except urllib.error.HTTPError as e:
        # 403/429 等視為暫時無法連線，不誤判為變動
        print(f"  [警告] HTTP {e.code} {url}")
        return None
    except (urllib.error.URLError, TimeoutError, Exception) as e:
        print(f"  [警告] 抓取失敗 {url} : {e}")
        return None


def strip_html(html):
    """粗略移除 HTML 標籤與多餘空白，保留可比對的文字內容。"""
    if not html:
        return ""
    # 移除 script / style
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    # 移除標籤
    text = re.sub(r"<[^>]+>", " ", html)
    # 移除多餘空白
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def content_hash(text):
    """對正規化後的文字取 SHA-256。"""
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def scan_keywords(text, keywords):
    """回傳文字中命中的關鍵字清單（供人工快速判讀）。"""
    hits = []
    for kw in keywords:
        if kw and kw in text:
            hits.append(kw)
    return hits


def scan_update_signals(text):
    """掃描頁面是否含近期日期或『修正/發布』等更新訊號。"""
    signals = []
    # 民國/西元年份 + 修正/發布/公告
    for m in re.finditer(r"(11[0-9]|20[0-9]{2})\D{0,6}(修正|發布|公告|新增|訂定)", text):
        signals.append(m.group(0))
    return list(dict.fromkeys(signals))[:8]  # 去重、最多 8 筆


def main():
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    sources = baseline["sources"]

    # 載入先前的內容雜湊
    if HASH_STORE.exists():
        prev_hashes = json.loads(HASH_STORE.read_text(encoding="utf-8"))
    else:
        prev_hashes = {}

    changes = []
    new_hashes = {}
    unreachable = []

    print(f"=== 法規檢索比對 {NOW} (Asia/Taipei) ===\n")

    for src in sources:
        sid = src["id"]
        name = src["name_zh"]
        url = src["check_url"]
        print(f"檢查：{name}")

        html = fetch(url)
        if html is None:
            unreachable.append(src)
            new_hashes[sid] = prev_hashes.get(sid, "")
            continue

        text = strip_html(html)
        h = content_hash(text)
        new_hashes[sid] = h

        prev_h = prev_hashes.get(sid)
        kw_hits = scan_keywords(text, src.get("watch_keywords", []))
        update_signals = scan_update_signals(text)

        # 首次執行（無先前雜湊）只建立基準，不報變動
        if prev_h is None:
            print(f"  [基準建立] 已記錄內容雜湊")
            continue

        if h != prev_h:
            print(f"  [變動偵測] 頁面內容已改變！")
            changes.append({
                "name": name,
                "name_en": src.get("name_en", ""),
                "authority": src.get("authority", ""),
                "url": url,
                "current_baseline": src.get("current_version", ""),
                "keyword_hits": kw_hits,
                "update_signals": update_signals,
                "notes": src.get("notes", "")
            })
        else:
            print(f"  [無變動]")

        # 更新 last_checked
        src["last_checked"] = TODAY

    # 寫回雜湊與 baseline 的 last_checked
    HASH_STORE.write_text(json.dumps(new_hashes, ensure_ascii=False, indent=2), encoding="utf-8")
    BASELINE.write_text(json.dumps(baseline, ensure_ascii=False, indent=2), encoding="utf-8")

    # 產生變動報告
    if changes or unreachable:
        lines = [f"# 法規檢索比對報告　{NOW}", ""]
        if changes:
            lines.append(f"## ⚠️ 偵測到 {len(changes)} 項來源頁面變動")
            lines.append("")
            lines.append("> 以下來源頁面內容自上次檢查後有變動，**請人工確認是否涉及系統需更新的實質法規異動**，")
            lines.append("> 確認後再手動調整程式（app.js 合規項目、templates.js 範本、references.js 版本日期）。")
            lines.append("")
            for c in changes:
                lines.append(f"### {c['name']}")
                lines.append(f"- 主管機關：{c['authority']}")
                lines.append(f"- 目前系統基準版本：{c['current_baseline']}")
                lines.append(f"- 來源：{c['url']}")
                if c["update_signals"]:
                    lines.append(f"- 頁面更新訊號：{', '.join(c['update_signals'])}")
                if c["keyword_hits"]:
                    lines.append(f"- 命中關鍵字：{', '.join(c['keyword_hits'])}")
                if c["notes"]:
                    lines.append(f"- 備註：{c['notes']}")
                lines.append("")
            lines.append("### 建議人工檢查的程式位置")
            lines.append("- `app.js` → `runCompliance()` 的 `items` 陣列（法規條號與檢核邏輯）")
            lines.append("- `templates.js` → 各章節範本中引用的時程與條號")
            lines.append("- `references.js` → `References` 清單的版本日期")
            lines.append("- `.regwatch/baseline.json` → 確認後更新對應來源的 `current_version`")
            lines.append("")
        if unreachable:
            lines.append(f"## 🔌 {len(unreachable)} 項來源無法連線（僅供參考，非變動）")
            for u in unreachable:
                lines.append(f"- {u['name_zh']}：{u['check_url']}")
            lines.append("")
        CHANGES_OUT.write_text("\n".join(lines), encoding="utf-8")
        print(f"\n>>> 已產生變動報告：{CHANGES_OUT}")
        # 用 exit code 1 讓 GitHub Actions 知道有變動需開 Issue
        if changes:
            sys.exit(1)
    else:
        # 無變動也寫一個簡短紀錄
        CHANGES_OUT.write_text(f"# 法規檢索比對報告　{NOW}\n\n✅ 所有來源自上次檢查後無內容變動。\n", encoding="utf-8")
        print("\n>>> 所有來源無變動。")
        sys.exit(0)


if __name__ == "__main__":
    main()
