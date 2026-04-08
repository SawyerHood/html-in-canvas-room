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
uniform float u_speed;
uniform int u_effect;
uniform vec2 u_resolution;

// ---- Noise utilities ----

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

// ---- Effect 0: CRT Monitor ----
// Intensity scales: barrel distortion, chromatic aberration, scanline depth, vignette, flicker

vec4 effectCRT(vec2 uv, float t, float i) {
  vec2 center = uv - 0.5;
  float r2 = dot(center, center);
  vec2 duv = uv + center * r2 * 0.3 * i;

  float aberr = 0.006 * i;
  float red   = texture(u_texture, clamp(duv + vec2(aberr, 0.0), 0.0, 1.0)).r;
  float green = texture(u_texture, clamp(duv, 0.0, 1.0)).g;
  float blue  = texture(u_texture, clamp(duv - vec2(aberr, 0.0), 0.0, 1.0)).b;
  vec3 col = vec3(red, green, blue);

  float scanline = 1.0 - 0.15 * i * (0.5 + 0.5 * sin(uv.y * u_resolution.y * 1.5 + t * 2.0));
  col *= scanline;

  float vignette = 1.0 - r2 * 2.5 * i;
  col *= clamp(vignette, 0.0, 1.0);

  col *= 1.0 - 0.06 * i * (0.5 + 0.5 * sin(t * 8.0));

  return vec4(col, 1.0);
}

// ---- Effect 1: Underwater ----
// Intensity scales: wave distortion amplitude, tint strength, caustic brightness, depth fog

vec4 effectUnderwater(vec2 uv, float t, float i) {
  vec2 duv = uv;
  duv.x += sin(uv.y * 12.0 + t * 2.0) * 0.015 * i;
  duv.y += cos(uv.x * 10.0 + t * 1.5) * 0.012 * i;
  duv = clamp(duv, 0.0, 1.0);

  vec4 col = texture(u_texture, duv);
  col.rgb = mix(col.rgb, col.rgb * vec3(0.5, 0.85, 1.0), 0.6 * i);

  float caustic1 = noise(uv * 8.0 + vec2(t * 0.8, t * 0.6));
  float caustic2 = noise(uv * 12.0 - vec2(t * 0.5, t * 0.7));
  float caustics = smoothstep(0.4, 0.9, caustic1 * caustic2 * 4.0);
  col.rgb += caustics * vec3(0.15, 0.25, 0.3) * i;

  col.rgb *= 1.0 - 0.2 * i * uv.y;

  return col;
}

// ---- Effect 2: VHS Glitch ----
// Intensity scales: glitch band probability & displacement, color bleed, jitter, noise bands

vec4 effectVHS(vec2 uv, float t, float i) {
  vec2 duv = uv;

  float bandThresh = 1.0 - 0.12 * i;
  float band = step(bandThresh, hash(vec2(floor(t * 15.0), floor(uv.y * 40.0))));
  duv.x += band * (hash(vec2(t, uv.y)) - 0.5) * 0.15 * i;
  duv.x += (hash(vec2(uv.y * 100.0, t * 3.0)) - 0.5) * 0.004 * i;
  duv = clamp(duv, 0.0, 1.0);

  float offset = (0.008 + band * 0.03) * i;
  float red   = texture(u_texture, clamp(duv + vec2(offset, 0.0), 0.0, 1.0)).r;
  float green = texture(u_texture, duv).g;
  float blue  = texture(u_texture, clamp(duv - vec2(offset, 0.0), 0.0, 1.0)).b;
  vec3 col = vec3(red, green, blue);

  float noiseBand = smoothstep(0.0, 0.03,
    abs(fract(uv.y * 3.0 + t * 0.5) - 0.5) - 0.47);
  col = mix(col, vec3(hash(uv + t)), noiseBand * 0.5 * i);

  col *= 1.0 - 0.15 * i * (0.5 + 0.5 * sin(uv.y * u_resolution.y * 0.5));

  return vec4(col, 1.0);
}

// ---- Effect 3: Night Vision ----
// Intensity scales: green monochrome amount, grain strength, bloom, vignette tightness

vec4 effectNightVision(vec2 uv, float t, float i) {
  vec4 col = texture(u_texture, uv);
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));

  vec3 nightCol = vec3(0.1, 1.0, 0.2) * lum;
  // Blend from original color toward green monochrome based on intensity
  vec3 result = mix(col.rgb, nightCol, i);

  float bloom = smoothstep(0.5, 1.0, lum) * 0.4 * i;
  result += vec3(0.05, 0.2, 0.05) * bloom;

  float grain = (hash(uv * u_resolution + vec2(t * 100.0, 0.0)) - 0.5) * 0.2 * i;
  result += grain;

  vec2 center = uv - 0.5;
  float dist = length(center);
  float vignetteEdge = mix(1.0, 0.35, i);
  float vignette = 1.0 - smoothstep(vignetteEdge, vignetteEdge + 0.35, dist);
  result *= mix(1.0, vignette, i);

  return vec4(result, 1.0);
}

// ---- Effect 4: Pixelate ----
// Intensity scales: block size (low = subtle, high = chunky)

vec4 effectPixelate(vec2 uv, float t, float i) {
  float blockSize = mix(2.0, 24.0, i);
  vec2 blocks = u_resolution / blockSize;
  vec2 blockUV = floor(uv * blocks) / blocks + 0.5 / blocks;

  return texture(u_texture, blockUV);
}

// ---- Effect 5: Thermal ----
// Intensity scales: how much the heat-map color replaces original, shimmer amount

vec4 effectThermal(vec2 uv, float t, float i) {
  vec4 col = texture(u_texture, uv);
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));

  vec3 thermal;
  if (lum < 0.15) {
    thermal = mix(vec3(0.0), vec3(0.0, 0.0, 1.0), lum / 0.15);
  } else if (lum < 0.35) {
    thermal = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), (lum - 0.15) / 0.2);
  } else if (lum < 0.55) {
    thermal = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (lum - 0.35) / 0.2);
  } else if (lum < 0.75) {
    thermal = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (lum - 0.55) / 0.2);
  } else {
    thermal = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), (lum - 0.75) / 0.25);
  }

  thermal += (noise(uv * 20.0 + t * 2.0) - 0.5) * 0.08 * i;

  return vec4(mix(col.rgb, thermal, i), 1.0);
}

// ---- Main ----

void main() {
  float t = u_time * u_speed;
  float i = u_intensity;

  vec4 result;
  if (u_effect == 0)      result = effectCRT(v_uv, t, i);
  else if (u_effect == 1) result = effectUnderwater(v_uv, t, i);
  else if (u_effect == 2) result = effectVHS(v_uv, t, i);
  else if (u_effect == 3) result = effectNightVision(v_uv, t, i);
  else if (u_effect == 4) result = effectPixelate(v_uv, t, i);
  else if (u_effect == 5) result = effectThermal(v_uv, t, i);
  else                    result = texture(u_texture, v_uv);

  fragColor = result;
}
`;

export interface Uniforms {
  u_texture: WebGLUniformLocation | null;
  u_time: WebGLUniformLocation | null;
  u_intensity: WebGLUniformLocation | null;
  u_speed: WebGLUniformLocation | null;
  u_effect: WebGLUniformLocation | null;
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
    u_speed: gl.getUniformLocation(program, 'u_speed'),
    u_effect: gl.getUniformLocation(program, 'u_effect'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
  };
}
