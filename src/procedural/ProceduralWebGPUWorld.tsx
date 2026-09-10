import { useEffect, useRef, useState } from 'react';
import type { QRMatrix } from '../qr/generateQR';
import { buildProceduralScene, type ProceduralScene, type Season } from './generateScene';
import {
  branchFragmentShader,
  branchVertexShader,
  groundFragmentShader,
  groundVertexShader,
  spriteFragmentShader,
  spriteVertexShader,
} from './shaders';

type GPULike = any;

const UNIFORM_FLOATS = 16;
const LERP_SPEED = 3.8;

const alphaBlend = {
  color: {
    srcFactor: 'src-alpha',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
};

function seasonIndex(season: Season) {
  if (season === 'summer') return 1;
  if (season === 'autumn') return 2;
  return 0;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createPipeline(
  device: GPULike,
  format: string,
  layout: GPULike,
  vertex: string,
  fragment: string,
  options: { depthWrite: boolean; blend?: GPULike },
) {
  return device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: {
      module: device.createShaderModule({ code: vertex }),
      entryPoint: 'main',
    },
    fragment: {
      module: device.createShaderModule({ code: fragment }),
      entryPoint: 'main',
      targets: [{ format, ...(options.blend ? { blend: options.blend } : {}) }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: options.depthWrite,
      depthCompare: 'less',
    },
  });
}

class ProceduralRenderer {
  private canvas: HTMLCanvasElement;
  private matrix: QRMatrix;
  private season: Season;
  private scene: ProceduralScene;
  private fixedProgress: number | null;
  private targetProgress = 0;
  private rawProgress = 0;
  private frame = 0;
  private destroyed = false;
  private lastFrame = performance.now();
  private startedAt = performance.now();
  private resizeObserver: ResizeObserver | null = null;

  private device: GPULike = null;
  private context: GPULike = null;
  private format = '';
  private depthTexture: GPULike = null;
  private uniformBuffer: GPULike = null;

  private groundBuffer: GPULike = null;
  private branchStartBuffer: GPULike = null;
  private branchEndBuffer: GPULike = null;
  private spriteBuffer: GPULike = null;

  private groundPipeline: GPULike = null;
  private branchPipeline: GPULike = null;
  private spritePipeline: GPULike = null;
  private groundBindGroup: GPULike = null;
  private branchBindGroup: GPULike = null;
  private spriteBindGroup: GPULike = null;
  private onLost: (message?: string) => void;

  constructor(
    canvas: HTMLCanvasElement,
    matrix: QRMatrix,
    season: Season,
    fixedProgress: number | null,
    onLost: (message?: string) => void,
  ) {
    this.canvas = canvas;
    this.matrix = matrix;
    this.season = season;
    this.scene = buildProceduralScene(matrix, season);
    this.fixedProgress = fixedProgress;
    this.onLost = onLost;
    if (fixedProgress !== null) this.rawProgress = fixedProgress;
  }

  async init() {
    const nav = navigator as Navigator & { gpu?: GPULike };
    if (!nav.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter was found.');

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu') as GPULike;
    if (!this.context) throw new Error('Could not create a WebGPU canvas context.');

    this.format = nav.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    const usage = (globalThis as any).GPUBufferUsage;
    const stage = (globalThis as any).GPUShaderStage;
    if (!usage || !stage) throw new Error('WebGPU globals are unavailable.');

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_FLOATS * 4,
      usage: usage.UNIFORM | usage.COPY_DST,
    });

    this.groundBuffer = this.createStorageBuffer(this.scene.ground);
    this.branchStartBuffer = this.createStorageBuffer(this.scene.branchStart);
    this.branchEndBuffer = this.createStorageBuffer(this.scene.branchEnd);
    this.spriteBuffer = this.createStorageBuffer(this.scene.sprites);

    const groundLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: stage.VERTEX | stage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const branchLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: stage.VERTEX | stage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const spriteLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: stage.VERTEX | stage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    this.groundBindGroup = this.device.createBindGroup({
      layout: groundLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.groundBuffer } },
      ],
    });
    this.branchBindGroup = this.device.createBindGroup({
      layout: branchLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.branchStartBuffer } },
        { binding: 2, resource: { buffer: this.branchEndBuffer } },
      ],
    });
    this.spriteBindGroup = this.device.createBindGroup({
      layout: spriteLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.spriteBuffer } },
      ],
    });

    this.device.pushErrorScope?.('validation');
    this.groundPipeline = createPipeline(
      this.device,
      this.format,
      groundLayout,
      groundVertexShader,
      groundFragmentShader,
      { depthWrite: true },
    );
    this.branchPipeline = createPipeline(
      this.device,
      this.format,
      branchLayout,
      branchVertexShader,
      branchFragmentShader,
      { depthWrite: true, blend: alphaBlend },
    );
    this.spritePipeline = createPipeline(
      this.device,
      this.format,
      spriteLayout,
      spriteVertexShader,
      spriteFragmentShader,
      { depthWrite: false, blend: alphaBlend },
    );

    const validation = await this.device.popErrorScope?.();
    if (validation) throw new Error(`Procedural WebGPU validation failed: ${validation.message}`);

    this.installResizeObserver();
    this.lastFrame = performance.now();
    this.startedAt = this.lastFrame;
    this.render();

    this.device.lost.then(() => {
      if (this.destroyed) return;
      this.destroyed = true;
      cancelAnimationFrame(this.frame);
      this.onLost('WebGPU device was lost.');
    });
  }

  setFlat(flat: boolean) {
    this.targetProgress = flat ? 1 : 0;
  }

  setFixedProgress(value: number | null) {
    this.fixedProgress = value;
    if (value !== null) this.rawProgress = value;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.groundBuffer?.destroy?.();
    this.branchStartBuffer?.destroy?.();
    this.branchEndBuffer?.destroy?.();
    this.spriteBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.depthTexture?.destroy?.();
  }

  private createStorageBuffer(data: Float32Array) {
    const usage = (globalThis as any).GPUBufferUsage;
    const size = Math.max(16, Math.ceil(data.byteLength / 16) * 16);
    const buffer = this.device.createBuffer({
      size,
      usage: usage.STORAGE | usage.COPY_DST,
    });
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  private installResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }

  private resize() {
    if (!this.device) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (width === this.canvas.width && height === this.canvas.height && this.depthTexture) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.depthTexture?.destroy?.();
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: (globalThis as any).GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  private render = () => {
    if (
      this.destroyed ||
      !this.device ||
      !this.context ||
      !this.depthTexture ||
      !this.groundBindGroup ||
      !this.branchBindGroup ||
      !this.spriteBindGroup
    ) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    let progress: number;
    if (this.fixedProgress !== null) {
      progress = this.fixedProgress;
    } else {
      this.rawProgress +=
        (this.targetProgress - this.rawProgress) * Math.min(1, LERP_SPEED * dt);
      if (Math.abs(this.rawProgress - this.targetProgress) < 0.001) {
        this.rawProgress = this.targetProgress;
      }
      progress = easeInOutCubic(this.rawProgress);
    }

    const uniforms = new Float32Array(UNIFORM_FLOATS);
    uniforms[0] = this.canvas.width / Math.max(1, this.canvas.height);
    uniforms[1] = (now - this.startedAt) / 1000;
    uniforms[2] = progress;
    uniforms[3] = this.scene.gridSize;
    uniforms[4] = seasonIndex(this.season);
    uniforms[5] = this.scene.cellSize;
    uniforms[6] = this.scene.groundSpan;
    uniforms[7] = this.scene.seed % 16777216;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.969, g: 0.969, b: 0.969, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setPipeline(this.groundPipeline);
    pass.setBindGroup(0, this.groundBindGroup);
    pass.draw(36 * this.scene.groundCount);

    pass.setPipeline(this.branchPipeline);
    pass.setBindGroup(0, this.branchBindGroup);
    pass.draw(36 * this.scene.branchCount);

    pass.setPipeline(this.spritePipeline);
    pass.setBindGroup(0, this.spriteBindGroup);
    pass.draw(6 * this.scene.spriteCount);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.frame = requestAnimationFrame(this.render);
  };
}

type Props = {
  matrix: QRMatrix;
  season: Season;
  scanMode: boolean;
  fixedProgress?: number | null;
  onUnavailable?: () => void;
};

export function ProceduralWebGPUWorld({
  matrix,
  season,
  scanMode,
  fixedProgress = null,
  onUnavailable,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ProceduralRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const fail = (cause?: unknown) => {
      if (cancelled) return;
      if (onUnavailable) onUnavailable();
      else setError(cause instanceof Error ? cause.message : String(cause ?? 'WebGPU failed.'));
    };

    const renderer = new ProceduralRenderer(canvas, matrix, season, fixedProgress, fail);
    rendererRef.current = renderer;
    renderer.setFlat(scanMode);
    renderer.init().catch(fail);

    return () => {
      cancelled = true;
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [matrix, season]);

  useEffect(() => {
    rendererRef.current?.setFlat(scanMode);
  }, [scanMode]);

  useEffect(() => {
    rendererRef.current?.setFixedProgress(fixedProgress);
  }, [fixedProgress]);

  return (
    <div className="procedural-webgpu-world">
      <canvas ref={canvasRef} className="procedural-webgpu-canvas" />
      {error ? <div className="webgpu-error">{error}</div> : null}
    </div>
  );
}
