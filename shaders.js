// GLSL shader sources and compilation utilities

export const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;

uniform vec2 u_quadPos;   // top-left in clip space
uniform vec2 u_quadSize;  // width/height in clip space

out vec2 v_uv;

void main() {
  v_uv = vec2(a_position.x, a_position.y);
  vec2 pos = vec2(
    u_quadPos.x + a_position.x * u_quadSize.x,
    u_quadPos.y - a_position.y * u_quadSize.y
  );
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_neutralIntensity;
uniform float u_focusIntensity;
uniform float u_validIntensity;
uniform float u_invalidIntensity;
uniform float u_effectScale; // 0.0 = clean pass-through, 1.0 = full effects

// --- Noise utilities ---
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// --- Edge distance for glow effects ---
float edgeDist(vec2 uv) {
  return min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
}

// --- Effect: Neutral (subtle ambient) ---
vec4 effectNeutral(vec2 uv, float t) {
  vec4 col = texture(u_texture, uv);
  float breathe = 1.0 + 0.008 * sin(t * 1.2);
  float scanline = 1.0 - 0.008 * sin(uv.y * 180.0 + t * 0.4);
  return col * breathe * scanline;
}

// --- Effect: Focus (indigo/purple pulsing edge glow) ---
vec4 effectFocus(vec2 uv, float t) {
  vec4 col = texture(u_texture, uv);
  float ed = edgeDist(uv);
  float pulse = 0.5 + 0.5 * sin(t * 3.0);
  float glow = smoothstep(0.14, 0.0, ed) * (0.35 + 0.25 * pulse);
  vec3 glowColor = vec3(0.39, 0.40, 0.95);
  return vec4(col.rgb + glowColor * glow, col.a);
}

// --- Effect: Valid (green glow + shimmer + sparkles) ---
vec4 effectValid(vec2 uv, float t) {
  vec4 col = texture(u_texture, uv);
  // Green edge glow
  float ed = edgeDist(uv);
  float glow = smoothstep(0.12, 0.0, ed) * 0.45;
  vec3 greenGlow = vec3(0.13, 0.80, 0.53);
  // Diagonal traveling shimmer
  float shimmer = sin((uv.x + uv.y) * 10.0 - t * 3.5);
  shimmer = smoothstep(0.65, 1.0, shimmer) * 0.12;
  // Sparkle noise
  float sparkle = noise(uv * 25.0 + t * 1.5);
  sparkle = smoothstep(0.82, 1.0, sparkle) * 0.25;
  return vec4(col.rgb + greenGlow * glow + vec3(shimmer + sparkle) * 0.7, col.a);
}

// --- Effect: Invalid (chromatic aberration + wave distortion + red glow) ---
vec4 effectInvalid(vec2 uv, float t) {
  // Wave distortion
  float wave = sin(uv.y * 18.0 + t * 5.0) * 0.003;
  float wave2 = cos(uv.x * 12.0 + t * 3.5) * 0.002;
  vec2 duv = uv + vec2(wave, wave2);
  // Clamp to prevent sampling outside texture
  duv = clamp(duv, 0.0, 1.0);
  // Chromatic aberration
  float aberr = 0.004 + 0.001 * sin(t * 6.0);
  float r = texture(u_texture, clamp(duv + vec2(aberr, 0.0), 0.0, 1.0)).r;
  float g = texture(u_texture, duv).g;
  float b = texture(u_texture, clamp(duv - vec2(aberr, 0.0), 0.0, 1.0)).b;
  float a = texture(u_texture, duv).a;
  vec4 col = vec4(r, g, b, a);
  // Red pulsing edge glow
  float ed = edgeDist(uv);
  float pulse = 0.5 + 0.5 * sin(t * 4.0);
  float glow = smoothstep(0.12, 0.0, ed) * (0.45 + 0.2 * pulse);
  vec3 redGlow = vec3(1.0, 0.27, 0.40);
  return vec4(col.rgb + redGlow * glow, col.a);
}

void main() {
  vec4 clean = texture(u_texture, v_uv);

  float total = u_neutralIntensity + u_focusIntensity + u_validIntensity + u_invalidIntensity;

  if (total < 0.001 || u_effectScale < 0.001) {
    fragColor = clean;
    return;
  }

  vec4 result = vec4(0.0);
  if (u_neutralIntensity > 0.001)
    result += effectNeutral(v_uv, u_time) * u_neutralIntensity;
  if (u_focusIntensity > 0.001)
    result += effectFocus(v_uv, u_time) * u_focusIntensity;
  if (u_validIntensity > 0.001)
    result += effectValid(v_uv, u_time) * u_validIntensity;
  if (u_invalidIntensity > 0.001)
    result += effectInvalid(v_uv, u_time) * u_invalidIntensity;

  result /= total;

  // Blend between clean pass-through and full effect
  fragColor = mix(clean, result, u_effectScale);
}
`;

// --- Compilation utilities ---

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export function createProgram(gl, vertSource, fragSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

export function getUniformLocations(gl, program) {
  return {
    u_quadPos: gl.getUniformLocation(program, 'u_quadPos'),
    u_quadSize: gl.getUniformLocation(program, 'u_quadSize'),
    u_texture: gl.getUniformLocation(program, 'u_texture'),
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_neutralIntensity: gl.getUniformLocation(program, 'u_neutralIntensity'),
    u_focusIntensity: gl.getUniformLocation(program, 'u_focusIntensity'),
    u_validIntensity: gl.getUniformLocation(program, 'u_validIntensity'),
    u_invalidIntensity: gl.getUniformLocation(program, 'u_invalidIntensity'),
    u_effectScale: gl.getUniformLocation(program, 'u_effectScale'),
  };
}
