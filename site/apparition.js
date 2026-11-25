// Les sections apparaissent en douceur quand on les atteint. Sans JavaScript, tout reste visible.
(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("js");
  const vue = new IntersectionObserver((entrees) => {
    for (const e of entrees) if (e.isIntersecting) { e.target.classList.add("vu"); vue.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".apparait").forEach((el) => vue.observe(el));
})();
