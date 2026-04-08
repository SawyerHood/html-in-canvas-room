import { defineContentScript } from 'wxt/utils/define-content-script';
import { ShaderPipeline } from '@/utils/pipeline';
import { activate, deactivate } from '@/utils/dom';
import { EFFECT_MAP } from '@/utils/effects';
import { DEFAULT_STATE, type ShaderState, type ToContentMessage } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main(ctx) {
    let state: ShaderState = { ...DEFAULT_STATE };
    let pipeline: ShaderPipeline | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let wrapper: HTMLDivElement | null = null;
    let rafId = 0;

    // Load persisted state
    chrome.storage.local.get('shaderState', (result) => {
      if (result.shaderState) {
        state = { ...DEFAULT_STATE, ...result.shaderState };
        if (state.active) activateShader();
      }
    });

    function activateShader() {
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
          'Shader Overlay: HTML-in-Canvas API not available. Enable chrome://flags/#canvas-draw-element',
        );
        return;
      }

      pipeline = new ShaderPipeline(gl);
      pipeline.setEffect(EFFECT_MAP[state.shader]);
      pipeline.setIntensity(state.intensity);
      pipeline.setSpeed(state.speed);
      handleResize();

      // Re-upload texture when DOM content changes
      canvas.addEventListener('paint', onPaint);
      window.addEventListener('resize', handleResize);

      // Also mark dirty on scroll since visible content changes
      wrapper.addEventListener('scroll', onScroll);

      // Start render loop
      function renderLoop(time: number) {
        if (!pipeline || !wrapper) return;
        pipeline.draw(time / 1000, wrapper);
        rafId = requestAnimationFrame(renderLoop);
      }
      rafId = requestAnimationFrame(renderLoop);

      // Force initial paint
      if (canvas.requestPaint) {
        canvas.requestPaint();
      }

      state.active = true;
      persistState();
    }

    function deactivateShader() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;

      if (canvas) {
        canvas.removeEventListener('paint', onPaint);
      }
      if (wrapper) {
        wrapper.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('resize', handleResize);

      if (pipeline) {
        pipeline.destroy();
        pipeline = null;
      }

      deactivate();
      canvas = null;
      wrapper = null;
      state.active = false;
      persistState();
    }

    function onPaint() {
      pipeline?.markDirty();
    }

    function onScroll() {
      pipeline?.markDirty();
    }

    function handleResize() {
      if (!canvas || !pipeline) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      pipeline.resize(window.innerWidth, window.innerHeight, dpr);
    }

    function persistState() {
      chrome.storage.local.set({ shaderState: state });
    }

    // Message listener
    chrome.runtime.onMessage.addListener(
      (msg: ToContentMessage, _sender, sendResponse) => {
        switch (msg.type) {
          case 'toggle':
            if (msg.enabled && !state.active) {
              state.shader = msg.shader;
              activateShader();
            } else if (!msg.enabled && state.active) {
              deactivateShader();
            }
            break;

          case 'setShader':
            state.shader = msg.shader;
            pipeline?.setEffect(EFFECT_MAP[msg.shader]);
            persistState();
            break;

          case 'setIntensity':
            state.intensity = msg.intensity;
            pipeline?.setIntensity(msg.intensity);
            persistState();
            break;

          case 'setSpeed':
            state.speed = msg.speed;
            pipeline?.setSpeed(msg.speed);
            persistState();
            break;

          case 'getState':
            sendResponse(state);
            return true;
        }
      },
    );

    // Clean teardown on extension reload/update
    ctx.onInvalidated(() => {
      if (state.active) deactivateShader();
    });
  },
});
