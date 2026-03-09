/** Inject a <style> tag once, identified by `id`. No-ops if already present. */
export function injectStyleOnce(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
