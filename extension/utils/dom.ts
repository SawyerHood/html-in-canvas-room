const CANVAS_ID = '__crt-canvas';
const WRAPPER_ID = '__crt-wrapper';

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
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;

  // Copy page background to prevent transparent areas
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const isTransparent = (c: string) =>
    !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const bg = !isTransparent(bodyBg)
    ? bodyBg
    : !isTransparent(htmlBg)
      ? htmlBg
      : 'white';

  wrapper.style.cssText = `width:100vw;height:100vh;overflow:auto;background:${bg};pointer-events:none;padding:20px;box-sizing:border-box;`;

  canvas.appendChild(wrapper);

  const children = Array.from(document.body.childNodes);
  for (const child of children) {
    if (child instanceof HTMLScriptElement) continue;
    if (child instanceof HTMLElement && child.id === '__crt-frame-overlay') continue;
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
