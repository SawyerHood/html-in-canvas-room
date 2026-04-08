import { defineContentScript } from 'wxt/utils/define-content-script';
import * as THREE from 'three';
import { activate, deactivate } from '@/utils/dom';
import { createScene } from '@/utils/crt-scene';
import { createCRTMaterial } from '@/utils/crt-material';
import { FPSControls } from '@/utils/fps-controls';
import type { ToContentMessage, CRTState } from '@/utils/messages';

const TAG = '[CRTWorld]';
// Monitor sits on desk (top=0.75), screen center at desk+0.3=1.05
const SCREEN_CENTER_Y = 0.75 + 0.3;  // DESK_TOP + screen local y
const SCREEN_CENTER_Z = 0.1 + 0.295; // monitorGroup z + screen local z
const SEATED_POS = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z + 0.45);
const SEATED_LOOK = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z);
const DESK_CENTER = new THREE.Vector3(0, SCREEN_CENTER_Y, 0);
const SIT_DISTANCE = 3.5;
const HUD_ID = '__crt-hud';

// Screen mesh dimensions (must match crt-scene.ts)
const SCREEN_HALF_W = 0.54 / 2;
const SCREEN_HALF_H = 0.40 / 2;
const SCREEN_Y = SCREEN_CENTER_Y;
const SCREEN_Z = SCREEN_CENTER_Z;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main(ctx) {
    let isActive = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let sceneData: ReturnType<typeof createScene> | null = null;
    let crtMaterial: THREE.ShaderMaterial | null = null;
    let glTexture: WebGLTexture | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let wrapper: HTMLDivElement | null = null;
    let fps: FPSControls | null = null;
    let rafId = 0;
    let dirty = true;
    let seated = false;
    let seatTransition = 0;
    let seatStartPos = new THREE.Vector3();
    let seatStartQuat = new THREE.Quaternion();
    let seatTargetQuat = new THREE.Quaternion();
    let lookingAtDesk = false;
    let hud: HTMLDivElement | null = null;

    // Project the CRT screen corners to viewport coordinates
    function getScreenBounds(camera: THREE.PerspectiveCamera): DOMRect | null {
      // Ensure matrices are up to date (critical on first frame / after restore)
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const corners = [
        new THREE.Vector3(-SCREEN_HALF_W, SCREEN_Y - SCREEN_HALF_H, SCREEN_Z),
        new THREE.Vector3(SCREEN_HALF_W, SCREEN_Y - SCREEN_HALF_H, SCREEN_Z),
        new THREE.Vector3(-SCREEN_HALF_W, SCREEN_Y + SCREEN_HALF_H, SCREEN_Z),
        new THREE.Vector3(SCREEN_HALF_W, SCREEN_Y + SCREEN_HALF_H, SCREEN_Z),
      ];

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (const c of corners) {
        c.project(camera);
        // Check if behind camera
        if (c.z > 1) return null;
        const sx = (c.x + 1) / 2 * window.innerWidth;
        const sy = (1 - c.y) / 2 * window.innerHeight;
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx);
        maxY = Math.max(maxY, sy);
      }

      return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }

    // Apply CSS transform to wrapper so its children align with the CRT screen
    // on the viewport. layoutsubtree spec: transforms affect hit testing but NOT
    // texElementImage2D drawing, so native events route correctly while texture
    // capture is unchanged.
    function applyScreenTransform() {
      if (!wrapper || !sceneData) return;
      const bounds = getScreenBounds(sceneData.camera as THREE.PerspectiveCamera);
      if (!bounds) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleX = bounds.width / vw;
      const scaleY = bounds.height / vh;

      wrapper.style.transformOrigin = '0 0';
      wrapper.style.transform =
        `translate(${bounds.x}px, ${bounds.y}px) scale(${scaleX}, ${scaleY})`;
      wrapper.style.pointerEvents = 'auto';
    }

    function removeScreenTransform() {
      if (!wrapper) return;
      wrapper.style.transform = '';
      wrapper.style.transformOrigin = '';
      wrapper.style.pointerEvents = '';
    }

    function createHUD() {
      hud = document.createElement('div');
      hud.id = HUD_ID;
      hud.innerHTML = `
        <style>
          #${HUD_ID} {
            position: fixed; inset: 0; z-index: 2147483647;
            pointer-events: none; font-family: system-ui, sans-serif;
          }
          #${HUD_ID} .crosshair {
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 20px; height: 20px;
          }
          #${HUD_ID} .crosshair::before, #${HUD_ID} .crosshair::after {
            content: ''; position: absolute; background: rgba(255,255,255,0.7);
          }
          #${HUD_ID} .crosshair::before {
            width: 2px; height: 20px; left: 9px; top: 0;
          }
          #${HUD_ID} .crosshair::after {
            width: 20px; height: 2px; top: 9px; left: 0;
          }
          #${HUD_ID} .prompt {
            position: absolute; bottom: 40px; left: 50%;
            transform: translateX(-50%);
            background: rgba(10,10,18,0.85);
            color: #c0c0e0; font-size: 14px;
            padding: 10px 20px; border-radius: 8px;
            border: 1px solid rgba(100,100,180,0.3);
            white-space: nowrap;
          }
          #${HUD_ID} .prompt kbd {
            background: rgba(100,100,180,0.2);
            padding: 2px 6px; border-radius: 4px;
            font-family: inherit; font-size: 12px;
            border: 1px solid rgba(100,100,180,0.3);
          }
          #${HUD_ID}.seated .crosshair { display: none; }
        </style>
        <div class="crosshair"></div>
        <div class="prompt"></div>
      `;
      document.body.appendChild(hud);
    }

    function updateHUD() {
      if (!hud) return;
      const prompt = hud.querySelector('.prompt') as HTMLElement;
      if (seated) {
        hud.classList.add('seated');
        prompt.innerHTML =
          'Click &amp; scroll to browse &middot; <kbd>Escape</kbd> to stand';
      } else if (!fps?.isLocked) {
        hud.classList.remove('seated');
        prompt.innerHTML = 'Click to look around &middot; <kbd>WASD</kbd> to move';
      } else if (lookingAtDesk) {
        hud.classList.remove('seated');
        prompt.innerHTML = 'Press <kbd>E</kbd> to sit down';
      } else {
        hud.classList.remove('seated');
        prompt.innerHTML = '<kbd>WASD</kbd> to move';
      }
    }

    function activateCRT(startSeated = false) {
      if (isActive) return;

      const result = activate();
      if (!result) return;
      canvas = result.canvas;
      wrapper = result.wrapper;

      const data = createScene(canvas);
      sceneData = data;
      renderer = data.renderer;

      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.texElementImage2D !== 'function') {
        console.warn(TAG, 'texElementImage2D not available');
        cleanup();
        return;
      }

      console.log(TAG, 'Activated');

      // GL texture
      glTexture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, glTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const pageTexture = new THREE.Texture();
      pageTexture.minFilter = THREE.LinearFilter;
      pageTexture.magFilter = THREE.LinearFilter;
      pageTexture.generateMipmaps = false;
      const texProps = renderer.properties.get(pageTexture);
      texProps.__webglTexture = glTexture;
      texProps.__webglInit = true;

      crtMaterial = createCRTMaterial(pageTexture);
      data.screenMesh.material = crtMaterial;

      // FPS controls
      fps = new FPSControls(data.camera, canvas);

      // HUD
      createHUD();
      updateHUD();

      // Events
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('paint', onPaint);
      document.addEventListener('keydown', onKeyDown);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      if (canvas.requestPaint) canvas.requestPaint();

      dirty = true;
      seated = false;
      seatTransition = 0;
      rafId = requestAnimationFrame(renderLoop);

      isActive = true;

      // If restoring a seated session, sit down immediately
      if (startSeated && fps && sceneData) {
        seated = true;
        seatTransition = 1;
        sceneData.camera.position.copy(SEATED_POS);
        const lookMat = new THREE.Matrix4().lookAt(
          SEATED_POS, SEATED_LOOK, new THREE.Vector3(0, 1, 0),
        );
        seatTargetQuat.setFromRotationMatrix(lookMat);
        sceneData.camera.quaternion.copy(seatTargetQuat);
        fps.enabled = false;
        updateHUD();
        // Defer transform until after first render so matrices are fully computed
        requestAnimationFrame(() => applyScreenTransform());
      }

      persistState();
    }

    function deactivateCRT() {
      if (!isActive) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;

      removeScreenTransform();

      if (canvas) {
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('paint', onPaint);
        canvas.removeEventListener('wheel', onWheel);
      }
      document.removeEventListener('keydown', onKeyDown);

      if (fps) { fps.dispose(); fps = null; }
      hud?.remove(); hud = null;
      cleanup();
      isActive = false;
      seated = false;
      persistState();
    }

    function cleanup() {
      if (renderer) { renderer.dispose(); renderer = null; }
      sceneData = null;
      crtMaterial = null;
      glTexture = null;
      deactivate();
      canvas = null;
      wrapper = null;
    }

    function onClick() {
      if (!fps || !sceneData || !canvas) return;

      // When seated, native events go directly to wrapper children
      // via the CSS transform — no synthetic dispatch needed
      if (seated) return;

      if (!fps.isLocked) {
        fps.lock();
        updateHUD();
        return;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!fps || !sceneData) return;

      if (e.key === 'Escape' && seated) {
        e.preventDefault();
        e.stopPropagation();
        seated = false;
        seatTransition = 1;
        removeScreenTransform();
        fps.enabled = true;
        persistState();
        setTimeout(() => {
          fps?.lock();
          updateHUD();
        }, 100);
      }

      if (e.key === 'e' || e.key === 'E') {
        if (!seated && fps.isLocked && lookingAtDesk) {
          seated = true;
          seatTransition = 0;
          seatStartPos.copy(sceneData.camera.position);
          seatStartQuat.copy(sceneData.camera.quaternion);
          const lookMat = new THREE.Matrix4().lookAt(
            SEATED_POS, SEATED_LOOK, new THREE.Vector3(0, 1, 0),
          );
          seatTargetQuat.setFromRotationMatrix(lookMat);
          fps.enabled = false;
          fps.unlock();
          updateHUD();
          persistState();
          // Transform will be applied once camera reaches seated position
        }
      }
    }

    function onWheel(e: WheelEvent) {
      if (!seated || !wrapper) return;
      e.preventDefault();
      wrapper.scrollTop += e.deltaY;
      dirty = true;
    }

    function onPaint() {
      dirty = true;
    }

    function uploadPageTexture(): boolean {
      if (!renderer || !wrapper || !glTexture) return false;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      try {
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
        gl.texElementImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wrapper,
        );
        renderer.state.reset();
        return true;
      } catch {
        return false;
      }
    }

    let lastTime = 0;
    let startTime = 0;

    function renderLoop(timestamp: number) {
      if (!renderer || !sceneData || !crtMaterial || !fps) return;

      if (!startTime) startTime = timestamp;
      const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
      lastTime = timestamp;
      const time = timestamp / 1000;

      // Warm-up
      if (timestamp - startTime < 3000) dirty = true;

      // Upload texture
      if (dirty) {
        if (uploadPageTexture()) dirty = false;
      }

      // Seat transition
      if (seated && seatTransition < 1) {
        seatTransition = Math.min(1, seatTransition + dt * 2.5);
        const s = seatTransition * seatTransition * (3 - 2 * seatTransition);
        sceneData.camera.position.lerpVectors(seatStartPos, SEATED_POS, s);
        sceneData.camera.quaternion.slerpQuaternions(seatStartQuat, seatTargetQuat, s);

        // Apply screen transform once transition is mostly complete
        if (seatTransition > 0.95) {
          applyScreenTransform();
        }
      } else if (seated) {
        sceneData.camera.position.copy(SEATED_POS);
        sceneData.camera.quaternion.copy(seatTargetQuat);
      }

      // Walking mode
      if (!seated) {
        if (seatTransition > 0) {
          seatTransition = Math.max(0, seatTransition - dt * 3);
        }
        fps.update(dt);

        // Proximity + facing check for sit prompt
        const cam = sceneData.camera;
        const distToDesk = cam.position.distanceTo(DESK_CENTER);
        const toDesk = new THREE.Vector3().subVectors(DESK_CENTER, cam.position).normalize();
        const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const dot = toDesk.dot(lookDir);
        const wasLooking = lookingAtDesk;
        lookingAtDesk = dot > 0.3 && distToDesk < SIT_DISTANCE;
        if (lookingAtDesk !== wasLooking) updateHUD();
      }

      // Shader time
      crtMaterial.uniforms.u_time.value = time;

      // Render
      renderer.render(sceneData.scene, sceneData.camera);

      rafId = requestAnimationFrame(renderLoop);
    }

    function persistState() {
      chrome.storage.local.set({ crtState: { active: isActive, seated } as CRTState });
    }

    chrome.storage.local.get('crtState', (result) => {
      const state = result.crtState as CRTState | undefined;
      if (state?.active) {
        console.log(TAG, 'Restoring state, seated:', state.seated);
        activateCRT(state.seated ?? false);
      }
    });

    chrome.runtime.onMessage.addListener(
      (msg: ToContentMessage, _sender, sendResponse) => {
        if (msg.type === 'toggle') {
          if (isActive) deactivateCRT();
          else activateCRT();
        } else if (msg.type === 'getState') {
          sendResponse({ active: isActive } as CRTState);
          return true;
        }
      },
    );

    // SPA navigation: page URL changes without full reload — keep scene, just re-upload texture
    ctx.addEventListener(window, 'wxt:locationchange' as any, () => {
      if (isActive) {
        console.log(TAG, 'SPA navigation detected, re-uploading texture');
        dirty = true;
      }
    });

    ctx.onInvalidated(() => {
      if (isActive) deactivateCRT();
    });
  },
});
