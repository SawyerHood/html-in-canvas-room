import { defineContentScript } from 'wxt/utils/define-content-script';
import { ShaderPipeline } from '@/utils/pipeline';
import {
  activate,
  deactivate,
  createBeerCan,
  removeBeerCan,
  setBeerWobble,
  triggerChug,
} from '@/utils/dom';
import type { ToContentMessage, DrunkState } from '@/utils/messages';

const DECAY_DURATION = 60; // seconds from 100% to 0%
const DRINK_AMOUNT = 0.2; // each chug adds 20%
const TAG = '[DrunkSim]';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main(ctx) {
    let active = false;
    let intensity = 0;
    let pipeline: ShaderPipeline | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let wrapper: HTMLDivElement | null = null;
    let beerCan: HTMLElement | null = null;
    let rafId = 0;
    let lastTime = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;
    let renderStarted = false;

    function startRenderLoop() {
      if (renderStarted) return;
      renderStarted = true;
      console.log(TAG, 'Starting render loop');
      pipeline?.markDirty();
      lastTime = 0;
      rafId = requestAnimationFrame(renderLoop);
    }

    function activateDrunk(restoredIntensity = 0) {
      if (active) return;

      const result = activate();
      if (!result) return;
      canvas = result.canvas;
      wrapper = result.wrapper;

      const gl = canvas.getContext('webgl2', {
        alpha: false,
        premultipliedAlpha: false,
      });

      if (!gl || typeof gl.texElementImage2D !== 'function') {
        deactivate();
        canvas = null;
        wrapper = null;
        console.warn(
          TAG,
          'HTML-in-Canvas API not available. Enable chrome://flags/#canvas-draw-element',
        );
        return;
      }

      console.log(TAG, 'Activated, texElementImage2D available');

      pipeline = new ShaderPipeline(gl);
      intensity = restoredIntensity;
      pipeline.setIntensity(intensity);
      handleResize();

      // Beer can (outside canvas, on top)
      beerCan = createBeerCan();
      beerCan.addEventListener('click', onDrink);

      // Events
      wrapper.addEventListener('scroll', onScroll);
      wrapper.addEventListener('mousemove', onMouseMove);
      window.addEventListener('resize', handleResize);

      // Listen for paint events (marks texture dirty when DOM changes)
      renderStarted = false;
      canvas.addEventListener('paint', (e: Event) => {
        console.log(
          TAG,
          'paint event, changedElements:',
          (e as any).changedElements?.length,
        );
        pipeline?.markDirty();
        // Start render loop on first paint
        startRenderLoop();
      });

      // Force initial paint
      if (canvas.requestPaint) {
        console.log(TAG, 'Calling requestPaint()');
        canvas.requestPaint();
      }

      // Fallback: if paint event never fires, start rendering after 500ms
      setTimeout(() => {
        if (!renderStarted) {
          console.log(TAG, 'Paint event did not fire, starting render loop via fallback');
          pipeline?.markDirty();
          startRenderLoop();
        }
      }, 500);

      active = true;
      persistState();
    }

    function deactivateDrunk() {
      if (!active) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      renderStarted = false;

      if (beerCan) {
        beerCan.removeEventListener('click', onDrink);
      }
      removeBeerCan();
      beerCan = null;

      window.removeEventListener('resize', handleResize);

      if (pipeline) {
        pipeline.destroy();
        pipeline = null;
      }

      deactivate();
      canvas = null;
      wrapper = null;
      active = false;
      intensity = 0;
      persistState();
    }

    function onDrink() {
      intensity = Math.min(1.0, intensity + DRINK_AMOUNT);
      triggerChug();
      pipeline?.markDirty();
      persistState();
    }

    function onScroll() {
      pipeline?.markDirty();
    }

    function onMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width;
      mouseY = (e.clientY - rect.top) / rect.height;
    }

    function handleResize() {
      if (!canvas || !pipeline) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      pipeline.resize(window.innerWidth, window.innerHeight, dpr);
    }

    function renderLoop(timestamp: number) {
      if (!pipeline || !wrapper) return;

      const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
      lastTime = timestamp;

      // Decay intensity
      if (intensity > 0) {
        intensity = Math.max(0, intensity - dt / DECAY_DURATION);
        // Persist periodically so navigations keep the level
        if (Math.random() < 0.02) persistState();
      }

      // Update pipeline
      pipeline.setIntensity(intensity);
      pipeline.setMouse(mouseX, mouseY);

      // Update beer can wobble
      setBeerWobble(intensity);

      // Draw
      pipeline.draw(timestamp / 1000, wrapper);

      rafId = requestAnimationFrame(renderLoop);
    }

    function persistState() {
      chrome.storage.local.set({
        drunkState: { active, intensity } as DrunkState,
      });
    }

    // Load persisted state — restore intensity across navigations
    chrome.storage.local.get('drunkState', (result) => {
      const state = result.drunkState as DrunkState | undefined;
      if (state?.active) {
        console.log(TAG, 'Restoring state, intensity:', state.intensity);
        activateDrunk(state.intensity ?? 0);
      }
    });

    // Message listener
    chrome.runtime.onMessage.addListener(
      (msg: ToContentMessage, _sender, sendResponse) => {
        if (msg.type === 'toggle') {
          if (active) {
            deactivateDrunk();
          } else {
            activateDrunk();
          }
        } else if (msg.type === 'getState') {
          sendResponse({ active, intensity } as DrunkState);
          return true;
        }
      },
    );

    // Cleanup on extension reload
    ctx.onInvalidated(() => {
      if (active) deactivateDrunk();
    });
  },
});
