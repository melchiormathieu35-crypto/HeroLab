/**
 * Producteur de rushes verticaux pour le format court.
 *
 * Principe : un plan = un fichier. Rien n'est monté ici, rien n'est enchaîné.
 * Le montage final, la voix, les sous-titres et le texte à l'écran ne sont pas
 * du ressort de ce script — il livre de la matière propre, cadrée et vérifiée.
 *
 * RENDU IMAGE PAR IMAGE. L'enregistrement vidéo de Playwright a été écarté
 * après mesure : il ne sait que réduire une page pour l'ajuster au cadre,
 * jamais l'agrandir, si bien qu'un viewport mobile n'occupait qu'un tiers d'un
 * cadre 1080×1920 — 85 % de gris de remplissage. Ici chaque image est un état
 * de caméra explicite, capturé à densité 3 (donc 1080×1920 natifs) puis poussé
 * dans ffmpeg. Conséquences : résolution réelle, durée exacte, et un plan
 * strictement reproductible.
 *
 * Les plans fixes ne sont capturés qu'une fois et l'image est répétée dans le
 * flux : c'est plus rapide, et surtout parfaitement stable à l'écran.
 *
 * Structure narrative appliquée à chaque spot :
 *
 *   1  ACCROCHE   la main du héros, serrée. Aucune information de contexte.
 *                 On montre le problème avant de l'expliquer.
 *   2  SITUATION  la table entière, fixe, assez longtemps pour être lue.
 *   3  CHOIX      les options réelles du moteur, avec leurs montants.
 *                 Le spectateur décide ici. Le verdict n'est pas encore joué.
 *   4  VERDICT    la décision est jouée, le moteur tranche, le coût s'affiche.
 *   5  PREUVE     l'espérance de chaque option, en big blinds.
 *
 * Les plans 2 et 4 sont tournés en deux cadrages, livrés séparément : au
 * montage on garde celui qui tient le rythme.
 *
 * Usage :
 *   node content/produce.mjs --spot turn_draw_price
 *   node content/produce.mjs --serie tu-fais-quoi --top 3
 */
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  launch, openShot, loadSpot, frameTo, setCamera, currentScroll,
  scrollTargetFor, zoomOriginFor, checkFraming,
  ANCHORS,
} from "./studio.mjs";
import { SPOTS, SERIES } from "./spots.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Destination imposée pour tout rush de format court. */
export const RUSH_DIR = join(ROOT, "Format court", "Rush avant montage");
/** Cadence de sortie. 30 images/s : fluide sans alourdir les fichiers. */
export const FPS = 30;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/** ffmpeg est fourni par Playwright ; sa version varie selon l'image système. */
export async function ffmpegPath() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) throw new Error("ffmpeg introuvable : /opt/pw-browsers absent");
  const dirs = (await readdir(base)).filter(d => d.startsWith("ffmpeg-")).sort().reverse();
  for (const d of dirs) {
    const p = join(base, d, "ffmpeg-linux");
    if (existsSync(p)) return p;
  }
  throw new Error("ffmpeg introuvable sous /opt/pw-browsers");
}

/** Adoucissement : départ et arrivée posés, milieu rapide. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Écrit un plan. Reçoit des images JPEG et produit un WebM VP8 1080×1920.
 *
 * ffmpeg est ici compilé `--disable-everything` : en entrée seul `image2pipe`
 * existe, et le codec d'entrée doit être nommé explicitement — sinon le flux
 * n'est pas reconnu et le processus meurt sur un tube rompu.
 */
class Plan {
  constructor(ff, file) {
    this.file = file;
    this.frames = 0;
    this.proc = spawn(ff, [
      "-hide_banner", "-loglevel", "error",
      "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
      "-c:v", "libvpx", "-b:v", "6M", "-pix_fmt", "yuv420p",
      "-y", file,
    ]);
    this.err = "";
    this.proc.stderr.on("data", d => { this.err += d; });
    this.dead = new Promise(r => this.proc.on("close", r));
    this.proc.stdin.on("error", () => { /* rapporté à la fermeture */ });
  }
  async push(buf, times = 1) {
    for (let i = 0; i < times; i++) {
      this.frames++;
      if (!this.proc.stdin.write(buf)) await new Promise(r => this.proc.stdin.once("drain", r));
    }
  }
  async close() {
    this.proc.stdin.end();
    const code = await this.dead;
    return { code, err: this.err.trim(), frames: this.frames, seconds: this.frames / FPS };
  }
}

