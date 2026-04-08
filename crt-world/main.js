import * as THREE from 'three';
import { createScene } from './scene.js';
import { createCRTMaterial } from './crt-material.js';

// --- Feature detection ---
const captureCanvas = document.getElementById('capture');
const captureCtx = captureCanvas.getContext('2d');

if (!captureCtx || typeof captureCtx.drawElementImage !== 'function') {
  document.getElementById('fallback').hidden = false;
  document.getElementById('scene').style.display = 'none';
  throw new Error('HTML-in-Canvas API not available');
}

// --- Setup 3D scene ---
const sceneCanvas = document.getElementById('scene');
const { renderer, scene, camera, controls, screenMesh } = createScene(sceneCanvas);

// --- Create texture from capture canvas ---
const pageDiv = document.getElementById('page-content');
const screenTexture = new THREE.CanvasTexture(captureCanvas);
screenTexture.minFilter = THREE.LinearFilter;
screenTexture.magFilter = THREE.LinearFilter;

// --- Apply CRT material to screen ---
const crtMaterial = createCRTMaterial(screenTexture);
screenMesh.material = crtMaterial;

// --- Capture page content and mark texture dirty on paint events ---
let textureDirty = true;

captureCanvas.addEventListener('paint', () => {
  textureDirty = true;
});

if (captureCanvas.requestPaint) {
  captureCanvas.requestPaint();
}

// --- Animation loop ---
function animate(timestamp) {
  requestAnimationFrame(animate);

  const time = timestamp / 1000;

  // Capture HTML content to the 2D canvas
  if (textureDirty) {
    try {
      captureCtx.drawElementImage(pageDiv, 0, 0, 1024, 768);
      screenTexture.needsUpdate = true;
      textureDirty = false;
    } catch {
      // Element not ready yet, retry next frame
    }
  }

  // Update CRT shader time
  crtMaterial.uniforms.u_time.value = time;

  // Update orbit controls
  controls.update();

  // Render
  renderer.render(scene, camera);
}

// Start after a brief delay to let layoutsubtree children settle
setTimeout(() => {
  textureDirty = true;
  requestAnimationFrame(animate);
}, 100);
