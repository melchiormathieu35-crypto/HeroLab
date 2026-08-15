/**
 * Pilotage de Hero Lab en mode Studio, pour la production de contenu.
 *
 * Ce module ne modifie PAS le produit. Il ouvre l'application en `?admin=1`,
 * construit un spot avec le DSL Studio existant, et applique ses effets de
 * caméra et ses masques par injection au moment de l'enregistrement — donc
 * uniquement dans le navigateur de production, jamais dans le fichier livré.
 *
 * Cadrage : le CSS de Hero Lab bascule en disposition mobile sous 760px. On
 * filme donc dans un viewport mobile (360×640, ratio 9:16) que Playwright met
 * à l'échelle vers 1080×1920. Cela donne une vraie composition mobile en pleine
 * résolution, et non un écran desktop recadré.
 */
import { chromium } from "playwright";
import { launchOptions } from "../tests/browser.mjs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const APP_URL = pathToFileURL(resolve(ROOT, "index.html")).href + "?admin=1";

/**
 * Viewport de tournage : disposition mobile, ratio 9:16 exact.
 *
 * 360×640 plutôt que 405×720. Les deux sont en 9:16 et donnent la même
 * disposition, mais 360 est mis à l'échelle ×3 vers 1080 au lieu de ×2,67.
 * Concrètement, le texte le plus petit de la table passe de 29 à 33 px dans le
 * rush final — au-dessus du seuil de lisibilité mobile au lieu d'en dessous.
 * C'est la façon honnête de faire passer le contrôle : améliorer l'image, pas
 * baisser le seuil.
 */
export const SHOT_VIEWPORT = { width: 360, height: 640 };
/**
 * Facteur de rendu. Les captures sont prises à cette densité, donc en
 * 360×3 = 1080 sur 640×3 = 1920 : la résolution de sortie est native, pas
 * obtenue par agrandissement.
 */
export const SHOT_DSF = 3;
/** Résolution de sortie : standard vertical des plateformes. */
export const SHOT_SIZE = { width: 1080, height: 1920 };

/**
 * Zones d'interface des plateformes, en pourcentage de hauteur. Rien
 * d'important ne doit s'y trouver : les boutons TikTok, la légende et la barre
 * de progression recouvrent ces bandes.
 */
export const SAFE_ZONES = { top: 0.10, bottom: 0.20, right: 0.16 };

/** Bande utile en pixels de viewport, dérivée des zones ci-dessus. */
export const SAFE_BAND = {
  top: Math.round(SHOT_VIEWPORT.height * SAFE_ZONES.top),             // 64
  bottom: Math.round(SHOT_VIEWPORT.height * (1 - SAFE_ZONES.bottom)),  // 512
};

/**
 * Ancres de cadrage, relevées sur la page réelle et non devinées. Positions
 * absolues mesurées en viewport 360×640, marge de course incluse (+300 px) :
 *
 *   .felt          la table          375 → 645   (h 270)
 *   .hero-hand     main du héros     659 → 780   (h 121)
 *   .act-zone      zone d'action     793 → 1224  (h 431)
 *   .verdict       verdict + coût    785 → 1255  (h 470)   après décision
 *   .opt-row.best  meilleure EV     1391 → 1456  (h  65)   après décision
 *
 * À noter : le bloc verdict (470 px) dépasse la bande utile (448 px). Il ne
 * peut donc pas y tenir en entier — on cale son bord haut, ce qui met le titre
 * et le coût dans le champ, et laisse déborder la fin du commentaire.
 */
export const ANCHORS = {
  table: ".felt",
  hand: ".hero-hand",
  actions: ".act-zone",
  verdict: ".verdict",
  evList: ".opt-row.best",
};

export async function launch() {
  return chromium.launch(launchOptions());
}

/**
 * Ouvre une page de tournage.
 *
 * L'enregistrement vidéo de Playwright n'est PAS utilisé : il ne sait que
 * réduire une page pour l'ajuster au cadre, jamais l'agrandir. Un viewport
 * mobile posé dans un cadre 1080×1920 n'en occupait qu'un tiers, le reste
 * étant du gris de remplissage — mesuré à 85 % du cadre. Les plans sont donc
 * assemblés image par image à partir de captures, en résolution native.
 */
