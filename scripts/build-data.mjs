import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const source = JSON.parse(await fs.readFile(path.join(rootDir, "data/source.json"), "utf8"));
let media = {};
try {
  media = JSON.parse(await fs.readFile(path.join(rootDir, "data/media.json"), "utf8"));
} catch {
  media = {};
}

const missing = new Set();
const used = new Set();

function cleanDescription(text = "") {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/\(Source:[^)]*\)/gi, "")
    .replace(/(^|\n)\s*Note:[^\n]*/gi, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function initials(text = "") {
  const words = text
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "M";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

let totalChaptersRead = 0;
let totalVolumesCount = 0;
let totalTitlesCount = 0;
let completedCount = 0;
const shelfChapters = [];

for (const section of source.sections) {
  let sectionChapters = 0;

  section.items = (section.items || []).map((item) => {
    const record = media[item.media];
    if (item.media) {
      if (!record) missing.add(item.media);
      else used.add(item.media);
    }

    const emptyLabel = item.placeholder
      ? item.placeholder.split("\n").join(" · ")
      : item.title;

    const readCh =
      item.chaptersRead != null
        ? item.chaptersRead
        : Array.isArray(item.progress)
        ? item.progress[0]
        : item.totalChapters || 0;

    totalChaptersRead += readCh;
    sectionChapters += readCh;
    totalTitlesCount++;

    if (item.volumes) totalVolumesCount += item.volumes;
    if (
      item.status === "COMPLETED" ||
      (Array.isArray(item.progress) && item.progress[0] >= item.progress[1] && item.progress[1] > 0)
    ) {
      completedCount++;
    }

    return {
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
      accent: section.accent,
      chaptersRead: readCh,
      synopsis: item.description || cleanDescription(record?.description),
      image: record?.poster || null,
      banner: record?.banner || null,
      emptyMark: item.emptyMark || initials(item.placeholder?.split("\n")[0] || item.title),
      emptyLabel: item.emptyLabel || emptyLabel,
      info: {
        format: record?.format || item.format || "MANGA",
        year: record?.year || item.year || null,
        chapters: record?.chapters || item.totalChapters || null,
        volumes: record?.volumes || item.volumes || null,
        status: record?.status || item.status || null,
        averageScore: record?.averageScore || null,
        genres: record?.genres || item.genres || [],
        staff: record?.staff || item.staff || [],
        romaji: record?.title?.romaji || null,
        english: record?.title?.english || null,
        native: record?.title?.native || null,
        siteUrl: record?.siteUrl || (record?.id ? `https://anilist.co/manga/${record.id}` : null)
      }
    };
  });

  shelfChapters.push({
    label: section.title,
    sectionId: section.id,
    chapters: sectionChapters,
    display: `${sectionChapters.toLocaleString()} ch`,
    accent: section.accent
  });
}

for (const key of Object.keys(media)) {
  if (!used.has(key)) console.log(`Unused cached media: ${key}`);
}
if (missing.size) {
  console.warn(`Warning: Missing cached media for slugs: ${[...missing].join(", ")}`);
}

// Compute proportional stacked widths for hero progress bar based on chapters
const totalCh = totalChaptersRead || 1;
const stackedBars = shelfChapters.map((bar) => ({
  ...bar,
  percentage: totalChaptersRead > 0 ? Number(((bar.chapters / totalCh) * 100).toFixed(1)) : 0
}));

const totals = source.totals || {};
totals.bars = totals.bars && totals.bars.length ? totals.bars : shelfChapters;
totals.stackedBars = stackedBars;

const payload = {
  meta: source.meta,
  heroStats: totals.stats || [
    { value: totalChaptersRead.toLocaleString(), label: "chapters read" },
    { value: totalVolumesCount.toLocaleString(), label: "volumes" },
    { value: completedCount.toLocaleString(), label: "completed" },
    { value: totalTitlesCount.toLocaleString(), label: "titles" }
  ],
  sections: source.sections,
  totals,
  taste: source.taste || { yes: [], no: [], note: "" },
  builtAt: new Date().toISOString()
};

const output = `/* Generated from data/source.json + data/media.json — do not edit by hand. */\nwindow.__DATA__ = ${JSON.stringify(
  payload,
  null,
  2
)};\nwindow.MANGA_DATA = window.__DATA__;\n`;

await fs.writeFile(path.join(rootDir, "data.js"), output, "utf8");
console.log(`✓ Successfully compiled data.js (${(output.length / 1024).toFixed(1)} KB).`);
