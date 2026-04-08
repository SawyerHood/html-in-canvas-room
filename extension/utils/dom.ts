const CANVAS_ID = '__drunk-canvas';
const WRAPPER_ID = '__drunk-wrapper';
const BEER_ID = '__drunk-beer-can';

// ---- Canvas wrapping ----

export function activate(): {
  canvas: HTMLCanvasElement;
  wrapper: HTMLDivElement;
} | null {
  if (document.getElementById(CANVAS_ID)) return null;

  const scrollTop =
    document.documentElement.scrollTop || document.body.scrollTop;

  const canvas = document.createElement('canvas');
  canvas.id = CANVAS_ID;
  canvas.setAttribute('layoutsubtree', '');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;

  // Copy page background so the wrapper isn't transparent where content doesn't cover
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const isTransparent = (c: string) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const bg = !isTransparent(bodyBg) ? bodyBg : !isTransparent(htmlBg) ? htmlBg : 'white';

  wrapper.style.cssText = `width:100vw;height:100vh;overflow:auto;background:${bg};`;

  canvas.appendChild(wrapper);

  const children = Array.from(document.body.childNodes);
  for (const child of children) {
    if (child instanceof HTMLScriptElement) continue;
    wrapper.appendChild(child);
  }

  document.body.appendChild(canvas);
  wrapper.scrollTop = scrollTop;

  return { canvas, wrapper };
}

export function deactivate(): void {
  const canvas = document.getElementById(CANVAS_ID);
  const wrapper = document.getElementById(WRAPPER_ID);
  if (!canvas || !wrapper) return;

  const scrollTop = wrapper.scrollTop;

  const children = Array.from(wrapper.childNodes);
  for (const child of children) {
    document.body.appendChild(child);
  }

  canvas.remove();
  document.documentElement.scrollTop = scrollTop;
  document.body.scrollTop = scrollTop;
}

// ---- Beer can ----

const BEER_SVG = `<svg viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Can body -->
  <rect x="8" y="20" width="44" height="70" rx="4" fill="#c8a84e"/>
  <rect x="8" y="20" width="44" height="70" rx="4" fill="url(#canGrad)"/>
  <!-- Metallic gradient -->
  <defs>
    <linearGradient id="canGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(255,255,255,0.3)"/>
      <stop offset="30%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="70%" stop-color="rgba(0,0,0,0.1)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.2)"/>
    </linearGradient>
  </defs>
  <!-- Top rim -->
  <ellipse cx="30" cy="20" rx="22" ry="5" fill="#d4b85a"/>
  <ellipse cx="30" cy="20" rx="18" ry="3.5" fill="#b89840"/>
  <!-- Tab -->
  <ellipse cx="30" cy="17" rx="8" ry="2.5" fill="#a0a0a0" stroke="#888" stroke-width="0.5"/>
  <rect x="28" y="14" width="4" height="4" rx="1" fill="#b0b0b0"/>
  <!-- Label -->
  <rect x="12" y="38" width="36" height="32" rx="2" fill="#1a5c2a"/>
  <text x="30" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="bold" fill="#f0d060">BEER</text>
  <text x="30" y="62" text-anchor="middle" font-family="Arial,sans-serif" font-size="4.5" fill="#c0a030">PREMIUM</text>
  <!-- Bottom rim -->
  <ellipse cx="30" cy="90" rx="22" ry="5" fill="#b89840"/>
  <!-- Liquid fill indicator -->
  <rect id="beerFill" x="12" y="75" width="36" height="0" fill="rgba(255,200,0,0.3)" rx="1"/>
</svg>`;

const BEER_STYLES = `
  #${BEER_ID} {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 64px;
    height: 107px;
    cursor: pointer;
    z-index: 2147483647;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
    transition: transform 0.15s ease;
    transform-origin: bottom center;
    user-select: none;
    -webkit-user-select: none;
  }
  #${BEER_ID}:hover {
    transform: scale(1.08);
  }
  #${BEER_ID}.wobble {
    animation: beerWobble 0.4s ease infinite;
  }
  #${BEER_ID}.chug {
    animation: beerChug 0.6s ease;
  }
  @keyframes beerWobble {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(3deg); }
    75% { transform: rotate(-3deg); }
  }
  @keyframes beerChug {
    0% { transform: rotate(0deg); }
    20% { transform: rotate(-40deg) translateY(-10px); }
    50% { transform: rotate(-50deg) translateY(-15px); }
    80% { transform: rotate(-10deg) translateY(-3px); }
    100% { transform: rotate(0deg); }
  }
`;

export function createBeerCan(): HTMLElement {
  const container = document.createElement('div');
  container.id = BEER_ID;
  container.innerHTML = BEER_SVG;
  container.title = 'Chug a beer!';

  // Inject styles
  const style = document.createElement('style');
  style.textContent = BEER_STYLES;
  container.appendChild(style);

  document.body.appendChild(container);
  return container;
}

export function removeBeerCan(): void {
  document.getElementById(BEER_ID)?.remove();
}

export function setBeerWobble(intensity: number): void {
  const can = document.getElementById(BEER_ID);
  if (!can) return;
  if (intensity > 0.3) {
    can.classList.add('wobble');
  } else {
    can.classList.remove('wobble');
  }
}

export function triggerChug(): void {
  const can = document.getElementById(BEER_ID);
  if (!can) return;
  can.classList.remove('wobble');
  can.classList.remove('chug');
  // Force reflow to restart animation
  void can.offsetWidth;
  can.classList.add('chug');
  can.addEventListener(
    'animationend',
    () => {
      can.classList.remove('chug');
    },
    { once: true },
  );
}
