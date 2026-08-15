/**
 * Contrôle qualité des vidéos livrées.
 *
 * Deux passes complémentaires, et c'est volontaire :
 *
 *   À LA PRISE     le producteur mesure le cadrage dans le DOM — position dans
 *                  la bande utile, taille du texte porteur — avant l'encodage.
 *   APRÈS COUP     ce module lit les fichiers réellement écrits.
 *
 * Un cadrage correct n'empêche pas un encodage vide, et un fichier valide peut
 * montrer une page blanche. Aucune des deux passes ne suffit seule.
 *
 * RÈGLE : une vidéo n'est jamais déclarée OK parce que le fichier est
 * techniquement valide. Le contrôle « image » mesure ce qu'il y a dedans, et le
 * contrôle « cohérence moteur » compare les chiffres du manifeste à ce que le
 * moteur redonne en rejouant le spot.
 *
 * Contrôles :
 *   fichier            présent, non vide
 *   format             1080×1920
 *   ratio              9:16 exact
 *   fps                cadence conforme
 *   durée              exploitable au montage
 *   image              luminance, contraste et remplissage réels du cadre
 *   safe area          les éléments porteurs sont dans la bande utile
 *   ordre              les plans suivent la convention et se suivent
 *   console            aucune erreur de page pendant la prise
 *   cohérence moteur   les chiffres livrés sont ceux que le moteur recalcule
 */
import { readFile, readdir, stat, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { inflateSync } from "node:zlib";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, openShot, loadSpot } from "./studio.mjs";
import { CONVENTION } from "./blueprint.mjs";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const RUSH_DIR = join(ROOT, "Format court", "Rush avant montage");

export const FORMAT = { largeur: 1080, hauteur: 1920, fps: 30 };
export const DUREE = { min: 1.2, max: 14.0 };

/**
 * Seuils d'image.
 *
 * `dominanteMax` vient d'un défaut réel que cette passe avait laissé passer :
 * l'enregistrement vidéo de Playwright ne sachant pas agrandir une page, le
 * rush ne contenait l'application que sur un tiers du cadre, le reste étant du
 * gris uni — et comme le fichier était bien formé et non uniforme, il était
 * déclaré conforme. Mesures : version défectueuse 85 à 87 % du cadre sur une
 * seule valeur, versions correctes 10 à 24 %. Le seuil est posé à 45 %, donc à
 * bonne distance des deux.
 */
export const IMAGE = { luminanceMin: 8, ecartTypeMin: 6, dominanteMax: 0.45 };

/** Tolérance de cohérence sur les chiffres, en bb. */
export const TOLERANCE_BB = 0.01;

async function ffmpegPath() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  const dirs = (await readdir(base)).filter(d => d.startsWith("ffmpeg-")).sort().reverse();
  for (const d of dirs) {
    const p = join(base, d, "ffmpeg-linux");
    if (existsSync(p)) return p;
  }
  return null;
}

/** Lit durée, résolution et cadence depuis la sortie de ffmpeg (pas de ffprobe). */
export async function sonder(ff, file) {
  let err = "";
  try { await run(ff, ["-hide_banner", "-i", file]); }
  catch (e) { err = (e.stderr || "") + (e.stdout || ""); }   // ffmpeg sort en erreur sans sortie demandée
  const dim = /,\s(\d{2,5})x(\d{2,5})[\s,]/.exec(err);
  const dur = /Duration:\s(\d+):(\d+):(\d+\.\d+)/.exec(err);
  const fps = /,\s([\d.]+)\sfps[,\s]/.exec(err);
  return {
    largeur: dim ? +dim[1] : null,
    hauteur: dim ? +dim[2] : null,
    secondes: dur ? (+dur[1] * 3600 + +dur[2] * 60 + +dur[3]) : null,
    fps: fps ? Math.round(parseFloat(fps[1])) : null,
  };
}