/** Capture une image en résolution native. */
const grab = (page) => page.screenshot({ type: "jpeg", quality: 92 });

/**
 * Plan fixe : une seule capture, répétée. Rien ne bouge, donc rien à
 * recapturer — et l'image est rigoureusement identique d'un bout à l'autre.
 */
async function still(page, plan, seconds) {
  await plan.push(await grab(page), Math.max(1, Math.round(seconds * FPS)));
}

/** Panoramique vertical vers un élément, image par image. */
async function panTo(page, plan, selector, seconds, { at = 0.34, align = "center" } = {}) {
  const from = await currentScroll(page);
  const to = await scrollTargetFor(page, selector, { at, align });
  if (to === null) throw new Error("cible de panoramique introuvable : " + selector);
  const n = Math.max(1, Math.round(seconds * FPS));
  for (let i = 1; i <= n; i++) {
    await setCamera(page, { scrollY: Math.round(from + (to - from) * ease(i / n)) });
    await plan.push(await grab(page));
  }
  return to;
}

/**
 * Panoramique d'une distance donnée. Utile quand la cible n'est pas isolable
 * par un sélecteur simple : `:last-of-type` porte sur le type d'élément et non
 * sur la classe, et les lignes d'espérance ne sont pas les derniers enfants de
 * leur bloc. On mesure alors la distance à parcourir et on la parcourt.
 */
async function panBy(page, plan, delta, seconds) {
  const from = await currentScroll(page);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const to = Math.max(0, Math.min(max, from + delta));
  const n = Math.max(1, Math.round(seconds * FPS));
  for (let i = 1; i <= n; i++) {
    await setCamera(page, { scrollY: Math.round(from + (to - from) * ease(i / n)) });
    await plan.push(await grab(page));
  }
}

/** Distance entre la première et la dernière occurrence d'un sélecteur. */
function spanOf(page, selector) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    if (els.length < 2) return 0;
    const a = els[0].getBoundingClientRect(), b = els[els.length - 1].getBoundingClientRect();
    return Math.round(b.bottom - a.bottom);
  }, selector);
}

/**
 * Rapprochement progressif sur un élément. L'origine est fixée au centre de la
 * cible au premier instant, donc la cible reste immobile pendant que le reste
 * s'écarte — c'est ce qui rend le mouvement lisible plutôt que flottant.
 */
async function zoomOn(page, plan, selector, seconds, { from = 1, to = 1.3 } = {}) {
  const origin = await zoomOriginFor(page, selector);
  if (!origin) throw new Error("cible de zoom introuvable : " + selector);
  const y = await currentScroll(page);
  const n = Math.max(1, Math.round(seconds * FPS));
  for (let i = 1; i <= n; i++) {
    await setCamera(page, { scrollY: y, scale: from + (to - from) * ease(i / n), origin });
    await plan.push(await grab(page));
  }
}

/** Joue une option en prenant les montants exacts du moteur. */
async function playOption(page, which) {
  return page.evaluate((which) => {
    const t = App.t;
    const opts = Spot.options(t);
    const a0 = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    const sorted = a0.options;                       // déjà trié par EV
    const intuitive = t.toCall(t.hero) > 0 ? "call" : "check";
    const pick = which === "best"
      ? sorted[0]
      : sorted.find(o => o.action === intuitive) || sorted[sorted.length - 1];
    App.choose(pick.action, pick.amount);
    const a = App.analysis;
    return {
      joue: { action: pick.action, label: pick.label || pick.action, evBB: Number(pick.evBB.toFixed(2)) },
      instinctive: intuitive,
      verdict: a.verdict,
      lossBB: Number(a.lossBB.toFixed(2)),
      equity: Number((a.equity * 100).toFixed(1)),
      options: a.options.map(o => ({
        label: o.label || o.action, action: o.action, evBB: Number(o.evBB.toFixed(2)),
      })),
      meilleure: { action: a.best.action, label: a.best.label || a.best.action, evBB: Number(a.best.evBB.toFixed(2)) },
    };
  }, which);
}

/**
 * Produit tous les plans d'un spot. Chaque plan repart d'une page neuve, donc
 * un plan raté n'entraîne pas les autres.
 */