export async function openShot(browser) {
  const ctx = await browser.newContext({
    viewport: SHOT_VIEWPORT,
    deviceScaleFactor: SHOT_DSF,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(APP_URL, { waitUntil: "load" });
  await page.waitForFunction('typeof Studio !== "undefined" && typeof App !== "undefined"');

  // Profil minimal : l'onboarding masquerait la table. On le passe sans
  // fabriquer de fausses données de progression — Studio joue en fantôme.
  await page.evaluate(() => {
    Onboarding.renderOnboarding();
    document.getElementById("obName").value = "Hero";
    Onboarding.obValidate();
    Onboarding.finishOnboarding();
  });
  await page.waitForTimeout(300);

  // Habillage de tournage : on retire ce qui n'a rien à faire dans un rush.
  await page.addStyleTag({
    content: `
      /* Aucun élément de debug ni chrome de navigation dans le cadre. */
      .stu-badge, .rail, .scrim, #burger, .toast { display: none !important; }
      /* Curseur invisible : aucune trace de pilotage automatique. */
      * { cursor: none !important; }
      /* Pas de barre de défilement dans le cadre : la caméra défile, pas le
         spectateur. La page reste défilable par script. */
      html { scrollbar-width: none; }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
      /* Marge de course pour la caméra. Sans elle, un élément situé en haut de
         page ne peut pas être descendu dans la bande utile : le défilement est
         déjà à zéro. Ces marges sortent du cadre dès qu'on cadre un plan. */
      #v-play { padding-top: 300px !important; padding-bottom: 520px !important; }
    `,
  });

  return { ctx, page, errors };
}

/** Construit un spot Studio. Retourne l'état réel de la table. */
export async function loadSpot(page, spec) {
  return page.evaluate((txt) => {
    try {
      Studio.loadText(txt);
      const t = App.t;
      return {
        ok: true,
        ghost: !!(t && t._studio),
        board: t ? t.board.length : 0,
        hero: t ? t.hero.hole : null,
        pot: t ? t.pot : null,
        toCall: t ? t.toCall(t.hero) : null,
      };
    } catch (e) { return { ok: false, err: e.message }; }
  }, spec);
}

/**
 * Position de défilement qui place un élément dans la bande utile.
 * Ne bouge rien : rend seulement la valeur, pour que l'animation image par
 * image puisse interpoler entre l'actuelle et la visée.
 */
export async function scrollTargetFor(page, selector, { at = 0.34, align = "center" } = {}) {
  return page.evaluate(({ selector, at, align }) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const anchor = align === "top" ? 0 : box.height / 2;
    const target = box.top + scrollY - (innerHeight * at) + anchor;
    const max = document.documentElement.scrollHeight - innerHeight;
    return Math.max(0, Math.min(max, Math.round(target)));
  }, { selector, at, align });
}

/**
 * Origine de zoom correspondant au centre d'un élément, en pourcentage de la
 * vue de jeu. Calculée une fois au début d'un mouvement puis maintenue : ainsi
 * l'élément visé reste immobile pendant que l'image s'agrandit autour de lui.
 */
export async function zoomOriginFor(page, selector) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const view = document.getElementById("v-play") || document.body;
    if (!el) return null;
    const b = el.getBoundingClientRect(), v = view.getBoundingClientRect();
    return {
      x: ((b.left + b.width / 2) - v.left) / v.width * 100,
      y: ((b.top + b.height / 2) - v.top) / v.height * 100,
    };
  }, selector);
}

/**
 * Applique un état de caméra, immédiatement et sans transition CSS.
 *
 * C'est le cœur du rendu image par image : chaque image est un état explicite,
 * pas le résultat d'une animation du navigateur lue au vol. Le plan est donc
 * reproductible à l'identique, et sa durée exacte.
 */
export async function setCamera(page, { scrollY = 0, scale = 1, origin = null } = {}) {
  await page.evaluate(({ scrollY, scale, origin }) => {
    const view = document.getElementById("v-play") || document.body;
    view.style.transition = "none";
    if (origin) view.style.transformOrigin = `${origin.x.toFixed(3)}% ${origin.y.toFixed(3)}%`;
    view.style.transform = scale === 1 ? "none" : `scale(${scale})`;
    window.scrollTo({ top: scrollY, behavior: "auto" });
  }, { scrollY, scale, origin });
}

/** Défilement courant, pour partir de l'état réel plutôt que d'un supposé. */
export function currentScroll(page) {
  return page.evaluate(() => Math.round(scrollY));
}

/**
 * Cadre un élément immédiatement. Utilisé pour poser un plan avant de tourner.
 */
export async function frameTo(page, selector, { at = 0.34, align = "center" } = {}) {
  const y = await scrollTargetFor(page, selector, { at, align });
  if (y === null) return { ok: false, err: "introuvable : " + selector };
  await setCamera(page, { scrollY: y });
  return { ok: true, y };
}

