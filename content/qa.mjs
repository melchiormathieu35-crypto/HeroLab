/**
 * Contrôle qualité des rushes, sur les fichiers réellement écrits.
 *
 * Le producteur vérifie déjà le cadrage dans le DOM, avant l'encodage. Ici on
 * contrôle l'autre bout de la chaîne : ce que contient le fichier livré.
 * Les deux passes sont complémentaires — un cadrage correct n'empêche pas un
 * encodage vide, et un fichier valide peut montrer une page blanche.
 *
 * Ce qui est vérifié :
 *   FICHIER      présent, non vide
 *   FORMAT       1080×1920, ratio 9:16 exact
 *   DURÉE        dans une fourchette exploitable au montage
 *   IMAGE        extraction d'une image réelle en milieu de plan, puis mesure
 *                de sa luminance, de son écart-type et de sa valeur dominante :
 *                un plan noir, uniforme, ou dont l'application n'occupe qu'une
 *                partie du cadre est détecté — pas seulement un fichier bien
 *                formé
 *   CONSOLE      aucune erreur de page pendant la prise (relevé du producteur)
 *   CADRAGE      report des contrôles DOM du producteur
 *
 * Usage : node content/qa.mjs [--json]
 */
import { readFile, readdir, stat, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { inflateSync } from "node:zlib";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOT_SIZE } from "./studio.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUSH_DIR = join(ROOT, "Format court", "Rush avant montage");
const AS_JSON = process.argv.includes("--json");

/** Durées acceptables pour un plan de format court, en secondes. */
export const DUREE = { min: 1.2, max: 12.0 };
/**
 * Seuils d'image.
 *
 * `luminanceMin` / `ecartTypeMin` : en dessous, le plan est noir ou plat.
 *
 * `dominanteMax` : part maximale du cadre occupée par une seule valeur de
 * luminance. Ce contrôle vient d'un défaut réel que cette passe avait laissé
 * passer : l'enregistrement vidéo de Playwright ne sachant pas agrandir une
 * page, le rush ne contenait l'application que sur un tiers du cadre, le reste
 * étant du gris uni — et comme le fichier était bien formé et non uniforme, il
 * était déclaré conforme. Mesures : version défectueuse 85 à 87 % du cadre sur
 * une seule valeur, versions correctes 10 à 24 %. Le seuil est posé à 45 %,
 * donc à bonne distance des deux.
 */
export const IMAGE = { luminanceMin: 8, ecartTypeMin: 6, dominanteMax: 0.45 };

/**
 * ffmpeg est fourni par Playwright. La version exacte varie selon l'image
 * système, donc on la cherche au lieu de la coder en dur.
 */
async function ffmpegPath() {
  const base = "/opt/pw-browsers";
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  if (!existsSync(base)) return null;
  const dirs = (await readdir(base)).filter(d => d.startsWith("ffmpeg-")).sort().reverse();
  for (const d of dirs) {
    const p = join(base, d, "ffmpeg-linux");
    if (existsSync(p)) return p;
  }
  return null;
}

/** Lit durée et résolution depuis la sortie de ffmpeg (il n'y a pas ffprobe). */
export async function probe(ff, file) {
  let err = "";
  try { await run(ff, ["-hide_banner", "-i", file]); }
  catch (e) { err = (e.stderr || "") + (e.stdout || ""); }   // ffmpeg sort en erreur sans sortie demandée
  const dim = /,\s(\d{2,5})x(\d{2,5})[\s,]/.exec(err);
  const dur = /Duration:\s(\d+):(\d+):(\d+\.\d+)/.exec(err);
  return {
    width: dim ? +dim[1] : null,
    height: dim ? +dim[2] : null,
    seconds: dur ? (+dur[1] * 3600 + +dur[2] * 60 + +dur[3]) : null,
  };
}

/**
 * Décode un PNG en niveaux de gris 8 bits et rend les valeurs de pixels.
 *
 * ffmpeg est ici compilé `--disable-everything` : il ne sait écrire que `webm`
 * et `image2`. Impossible donc de lui demander une sortie brute — on décode le
 * PNG nous-même. C'est court et exact : lecture de l'en-tête IHDR, concaténation
 * des blocs IDAT, décompression zlib (fournie par Node), puis retrait du filtre
 * ligne par ligne selon la spécification PNG.
 */
