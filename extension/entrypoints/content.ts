import { defineContentScript } from 'wxt/utils/define-content-script';
import * as THREE from 'three';
import { activate, deactivate } from '@/utils/dom';
import { createScene } from '@/utils/crt-scene';
import { CRT_OVERSCAN, createCRTMaterial } from '@/utils/crt-material';
import { FPSControls } from '@/utils/fps-controls';
import { DrunkPostEffect } from '@/utils/drunk-post';
import { SCREEN_CENTER_Y, SCREEN_CENTER_Z, SCREEN_HALF_W, SCREEN_HALF_H } from '@/utils/scene/constants';
import type { ToContentMessage, CRTState } from '@/utils/messages';

const TAG = '[CRTWorld]';
const SEATED_POS = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z + 0.52);
const SEATED_LOOK = new THREE.Vector3(0, SCREEN_CENTER_Y, SCREEN_CENTER_Z);
const HUD_ID = '__crt-hud';
const DECAY_DURATION = 60; // seconds from 100% to 0%
const DRINK_AMOUNT = 0.34; // each chug adds ~34%, 3 drinks to blackout
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
    let settingsPanel: HTMLDivElement | null = null;
    let settingsVisible = false;
    let drunkIntensity = 0;
    let drunkTarget = 0;
    let drunkPost: DrunkPostEffect | null = null;
    let beerCanGroup: THREE.Group | null = null;
    let drinkAnim = -1; // -1 = inactive, 0-1 = animating
    let musicPlaying = false;
    let musicIframe: HTMLIFrameElement | null = null;
    let nearRecordPlayer = false;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 4; // max interaction distance
    let interactTarget: string | null = null;
    let selectedRecord = 0;
    let playingRecord = -1;

    // Blackout sequence state
    type BlackoutPhase = 'none' | 'falling' | 'black' | 'waking';
    let blackoutPhase: BlackoutPhase = 'none';
    let blackoutTimer = 0;
    let blackoutOverlay: HTMLDivElement | null = null;
    let blackoutStartPos = new THREE.Vector3();
    let blackoutStartQuat = new THREE.Quaternion();
    // Head-on-desk pose: slumped sideways on the desk looking at the CRT
    const BLACKOUT_POS = new THREE.Vector3(0.15, SCREEN_CENTER_Y - 0.1, SCREEN_CENTER_Z + 0.6);
    const BLACKOUT_QUAT = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.1, 0, Math.PI / 2.5), // tilted sideways
    );

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
      const scaleX = bounds.width * CRT_OVERSCAN / vw;
      const scaleY = bounds.height * CRT_OVERSCAN / vh;
      const offsetX = bounds.width * (CRT_OVERSCAN - 1) * 0.5;
      const offsetY = bounds.height * (CRT_OVERSCAN - 1) * 0.5;

      wrapper.style.transformOrigin = '0 0';
      wrapper.style.transform =
        `translate(${bounds.x - offsetX}px, ${bounds.y - offsetY}px) scale(${scaleX}, ${scaleY})`;
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
      } else if (interactTarget === 'record' && sceneData) {
        hud.classList.remove('seated');
        const rec = sceneData.records[selectedRecord];
        prompt.innerHTML =
          `<kbd>&larr;</kbd><kbd>&rarr;</kbd> browse &middot; <kbd>E</kbd> play &middot; ${rec.name}` + beerHint;
      } else if (interactTarget === 'beer' && !beerCanGroup) {
        hud.classList.remove('seated');
        prompt.innerHTML = '<kbd>E</kbd> grab a beer' + beerHint;
      } else if (interactTarget === 'sit') {
        hud.classList.remove('seated');
        prompt.innerHTML = '<kbd>E</kbd> sit down' + beerHint;
      } else {
        hud.classList.remove('seated');
        prompt.innerHTML = '<kbd>WASD</kbd> to move' + beerHint;
      }
    }

    function onResizeDrunk() {
      drunkPost?.resize(window.innerWidth, window.innerHeight);
    }

    const SHADER_TOGGLES = [
      { key: 'dither', label: 'PS1 Dither', target: 'post' },
      { key: 'sway', label: 'Drunk Sway', target: 'post' },
      { key: 'doubleVision', label: 'Double Vision', target: 'post' },
      { key: 'chromatic', label: 'Chromatic Aberration', target: 'post' },
      { key: 'blur', label: 'Drunk Blur', target: 'post' },
      { key: 'vignette', label: 'Vignette', target: 'post' },
      { key: 'barrel', label: 'Barrel Distortion', target: 'crt' },
      { key: 'scanlines', label: 'Scanlines', target: 'crt' },
      { key: 'phosphor', label: 'Phosphor Subpixels', target: 'crt' },
      { key: 'flicker', label: 'CRT Flicker', target: 'crt' },
      { key: 'reflection', label: 'Glass Reflection', target: 'crt' },
    ];
    const toggleState: Record<string, boolean> = {};
    SHADER_TOGGLES.forEach(t => toggleState[t.key] = true);

    function createSettingsPanel() {
      if (settingsPanel) return;
      settingsPanel = document.createElement('div');
      settingsPanel.id = '__crt-settings';
      let html = `<style>
        #__crt-settings {
          position:fixed; top:10px; right:10px; z-index:2147483647;
          background:rgba(10,10,18,0.92); color:#c0c0e0;
          font:13px system-ui,sans-serif; padding:12px 16px;
          border-radius:8px; border:1px solid rgba(100,100,180,0.3);
          pointer-events:auto; min-width:180px;
        }
        #__crt-settings h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase;
          letter-spacing:1px; color:#808098; }
        #__crt-settings label { display:flex; align-items:center; gap:8px;
          padding:3px 0; cursor:pointer; }
        #__crt-settings label:hover { color:white; }
        #__crt-settings input { accent-color:#6666cc; }
        #__crt-settings .sep { border-top:1px solid rgba(100,100,180,0.2);
          margin:6px 0; }
      </style>`;
      html += '<h3>Shader Toggles <kbd style="float:right;opacity:0.5">`</kbd></h3>';
      html += '<div><strong style="font-size:11px;color:#808098">Post-Processing</strong></div>';
      for (const t of SHADER_TOGGLES) {
        if (t.key === 'barrel') html += '<div class="sep"></div><div><strong style="font-size:11px;color:#808098">CRT Monitor</strong></div>';
        html += `<label><input type="checkbox" data-key="${t.key}" ${toggleState[t.key] ? 'checked' : ''}> ${t.label}</label>`;
      }
      settingsPanel.innerHTML = html;
      settingsPanel.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const key = input.dataset.key;
        if (!key) return;
        toggleState[key] = input.checked;
        const toggle = SHADER_TOGGLES.find(t => t.key === key);
        if (!toggle) return;
        if (toggle.target === 'post' && drunkPost) {
          drunkPost.setToggle(key, input.checked);
        } else if (toggle.target === 'crt' && crtMaterial) {
          crtMaterial.uniforms[`u_${key}`].value = input.checked ? 1 : 0;
        }
      });
      document.body.appendChild(settingsPanel);
    }

    function toggleSettings() {
      settingsVisible = !settingsVisible;
      if (settingsVisible) {
        createSettingsPanel();
        if (settingsPanel) settingsPanel.style.display = '';
      } else if (settingsPanel) {
        settingsPanel.style.display = 'none';
      }
    }

    function createBlackoutOverlay() {
      if (blackoutOverlay) return;
      blackoutOverlay = document.createElement('div');
      blackoutOverlay.style.cssText =
        'position:fixed;inset:0;background:black;z-index:2147483647;opacity:0;transition:opacity 0.8s;pointer-events:none;';
      document.body.appendChild(blackoutOverlay);
    }

    function setBlackoutOpacity(v: number) {
      if (blackoutOverlay) blackoutOverlay.style.opacity = String(v);
    }

    function removeBlackoutOverlay() {
      blackoutOverlay?.remove();
      blackoutOverlay = null;
    }

    function triggerBlackout() {
      if (!sceneData || blackoutPhase !== 'none') return;
      blackoutPhase = 'falling';
      blackoutTimer = 0;
      blackoutStartPos.copy(sceneData.camera.position);
      blackoutStartQuat.copy(sceneData.camera.quaternion);
      createBlackoutOverlay();
      // Remove beer from hand
      removeBeerCan3D();
      // Disable controls and unseat so page isn't visible
      removeScreenTransform();
      seated = false;
      if (fps) fps.enabled = false;
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

    function playRecord(index: number) {
      if (!sceneData) return;
      // Stop current
      musicIframe?.remove();
      musicIframe = null;

      selectedRecord = index;
      const rec = sceneData.records[index];

      // Update vinyl label color to match selected record
      (sceneData.labelDisc.material as THREE.MeshStandardMaterial).color.setHex(rec.color);

      // Start YouTube iframe for audio
      musicIframe = document.createElement('iframe');
      musicIframe.src = `https://www.youtube.com/embed/${rec.url}?autoplay=1&loop=1&playlist=${rec.url}`;
      musicIframe.allow = 'autoplay';
      musicIframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-10px;left:-10px;';
      document.body.appendChild(musicIframe);
      musicPlaying = true;
      playingRecord = index;
      updateHUD();
      persistState();
    }

    function stopMusic() {
      musicIframe?.remove();
      musicIframe = null;
      musicPlaying = false;
      playingRecord = -1;
      updateHUD();
      persistState();
    }

    function updateRecordSelection() {
      if (!sceneData) return;
      const mesh = sceneData.recordMeshes[selectedRecord];
      sceneData.selectedIndicator.visible = nearRecordPlayer;
      if (mesh) {
        sceneData.selectedIndicator.position.copy(mesh.position);
        sceneData.selectedIndicator.position.x -= 0.01;
      }
    }



    function activateCRT(restored?: CRTState) {
      if (isActive) return;

      // Show last frame overlay immediately while scene loads
      if (restored?.seated) showFrameOverlay();
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
      drunkTarget = restored?.drunkIntensity ?? 0;
      drunkIntensity = drunkTarget;
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
      fps.colliders = data.colliders;

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

      // Restore state from previous session
      if (restored && fps && sceneData) {
        if (restored.seated) {
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
          requestAnimationFrame(() => applyScreenTransform());
        } else {
          // Restore walking position and look direction
          if (restored.posX != null && restored.posZ != null) {
            sceneData.camera.position.x = restored.posX;
            sceneData.camera.position.z = restored.posZ;
          }
          if (restored.yaw != null && restored.pitch != null) {
            fps.yaw = restored.yaw;
            fps.pitch = restored.pitch;
          }
        }
        // Restore held beer
        if (restored.hasBeer) {
          beerCanGroup = createBeerCanMesh();
          sceneData.camera.add(beerCanGroup);
          updateHUD();
        }
        // Restore music
        if (restored.musicRecord != null) selectedRecord = restored.musicRecord;
        if (restored.musicPlaying) {
          playRecord(selectedRecord);
        }
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
      settingsPanel?.remove(); settingsPanel = null;
      if (musicIframe) { musicIframe.remove(); musicIframe = null; musicPlaying = false; }

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
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
          (document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === '`') {
        toggleSettings();
        return;
      }

      if (e.key === 'Escape' && seated) {
        e.preventDefault();
        e.stopPropagation();
        seated = false;
        seatTransition = 1;
        removeScreenTransform();
        fps.enabled = true;
        // Skip colliders the player is currently inside so they can walk out
        const px = sceneData.camera.position.x;
        const pz = sceneData.camera.position.z;
        for (const c of fps.colliders) {
          if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) {
            fps.skippedColliders.add(c);
          }
        }
        persistState();
        setTimeout(() => {
          fps?.lock();
          updateHUD();
        }, 100);
      }

      if (e.key === 'f' || e.key === 'F') {
        if (beerCanGroup) onDrink();
      }

      if (e.key === 'q' || e.key === 'Q') {
        onToss();
      }

      if (nearRecordPlayer && sceneData) {
        const numRecords = sceneData.records.length;
        if (e.key === 'ArrowLeft') {
          selectedRecord = (selectedRecord - 1 + numRecords) % numRecords;
          updateRecordSelection();
          updateHUD();
        }
        if (e.key === 'ArrowRight') {
          selectedRecord = (selectedRecord + 1) % numRecords;
          updateRecordSelection();
          updateHUD();
        }
      }

      if (e.key === 'e' || e.key === 'E') {
        if (seated || !fps.isLocked || !interactTarget) return;

        if (interactTarget === 'record') {
          if (musicPlaying && playingRecord === selectedRecord) stopMusic();
          else playRecord(selectedRecord);
        } else if (interactTarget === 'beer' && !beerCanGroup && sceneData) {
          beerCanGroup = createBeerCanMesh();
          sceneData.camera.add(beerCanGroup);
          updateHUD();
        } else if (interactTarget === 'sit') {
          seated = true;
          seatTransition = 0;
          seatStartPos.copy(sceneData!.camera.position);
          seatStartQuat.copy(sceneData!.camera.quaternion);
          const lookMat = new THREE.Matrix4().lookAt(
            SEATED_POS, SEATED_LOOK, new THREE.Vector3(0, 1, 0),
          );
          seatTargetQuat.setFromRotationMatrix(lookMat);
          fps.enabled = false;
          fps.unlock();
          updateHUD();
          persistState();
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

        // Raycast from crosshair to find interactable
        raycaster.setFromCamera(new THREE.Vector2(0, 0), sceneData.camera);
        const hits = raycaster.intersectObjects(sceneData.interactables);
        const prevTarget = interactTarget;
        const prevNearRP = nearRecordPlayer;
        interactTarget = hits.length > 0 ? hits[0].object.userData.interaction : null;
        lookingAtDesk = interactTarget === 'sit' || interactTarget === 'beer';
        nearRecordPlayer = interactTarget === 'record';
        if (interactTarget !== prevTarget) updateHUD();
        if (nearRecordPlayer !== prevNearRP) updateRecordSelection();
      }

      // Blackout sequence
      if (blackoutPhase !== 'none' && sceneData) {
        blackoutTimer += dt;
        if (blackoutPhase === 'falling') {
          // 1.5s: camera slumps onto desk, screen fades to black
          const t = Math.min(blackoutTimer / 1.5, 1);
          const s = t * t; // ease in
          sceneData.camera.position.lerpVectors(blackoutStartPos, BLACKOUT_POS, s);
          sceneData.camera.quaternion.slerpQuaternions(blackoutStartQuat, BLACKOUT_QUAT, s);
          setBlackoutOpacity(t);
          if (t >= 1) { blackoutPhase = 'black'; blackoutTimer = 0; }
        } else if (blackoutPhase === 'black') {
          // 3s: fully black, "passed out"
          setBlackoutOpacity(1);
          if (blackoutTimer > 3) { blackoutPhase = 'waking'; blackoutTimer = 0; drunkTarget = 0; drunkIntensity = 0; }
        } else if (blackoutPhase === 'waking') {
          // Start on your side at desk level, blink open with eyelid shutters
          // First 1s: initial blink open from black
          // Then 4s: slow head lift with blink shutters
          const totalWake = 5;
          const t = Math.min(blackoutTimer / totalWake, 1);

          // Camera: start at blackout pose, slowly lift to seated
          const liftT = Math.max(0, (blackoutTimer - 0.8) / (totalWake - 0.8));
          const s = liftT * liftT * (3 - 2 * liftT);
          sceneData.camera.position.lerpVectors(BLACKOUT_POS, SEATED_POS, s);
          const lookMat = new THREE.Matrix4().lookAt(
            SEATED_POS, SEATED_LOOK, new THREE.Vector3(0, 1, 0),
          );
          const wakeQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
          sceneData.camera.quaternion.slerpQuaternions(BLACKOUT_QUAT, wakeQuat, s);

          // Eyelid blink effect: two black bars (top and bottom) that open and close
          if (blackoutOverlay) {
            // Switch to eyelid mode on first frame
            if (blackoutOverlay.childElementCount === 0) {
              blackoutOverlay.style.background = 'none';
              blackoutOverlay.style.opacity = '1';
              const topLid = document.createElement('div');
              topLid.className = '__crt-lid-top';
              topLid.style.cssText = 'position:absolute;top:0;left:0;right:0;background:black;height:50%;transition:none;';
              const bottomLid = document.createElement('div');
              bottomLid.className = '__crt-lid-bottom';
              bottomLid.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:black;height:50%;transition:none;';
              blackoutOverlay.appendChild(topLid);
              blackoutOverlay.appendChild(bottomLid);
            }
            const topLid = blackoutOverlay.querySelector('.__crt-lid-top') as HTMLElement;
            const bottomLid = blackoutOverlay.querySelector('.__crt-lid-bottom') as HTMLElement;

            // Blink pattern: start closed, flutter open
            let openAmount = 0; // 0 = fully closed, 1 = fully open
            if (blackoutTimer < 0.6) {
              // Closed
              openAmount = 0;
            } else if (blackoutTimer < 1.0) {
              // First peek
              openAmount = ((blackoutTimer - 0.6) / 0.4) * 0.3;
            } else if (blackoutTimer < 1.3) {
              // Close again
              openAmount = 0.3 * (1 - (blackoutTimer - 1.0) / 0.3);
            } else if (blackoutTimer < 1.8) {
              // Open wider
              openAmount = ((blackoutTimer - 1.3) / 0.5) * 0.5;
            } else if (blackoutTimer < 2.1) {
              // Close briefly
              openAmount = 0.5 * (1 - (blackoutTimer - 1.8) / 0.3);
            } else if (blackoutTimer < 3.0) {
              // Open mostly
              openAmount = ((blackoutTimer - 2.1) / 0.9) * 0.85;
            } else if (blackoutTimer < 3.3) {
              // Quick blink
              const bt = (blackoutTimer - 3.0) / 0.3;
              openAmount = 0.85 * (bt < 0.5 ? 1 - bt * 2 : (bt - 0.5) * 2);
            } else {
              // Fully open
              openAmount = Math.min(1, 0.85 + (blackoutTimer - 3.3) / 1.0 * 0.15);
            }

            const lidH = 50 * (1 - openAmount);
            topLid.style.height = `${lidH}%`;
            bottomLid.style.height = `${lidH}%`;
          }

          if (blackoutTimer > totalWake) {
            blackoutPhase = 'none';
            removeBlackoutOverlay();
            seated = true;
            seatTransition = 1;
            seatTargetQuat.copy(wakeQuat);
            sceneData.camera.position.copy(SEATED_POS);
            sceneData.camera.quaternion.copy(wakeQuat);
            if (fps) fps.enabled = false;
            requestAnimationFrame(() => applyScreenTransform());
            updateHUD();
          }
        }
      }

      // Decay drunk target and smoothly lerp intensity toward it
      if (blackoutPhase === 'none' && drunkTarget > 0) {
        drunkTarget = Math.max(0, drunkTarget - dt / DECAY_DURATION);
      }
      drunkIntensity += (drunkTarget - drunkIntensity) * Math.min(dt * 3, 1);
      if (drunkIntensity > 0 && Math.random() < 0.02) persistState();

      // Animate held beer can
      if (beerCanGroup) {
        if (drinkAnim >= 0) {
          drinkAnim += dt * 2; // ~0.5s animation
          if (drinkAnim >= 1) {
            // Drinking complete — add drunkenness, keep can
            drunkTarget = Math.min(1.0, drunkTarget + DRINK_AMOUNT);
            if (drunkTarget >= 1.0) triggerBlackout();
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

      // Record player animation
      if (sceneData.vinyl) {
        if (musicPlaying) sceneData.vinyl.rotation.y += dt * 1.5;
        // Tonearm: 0.4 = resting (away), 0.05 = playing (over record)
        const targetArm = musicPlaying ? -0.7 : 0.4;
        const arm = sceneData.tonearmGroup;
        arm.rotation.y += (targetArm - arm.rotation.y) * Math.min(dt * 3, 1);
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

      // Save frame snapshot + state every 2 seconds for seamless page transitions
      if (timestamp - lastSnapshotTime > 2000) {
        lastSnapshotTime = timestamp;
        saveFrameSnapshot();
        persistState();
      }

      rafId = requestAnimationFrame(renderLoop);
    }

    function persistState() {
      const state: CRTState = {
        active: isActive,
        seated,
        drunkIntensity: drunkTarget,
        hasBeer: !!beerCanGroup,
        musicPlaying,
        musicRecord: selectedRecord,
      };
      if (fps && sceneData && !seated) {
        state.posX = sceneData.camera.position.x;
        state.posZ = sceneData.camera.position.z;
        state.yaw = (fps as any).yaw;
        state.pitch = (fps as any).pitch;
      }
      chrome.storage.local.set({ crtState: state });
    }

    chrome.storage.local.get('crtState', (result) => {
      const state = result.crtState as CRTState | undefined;
      if (state?.active) {
        console.log(TAG, 'Restoring state', state);
        activateCRT(state);
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
