import * as THREE from 'three';

export const CRT_OVERSCAN = 1.05;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;

uniform sampler2D u_texture;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_barrel;
uniform float u_scanlines;
uniform float u_phosphor;
uniform float u_flicker;
uniform float u_reflection;

float roundedRectSDF(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + vec2(radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 uv = vUv;

  // 1. Barrel distortion
  vec2 center = uv - 0.5;
  float r2 = dot(center, center);
  if (u_barrel > 0.5) uv = uv + center * r2 * 0.055;

  // 2. Screen bounds mask
  float border = 0.0005;
  float edge = 0.004;
  float cornerRadius = 0.014;
  float mask = 1.0 - smoothstep(
    0.0,
    edge,
    roundedRectSDF(uv - 0.5, vec2(0.5 - border), cornerRadius)
  );

  if (mask < 0.01) {
    vec3 bezelGlow = vec3(0.01, 0.02, 0.015) * (1.0 - smoothstep(0.08, 0.35, r2));
    gl_FragColor = vec4(bezelGlow, 1.0);
    return;
  }

  float overscan = ${CRT_OVERSCAN.toFixed(2)};
  vec2 sampleUv = clamp((uv - 0.5) / overscan + 0.5, 0.0, 1.0);
  vec3 col = pow(texture2D(u_texture, sampleUv).rgb, vec3(2.2)); // sRGB → linear

  // 3. Scanlines (stronger)
  if (u_scanlines > 0.5) {
    float scanline = 0.72 + 0.28 * sin(uv.y * u_resolution.y * 3.14159);
    col *= scanline;
  }

  // 4. Phosphor RGB subpixels (more visible)
  if (u_phosphor > 0.5) {
    float pixelX = fract(uv.x * u_resolution.x / 3.0) * 3.0;
    vec3 phosphor;
    if (pixelX < 1.0) phosphor = vec3(1.4, 0.7, 0.7);
    else if (pixelX < 2.0) phosphor = vec3(0.7, 1.4, 0.7);
    else phosphor = vec3(0.7, 0.7, 1.4);
    col *= mix(vec3(1.0), phosphor, 0.35);
  }

  // 5. Vignette
  float vig = 1.0 - r2 * 1.2;
  col *= clamp(vig, 0.0, 1.0);

  // 6. Flicker (more noticeable)
  if (u_flicker > 0.5) col *= 0.95 + 0.05 * sin(u_time * 7.0);

  // 7. Glass reflection
  if (u_reflection > 0.5) {
    float reflection = smoothstep(0.3, 0.7, uv.x + uv.y * 0.5 - 0.3);
    reflection *= smoothstep(0.7, 0.3, uv.x + uv.y * 0.5 - 0.5);
    col += vec3(0.06, 0.07, 0.08) * reflection * 0.4;
  }

  // 8. CRT warmth
  col *= vec3(1.05, 1.0, 0.92);

  // 9. Brightness
  col *= 1.15;

  gl_FragColor = vec4(col * mask, 1.0);
}
`;

export function createCRTMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture },
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1024, 768) },
      u_barrel: { value: 1 },
      u_scanlines: { value: 1 },
      u_phosphor: { value: 1 },
      u_flicker: { value: 1 },
      u_reflection: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  });
}