export function decodeGrayPNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("ce n'est pas un PNG");
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;                                   // longueur + type + données + CRC
  }
  if (depth !== 8 || colorType !== 0) throw new Error(`PNG non gris 8 bits (depth ${depth}, type ${colorType})`);

  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height);
  const bpp = 1;                                       // un octet par pixel en gris 8 bits
  let prev = Buffer.alloc(width);
  for (let y = 0; y < height; y++) {
    const filtre = raw[y * (width + 1)];
    const ligne = Buffer.from(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)));
    for (let x = 0; x < width; x++) {
      const a = x >= bpp ? ligne[x - bpp] : 0;         // pixel de gauche
      const b = prev[x];                               // pixel du dessus
      const c = x >= bpp ? prev[x - bpp] : 0;          // pixel en haut à gauche
      let v = ligne[x];
      if (filtre === 1) v += a;
      else if (filtre === 2) v += b;
      else if (filtre === 3) v += (a + b) >> 1;
      else if (filtre === 4) {                         // Paeth
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      ligne[x] = v & 0xff;
    }
    ligne.copy(out, y * width);
    prev = ligne;
  }
  return { width, height, pixels: out };
}

/**
 * Extrait une image au milieu du plan et en mesure la luminance moyenne et
 * l'écart-type. Un plan noir ou uniforme est ainsi détecté, là où un simple
 * contrôle de format le laisserait passer.
 */
