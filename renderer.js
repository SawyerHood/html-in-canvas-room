// WebGL rendering pipeline for HTML-in-Canvas shader effects

import { VERTEX_SOURCE, FRAGMENT_SOURCE, createProgram, getUniformLocations } from './shaders.js';
import { initValidation } from './validation.js';

const TRANSITION_SPEED = 5.0;

const canvas = document.getElementById('main-canvas');
const fallback = document.getElementById('fallback');

// --- Feature detection ---
const gl = canvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false });

if (!gl || typeof gl.texElementImage2D !== 'function') {
  fallback.hidden = false;
  canvas.style.display = 'none';
  throw new Error('HTML-in-Canvas API not available. Enable chrome://flags/#canvas-draw-element in Chrome Canary.');
}

// --- DPR handling ---
const dpr = window.devicePixelRatio || 1;
const cssWidth = 480;
const cssHeight = 700;
canvas.width = cssWidth * dpr;
canvas.height = cssHeight * dpr;
canvas.style.width = cssWidth + 'px';
canvas.style.height = cssHeight + 'px';

// --- Shader setup ---
const program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
const uniforms = getUniformLocations(gl, program);

// --- Quad geometry (unit square, TRIANGLE_STRIP) ---
const quadVerts = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const vao = gl.createVertexArray();
const vbo = gl.createBuffer();
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.bindVertexArray(null);

// --- Field setup ---
const fieldNames = ['username', 'email', 'password', 'confirm', 'submit'];
const fields = fieldNames.map((name) => {
  const element = document.querySelector(`.field-group[data-field="${name}"]`);
  const texture = gl.createTexture();

  // Initialize texture with placeholder (texElementImage2D may not be ready yet)
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    name,
    element,
    texture,
    needsUpload: true,
    anim: { neutral: 1.0, focus: 0.0, valid: 0.0, invalid: 0.0 },
    targetState: 'untouched',
  };
});

// --- Texture upload ---
function uploadTexture(field) {
  gl.bindTexture(gl.TEXTURE_2D, field.texture);
  try {
    gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, field.element);
  } catch (e) {
    // Element may not be ready for first frame; will retry next frame
    field.needsUpload = true;
  }
}

// --- Paint event: mark changed elements for re-upload ---
canvas.addEventListener('paint', (e) => {
  for (const changed of e.changedElements) {
    for (const field of fields) {
      if (field.element === changed || field.element.contains(changed)) {
        field.needsUpload = true;
        break;
      }
    }
  }
});

// --- State change callback from validation ---
function onStateChange(fieldName, state) {
  const field = fields.find((f) => f.name === fieldName);
  if (field) field.targetState = state;
}

// --- Animation interpolation ---
function updateAnimations(dt) {
  const speed = TRANSITION_SPEED * dt;
  for (const field of fields) {
    const targets = {
      neutral: field.targetState === 'untouched' ? 1.0 : 0.0,
      focus: field.targetState === 'focused' ? 1.0 : 0.0,
      valid: field.targetState === 'valid' ? 1.0 : 0.0,
      invalid: field.targetState === 'invalid' ? 1.0 : 0.0,
    };
    field.anim.neutral += (targets.neutral - field.anim.neutral) * Math.min(speed, 1.0);
    field.anim.focus += (targets.focus - field.anim.focus) * Math.min(speed, 1.0);
    field.anim.valid += (targets.valid - field.anim.valid) * Math.min(speed, 1.0);
    field.anim.invalid += (targets.invalid - field.anim.invalid) * Math.min(speed, 1.0);
  }
}

// --- Coordinate mapping ---
function getQuadRect(element) {
  const canvasRect = canvas.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();

  // Normalized [0, 1] within the canvas CSS box
  const nx = (elRect.left - canvasRect.left) / canvasRect.width;
  const ny = (elRect.top - canvasRect.top) / canvasRect.height;
  const nw = elRect.width / canvasRect.width;
  const nh = elRect.height / canvasRect.height;

  // Convert to clip space: x [0,1] -> [-1,1], y [0,1] -> [1,-1]
  return {
    x: nx * 2.0 - 1.0,
    y: 1.0 - ny * 2.0,
    w: nw * 2.0,
    h: nh * 2.0,
  };
}

// --- Render loop ---
let lastTime = 0;

function render(timestamp) {
  const t = timestamp / 1000;
  const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
  lastTime = timestamp;

  updateAnimations(dt);

  // Upload dirty textures
  for (const field of fields) {
    if (field.needsUpload) {
      uploadTexture(field);
      field.needsUpload = false;
    }
  }

  // Clear
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.039, 0.039, 0.059, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  for (const field of fields) {
    const rect = getQuadRect(field.element);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, field.texture);
    gl.uniform1i(uniforms.u_texture, 0);

    gl.uniform2f(uniforms.u_quadPos, rect.x, rect.y);
    gl.uniform2f(uniforms.u_quadSize, rect.w, rect.h);
    gl.uniform1f(uniforms.u_time, t);
    gl.uniform1f(uniforms.u_neutralIntensity, field.anim.neutral);
    gl.uniform1f(uniforms.u_focusIntensity, field.anim.focus);
    gl.uniform1f(uniforms.u_validIntensity, field.anim.valid);
    gl.uniform1f(uniforms.u_invalidIntensity, field.anim.invalid);

    // Submit button: clean pass-through normally, subtle effect when valid
    const effectScale = field.name === 'submit' ? field.anim.valid * 0.4 : 1.0;
    gl.uniform1f(uniforms.u_effectScale, effectScale);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  requestAnimationFrame(render);
}

// --- Initial texture upload after first paint ---
canvas.addEventListener('paint', function initialPaint() {
  canvas.removeEventListener('paint', initialPaint);
  for (const field of fields) {
    uploadTexture(field);
    field.needsUpload = false;
  }
});

// Force an initial paint
if (canvas.requestPaint) {
  canvas.requestPaint();
}

// --- Initialize validation and start rendering ---
initValidation(onStateChange);
requestAnimationFrame(render);
