// E2E 커버리지(번들 바이트 범위) → 원본 src/LifeRPG.jsx 라인으로 역매핑
// 사용: node cov_map.js out/<tag>-coverage.json ../../../../Desktop/life/files/dist/assets/<bundle>.js.map
const fs = require("fs");
const path = require("path");
const { SourceMapConsumer } = require("source-map");

const covPath = process.argv[2] || path.join(__dirname, "out", "before-coverage.json");
const DIST = "c:/Users/조준형/Desktop/life/files/dist/assets";
const mapFile = process.argv[3] || fs.readdirSync(DIST).find((f) => f.endsWith(".js.map"));
const SRC_FILE = "c:/Users/조준형/Desktop/life/files/src/LifeRPG.jsx";

(async () => {
  const cov = JSON.parse(fs.readFileSync(covPath, "utf8"));
  const entry = cov.find((c) => c.url.includes("/assets/") && c.url.endsWith(".js"));
  if (!entry) throw new Error("번들 커버리지 없음");
  const raw = JSON.parse(fs.readFileSync(path.join(DIST, path.basename(mapFile)), "utf8"));
  const consumer = await new SourceMapConsumer(raw);
  const text = entry.text;

  // 번들 오프셋 → (line, col)
  const lineStart = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStart.push(i + 1);
  const posOf = (off) => {
    let lo = 0, hi = lineStart.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStart[mid] <= off) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, column: off - lineStart[lo] };
  };
  // 실행된 오프셋 집합(범위 병합)
  const ranges = [...entry.ranges].sort((a, b) => a.start - b.start);
  const covered = (off) => { let lo = 0, hi = ranges.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (off < ranges[m].start) hi = m - 1; else if (off >= ranges[m].end) lo = m + 1; else return true; } return false; };

  const srcLines = fs.readFileSync(SRC_FILE, "utf8").split("\n");
  const hit = new Set(), miss = new Map();
  // 매핑 지점을 순회하며 원본 라인의 실행 여부 판정
  consumer.eachMapping((m) => {
    if (!m.source || !m.source.includes("LifeRPG")) return;
    const off = (lineStart[m.generatedLine - 1] ?? 0) + m.generatedColumn;
    if (covered(off)) hit.add(m.originalLine);
    else miss.set(m.originalLine, (miss.get(m.originalLine) || 0) + 1);
  });
  const never = [...miss.keys()].filter((l) => !hit.has(l)).sort((a, b) => a - b);

  // 연속 구간으로 묶기
  const blocks = [];
  for (const l of never) {
    const last = blocks[blocks.length - 1];
    if (last && l === last.end + 1) last.end = l; else blocks.push({ start: l, end: l });
  }
  const big = blocks.filter((b) => b.end - b.start >= 2);
  const isData = (b) => srcLines.slice(b.start - 1, b.end).every((l) => /^\s*\{ n: "/.test(l) || /^\s*\/\*|^\s*\*/.test(l) || !l.trim());
  const code = big.filter((b) => !isData(b));

  console.log(`실행된 원본 라인 ${hit.size} · 한 번도 실행 안 된 라인 ${never.length} · 연속 구간 ${blocks.length}(3줄 이상 ${big.length}, 데이터 제외 ${code.length})`);
  console.log("\n[미실행 코드 구간 — 3줄 이상, 데이터 테이블 제외]");
  for (const b of code.sort((a, b2) => (b2.end - b2.start) - (a.end - a.start)).slice(0, 40)) {
    const head = srcLines[b.start - 1].trim().slice(0, 96);
    console.log(`  ${String(b.start).padStart(4)}~${String(b.end).padEnd(4)} (${b.end - b.start + 1}줄) ${head}`);
  }
  fs.writeFileSync(path.join(__dirname, "out", "never-executed.json"), JSON.stringify({ never, blocks: code }, null, 1));
  consumer.destroy();
})();
