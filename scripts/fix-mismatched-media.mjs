import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const exec = promisify(execFile);

const pinsPath = path.join(rootDir, "data/pins.json");
const mediaPath = path.join(rootDir, "data/media.json");
const sourcePath = path.join(rootDir, "data/source.json");
const listPath = path.join(rootDir, "data/list.md");

const pins = JSON.parse(await fs.readFile(pinsPath, "utf8"));
const media = JSON.parse(await fs.readFile(mediaPath, "utf8"));
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));

async function downloadAndProcessImage(url, key, isBanner = false) {
  const tmpPath = path.join("/tmp", `${key}-${isBanner ? "banner" : "poster"}-${Date.now()}`);
  const outSubpath = isBanner ? `assets/img/banners/${key}.webp` : `assets/img/posters/${key}.webp`;
  const outPath = path.join(rootDir, outSubpath);

  console.log(`Downloading ${url} -> ${outSubpath}...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://manga.bilibili.com/"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);

  if (isBanner) {
    await exec("magick", [tmpPath, "-resize", "1600x900>", "-strip", "-quality", "80", outPath]);
  } else {
    await exec("magick", [tmpPath, "-resize", "700x1050>", "-strip", "-quality", "82", outPath]);
  }
  await fs.unlink(tmpPath).catch(() => {});
  return outSubpath;
}

// 1. Update pins.json
pins["passion"] = 129247;
pins["heatstroke"] = 199402;
pins["kill-my-love"] = 173435;
pins["possessed-by-a-cotton-ball"] = 188590;
pins["blood-lust"] = 135496;
pins["rabid-dog-breeding-rules"] = null; // Custom Bilibili manhua
pins["devil-in-the-suit"] = null; // Custom Baozimh manhua

// 2. Fetch AniList records for the 5 AniList-pinned ones
const anilistQuery = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: MANGA) {
      id
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large color }
      bannerImage
      genres
      format
      startDate { year }
      chapters
      volumes
      status
      averageScore
      siteUrl
      staff(perPage: 4) {
        edges { role node { name { full } } }
      }
    }
  }
}`;

console.log("Querying AniList for updated titles...");
const aniRes = await fetch("https://graphql.anilist.co", {
  method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
  body: JSON.stringify({ query: anilistQuery, variables: { ids: [129247, 199402, 173435, 188590, 135496] } })
});
const aniData = await aniRes.json();
const aniMap = {};
for (const m of aniData.data?.Page?.media || []) {
  aniMap[m.id] = m;
}

// Map entries to process
const updates = [
  {
    key: "passion",
    aniId: 129247,
    title: "PASSION",
    alt: "PASSION · 패션",
    badge: "ONGOING",
    meta: "Ongoing · Action / Drama",
    chapters: 105
  },
  {
    key: "heatstroke",
    aniId: 199402,
    title: "Heat Stroke",
    alt: "Heat Stroke · 아기 삵을 낳아줘",
    badge: "ONGOING",
    meta: "Ongoing · Comedy / Fantasy",
    chapters: 35
  },
  {
    key: "kill-my-love",
    aniId: 173435,
    title: "Kill My Love",
    alt: "Kill My Love · 爱与杀意之夜",
    badge: "COMPLETED",
    meta: "92 chapters · Completed",
    chapters: 92
  },
  {
    key: "possessed-by-a-cotton-ball",
    aniId: 188590,
    title: "Possessing the Obsessive Maniac's Cotton Doll",
    alt: "The Duke's Plush Obsession · 광공의 솜뭉치로 빙의함",
    badge: "COMPLETED",
    meta: "55 chapters · Completed",
    chapters: 55
  },
  {
    key: "blood-lust",
    aniId: 135496,
    title: "Blood/Lust",
    alt: "LUST / In Pursuit of Lust · 러스트",
    badge: "COMPLETED",
    meta: "68 chapters · Completed",
    chapters: 68
  },
  {
    key: "rabid-dog-breeding-rules",
    custom: {
      id: "bili-34078",
      title: { english: "Rabid Dog Breeding Rules", romaji: "Kuangquan Siyang Faze", native: "狂犬饲养法则" },
      format: "MANGA",
      countryOfOrigin: "CN",
      chapters: 81,
      volumes: null,
      status: "FINISHED",
      genres: ["Drama", "Romance"],
      description: "In the eyes of Xu Hanzhou, Shen Yuan was always his most obedient, submissive, and loyal dog. But when Shen Yuan loses control and goes completely wild, Hanzhou realizes that behind that docile facade lies a dangerous, obsessive beast. A tension-filled ABO power dynamic unfolds between a cold, calculating Queen and an unhinged, fiercely devoted hound.",
      staff: [{ name: { full: "Cao Huohuo" }, role: "Story" }, { name: { full: "Zhongyue Animation" }, role: "Art" }],
      siteUrl: "https://manga.bilibili.com/detail/mc34078",
      posterUrl: "https://i0.hdslb.com/bfs/manga-static/5b72e54be42864fd23e7368bfdf566841d3a8595.jpg"
    },
    title: "Rabid Dog Breeding Rules",
    alt: "Rabid Dog Breeding Rules · 狂犬饲养法则",
    badge: "COMPLETED",
    meta: "81 chapters · Completed",
    chapters: 81
  },
  {
    key: "devil-in-the-suit",
    custom: {
      id: "baozimh-xizhuang",
      title: { english: "The Devil in the Suit", romaji: "Xizhuang Xia De Mo Wang", native: "西装下的魔王" },
      format: "MANGA",
      countryOfOrigin: "CN",
      chapters: 75,
      volumes: null,
      status: "FINISHED",
      genres: ["Comedy", "Romance"],
      description: "Second-rate novelist Shao Xinyu disguises herself as a young man under the alias 'Shao Xinyu' and takes a huge risk by sneaking into Rong Guang Group, a renowned talent agency. Her mission: secretly gather material on the notoriously cold, arrogant, and sharp-tongued CEO Wen Qijing. But living and working in close quarters with the 'devil in the suit' quickly turns her undercover investigation into an uncontrollable romance.",
      staff: [{ name: { full: "Dongying COMIC" }, role: "Story & Art" }],
      siteUrl: "https://www.baozimh.com/comic/xizhuangxiademowang-dongying",
      posterUrl: "https://static-tw.baozimh.com/cover/xizhuangxiademowang-dongying.jpg"
    },
    title: "The Devil in the Suit",
    alt: "The Devil in the Suit · 西装下的魔王",
    badge: "COMPLETED",
    meta: "75 chapters · Completed",
    chapters: 75
  }
];

for (const item of updates) {
  console.log(`\nProcessing ${item.key}...`);
  let rec = null;
  let posterUrl = null;
  let bannerUrl = null;

  if (item.aniId) {
    const ani = aniMap[item.aniId];
    if (!ani) {
      console.warn(`No AniList data for ID ${item.aniId}`);
      continue;
    }
    rec = {
      id: ani.id,
      anilistId: ani.id,
      title: ani.title,
      format: ani.format,
      countryOfOrigin: ani.id === 173435 ? "CN" : "KR",
      chapters: ani.chapters || item.chapters,
      volumes: ani.volumes,
      status: ani.status,
      genres: ani.genres,
      averageScore: ani.averageScore,
      description: ani.description,
      staff: ani.staff?.edges?.map(e => ({ name: { full: e.node.name.full }, role: e.role })) || [],
      siteUrl: ani.siteUrl
    };
    posterUrl = ani.coverImage?.extraLarge || ani.coverImage?.large;
    bannerUrl = ani.bannerImage || posterUrl;
  } else if (item.custom) {
    rec = { ...item.custom };
    posterUrl = item.custom.posterUrl;
    bannerUrl = posterUrl;
  }

  // Download & process poster & banner
  const posterPath = await downloadAndProcessImage(posterUrl, item.key, false);
  const bannerPath = await downloadAndProcessImage(bannerUrl, item.key, true);

  rec.poster = posterPath;
  rec.banner = bannerPath;
  rec.images = { poster: posterPath, banner: bannerPath };

  media[item.key] = rec;
  console.log(`✓ Updated media entry for ${item.key}: "${rec.title.english || rec.title.romaji}"`);

  // Update source.json
  for (const sec of source.sections) {
    for (const sItem of sec.items || []) {
      if (sItem.media === item.key) {
        sItem.title = item.title;
        sItem.alt = item.alt;
        sItem.badge = item.badge;
        sItem.meta = item.meta;
        sItem.chaptersRead = item.chapters;
        sItem.totalChapters = item.chapters;
        sItem.progress = [item.chapters, item.chapters];
        if (item.badge === "COMPLETED") sItem.status = "COMPLETED";
        else sItem.status = "RELEASING";
        console.log(`✓ Updated source.json entry in [${sec.title}]`);
      }
    }
  }
}

await fs.writeFile(pinsPath, JSON.stringify(pins, null, 2), "utf8");
await fs.writeFile(mediaPath, JSON.stringify(media, null, 2), "utf8");
await fs.writeFile(sourcePath, JSON.stringify(source, null, 2), "utf8");
console.log("\n✓ All files updated successfully!");
