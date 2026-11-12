(() => {
  const realNow = performance.now.bind(performance), realRaf = window.requestAnimationFrame.bind(window), realCancel = window.cancelAnimationFrame.bind(window);
  let manual = false, t = 0, id = 0; const q = new Map();
  performance.now = () => manual ? t : realNow();
  window.requestAnimationFrame = cb => { if (!manual) return realRaf(cb); id++; q.set(id, cb); return id; };
  window.cancelAnimationFrame = h => { if (q.has(h)) q.delete(h); else realCancel(h); };
  window.__manual = () => { t = realNow(); manual = true; };
  window.__step = ms => { t += ms; const cbs = [...q.values()]; q.clear(); for (const c of cbs) { try { c(t); } catch (e) { console.error(e); } } };
})();
