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
/**
 * Cohérence moteur d'un DUEL : deux manches, deux vérités à recontrôler. On
 * recharge chaque spec, on rejoue la même action (désignée par son libellé,
 * comme à la prise), et chaque chiffre livré doit revenir à l'identique — EV
 * de l'action dans les deux manches, meilleure option de la manche B, verdict.
 */
async function coherenceDuel(page, manifest) {
  const d = manifest.duel;
  const [mA, mB] = manifest.moteurs || [];
  if (!mA || !mB) return { ok: false, why: "manifeste de duel sans les deux analyses moteur" };

  const rejouer = async (spec, action) => {
    const built = await loadSpot(page, spec);
    if (!built.ok) return { err: built.err };
    return page.evaluate((action) => {
      const t = App.t;
      const opts = Spot.options(t);
      const a0 = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
      const pick = a0.options.find(o => (o.label || o.action) === action);
      if (!pick) return { err: "option absente : " + action };
      App.choose(pick.action, pick.amount);
      const a = App.analysis;
      return {
        evAction: Number(pick.evBB.toFixed(2)),
        verdict: a.verdict,
        lossBB: Number(a.lossBB.toFixed(2)),
        meilleure: { label: a.best.label || a.best.action, evBB: Number(a.best.evBB.toFixed(2)) },
      };
    }, action);
  };

  const ecarts = [];
  const rA = await rejouer(d.specA, d.action);
  if (rA.err) return { ok: false, why: `manche A : ${rA.err}` };
  if (Math.abs(rA.evAction - mA.joue.evBB) > TOLERANCE_BB) ecarts.push(`EV manche A ${mA.joue.evBB} → ${rA.evAction}`);
  if (rA.verdict !== mA.verdict) ecarts.push(`verdict A « ${mA.verdict} » → « ${rA.verdict} »`);

  const rB = await rejouer(d.specB, d.action);
  if (rB.err) return { ok: false, why: `manche B : ${rB.err}` };
  if (Math.abs(rB.evAction - mB.joue.evBB) > TOLERANCE_BB) ecarts.push(`EV manche B ${mB.joue.evBB} → ${rB.evAction}`);
  if (rB.verdict !== mB.verdict) ecarts.push(`verdict B « ${mB.verdict} » → « ${rB.verdict} »`);
  if (rB.meilleure.label !== mB.meilleure.label) ecarts.push(`meilleure B « ${mB.meilleure.label} » → « ${rB.meilleure.label} »`);
  if (Math.abs(rB.meilleure.evBB - mB.meilleure.evBB) > TOLERANCE_BB) ecarts.push(`EV meilleure B ${mB.meilleure.evBB} → ${rB.meilleure.evBB}`);
  // Le contraste annoncé est une soustraction des deux EV rejouées : vérifié aussi.
  const contraste = Number((rA.evAction - rB.evAction).toFixed(2));
  if (Math.abs(contraste - d.contraste) > TOLERANCE_BB * 2) ecarts.push(`contraste ${d.contraste} → ${contraste}`);

  return { ok: ecarts.length === 0, why: ecarts.length ? ecarts.join(" · ") : null, ecarts };
}

/**
 * Cohérence moteur d'un PODIUM : trois erreurs indépendantes, trois vérités à
 * recontrôler. Chaque spec est rechargée, le réflexe instinctif rejoué
 * (comme à la prise), et chaque coût comparé à celui du manifeste.
 */
