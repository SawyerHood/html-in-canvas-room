import {
  VERTEX_SOURCE,
  FRAGMENT_SOURCE,
  createProgram,
  getUniformLocations,
  type Uniforms,
} from './shaders';

export class ShaderPipeline {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: Uniforms;
  private vao: WebGLVertexArrayObject;
  private texture: WebGLTexture;
  private dirty = true;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Compile shaders
    this.program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
    this.uniforms = getUniformLocations(gl, this.program);

    // Full-screen quad: two triangles via TRIANGLE_STRIP
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.vao = gl.createVertexArray()!;
    const vbo = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Texture for page content
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Set default uniforms
    gl.useProgram(this.program);
    gl.uniform1i(this.uniforms.u_texture, 0);
  }

  resize(width: number, height: number, dpr: number): void {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.u_resolution, canvas.width, canvas.height);
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  setEffect(index: number): void {
    this.gl.useProgram(this.program);
    this.gl.uniform1i(this.uniforms.u_effect, index);
  }

  setIntensity(value: number): void {
    this.gl.useProgram(this.program);
    this.gl.uniform1f(this.uniforms.u_intensity, value);
  }

  setSpeed(value: number): void {
    this.gl.useProgram(this.program);
    this.gl.uniform1f(this.uniforms.u_speed, value);
  }

  draw(time: number, wrapper: HTMLElement): void {
    const gl = this.gl;

    // Re-upload texture if content changed
    if (this.dirty) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      try {
        gl.texElementImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          wrapper,
        );
        this.dirty = false;
      } catch {
        // Element may not be ready yet; will retry next frame
      }
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.u_time, time);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
  }
}