export async function frameStats(ff, file, atSeconds) {
  const dir = await mkdtemp(join(tmpdir(), "rushqa-"));
  const out = join(dir, "f.png");
  try {
    await run(ff, [
      "-hide_banner", "-loglevel", "error",
      "-ss", String(atSeconds), "-i", file,
      "-frames:v", "1", "-vf", "scale=64:64,format=gray",
      "-f", "image2", "-y", out,
    ]);
    const { pixels } = decodeGrayPNG(await readFile(out));
    if (!pixels.length) return { ok: false, why: "image non extraite" };
    let sum = 0;
    for (const v of pixels) sum += v;
    const moy = sum / pixels.length;
    let vari = 0;
    for (const v of pixels) vari += (v - moy) ** 2;
    const ecart = Math.sqrt(vari / pixels.length);

    // Part du cadre occupée par une seule valeur : détecte le remplissage.
    const hist = new Map();
    for (const v of pixels) hist.set(v, (hist.get(v) || 0) + 1);
    let dominante = 0;
    for (const n of hist.values()) if (n > dominante) dominante = n;
    const partDominante = dominante / pixels.length;

    return {
      ok: moy >= IMAGE.luminanceMin && ecart >= IMAGE.ecartTypeMin && partDominante <= IMAGE.dominanteMax,
      luminance: Math.round(moy * 10) / 10,
      ecartType: Math.round(ecart * 10) / 10,
      dominante: Math.round(partDominante * 100),
      why: moy < IMAGE.luminanceMin ? "image noire"
         : ecart < IMAGE.ecartTypeMin ? "image uniforme (rien à l'écran ?)"
         : partDominante > IMAGE.dominanteMax
           ? `${Math.round(partDominante * 100)} % du cadre sur une seule valeur — l'application ne remplit pas l'image`
           : null,
    };
  } catch (e) {
    return { ok: false, why: "extraction impossible : " + (e.stderr || e.message).slice(0, 90) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function qa() {
  const relevePath = join(RUSH_DIR, "production.json");
  if (!existsSync(relevePath)) throw new Error(`relevé absent : ${relevePath} — lancer content/produce.mjs d'abord`);
  const releve = JSON.parse(await readFile(relevePath, "utf8"));
  const ff = await ffmpegPath();
  if (!ff) throw new Error("ffmpeg introuvable (attendu sous /opt/pw-browsers/ffmpeg-*)");

  const rapport = [];
  for (const v of releve) {
    const plans = [];
    for (const s of v.shots) {
      const item = { plan: s.name, controles: [], ok: true };
      const echec = (nom, why, info = {}) => { item.controles.push({ nom, ok: false, why, ...info }); item.ok = false; };
      const reussi = (nom, info = {}) => item.controles.push({ nom, ok: true, ...info });

      if (!s.ok || !s.file) { echec("fichier", s.why || "plan non tourné"); plans.push(item); continue; }
      if (!existsSync(s.file)) { echec("fichier", "absent du disque"); plans.push(item); continue; }

      const st = await stat(s.file);
      if (st.size < 2048) echec("fichier", `trop petit (${st.size} octets)`);
      else reussi("fichier", { octets: st.size });

      const p = await probe(ff, s.file);
      if (p.width !== SHOT_SIZE.width || p.height !== SHOT_SIZE.height) {
        echec("format", `attendu ${SHOT_SIZE.width}×${SHOT_SIZE.height}, obtenu ${p.width}×${p.height}`);
      } else reussi("format", { resolution: `${p.width}×${p.height}` });

      const ratio = p.width && p.height ? p.width / p.height : 0;
      if (Math.abs(ratio - 9 / 16) > 0.001) echec("ratio", `attendu 9:16, obtenu ${ratio.toFixed(4)}`);
      else reussi("ratio", { ratio: "9:16" });

      if (p.seconds === null) echec("durée", "illisible");
      else if (p.seconds < DUREE.min || p.seconds > DUREE.max) {
        echec("durée", `${p.seconds.toFixed(2)}s hors fourchette ${DUREE.min}–${DUREE.max}s`, { secondes: p.seconds });
      } else reussi("durée", { secondes: Math.round(p.seconds * 100) / 100 });

      if (p.seconds) {
        const f = await frameStats(ff, s.file, Math.max(0.3, p.seconds * 0.6));
        if (!f.ok) echec("image", f.why, f);
        else reussi("image", { luminance: f.luminance, ecartType: f.ecartType, dominante: f.dominante });
      }

      if (s.errors && s.errors.length) echec("console", `${s.errors.length} erreur(s)`, { detail: s.errors.slice(0, 3) });
      else reussi("console");

      plans.push(item);
    }

    const cadrage = (v.framing || []).map(f => ({
      plan: f.plan, ok: !!f.ok, why: f.why || null,
      texteRush: f.texteRush ?? null, bande: `${f.top}→${f.bottom}`,
    }));

    rapport.push({
      id: v.id, label: v.label, dir: v.dir,
      plans, cadrage,
      ok: plans.every(p => p.ok) && cadrage.every(c => c.ok),
    });
  }
  return rapport;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rapport = await qa();
  if (AS_JSON) { console.log(JSON.stringify(rapport, null, 2)); }
  else {
    let ko = 0;
    for (const v of rapport) {
      console.log(`\n${v.ok ? "✓" : "✗"}  ${v.id} — ${v.label}`);
      console.log(`   ${relative(ROOT, v.dir)}`);
      for (const p of v.plans) {
        const bad = p.controles.filter(c => !c.ok);
        const info = p.controles.find(c => c.nom === "durée" && c.ok);
        const img = p.controles.find(c => c.nom === "image" && c.ok);
        console.log(`   ${p.ok ? "·" : "✗"} ${p.plan.padEnd(22)}` +
          (info ? ` ${String(info.secondes).padStart(5)}s` : "        ") +
          (img ? `  lum ${String(img.luminance).padStart(5)}  écart ${String(img.ecartType).padStart(4)}  remplissage ${String(100 - img.dominante).padStart(3)}%` : ""));
        for (const c of bad) { console.log(`       ✗ ${c.nom} : ${c.why}`); ko++; }
      }
      for (const c of v.cadrage) if (!c.ok) { console.log(`       ⚠ cadrage ${c.plan} : ${c.why}`); ko++; }
    }
    console.log(`\n${rapport.length} vidéo(s), ${rapport.reduce((n, v) => n + v.plans.length, 0)} plans, ${ko} anomalie(s).`);
    if (ko) process.exitCode = 1;
  }
}