async function coherencePodium(page, manifest) {
  const rangs = manifest.podium?.rang || [];
  const moteurs = manifest.moteurs || [];
  if (rangs.length !== 3 || moteurs.length !== 3) {
    return { ok: false, why: `podium incomplet dans le manifeste (${rangs.length} rang(s), ${moteurs.length} analyse(s))` };
  }

  const ecarts = [];
  for (let i = 0; i < 3; i++) {
    const r = rangs[i], m = moteurs[i];
    const built = await loadSpot(page, r.spot.spec);
    if (!built.ok) { ecarts.push(`rang ${r.rang} : spot non rechargeable (${built.err})`); continue; }

    const rejoue = await page.evaluate(() => {
      const t = App.t;
      const opts = Spot.options(t);
      const a0 = Judge.evaluate(t, { action: opts[0].action, amount: opts[0].amount });
      const instinct = t.toCall(t.hero) > 0 ? "call" : "check";
      const pick = a0.options.find(o => o.action === instinct) || a0.options[a0.options.length - 1];
      App.choose(pick.action, pick.amount);
      const a = App.analysis;
      return {
        evAction: Number(pick.evBB.toFixed(2)), verdict: a.verdict, lossBB: Number(a.lossBB.toFixed(2)),
        meilleure: { label: a.best.label || a.best.action, evBB: Number(a.best.evBB.toFixed(2)) },
      };
    });

    if (Math.abs(rejoue.evAction - m.joue.evBB) > TOLERANCE_BB) ecarts.push(`rang ${r.rang} EV ${m.joue.evBB} → ${rejoue.evAction}`);
    if (rejoue.verdict !== m.verdict) ecarts.push(`rang ${r.rang} verdict « ${m.verdict} » → « ${rejoue.verdict} »`);
    if (Math.abs(rejoue.lossBB - m.lossBB) > TOLERANCE_BB) ecarts.push(`rang ${r.rang} coût ${m.lossBB} → ${rejoue.lossBB}`);
    if (Math.abs(r.coutInstinct - rejoue.lossBB) > TOLERANCE_BB) ecarts.push(`rang ${r.rang} coût annoncé ${r.coutInstinct} → ${rejoue.lossBB}`);
  }
  // Le classement lui-même : rang 3 < rang 2 < rang 1 en coût réel.
  const parRang = Object.fromEntries(rangs.map(r => [r.rang, r.coutInstinct]));
  if (!(parRang[3] <= parRang[2] && parRang[2] <= parRang[1])) {
    ecarts.push(`ordre du classement incohérent (3:${parRang[3]} 2:${parRang[2]} 1:${parRang[1]})`);
  }

  return { ok: ecarts.length === 0, why: ecarts.length ? ecarts.join(" · ") : null, ecarts };
}

