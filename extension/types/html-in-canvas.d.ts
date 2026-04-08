// Type declarations for the HTML-in-Canvas API (WICG proposal)
// https://github.com/WICG/html-in-canvas

interface WebGL2RenderingContext {
  texElementImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLenum,
    format: GLenum,
    type: GLenum,
    element: HTMLElement,
  ): void;
}

interface CanvasPaintEvent extends Event {
  readonly changedElements: readonly HTMLElement[];
}

interface HTMLCanvasElement {
  requestPaint(): void;
  addEventListener(
    type: 'paint',
    listener: (ev: CanvasPaintEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'paint',
    listener: (ev: CanvasPaintEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}