/**
 * Contrôle de cadrage et de lisibilité, mesuré dans le DOM et non sur l'image.
 *
 * Deux questions distinctes :
 *
 *   CADRAGE      la cible est-elle dans la bande utile ? Un bloc plus haut que
 *                la bande ne peut pas y tenir entièrement — on exige alors que
 *                son début y soit, ce qui est ce que voit le spectateur.
 *
 *   LISIBILITÉ   le texte QUI PORTE LE MESSAGE est-il assez grand ? Première
 *                version : on prenait la plus petite police du sous-arbre.
 *                Elle échouait partout, car ces blocs contiennent des étiquettes
 *                secondaires qui n'ont pas à être lues. On mesure donc le texte
 *                principal — le plus grand du bloc, ou celui désigné par `key` —
 *                et on le convertit en pixels du rush final.
 */
export async function checkFraming(page, selector, { minOut = 30, key = null, scale = 1 } = {}) {
  return page.evaluate(({ selector, minOut, key, band, scaleUp, scale }) => {
    const el = document.querySelector(selector);
    if (!el) return { ok: false, why: "élément absent : " + selector };
    const b = el.getBoundingClientRect();

    const tall = b.height > (band.bottom - band.top);
    const inBand = tall
      ? b.top >= band.top - 2 && b.top < band.bottom - 60
      : b.top >= band.top - 2 && b.bottom <= band.bottom + 2;

    // Contenance horizontale. Omise dans une première version, elle a laissé
    // passer un zoom sur un bloc pleine largeur : les montants et les libellés
    // d'action étaient coupés aux deux bords (« 97.5 b », « asser »), alors que
    // le contrôle vertical passait. Rien d'essentiel ne doit sortir du cadre.
    const dansLargeur = b.left >= -2 && b.right <= innerWidth + 2;

    const measure = (node) => {
      let px = 0;
      for (const n of [node, ...node.querySelectorAll("*")]) {
        const r = n.getBoundingClientRect();
        if (r.height < 6 || !n.textContent.trim()) continue;
        const own = [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
        if (!own) continue;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (fs > px) px = fs;
      }
      return px;
    };
    const keyEl = key ? el.querySelector(key) || document.querySelector(key) : null;
    const px = measure(keyEl || el);
    // Le zoom du plan agrandit aussi le texte : on en tient compte.
    const out = Math.round(px * scaleUp * scale);

    return {
      ok: inBand && dansLargeur && out >= minOut,
      inBand, dansLargeur, tall,
      gauche: Math.round(b.left), droite: Math.round(b.right), largeurVue: innerWidth,
      textePx: Math.round(px * 10) / 10,
      texteRush: out,
      top: Math.round(b.top), bottom: Math.round(b.bottom),
      why: !inBand ? "hors bande utile"
        : !dansLargeur ? `coupé horizontalement (${Math.round(b.left)} → ${Math.round(b.right)} pour ${innerWidth}px de large)`
        : out < minOut ? `texte trop petit (${out}px dans le rush)` : null,
    };
  }, { selector, minOut, key, band: SAFE_BAND, scaleUp: SHOT_SIZE.width / SHOT_VIEWPORT.width, scale });
}

/**
 * Masque le verdict. Indispensable au suspense : la décision est jouée, le
 * moteur a calculé, mais le spectateur ne voit pas encore le résultat.
 */
export async function maskVerdict(page, on = true) {
  await page.evaluate((on) => {
    const ID = "__rush_mask__";
    document.getElementById(ID)?.remove();
    if (!on) return;
    const el = document.createElement("div");
    el.id = ID;
    el.style.cssText = `position:fixed;inset:0;z-index:9998;pointer-events:none;
      background:linear-gradient(180deg,rgba(8,11,20,0) 0%,rgba(8,11,20,.97) 26%,rgba(8,11,20,.99) 100%);`;
    document.body.appendChild(el);
  }, on);
}

/** Joue une action et rend l'analyse du moteur, sans rien inventer. */
export async function decide(page, action, amount = 0) {
  return page.evaluate(({ action, amount }) => {
    App.choose(action, amount);
    const a = App.analysis;
    if (!a) return null;
    return {
      verdict: a.verdict,
      lossBB: a.lossBB,
      equity: a.equity,
      options: (a.options || []).map(o => ({ action: o.action, evBB: o.evBB })),
    };
  }, { action, amount });
}

/** Remet la caméra à plat entre deux plans. */
export async function resetCamera(page) {
  await setCamera(page, { scrollY: 0, scale: 1 });
}
