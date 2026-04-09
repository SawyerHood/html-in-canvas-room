import { defineContentScript } from 'wxt/utils/define-content-script';
import * as THREE from 'three';
import { activate, deactivate } from '@/utils/dom';
import { createScene } from '@/utils/crt-scene';
import { createCRTMaterial } from '@/utils/crt-material';
import { FPSControls } from '@/utils/fps-controls';
import { DrunkPostEffect } from '@/utils/drunk-post';
import { SCREEN_CENTER_Y, SCREEN_CENTER_Z, SCREEN_HALF_W, SCREEN_HALF_H } from '@/utils/scene/constants';
import type { ToContentMessage, CRTState } from '@/utils/messages';

const TAG = '[CRTWorld]';
const SEATED_POS = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z + 0.45);
const SEATED_LOOK = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z);
const DESK_CENTER = new THREE.Vector3(0, SCREEN_CENTER_Y, -2.5);
const SIT_DISTANCE = 5.0;
const HUD_ID = '__crt-hud';
const DECAY_DURATION = 60; // seconds from 100% to 0%
const DRINK_AMOUNT = 0.2;  // each chug adds 20%
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
    let frameOverlay: HTMLImageElement | null = null;
    let lastSnapshotTime = 0;
    let hasRenderedFirstFrame = false;
    let drunkIntensity = 0;
    let drunkPost: DrunkPostEffect | null = null;
    let beerCanGroup: THREE.Group | null = null;
    let drinkAnim = -1; // -1 = inactive, 0-1 = animating

    // Beer can resting pose in camera space
    const BEER_REST_POS = new THREE.Vector3(0.12, -0.10, -0.25);
    const BEER_REST_ROT = new THREE.Euler(-0.1, 0, 0.1);

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

    // The early-loading frame-overlay.content.ts may have already placed an overlay.
    // Find it, or create one as fallback.
    function showFrameOverlay() {
      const existing = document.getElementById('__crt-frame-overlay');
      if (existing instanceof HTMLImageElement) {
        frameOverlay = existing;
        console.log(TAG, 'Found early frame overlay');
        return;
      }
      // Fallback: create our own
      chrome.storage.local.get('crtLastFrame', (result) => {
        if (!result.crtLastFrame) return;
        frameOverlay = document.createElement('img');
        frameOverlay.id = '__crt-frame-overlay';
        frameOverlay.src = result.crtLastFrame;
        frameOverlay.style.cssText =
          'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;object-fit:cover;pointer-events:none;';
        document.body.appendChild(frameOverlay);
        console.log(TAG, 'Frame overlay created (fallback)');
      });
    }

    function hideFrameOverlay() {
      // Hide whichever overlay exists (early or fallback)
      const el = frameOverlay || document.getElementById('__crt-frame-overlay');
      if (!el) return;
      (el as HTMLElement).style.transition = 'opacity 0.3s';
      (el as HTMLElement).style.opacity = '0';
      setTimeout(() => {
        el.remove();
        frameOverlay = null;
      }, 300);
      console.log(TAG, 'Frame overlay hidden');
    }

    // Save a frame snapshot to storage for next page load
    function saveFrameSnapshot() {
      if (!canvas) return;
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        chrome.storage.local.set({ crtLastFrame: dataUrl });
      } catch { /* ignore */ }
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
      const beerHint = beerCanGroup
        ? ' &middot; <kbd>F</kbd> drink &middot; <kbd>Q</kbd> toss'
        : '';
      if (seated) {
        hud.classList.add('seated');
        prompt.innerHTML =
          'Click &amp; scroll to browse &middot; <kbd>Escape</kbd> to stand' + beerHint;
      } else if (!fps?.isLocked) {
        hud.classList.remove('seated');
        prompt.innerHTML = 'Click to look around &middot; <kbd>WASD</kbd> to move';
      } else if (lookingAtDesk) {
        hud.classList.remove('seated');
        prompt.innerHTML =
          '<kbd>E</kbd> sit &middot; <kbd>F</kbd> grab a beer' + beerHint;
      } else {
        hud.classList.remove('seated');
        prompt.innerHTML = '<kbd>WASD</kbd> to move' + beerHint;
      }
    }

    function onResizeDrunk() {
      drunkPost?.resize(window.innerWidth, window.innerHeight);
    }

    function createBeerCanMesh(): THREE.Group {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xc8a84e, metalness: 0.5, roughness: 0.3,
      });
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.08, 16), bodyMat,
      );
      group.add(body);
      // Green label band
      const label = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0205, 0.0205, 0.035, 16),
        new THREE.MeshStandardMaterial({ color: 0x1a5c2a, roughness: 0.8 }),
      );
      label.position.y = -0.005;
      group.add(label);
      // Top rim
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.02, 0.004, 16),
        new THREE.MeshStandardMaterial({ color: 0xd4b85a, metalness: 0.6, roughness: 0.3 }),
      );
      top.position.y = 0.042;
      group.add(top);
      // Tab
      const tab = new THREE.Mesh(
        new THREE.BoxGeometry(0.006, 0.002, 0.015),
        new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.4, roughness: 0.4 }),
      );
      tab.position.set(0, 0.045, 0.005);
      group.add(tab);

      group.position.copy(BEER_REST_POS);
      group.rotation.copy(BEER_REST_ROT);
      return group;
    }

    function removeBeerCan3D() {
      if (beerCanGroup) {
        beerCanGroup.parent?.remove(beerCanGroup);
        beerCanGroup = null;
      }
      drinkAnim = -1;
      updateHUD();
    }

    function onDrink() {
      if (!beerCanGroup || drinkAnim >= 0) return;
      drinkAnim = 0; // start drink animation
    }

    function onToss() {
      removeBeerCan3D();
    }



    function activateCRT(startSeated = false, restoredDrunk = 0) {
      if (isActive) return;

      // Show last frame overlay immediately while scene loads
      if (startSeated) showFrameOverlay();
      hasRenderedFirstFrame = false;

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

      // Drunk post-processing (shader-based)
      drunkIntensity = restoredDrunk;
      drunkPost = new DrunkPostEffect(
        window.innerWidth, window.innerHeight,
        renderer.toneMappingExposure,
      );
      window.addEventListener('resize', onResizeDrunk);

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


      window.removeEventListener('resize', onResizeDrunk);
      removeBeerCan3D();

      if (drunkPost) { drunkPost.dispose(); drunkPost = null; }
      drunkIntensity = 0;

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

      if (e.key === 'f' || e.key === 'F') {
        if (beerCanGroup) {
          onDrink();
        } else if (!seated && fps.isLocked && lookingAtDesk && sceneData) {
          beerCanGroup = createBeerCanMesh();
          sceneData.camera.add(beerCanGroup);
          updateHUD();
        }
      }

      if (e.key === 'q' || e.key === 'Q') {
        onToss();
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

      // Decay drunk intensity
      if (drunkIntensity > 0) {
        drunkIntensity = Math.max(0, drunkIntensity - dt / DECAY_DURATION);
        if (Math.random() < 0.02) persistState();
      }

      // Animate held beer can
      if (beerCanGroup) {
        if (drinkAnim >= 0) {
          drinkAnim += dt * 2; // ~0.5s animation
          if (drinkAnim >= 1) {
            // Drinking complete — add drunkenness, keep can
            drunkIntensity = Math.min(1.0, drunkIntensity + DRINK_AMOUNT);
            drinkAnim = -1;
            persistState();
          } else {
            // Smoothstep for nice easing
            const t = drinkAnim * drinkAnim * (3 - 2 * drinkAnim);
            // Tilt can up toward camera (like chugging)
            beerCanGroup.position.set(
              BEER_REST_POS.x * (1 - t * 0.5),
              BEER_REST_POS.y + t * 0.12,
              BEER_REST_POS.z - t * 0.08,
            );
            beerCanGroup.rotation.set(
              BEER_REST_ROT.x + t * 1.5, // tilt toward camera
              BEER_REST_ROT.y,
              BEER_REST_ROT.z * (1 - t),
            );
          }
        } else {
          // Idle wobble when drunk
          const w = drunkIntensity * 0.05;
          beerCanGroup.position.copy(BEER_REST_POS);
          beerCanGroup.rotation.set(
            BEER_REST_ROT.x + Math.cos(time * 2) * w * 0.5,
            BEER_REST_ROT.y,
            BEER_REST_ROT.z + Math.sin(time * 3) * w,
          );
        }
      }

      // Shader time + scene animations
      crtMaterial.uniforms.u_time.value = time;
      sceneData.animate(time, dt);

      // Update drunk post-processing
      if (drunkPost) {
        drunkPost.setIntensity(drunkIntensity);
        drunkPost.setTime(time);
      }

      // Render through post-processing (dither always on, drunk effects gated by intensity)
      if (drunkPost) {
        drunkPost.render(renderer, sceneData.scene, sceneData.camera);
      } else {
        renderer.render(sceneData.scene, sceneData.camera);
      }

      // After first successful render, hide the loading overlay
      if (!hasRenderedFirstFrame && timestamp - startTime > 500) {
        hasRenderedFirstFrame = true;
        hideFrameOverlay();
      }

      // Save frame snapshot every 2 seconds for seamless page transitions
      if (timestamp - lastSnapshotTime > 2000) {
        lastSnapshotTime = timestamp;
        saveFrameSnapshot();
      }

      rafId = requestAnimationFrame(renderLoop);
    }

    function persistState() {
      chrome.storage.local.set({
        crtState: { active: isActive, seated, drunkIntensity } as CRTState,
      });
    }

    chrome.storage.local.get('crtState', (result) => {
      const state = result.crtState as CRTState | undefined;
      if (state?.active) {
        console.log(TAG, 'Restoring state, seated:', state.seated, 'drunk:', state.drunkIntensity);
        activateCRT(state.seated ?? false, state.drunkIntensity ?? 0);
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
