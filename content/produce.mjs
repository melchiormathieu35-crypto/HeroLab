/**
 * Producteur de rushes — exécuteur de blueprint.
 *
 * Ce module ne décide plus de la narration : il exécute le plan de tournage que
 * `blueprint.mjs` produit. C'est ce qui rend la chaîne extensible — changer la
 * structure d'une vidéo ne demande pas de toucher au rendu.
 *
 * RENDU IMAGE PAR IMAGE. L'enregistrement vidéo de Playwright a été écarté
 * après mesure : il ne sait que réduire une page pour l'ajuster au cadre, jamais
 * l'agrandir, si bien qu'un viewport mobile n'occupait qu'un tiers d'un cadre
 * 1080×1920 — 85 % de gris de remplissage. Chaque image est donc un état de
 * caméra explicite, capturé à densité 3 (1080×1920 natifs) puis poussé dans
 * ffmpeg. Conséquences : résolution réelle, durée exacte, plan reproductible.
 *
 * Les plans fixes ne sont capturés qu'une fois et l'image est répétée dans le
 * flux : plus rapide, et parfaitement stable à l'écran.
 *
 * Un plan = un fichier. Aucun montage n'est fait ici, et ni voix, ni
 * sous-titres, ni texte définitif ne sont incrustés.
 */
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openShot, loadSpot, setCamera, currentScroll,
  scrollTargetFor, zoomOriginFor, checkFraming,
} from "./studio.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Destination imposée pour tout rush de format court. */
export const RUSH_DIR = join(ROOT, "Format court", "Rush avant montage");
/** Cadence de sortie. */
export const FPS = 30;

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
 * Écrit un plan : reçoit des images JPEG, produit un WebM VP8 1080×1920.
 *
 * ffmpeg est compilé `--disable-everything` : en entrée seul `image2pipe`
 * existe, et le codec doit être nommé explicitement — sinon le flux n'est pas
 * reconnu et le processus meurt sur un tube rompu.
 */
