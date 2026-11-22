// Le chant : une ligne qui grésille au chargement comme une cigale en plein été,
// puis se tait. Au passage de la souris, elle frémit un peu, sans jamais rechanter.
(() => {
  const toile = document.getElementById("chant");
  if (!toile) return;
  const ctx = toile.getContext("2d");
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let l = 0, h = 0, ratio = 1;
  let souris = null, frisson = 0;
  const debut = performance.now();

  function taille() {
    ratio = Math.min(devicePixelRatio || 1, 2);
    l = toile.clientWidth;
    h = toile.clientHeight;
    toile.width = l * ratio;
    toile.height = h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // bruit de cymbale : salves rapides, modulées comme les stridulations d'une cigale
  function onde(x, t, force) {
    const salve = 0.55 + 0.45 * Math.sin(t * 0.011 + x * 0.004) * Math.sin(t * 0.0037);
    return force * salve * (Math.sin(x * 0.42 + t * 0.09) * 0.6 + Math.sin(x * 1.31 - t * 0.21) * 0.4);
  }

  function dessiner(t) {
    const ecoule = t - debut;
    // 2,6 s de chant puis silence (courbe douce)
    const chant = calme ? 0 : Math.max(0, 1 - ecoule / 3200) ** 1.4;
    frisson *= 0.94;
    ctx.clearRect(0, 0, l, h);
    const milieu = h / 2;
    const ampl = h * 0.48;

    ctx.beginPath();
    for (let x = 0; x <= l; x += 2) {
      let y = onde(x, t, ampl * chant);
      // souffle : presque immobile une fois silencieuse
      y += Math.sin(x * 0.012 + t * 0.0009) * 1.2;
      if (souris !== null && frisson > 0.01) {
        const d = (x - souris) / 70;
        y += Math.exp(-d * d) * Math.sin(x * 0.35 - t * 0.05) * 9 * frisson;
      }
      x ? ctx.lineTo(x, milieu + y) : ctx.moveTo(x, milieu + y);
    }
    ctx.strokeStyle = "rgba(233, 230, 220, 0.85)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // la partie déjà « coupée » se lit à gauche : un trait d'olive qui avance avec le silence
    const coupe = Math.min(1, ecoule / 3200);
    ctx.fillStyle = "#a9b89a";
    ctx.fillRect(0, milieu - 0.75, l * (calme ? 1 : coupe), 1.5);

    if (!calme) requestAnimationFrame(dessiner);
  }

  addEventListener("resize", taille);
  toile.addEventListener("pointermove", (e) => {
    souris = e.offsetX;
    frisson = Math.min(1, frisson + 0.08);
  });
  toile.addEventListener("pointerleave", () => (souris = null));
  taille();
  requestAnimationFrame(dessiner);
})();
