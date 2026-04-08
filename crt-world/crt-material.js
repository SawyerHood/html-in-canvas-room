import * as THREE from 'three';

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

void main() {
  vec2 uv = vUv;

  // --- 1. Barrel distortion ---
  vec2 center = uv - 0.5;
  float r2 = dot(center, center);
  uv = uv + center * r2 * 0.2;

  // --- 2. Screen bounds: discard pixels outside the screen area ---
  float border = 0.02;
  float edgeSoftness = 0.005;
  float mask = smoothstep(0.0, edgeSoftness, uv.x - border)
             * smoothstep(0.0, edgeSoftness, uv.y - border)
             * smoothstep(0.0, edgeSoftness, (1.0 - border) - uv.x)
             * smoothstep(0.0, edgeSoftness, (1.0 - border) - uv.y);

  if (mask < 0.01) {
    // Outside screen — dark bezel glow
    float glowDist = min(min(abs(uv.x - 0.5), abs(uv.y - 0.5)), 0.5);
    vec3 bezelGlow = vec3(0.02, 0.04, 0.03) * (1.0 - smoothstep(0.0, 0.15, r2));
    gl_FragColor = vec4(bezelGlow, 1.0);
    return;
  }

  vec3 col = texture2D(u_texture, uv).rgb;

  // --- 3. Scanlines ---
  float scanline = 0.88 + 0.12 * sin(uv.y * u_resolution.y * 3.14159);
  col *= scanline;

  // --- 4. Phosphor RGB subpixels ---
  float pixelX = fract(uv.x * u_resolution.x / 3.0) * 3.0;
  vec3 phosphor;
  if (pixelX < 1.0) phosphor = vec3(1.2, 0.9, 0.9);
  else if (pixelX < 2.0) phosphor = vec3(0.9, 1.2, 0.9);
  else phosphor = vec3(0.9, 0.9, 1.2);
  col *= mix(vec3(1.0), phosphor, 0.15);

  // --- 5. Vignette ---
  float vig = 1.0 - r2 * 2.2;
  col *= clamp(vig, 0.0, 1.0);

  // --- 6. Flicker ---
  col *= 0.98 + 0.02 * sin(u_time * 7.0);

  // --- 7. Glass reflection ---
  float reflection = smoothstep(0.3, 0.7, uv.x + uv.y * 0.5 - 0.3);
  reflection *= smoothstep(0.7, 0.3, uv.x + uv.y * 0.5 - 0.5);
  col += vec3(0.06, 0.07, 0.08) * reflection * 0.4;

  // --- 8. Slight warmth (CRT color temperature) ---
  col *= vec3(1.05, 1.0, 0.92);

  // --- 9. Brightness boost for glow feel ---
  col *= 1.15;

  gl_FragColor = vec4(col * mask, 1.0);
}
`;

export function createCRTMaterial(texture) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture },
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1024, 768) },
    },
    vertexShader,
    fragmentShader,
  });
  return material;
}