class Encodeur {
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

const grab = (page) => page.screenshot({ type: "jpeg", quality: 92 });
const images = (sec) => Math.max(1, Math.round(sec * FPS));

/** Joue une option en prenant les montants exacts du moteur. */
async function jouerOption(page, quoi) {
  return page.evaluate((quoi) => {
    const t = App.t;
    const opts = Spot.options(t);
    const a0 = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    const tries = a0.options;
    const instinct = t.toCall(t.hero) > 0 ? "call" : "check";
    const pick = quoi === "best"
      ? tries[0]
      : tries.find(o => o.action === instinct) || tries[tries.length - 1];
    App.choose(pick.action, pick.amount);
    const a = App.analysis;
    return {
      joue: { action: pick.action, label: pick.label || pick.action, evBB: Number(pick.evBB.toFixed(2)) },
      instinct,
      verdict: a.verdict,
      lossBB: Number(a.lossBB.toFixed(2)),
      equity: Number((a.equity * 100).toFixed(1)),
      pot: a.pot, toCall: a.toCall,
      options: a.options.map(o => ({ label: o.label || o.action, action: o.action, evBB: Number(o.evBB.toFixed(2)) })),
      meilleure: { action: a.best.action, label: a.best.label || a.best.action, evBB: Number(a.best.evBB.toFixed(2)) },
    };
  }, quoi);
}

/**
 * Exécute un mouvement de blueprint. Retourne l'état moteur si le mouvement en
 * a produit un.
 */
async function executer(page, enc, m, etat) {
  switch (m.type) {
    case "cadre": {
      const y = await scrollTargetFor(page, m.cible, { at: m.at ?? 0.34, align: m.align || "center" });
      if (y === null) throw new Error(`cible introuvable : ${m.cible}`);
      await setCamera(page, { scrollY: y, scale: etat.scale, origin: etat.origin });
      etat.scrollY = y;
      return null;
    }
    case "fixe":
    case "freeze": {
      await enc.push(await grab(page), images(m.duree));
      return null;
    }
    case "zoomIn":
    case "zoomOut": {
      const origin = await zoomOriginFor(page, m.cible);
      if (!origin) throw new Error(`cible de zoom introuvable : ${m.cible}`);

      // Garde de rognage. Agrandir une cible plus large que le cadre la coupe
      // forcément : les blocs pleine largeur de Hero Lab font 332 px pour un
      // cadre de 360, soit un zoom maximal de 1,02. Un premier jet zoomait à
      // 1,45 sur l'un d'eux et tronquait montants et libellés aux deux bords.
      // On borne donc l'agrandissement à ce que la cible supporte, et on le
      // signale plutôt que de le corriger en silence.
      const dim = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        return { w: r.width, vw: innerWidth };
      }, m.cible);
      const plafond = dim.w > 0 ? (dim.vw * 0.96) / dim.w : Infinity;
      const vise = Math.max(1, Math.min(m.a, plafond));
      if (vise < m.a - 0.005) etat.bornages.push({ cible: m.cible, demande: m.a, applique: Number(vise.toFixed(2)) });

      const n = images(m.duree);
      for (let i = 1; i <= n; i++) {
        const s = m.de + (vise - m.de) * ease(i / n);
        await setCamera(page, { scrollY: etat.scrollY, scale: s, origin });
        await enc.push(await grab(page));
      }
      etat.scale = vise;
      etat.origin = origin;
      return null;
    }
    case "pan": {
      const from = await currentScroll(page);
      const to = await scrollTargetFor(page, m.cible, { at: m.at ?? 0.34, align: m.align || "center" });
      if (to === null) throw new Error(`cible de panoramique introuvable : ${m.cible}`);
      const n = images(m.duree);
      for (let i = 1; i <= n; i++) {
        await setCamera(page, { scrollY: Math.round(from + (to - from) * ease(i / n)), scale: etat.scale, origin: etat.origin });
        await enc.push(await grab(page));
      }
      etat.scrollY = to;
      return null;
    }
    case "panPx": {
      // Distance mesurée entre la première et la dernière occurrence d'un
      // sélecteur. `:last-of-type` ne conviendrait pas : il porte sur le type
      // d'élément, or les lignes d'espérance ne sont pas les derniers enfants
      // de leur bloc.
      const delta = await page.evaluate((sel) => {
        const els = [...document.querySelectorAll(sel)];
        if (els.length < 2) return 0;
        return Math.round(els[els.length - 1].getBoundingClientRect().bottom - els[0].getBoundingClientRect().bottom);
      }, m.mesure);
      const from = await currentScroll(page);
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const to = Math.max(0, Math.min(max, from + delta));
      const n = images(m.duree);
      for (let i = 1; i <= n; i++) {
        await setCamera(page, { scrollY: Math.round(from + (to - from) * ease(i / n)), scale: etat.scale, origin: etat.origin });
        await enc.push(await grab(page));
      }
      etat.scrollY = to;
      return null;
    }
    case "controle": {
      // Le cadrage se vérifie au moment où la cible doit être lisible, pas à la
      // fin du plan : un plan qui finit sur un zoom ou qui descend volontairement
      // une liste aurait échoué alors que l'image était juste.
      const c = await checkFraming(page, m.cible, { key: m.texte || null, scale: etat.scale || 1 });
      etat.cadrages.push({ cible: m.cible, ...c });
      return null;
    }
    case "jouer": {
      const r = await jouerOption(page, m.quoi === "best" ? "best" : "instinct");
      etat.scale = 1; etat.origin = null;   // l'écran a changé, la caméra repart à plat
      return r;
    }
    default:
      throw new Error(`mouvement inconnu : ${m.type}`);
  }
}

/**
 * Tourne un plan complet, dans sa propre page : un plan raté n'entraîne pas les
 * autres, et chaque fichier commence exactement où il doit commencer.
 */
