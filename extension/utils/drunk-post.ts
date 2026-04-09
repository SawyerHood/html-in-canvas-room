import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Tone-map each sample BEFORE mixing so emissive HDR values don't bleed white.
const fragmentShader = `
precision highp float;
varying vec2 vUv;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_resolution;
uniform float u_exposure;

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float drunkExposure() {
  // Pull exposure down as the effect ramps up so bright pages do not wash out.
  return mix(u_exposure, u_exposure * 0.55, clamp(u_intensity, 0.0, 1.0));
}

// Sample + tone map in one step so HDR spikes are compressed before mixing
vec3 tm(vec2 coord) {
  return aces(texture2D(u_texture, clamp(coord, 0.0, 1.0)).rgb * drunkExposure());
}

void main() {
  float i = u_intensity;
  float t = u_time;
  vec2 uv = vUv;

  vec3 base = tm(uv);
  float luma = dot(base, vec3(0.2126, 0.7152, 0.0722));
  float brightGuard = 1.0 - smoothstep(0.72, 0.98, luma);
  float fx = i * mix(0.35, 1.0, brightGuard);

  // 1. Global sway
  uv.x += sin(t * 1.5) * 0.025 * fx;
  uv.y += cos(t * 1.1) * 0.012 * fx;
  uv.x += sin(t * 0.7 + 1.5) * 0.015 * fx;
  uv.y += cos(t * 0.5 + 0.8) * 0.008 * fx;

  // 2. Hiccup jolts
  float hiccupSeed = floor(t * 2.5);
  float hiccupChance = hash(vec2(hiccupSeed, 42.0));
  float hiccupActive = step(0.92, hiccupChance) * fx;
  float hiccupPhase = fract(t * 2.5);
  float hiccupFade = 1.0 - smoothstep(0.0, 0.3, hiccupPhase);
  vec2 hiccupDir = vec2(
    hash(vec2(hiccupSeed, 13.0)) - 0.5,
    hash(vec2(hiccupSeed, 77.0)) - 0.5
  );
  uv += hiccupDir * 0.04 * hiccupActive * hiccupFade;

  uv = clamp(uv, 0.0, 1.0);

  // 3. Double/triple vision (all samples pre-tone-mapped)
  float visionOffset = 0.010 * fx;
  vec2 off1 = vec2(visionOffset, visionOffset * 0.5);
  vec2 off2 = vec2(-visionOffset * 0.8, visionOffset * 0.7);
  vec3 s0 = tm(uv);
  vec3 s1 = tm(uv + off1);
  vec3 s2 = tm(uv + off2);
  vec3 col = mix(s0, s0 * 0.55 + s1 * 0.27 + s2 * 0.18, fx);

  // 4. Chromatic aberration
  float aberr = 0.006 * fx;
  col.r = tm(uv + vec2(aberr, 0.0)).r * (1.0 - fx)
        + tm(uv + off1 + vec2(aberr, 0.0)).r * fx * 0.45
        + col.r * fx * 0.55;
  col.b = tm(uv - vec2(aberr, 0.0)).b * (1.0 - fx)
        + tm(uv + off2 - vec2(aberr, 0.0)).b * fx * 0.45
        + col.b * fx * 0.55;

  // 5. Blur
  float blurSize = 1.25 * fx / u_resolution.x;
  vec3 blur = col;
  blur += tm(uv + vec2(blurSize, 0.0));
  blur += tm(uv - vec2(blurSize, 0.0));
  blur += tm(uv + vec2(0.0, blurSize));
  blur += tm(uv - vec2(0.0, blurSize));
  col = mix(col, blur / 5.0, fx * 0.45);

  // 6. Vignette + overall dim
  vec2 center = vUv - 0.5;
  float vig = 1.0 - dot(center, center) * 3.0 * fx;
  col *= clamp(vig, 0.0, 1.0);
  col *= 1.0 - fx * 0.38;

  // 7. Linear -> sRGB before dither (so dithering happens in perceptual space)
  col = pow(col, vec3(1.0 / 2.2));

  // 8. PS1-style ordered dither + color quantization (always on)
  float brightness = dot(col, vec3(0.299, 0.587, 0.114));
  float levels = mix(8.0, 48.0, brightness); // chunky in dark areas, smooth on bright screens
  vec2 pixel = floor(gl_FragCoord.xy);
  int px = int(mod(pixel.x, 4.0));
  int py = int(mod(pixel.y, 4.0));
  int idx = px + py * 4;
  // 4x4 Bayer matrix
  float bayer;
  if (idx ==  0) bayer =  0.0; else if (idx ==  1) bayer =  8.0;
  else if (idx ==  2) bayer =  2.0; else if (idx ==  3) bayer = 10.0;
  else if (idx ==  4) bayer = 12.0; else if (idx ==  5) bayer =  4.0;
  else if (idx ==  6) bayer = 14.0; else if (idx ==  7) bayer =  6.0;
  else if (idx ==  8) bayer =  3.0; else if (idx ==  9) bayer = 11.0;
  else if (idx == 10) bayer =  1.0; else if (idx == 11) bayer =  9.0;
  else if (idx == 12) bayer = 15.0; else if (idx == 13) bayer =  7.0;
  else if (idx == 14) bayer = 13.0; else bayer = 5.0;
  float dither = (bayer / 16.0 - 0.5) / levels;
  col = floor((col + dither) * levels) / levels;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class DrunkPostEffect {
  private rt: THREE.WebGLRenderTarget;
  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;

  constructor(width: number, height: number, exposure: number) {
    const dpr = window.devicePixelRatio || 1;
    this.rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, {
      type: THREE.HalfFloatType,
    });

    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_texture: { value: this.rt.texture },
        u_time: { value: 0 },
        u_intensity: { value: 0 },
        u_resolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
        u_exposure: { value: exposure },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  get intensity(): number {
    return this.material.uniforms.u_intensity.value;
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    // Always render through the pipeline (dither is always on, drunk effects gated by intensity)

    // Save renderer state — we take full control of tone mapping + color space
    const savedToneMapping = renderer.toneMapping;
    const savedOutputColorSpace = renderer.outputColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    // Render scene to half-float RT — raw linear HDR (no tone mapping, no gamma)
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Quad applies ACES + sRGB gamma + dither in the shader
    this.material.uniforms.u_texture.value = this.rt.texture;
    renderer.render(this.quadScene, this.quadCamera);

    // Restore renderer state
    renderer.toneMapping = savedToneMapping;
    renderer.outputColorSpace = savedOutputColorSpace;
  }

  setIntensity(v: number) {
    this.material.uniforms.u_intensity.value = v;
  }

  setTime(t: number) {
    this.material.uniforms.u_time.value = t;
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.rt.setSize(width * dpr, height * dpr);
    this.material.uniforms.u_resolution.value.set(width * dpr, height * dpr);
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
  }
}