export async function produceSpot(browser, ff, spot, outDir) {
  await mkdir(outDir, { recursive: true });
  const shots = [];
  const framing = [];
  let engine = null;

  /** Tourne un plan complet et referme proprement, même en cas d'erreur. */
  const tourner = async (name, corps) => {
    const { ctx, page, errors } = await openShot(browser);
    const file = join(outDir, `${name}.webm`);
    const plan = new Plan(ff, file);
    let echec = null, retour = null;
    try {
      const built = await loadSpot(page, spot.spec);
      if (!built.ok) throw new Error(built.err);
      // Un plan ne doit jamais toucher la vraie progression : Studio joue en
      // fantôme. On le vérifie à chaque prise plutôt que de le supposer.
      if (!built.ghost) throw new Error("spot non fantôme");
      retour = await corps(page, plan);
    } catch (e) { echec = e.message; }
    const fin = await plan.close();
    await ctx.close();

    const fatals = errors.filter(e => !/favicon|net::ERR_FILE_NOT_FOUND/i.test(e));
    if (echec) return { name, ok: false, why: echec };
    if (fin.code !== 0) return { name, ok: false, why: `ffmpeg a échoué : ${fin.err.slice(0, 140)}` };
    return {
      name, ok: true, file,
      frames: fin.frames, seconds: Math.round(fin.seconds * 100) / 100,
      errors: fatals, ...(retour || {}),
    };
  };

  /** Contrôle de cadrage : `key` désigne le texte qui doit être lisible. */
  const control = async (page, sel, label, key = null, scale = 1) => {
    const c = await checkFraming(page, sel, { key, scale });
    framing.push({ plan: label, cible: sel, ...c });
    return c;
  };

  // ── 1. ACCROCHE — la main, serrée. Rien d'autre.
  shots.push(await tourner("01-accroche-main", async (page, plan) => {
    await frameTo(page, ANCHORS.hand, { at: 0.42 });
    await control(page, ANCHORS.hand, "01-accroche-main", ".cards", 1.45);
    await still(page, plan, 0.5);
    await zoomOn(page, plan, ANCHORS.hand, 0.8, { from: 1, to: 1.45 });
    await still(page, plan, 1.6);
  }));

  // ── 2. SITUATION — table entière, fixe. Le spectateur doit pouvoir lire.
  shots.push(await tourner("02-situation-large", async (page, plan) => {
    await frameTo(page, ANCHORS.table, { at: 0.22, align: "top" });
    await control(page, ANCHORS.table, "02-situation-large", ".pot");
    await still(page, plan, 3.4);
  }));

  // ── 2b. Même temps narratif, resserré sur le board. Variante de montage.
  shots.push(await tourner("02b-situation-serree", async (page, plan) => {
    await frameTo(page, ANCHORS.table, { at: 0.22, align: "top" });
    await control(page, ".center", "02b-situation-serree", ".pot", 1.35);
    await still(page, plan, 0.4);
    await zoomOn(page, plan, ".center", 0.85, { from: 1, to: 1.35 });
    await still(page, plan, 2.0);
  }));

  // ── 3. CHOIX — les options réelles, avec leurs montants. Le mouvement va de
  // la table vers les boutons : c'est le regard du joueur qui descend décider.
  shots.push(await tourner("03-choix", async (page, plan) => {
    await frameTo(page, ANCHORS.table, { at: 0.22, align: "top" });
    await still(page, plan, 0.8);
    await panTo(page, plan, ".actions", 0.9, { at: 0.16, align: "top" });
    await control(page, ".actions", "03-choix", ".a-n");
    await still(page, plan, 2.6);
  }));

  // ── 4. VERDICT — on joue l'action instinctive : c'est elle qui porte la
  // leçon. Le moteur tranche, le coût s'affiche.
  shots.push(await tourner("04-verdict", async (page, plan) => {
    await frameTo(page, ANCHORS.table, { at: 0.22, align: "top" });
    await still(page, plan, 0.7);
    const r = await playOption(page, "intuitive");
    engine = r;
    await still(page, plan, 0.4);
    // Le bloc verdict fait presque exactement la hauteur de la bande utile :
    // il faut le caler tout en haut de celle-ci pour qu'il y tienne.
    await panTo(page, plan, ANCHORS.verdict, 0.9, { at: 0.10, align: "top" });
    await control(page, ANCHORS.verdict, "04-verdict", ".cost");
    await still(page, plan, 3.0);
    return { engine: r };
  }));

  // ── 4b. Variante serrée sur le verdict seul, pour un cut plus sec.
  shots.push(await tourner("04b-verdict-serre", async (page, plan) => {
    const r = await playOption(page, "intuitive");
    if (!engine) engine = r;
    await frameTo(page, ".vh", { at: 0.38, align: "top" });
    await control(page, ".vh", "04b-verdict-serre", ".cost", 1.3);
    await still(page, plan, 0.4);
    await zoomOn(page, plan, ".vh", 0.7, { from: 1, to: 1.3 });
    await still(page, plan, 2.3);
    return { engine: r };
  }));

  // ── 5. PREUVE — l'espérance de chaque option. C'est le plan qui rend le
  // propos vérifiable : les chiffres sont à l'écran, calculés par le moteur.
  shots.push(await tourner("05-preuve-ev", async (page, plan) => {
    const r = await playOption(page, "intuitive");
    if (!engine) engine = r;
    await frameTo(page, ANCHORS.evList, { at: 0.26, align: "top" });
    await control(page, ANCHORS.evList, "05-preuve-ev", ".ev");
    await still(page, plan, 1.6);
    // Descente lente le long des options : le regard suit la liste jusqu'à la
    // pire, celle qui chiffre l'erreur.
    await panBy(page, plan, await spanOf(page, ".opt-row"), 1.4);
    await still(page, plan, 1.6);
    return { engine: r };
  }));

  return { spot, shots, framing, engine, dir: outDir };
}