async function tournerPlan(browser, ff, spot, plan, dossier) {
  const { ctx, page, errors } = await openShot(browser);
  const fichier = join(dossier, `${plan.fichier}.webm`);
  const enc = new Encodeur(ff, fichier);
  const etat = { scrollY: 0, scale: 1, origin: null, cadrages: [], bornages: [] };
  let echec = null, moteur = null, cadrage = null;

  try {
    const built = await loadSpot(page, spot.spec);
    if (!built.ok) throw new Error(built.err);
    // Un plan ne doit jamais toucher la vraie progression : Studio joue en
    // fantôme. Vérifié à chaque prise plutôt que supposé.
    if (!built.ghost) throw new Error("spot non fantôme");

    for (const m of plan.mouvements) {
      const r = await executer(page, enc, m, etat);
      if (r) moteur = r;
    }

    // Un plan peut poser plusieurs points de contrôle ; le plan échoue si l'un
    // d'eux échoue, et on rapporte le premier fautif.
    if (etat.cadrages.length) {
      cadrage = etat.cadrages.find(c => !c.ok) || etat.cadrages[0];
    } else if (plan.controle) {
      cadrage = await checkFraming(page, plan.controle.cible, {
        key: plan.controle.texte || null,
        scale: plan.controle.echelle || 1,
      });
    }
  } catch (e) { echec = e.message; }

  const fin = await enc.close();
  await ctx.close();

  const fatals = errors.filter(e => !/favicon|net::ERR_FILE_NOT_FOUND/i.test(e));
  if (echec) return { plan: plan.fichier, beat: plan.beat, ok: false, why: echec };
  if (fin.code !== 0) return { plan: plan.fichier, beat: plan.beat, ok: false, why: `ffmpeg a échoué : ${fin.err.slice(0, 140)}` };

  return {
    plan: plan.fichier, beat: plan.beat, ok: true, fichier,
    frames: fin.frames, seconds: Math.round(fin.seconds * 100) / 100,
    role: plan.role,
    mouvements: plan.mouvements.map(m => ({ type: m.type, cible: m.cible || m.mesure || null, duree: m.duree ?? null, pourquoi: m.pourquoi || null })),
    cadrage, cadrages: etat.cadrages, bornages: etat.bornages, moteur, errors: fatals,
  };
}

/**
 * Produit une vidéo complète à partir de son blueprint.
 * `dossier` est le dossier « Video NNN » de destination.
 */
export async function produireVideo(browser, ff, spot, bp, dossier) {
  await mkdir(dossier, { recursive: true });
  const plans = [];
  let moteur = null;

  for (const plan of bp.plans) {
    const r = await tournerPlan(browser, ff, spot, plan, dossier);
    if (r.moteur) moteur = r.moteur;
    plans.push(r);
  }

  const manifest = {
    video: bp.titre,
    titreInterne: bp.titreInterne,
    concept: bp.concept,
    spot: { id: spot.id, modele: spot.modele, theme: spot.theme, label: spot.label, spec: spot.spec },
    score: bp.score,
    scoreDetail: spot.details || null,
    signature: bp.signature,
    momentReveal: bp.momentReveal,
    objectifRetention: bp.objectifRetention,
    format: { largeur: 1080, hauteur: 1920, fps: FPS, conteneur: "webm", codec: "vp8" },
    moteur,
    plans: plans.map(p => ({
      fichier: p.ok ? `${p.plan}.webm` : null,
      beat: p.beat, ok: p.ok, why: p.why || null,
      secondes: p.seconds ?? null, images: p.frames ?? null,
      role: p.role || null,
      mouvements: p.mouvements || [],
      cadrage: p.cadrage || null,
      bornages: p.bornages || [],
      erreurs: p.errors || [],
    })),
  };
  await writeFile(join(dossier, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { spot, bp, plans, moteur, dossier, manifest };
}
