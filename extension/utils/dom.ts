const CANVAS_ID = '__shader-canvas';
const WRAPPER_ID = '__shader-wrapper';

export function activate(): {
  canvas: HTMLCanvasElement;
  wrapper: HTMLDivElement;
} | null {
  if (document.getElementById(CANVAS_ID)) return null;

  // Capture scroll position before DOM manipulation
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;

  const canvas = document.createElement('canvas');
  canvas.id = CANVAS_ID;
  canvas.setAttribute('layoutsubtree', '');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText = 'width:100vw;height:100vh;overflow:auto;';

  canvas.appendChild(wrapper);

  // Move all body children into wrapper (skip <script> to avoid re-execution)
  const children = Array.from(document.body.childNodes);
  for (const child of children) {
    if (child instanceof HTMLScriptElement) continue;
    wrapper.appendChild(child);
  }

  document.body.appendChild(canvas);

  // Restore scroll position inside the wrapper
  wrapper.scrollTop = scrollTop;

  return { canvas, wrapper };
}

export function deactivate(): void {
  const canvas = document.getElementById(CANVAS_ID);
  const wrapper = document.getElementById(WRAPPER_ID);
  if (!canvas || !wrapper) return;

  // Capture scroll position from wrapper
  const scrollTop = wrapper.scrollTop;

  // Move children back to body
  const children = Array.from(wrapper.childNodes);
  for (const child of children) {
    document.body.appendChild(child);
  }

  canvas.remove();

  // Restore scroll position on the document
  document.documentElement.scrollTop = scrollTop;
  document.body.scrollTop = scrollTop;
}
