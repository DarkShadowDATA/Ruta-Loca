// Moneda Shadow (la de DarkShadow Studios, sirve en todos los juegos): siempre con su imagen, nunca con emoji (regla del estudio, 15 nov 2026).
// Misma imagen y estilo que Noche de Leyendas (compartido/shadow.webp del repo cerebro). Las monedas del juego (🪙) se quedan.
import coin from './ui/shadow.webp?url';
export const SH = `<img class="shc" src="${coin}" alt="Shadow">`;
export const SH_QUE = `<div class="sh-que">${SH} <span><b>Shadow</b> es la moneda de DarkShadow Studios: sirve en todos nuestros juegos y se compra en tu cuenta del estudio. Todo lo que se compra con Shadow es opcional.</span></div>`;
/** Cambia el marcador {SH} de un texto por la imagen de la moneda (para textos que vengan de traducciones). */
export const conSH = (t) => String(t).split('{SH}').join(SH);