async function coherenceMoteur(page, manifest) {
  if (manifest.duel) return coherenceDuel(page, manifest);
  if (manifest.podium) return coherencePodium(page, manifest);
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

/**
 * QA des vidéos MONTÉES — un seul fichier par vidéo.
 *
 * La passe des rushs échantillonne trois instants par fichier, ce qui suffit
 * quand un fichier = un plan. Ici, un seul fichier contient six beats : une
 * moyenne sur toute la durée masquerait un beat noir. On échantillonne donc
 * DANS CHAQUE BEAT, aux timecodes réels relevés à l'encodage, plus le tout
 * dernier instant utile — une vidéo qui finit sur du vide est inexploitable et
 * c'est précisément ce que la moyenne cacherait.
 *
 * S'y ajoute la contrainte de format court demandée : la vidéo doit durer entre
 * 30 s et 1 min, et l'écart entre la durée prévue par le blueprint et la durée
 * réellement écrite doit être négligeable — un écart signale un beat interrompu.
 */
export async function qaMontage({ dossiers = [], duree = { min: 30, max: 60 } } = {}) {
  const ff = await ffmpegPath();
  if (!ff) throw new Error("ffmpeg introuvable (attendu sous /opt/pw-browsers/ffmpeg-*)");

  const browser = await launch();
  const { ctx, page } = await openShot(browser);
  const rapport = [];

  for (const dossier of dossiers) {
    const mf = join(dossier, "manifest.json");
    const item = { dossier, controles: [], ok: true, beats: [] };
    const ko = (nom, why, info = {}) => { item.controles.push({ nom, ok: false, why, ...info }); item.ok = false; };
    const oui = (nom, info = {}) => item.controles.push({ nom, ok: true, ...info });

    if (!existsSync(mf)) { ko("manifeste", "manifest.json absent"); rapport.push(item); continue; }
    const m = JSON.parse(await readFile(mf, "utf8"));
    item.video = m.video; item.titre = m.titreInterne; item.score = m.score; item.concept = m.concept;

    const file = join(dossier, m.fichier);
    if (!existsSync(file)) { ko("fichier", "absent du disque"); rapport.push(item); continue; }
    const st = await stat(file);
    if (st.size < 8192) ko("fichier", `trop petit (${st.size} octets)`); else oui("fichier", { octets: st.size });

    const s = await sonder(ff, file);
    if (s.largeur !== FORMAT.largeur || s.hauteur !== FORMAT.hauteur) {
      ko("format", `attendu ${FORMAT.largeur}×${FORMAT.hauteur}, obtenu ${s.largeur}×${s.hauteur}`);
    } else oui("format", { resolution: `${s.largeur}×${s.hauteur}` });

    const ratio = s.largeur && s.hauteur ? s.largeur / s.hauteur : 0;
    if (Math.abs(ratio - 9 / 16) > 0.001) ko("ratio", `attendu 9:16, obtenu ${ratio.toFixed(4)}`); else oui("ratio");

    if (s.fps !== FORMAT.fps) ko("fps", `attendu ${FORMAT.fps}, obtenu ${s.fps}`); else oui("fps", { fps: s.fps });

    if (s.secondes === null) ko("durée", "illisible");
    else if (s.secondes < duree.min || s.secondes > duree.max) {
      ko("durée", `${s.secondes.toFixed(2)} s hors de la fourchette format court ${duree.min}–${duree.max} s`);
    } else oui("durée", { secondes: Math.round(s.secondes * 100) / 100 });

    // Continuité : la somme des beats doit couvrir le fichier entier.
    const fin = m.timeline.length ? m.timeline[m.timeline.length - 1].fin : 0;
    if (s.secondes !== null && Math.abs(fin - s.secondes) > 0.2) {
      ko("continuité", `la timeline s'arrête à ${fin.toFixed(2)} s pour un fichier de ${s.secondes.toFixed(2)} s`);
    } else oui("continuité", { beats: m.timeline.length, fin });

    const trous = m.timeline.filter((b, i) => i > 0 && Math.abs(b.debut - m.timeline[i - 1].fin) > 0.001);
    if (trous.length) ko("enchaînement", `${trous.length} discontinuité(s) entre beats`); else oui("enchaînement");

    // Image, beat par beat. Un seul beat noir suffit à rendre la vidéo
    // inexploitable ; une mesure globale ne le verrait pas.
    let imageOk = true;
    for (const b of m.timeline) {
      const instants = [b.debut + (b.secondes * 0.25), b.debut + (b.secondes * 0.75)];
      const mesures = [];
      for (const t of instants) mesures.push({ a: Math.round(t * 100) / 100, ...(await imageAt(ff, file, Math.max(0.05, t))) });
      const mauvaise = mesures.find(x => !x.ok);
      item.beats.push({
        beat: b.beat, debut: b.debut, fin: b.fin, secondes: b.secondes,
        image: { ok: !mauvaise, why: mauvaise ? `à ${mauvaise.a} s : ${mauvaise.why}` : null, mesures: mesures.map(x => ({ a: x.a, luminance: x.luminance, remplissage: x.remplissage })) },
        cadrage: b.cadrage || null,
      });
      if (mauvaise) { ko("image", `${b.beat} — ${mauvaise.why} (à ${mauvaise.a} s)`); imageOk = false; }
    }
    // Dernière image utile : une fin sur du vide se voit seulement là.
    if (s.secondes) {
      const der = await imageAt(ff, file, Math.max(0.05, s.secondes - 0.15));
      if (!der.ok) { ko("image", `dernière image : ${der.why}`); imageOk = false; }
    }
    if (imageOk) oui("image", { beats: item.beats.length, echantillons: item.beats.length * 2 + 1 });

    // Safe area : relevé DOM fait à la prise, beat par beat.
    const horsBande = m.timeline.filter(b => b.cadrage && !b.cadrage.ok);
    if (horsBande.length) ko("safe area", horsBande.map(b => `${b.beat} : ${b.cadrage.why}`).join(" · "));
    else oui("safe area", { controles: m.timeline.filter(b => b.cadrage).length });

    if (m.erreurs && m.erreurs.length) ko("console", `${m.erreurs.length} erreur(s)`, { detail: m.erreurs.slice(0, 3) });
    else oui("console");

    const coherence = await coherenceMoteur(page, m);
    if (!coherence.ok) ko("cohérence moteur", coherence.why); else oui("cohérence moteur");
    item.coherence = coherence;
    item.duree = s.secondes;

    rapport.push(item);
  }

  await ctx.close();
  await browser.close();
  return rapport;
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
