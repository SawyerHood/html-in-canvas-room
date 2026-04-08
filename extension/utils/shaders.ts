export const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

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

void main() {
  float i = u_intensity;
  float t = u_time;
  vec2 uv = v_uv;

  // --- 1. Global sway: the room is spinning ---
  uv.x += sin(t * 1.5) * 0.025 * i;
  uv.y += cos(t * 1.1) * 0.012 * i;
  // Add a slower, larger wobble on top
  uv.x += sin(t * 0.7 + 1.5) * 0.015 * i;
  uv.y += cos(t * 0.5 + 0.8) * 0.008 * i;

  // --- 2. Hiccup jolts: random sudden jerks ---
  float hiccupSeed = floor(t * 2.5);
  float hiccupChance = hash(vec2(hiccupSeed, 42.0));
  float hiccupActive = step(0.92, hiccupChance) * i;
  float hiccupPhase = fract(t * 2.5);
  float hiccupFade = 1.0 - smoothstep(0.0, 0.3, hiccupPhase);
  vec2 hiccupDir = vec2(
    hash(vec2(hiccupSeed, 13.0)) - 0.5,
    hash(vec2(hiccupSeed, 77.0)) - 0.5
  );
  uv += hiccupDir * 0.04 * hiccupActive * hiccupFade;

  // --- 3. Mouse warp: fisheye ripple around cursor ---
  vec2 mouseUV = u_mouse;
  vec2 toMouse = uv - mouseUV;
  float aspect = u_resolution.x / u_resolution.y;
  toMouse.x *= aspect;
  float mouseDist = length(toMouse);
  float mouseRadius = 0.12 + 0.15 * i;
  float warpStrength = smoothstep(mouseRadius, 0.0, mouseDist);
  float ripple = sin(mouseDist * 25.0 - t * 5.0) * 0.5 + 0.5;
  vec2 warpDir = normalize(toMouse + 0.0001);
  warpDir.x /= aspect;
  uv += warpDir * warpStrength * ripple * 0.06 * i;

  uv = clamp(uv, 0.0, 1.0);

  // --- 4. Double/triple vision ---
  float visionOffset = 0.012 * i;
  vec2 off1 = vec2(visionOffset, visionOffset * 0.5);
  vec2 off2 = vec2(-visionOffset * 0.8, visionOffset * 0.7);
  vec4 col0 = texture(u_texture, clamp(uv, 0.0, 1.0));
  vec4 col1 = texture(u_texture, clamp(uv + off1, 0.0, 1.0));
  vec4 col2 = texture(u_texture, clamp(uv + off2, 0.0, 1.0));
  vec4 col = mix(col0, col0 * 0.5 + col1 * 0.3 + col2 * 0.2, i);

  // --- 5. Chromatic aberration ---
  float aberr = 0.008 * i;
  col.r = texture(u_texture, clamp(uv + vec2(aberr, 0.0), 0.0, 1.0)).r * (1.0 - i)
         + texture(u_texture, clamp(uv + off1 + vec2(aberr, 0.0), 0.0, 1.0)).r * i * 0.5
         + col.r * i * 0.5;
  col.b = texture(u_texture, clamp(uv - vec2(aberr, 0.0), 0.0, 1.0)).b * (1.0 - i)
         + texture(u_texture, clamp(uv + off2 - vec2(aberr, 0.0), 0.0, 1.0)).b * i * 0.5
         + col.b * i * 0.5;

  // --- 6. Blur: multi-sample box blur ---
  float blurSize = 2.0 * i / u_resolution.x;
  vec4 blur = col;
  blur += texture(u_texture, clamp(uv + vec2(blurSize, 0.0), 0.0, 1.0));
  blur += texture(u_texture, clamp(uv - vec2(blurSize, 0.0), 0.0, 1.0));
  blur += texture(u_texture, clamp(uv + vec2(0.0, blurSize), 0.0, 1.0));
  blur += texture(u_texture, clamp(uv - vec2(0.0, blurSize), 0.0, 1.0));
  col = mix(col, blur / 5.0, i * 0.6);

  // --- 7. Warm color shift (alcohol flush) ---
  col.rgb = mix(col.rgb, col.rgb * vec3(1.15, 0.95, 0.80), i * 0.35);

  // --- 8. Tunnel vision: heavy vignette ---
  vec2 center = v_uv - 0.5;
  float vig = 1.0 - dot(center, center) * 3.5 * i;
  col.rgb *= clamp(vig, 0.0, 1.0);

  // --- 9. Slight brightness fluctuation (woozy) ---
  col.rgb *= 1.0 - 0.04 * i * sin(t * 3.0 + v_uv.y * 5.0);

  fragColor = col;
}
`;

export interface Uniforms {
  u_texture: WebGLUniformLocation | null;
  u_time: WebGLUniformLocation | null;
  u_intensity: WebGLUniformLocation | null;
  u_mouse: WebGLUniformLocation | null;
  u_resolution: WebGLUniformLocation | null;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram()!;
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

export function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): Uniforms {
  return {
    u_texture: gl.getUniformLocation(program, 'u_texture'),
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_intensity: gl.getUniformLocation(program, 'u_intensity'),
    u_mouse: gl.getUniformLocation(program, 'u_mouse'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
  };
}