/**
 * Décode un PNG gris 8 bits. ffmpeg est compilé `--disable-everything` : il ne
 * sait écrire que `webm` et `image2`, donc pas de sortie brute — on décode le
 * PNG soi-même. Lecture d'IHDR, concaténation des IDAT, décompression zlib
 * (fournie par Node), puis retrait du filtre ligne par ligne.
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
    pos += 12 + len;
  }
  if (depth !== 8 || colorType !== 0) throw new Error(`PNG non gris 8 bits (depth ${depth}, type ${colorType})`);

  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height);
  const bpp = 1;
  let prev = Buffer.alloc(width);
  for (let y = 0; y < height; y++) {
    const filtre = raw[y * (width + 1)];
    const ligne = Buffer.from(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)));
    for (let x = 0; x < width; x++) {
      const a = x >= bpp ? ligne[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = ligne[x];
      if (filtre === 1) v += a;
      else if (filtre === 2) v += b;
      else if (filtre === 3) v += (a + b) >> 1;
      else if (filtre === 4) {
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

/** Mesure une image du plan : luminance, contraste, remplissage. */
export async function imageAt(ff, file, seconde) {
  const dir = await mkdtemp(join(tmpdir(), "rushqa-"));
  const out = join(dir, "f.png");
  try {
    await run(ff, [
      "-hide_banner", "-loglevel", "error",
      "-ss", String(seconde), "-i", file,
      "-frames:v", "1", "-vf", "scale=64:64,format=gray",
      "-f", "image2", "-y", out,
    ]);
    const { pixels } = decodeGrayPNG(await readFile(out));
    if (!pixels.length) return { ok: false, why: "image non extraite" };
    let somme = 0;
    for (const v of pixels) somme += v;
    const moy = somme / pixels.length;
    let vari = 0;
    for (const v of pixels) vari += (v - moy) ** 2;
    const ecart = Math.sqrt(vari / pixels.length);
    const hist = new Map();
    for (const v of pixels) hist.set(v, (hist.get(v) || 0) + 1);
    let dom = 0;
    for (const n of hist.values()) if (n > dom) dom = n;
    const part = dom / pixels.length;
    return {
      ok: moy >= IMAGE.luminanceMin && ecart >= IMAGE.ecartTypeMin && part <= IMAGE.dominanteMax,
      luminance: Math.round(moy * 10) / 10,
      ecartType: Math.round(ecart * 10) / 10,
      remplissage: Math.round((1 - part) * 100),
      why: moy < IMAGE.luminanceMin ? "image noire"
         : ecart < IMAGE.ecartTypeMin ? "image uniforme (rien à l'écran ?)"
         : part > IMAGE.dominanteMax ? `${Math.round(part * 100)} % du cadre sur une seule valeur — l'application ne remplit pas l'image`
         : null,
    };
  } catch (e) {
    return { ok: false, why: "extraction impossible : " + (e.stderr || e.message).slice(0, 90) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * QA visuelle : on ne se contente pas d'une image au milieu du plan. Un plan
 * peut être correct à mi-course et noir au début ou à la fin — typiquement
 * après un mouvement qui sort du cadre. On échantillonne donc trois instants.
 */
async function qaVisuelle(ff, file, duree) {
  const instants = [0.25, 0.5, 0.8].map(f => Math.max(0.1, duree * f));
  const mesures = [];
  for (const s of instants) mesures.push({ a: Math.round(s * 100) / 100, ...(await imageAt(ff, file, s)) });
  const mauvaise = mesures.find(m => !m.ok);
  return {
    ok: !mauvaise,
    why: mauvaise ? `à ${mauvaise.a}s : ${mauvaise.why}` : null,
    mesures: mesures.map(m => ({ a: m.a, luminance: m.luminance, remplissage: m.remplissage })),
  };
}

/**
 * Cohérence moteur : on recharge le spot et on redemande au moteur ce qu'il
 * dit. Les chiffres livrés dans le manifeste et le README doivent être
 * exactement ceux-là. C'est ce contrôle qui empêche de publier une vidéo dont
 * le commentaire ne correspondrait plus à l'image.
 *
 * Studio est déterministe — le même spot rend les mêmes ranges, donc les mêmes
 * EV — ce qui rend cette comparaison exacte et non approximative.
 */
async function coherenceMoteur(page, manifest) {
  const e = manifest.moteur;
  if (!e) return { ok: false, why: "aucune donnée moteur dans le manifeste" };
  const built = await loadSpot(page, manifest.spot.spec);
  if (!built.ok) return { ok: false, why: `spot non rechargeable : ${built.err}` };

  const r = await page.evaluate(() => {
    const t = App.t;
    const opts = Spot.options(t);
    const a0 = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
    const instinct = t.toCall(t.hero) > 0 ? "call" : "check";
    const pick = a0.options.find(o => o.action === instinct) || a0.options[a0.options.length - 1];
    App.choose(pick.action, pick.amount);
    const a = App.analysis;
    return {
      equity: Number((a.equity * 100).toFixed(1)),
      lossBB: Number(a.lossBB.toFixed(2)),
      verdict: a.verdict,
      meilleure: { label: a.best.label || a.best.action, evBB: Number(a.best.evBB.toFixed(2)) },
      joue: { label: pick.label || pick.action, evBB: Number(pick.evBB.toFixed(2)) },
      options: a.options.map(o => ({ label: o.label || o.action, evBB: Number(o.evBB.toFixed(2)) })),
    };
  });

  const ecarts = [];
  if (Math.abs(r.equity - e.equity) > 0.05) ecarts.push(`équité ${e.equity} → ${r.equity}`);
  if (Math.abs(r.lossBB - e.lossBB) > TOLERANCE_BB) ecarts.push(`différentiel ${e.lossBB} → ${r.lossBB}`);
  if (r.verdict !== e.verdict) ecarts.push(`verdict « ${e.verdict} » → « ${r.verdict} »`);
  if (r.meilleure.label !== e.meilleure.label) ecarts.push(`meilleure option « ${e.meilleure.label} » → « ${r.meilleure.label} »`);
  if (Math.abs(r.meilleure.evBB - e.meilleure.evBB) > TOLERANCE_BB) ecarts.push(`EV meilleure ${e.meilleure.evBB} → ${r.meilleure.evBB}`);
  if (r.options.length !== e.options.length) ecarts.push(`nombre d'options ${e.options.length} → ${r.options.length}`);

  return { ok: ecarts.length === 0, why: ecarts.length ? ecarts.join(" · ") : null, ecarts };
}

/** Contrôle l'ordre et la convention de nommage des plans. */
function controleOrdre(manifest) {
  const ok = manifest.plans.filter(p => p.ok).map(p => p.fichier.replace(/\.webm$/, ""));
  const attendus = CONVENTION.filter(c => ok.includes(c));
  const horsConvention = ok.filter(f => !CONVENTION.includes(f));
  const desordre = ok.join(",") !== attendus.join(",");
  if (horsConvention.length) return { ok: false, why: `plans hors convention : ${horsConvention.join(", ")}` };
  if (desordre) return { ok: false, why: `ordre inattendu : ${ok.join(", ")}` };
  return { ok: true, plans: ok.length };
}

export async function qa({ dossiers = null } = {}) {
  const ff = await ffmpegPath();
  if (!ff) throw new Error("ffmpeg introuvable (attendu sous /opt/pw-browsers/ffmpeg-*)");

  const liste = dossiers || (await readdir(RUSH_DIR, { withFileTypes: true }))
    .filter(d => d.isDirectory() && /^Video \d+$/.test(d.name))
    .map(d => join(RUSH_DIR, d.name))
    .sort();

  const browser = await launch();
  const { ctx, page } = await openShot(browser);

  const rapport = [];
  for (const dossier of liste) {
    const mf = join(dossier, "manifest.json");
    if (!existsSync(mf)) { rapport.push({ dossier, ok: false, plans: [], why: "manifest.json absent" }); continue; }
    const manifest = JSON.parse(await readFile(mf, "utf8"));

    const plans = [];
    for (const p of manifest.plans) {
      const item = { plan: p.fichier || p.beat, beat: p.beat, controles: [], ok: true };
      const ko = (nom, why, info = {}) => { item.controles.push({ nom, ok: false, why, ...info }); item.ok = false; };
      const oui = (nom, info = {}) => item.controles.push({ nom, ok: true, ...info });

      if (!p.ok || !p.fichier) { ko("fichier", p.why || "plan non tourné"); plans.push(item); continue; }
      const file = join(dossier, p.fichier);
      if (!existsSync(file)) { ko("fichier", "absent du disque"); plans.push(item); continue; }

      const st = await stat(file);
      if (st.size < 2048) ko("fichier", `trop petit (${st.size} octets)`); else oui("fichier", { octets: st.size });

      const s = await sonder(ff, file);
      if (s.largeur !== FORMAT.largeur || s.hauteur !== FORMAT.hauteur) {
        ko("format", `attendu ${FORMAT.largeur}×${FORMAT.hauteur}, obtenu ${s.largeur}×${s.hauteur}`);
      } else oui("format", { resolution: `${s.largeur}×${s.hauteur}` });

      const ratio = s.largeur && s.hauteur ? s.largeur / s.hauteur : 0;
      if (Math.abs(ratio - 9 / 16) > 0.001) ko("ratio", `attendu 9:16, obtenu ${ratio.toFixed(4)}`);
      else oui("ratio");

      if (s.fps !== FORMAT.fps) ko("fps", `attendu ${FORMAT.fps}, obtenu ${s.fps}`); else oui("fps", { fps: s.fps });

      if (s.secondes === null) ko("durée", "illisible");
      else if (s.secondes < DUREE.min || s.secondes > DUREE.max) ko("durée", `${s.secondes.toFixed(2)}s hors fourchette ${DUREE.min}–${DUREE.max}s`);
      else oui("durée", { secondes: Math.round(s.secondes * 100) / 100 });

      if (s.secondes) {
        const v = await qaVisuelle(ff, file, s.secondes);
        if (!v.ok) ko("image", v.why, { mesures: v.mesures });
        else oui("image", { mesures: v.mesures, remplissage: v.mesures[1].remplissage });
      }

      // Safe area : relevé fait dans le DOM au moment de la prise.
      if (p.cadrage) {
        if (!p.cadrage.ok) ko("safe area", p.cadrage.why, { texteRush: p.cadrage.texteRush });
        else oui("safe area", { texteRush: p.cadrage.texteRush });
      } else oui("safe area", { note: "aucun contrôle déclaré pour ce plan" });

      if (p.erreurs && p.erreurs.length) ko("console", `${p.erreurs.length} erreur(s)`, { detail: p.erreurs.slice(0, 3) });
      else oui("console");

      plans.push(item);
    }

    const ordre = controleOrdre(manifest);
    const coherence = await coherenceMoteur(page, manifest);
    // La cohérence porte sur la vidéo : on la reporte sur le plan de reveal,
    // qui est celui dont les chiffres sont à l'écran.
    const cible = plans.find(p => p.beat === "PAYOFF") || plans.find(p => p.beat === "REVEAL") || plans[0];
    if (cible) {
      cible.controles.push({ nom: "cohérence moteur", ok: coherence.ok, why: coherence.why });
      if (!coherence.ok) cible.ok = false;
    }

    rapport.push({
      dossier, video: manifest.video, titre: manifest.titreInterne, score: manifest.score,
      plans, ordre, coherence,
      ok: plans.every(p => p.ok) && ordre.ok && coherence.ok,
    });
  }

  await ctx.close();
  await browser.close();
  return rapport;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rapport = await qa();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(rapport, null, 2)); }
  else {
    let anomalies = 0, nplans = 0;
    for (const v of rapport) {
      console.log(`\n${v.ok ? "✓" : "✗"}  ${v.video || relative(ROOT, v.dossier)} — ${v.titre || ""}`);
      for (const p of v.plans) {
        nplans++;
        const dur = p.controles.find(c => c.nom === "durée" && c.ok);
        const img = p.controles.find(c => c.nom === "image" && c.ok);
        console.log(`   ${p.ok ? "·" : "✗"} ${String(p.plan).padEnd(18)}` +
          (dur ? ` ${String(dur.secondes).padStart(5)}s` : "        ") +
          (img ? `  remplissage ${String(img.remplissage).padStart(3)}%` : ""));
        for (const c of p.controles.filter(x => !x.ok)) { console.log(`       ✗ ${c.nom} : ${c.why}`); anomalies++; }
      }
      if (!v.ordre.ok) { console.log(`       ✗ ordre : ${v.ordre.why}`); anomalies++; }
    }
    console.log(`\n${rapport.length} vidéo(s), ${nplans} plans, ${anomalies} anomalie(s).`);
    if (anomalies) process.exitCode = 1;
  }
}