/** Choisit les spots d'une série, classés par le scanner. */
async function pickSpots(serieKey, top) {
  const serie = SERIES[serieKey];
  if (!serie) throw new Error(`série inconnue : ${serieKey}`);
  const { scan } = await import("./scan.mjs");
  const { results } = await scan();
  const kept = results.filter(r => !r.error && serie.themes.includes(r.theme)).slice(0, top);
  return { serie, kept };
}

// ── Entrée en ligne de commande
if (import.meta.url === `file://${process.argv[1]}`) {
  const spotId = arg("--spot", null);
  const serieKey = arg("--serie", null);
  const top = Number(arg("--top", "3"));

  const ff = await ffmpegPath();
  const browser = await launch();
  const produced = [];

  const un = async (spot, dir, extra = {}) => {
    process.stdout.write(`  ▶ ${spot.id.padEnd(24)}`);
    const t0 = Date.now();
    const p = await produceSpot(browser, ff, spot, dir);
    Object.assign(p, extra);
    const ok = p.shots.filter(s => s.ok).length;
    const dur = p.shots.filter(s => s.ok).reduce((n, s) => n + s.seconds, 0);
    console.log(` ${ok}/${p.shots.length} plans · ${dur.toFixed(1)}s de rush · tourné en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    produced.push(p);
  };

  if (spotId) {
    const spot = SPOTS.find(s => s.id === spotId);
    if (!spot) { console.error(`spot inconnu : ${spotId}`); process.exit(1); }
    console.log(`\n▶ ${spot.label}`);
    await un(spot, join(RUSH_DIR, spot.id));
  } else if (serieKey) {
    const { serie, kept } = await pickSpots(serieKey, top);
    console.log(`\n▶ série « ${serie.title} » — ${kept.length} spots retenus par le moteur\n`);
    for (const r of kept) {
      const spot = SPOTS.find(s => s.id === r.id);
      await un(spot, join(RUSH_DIR, serieKey, spot.id), { scan: r, serie: serieKey });
    }
  } else {
    console.error("préciser --spot <id> ou --serie <clé>");
    process.exit(1);
  }

  await browser.close();

  for (const p of produced) {
    for (const s of p.shots) if (!s.ok) console.log(`     ✗ ${s.name} : ${s.why}`);
    for (const f of p.framing) if (!f.ok) console.log(`     ⚠ cadrage ${f.plan} : ${f.why} (${f.top}→${f.bottom}, ${f.texteRush}px rush)`);
  }

  // Relevé machine, consommé par qa.mjs et par la génération des README.
  await mkdir(RUSH_DIR, { recursive: true });
  const relevePath = join(RUSH_DIR, "production.json");
  await writeFile(relevePath, JSON.stringify(produced.map(p => ({
    id: p.spot.id, label: p.spot.label, theme: p.spot.theme, serie: p.serie || null,
    dir: p.dir, spec: p.spot.spec, engine: p.engine, scan: p.scan || null,
    shots: p.shots.map(s => ({
      name: s.name, ok: s.ok, why: s.why || null, file: s.file || null,
      frames: s.frames ?? null, seconds: s.seconds ?? null, errors: s.errors || [],
    })),
    framing: p.framing,
  })), null, 2));
  console.log(`\nRelevé de production : ${relevePath}`);
}
