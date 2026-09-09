import { useEffect, useRef, useState } from 'react';
import type { QRMatrix } from '../qr/generateQR';
import { buildGPUBlockData, type GPUBlockData } from './blockData';
import {
  blocksFragmentShader,
  blocksVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
  skyFragmentShader,
  skyVertexShader,
} from './shaders';

const LERP_SPEED = 4;
const UNIFORM_FLOATS = 16;
const MAX_GRID_SIZE = 41;
const MAX_BLOCKS = MAX_GRID_SIZE * MAX_GRID_SIZE * 18;

type Props = {
  matrix: QRMatrix;
  scanMode: boolean;
  fixedProgress?: number | null;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onUnavailable?: () => void;
};

type GPULike = any;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createPipeline(
  device: GPULike,
  format: string,
  bindGroupLayout: GPULike,
  vertex: string,
  fragment: string,
  options: {
    depthWrite: boolean;
    depthCompare: string;
    blend?: GPULike;
  },
) {
  return device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
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
      depthWriteEnabled: options.depthWrite,
      depthCompare: options.depthCompare,
      format: 'depth24plus',
    },
  });
}

class ReferenceWebGPURenderer {
  private canvas: HTMLCanvasElement;
  private context: GPULike = null;
  private device: GPULike = null;
  private format = '';

  private uniformBuffer: GPULike = null;
  private typeBuffer: GPULike = null;
  private positionBuffer: GPULike = null;
  private resistanceBuffer: GPULike = null;
  private baseYBuffer: GPULike = null;
  private depthTexture: GPULike = null;

  private blockLayout: GPULike = null;
  private skyLayout: GPULike = null;
  private blockBindGroup: GPULike = null;
  private skyBindGroup: GPULike = null;

  private skyPipeline: GPULike = null;
  private shadowPipeline: GPULike = null;
  private blocksPipeline: GPULike = null;

  private blockData: GPUBlockData;
  private targetProgress = 0;
  private rawProgress = 0;
  private fixedProgress: number | null;
  private animationFrame = 0;
  private lastFrame = performance.now();
  private startTime = performance.now();
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private onLost: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    matrix: QRMatrix,
    fixedProgress: number | null,
    onLost: () => void,
  ) {
    this.canvas = canvas;
    this.blockData = buildGPUBlockData(matrix);
    this.fixedProgress = fixedProgress;
    this.onLost = onLost;
  }

  async init() {
    const nav = navigator as Navigator & { gpu?: GPULike };
    if (!nav.gpu) throw new Error('WebGPU is not available in this browser.');

    const adapter = await nav.gpu.requestAdapter();
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
    const shaderStage = (globalThis as any).GPUShaderStage;
    if (!usage || !shaderStage) throw new Error('WebGPU globals are unavailable.');

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_FLOATS * 4,
      usage: usage.UNIFORM | usage.COPY_DST,
    });

    this.typeBuffer = this.device.createBuffer({
      size: MAX_BLOCKS * 4,
      usage: usage.STORAGE | usage.COPY_DST,
    });
    this.positionBuffer = this.device.createBuffer({
      size: MAX_BLOCKS * 16,
      usage: usage.STORAGE | usage.COPY_DST,
    });
    this.resistanceBuffer = this.device.createBuffer({
      size: MAX_BLOCKS * 4,
      usage: usage.STORAGE | usage.COPY_DST,
    });
    this.baseYBuffer = this.device.createBuffer({
      size: MAX_BLOCKS * 4,
      usage: usage.STORAGE | usage.COPY_DST,
    });

    this.blockLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: shaderStage.VERTEX | shaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: shaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 2,
          visibility: shaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 3,
          visibility: shaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 4,
          visibility: shaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });

    this.skyLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: shaderStage.VERTEX | shaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.skyBindGroup = this.device.createBindGroup({
      layout: this.skyLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    this.blockBindGroup = this.device.createBindGroup({
      layout: this.blockLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.typeBuffer } },
        { binding: 2, resource: { buffer: this.positionBuffer } },
        { binding: 3, resource: { buffer: this.resistanceBuffer } },
        { binding: 4, resource: { buffer: this.baseYBuffer } },
      ],
    });

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

    this.device.pushErrorScope?.('validation');

    this.skyPipeline = createPipeline(
      this.device,
      this.format,
      this.skyLayout,
      skyVertexShader,
      skyFragmentShader,
      { depthWrite: false, depthCompare: 'always' },
    );
    this.shadowPipeline = createPipeline(
      this.device,
      this.format,
      this.skyLayout,
      shadowVertexShader,
      shadowFragmentShader,
      { depthWrite: false, depthCompare: 'always', blend: alphaBlend },
    );
    this.blocksPipeline = createPipeline(
      this.device,
      this.format,
      this.blockLayout,
      blocksVertexShader,
      blocksFragmentShader,
      { depthWrite: true, depthCompare: 'less' },
    );

    const validationError = await this.device.popErrorScope?.();
    if (validationError) {
      throw new Error(`WebGPU pipeline validation failed: ${validationError.message}`);
    }

    this.uploadBlockData(this.blockData);
    this.installResizeObserver();
    this.lastFrame = performance.now();
    this.startTime = this.lastFrame;
    this.render();

    this.device.lost.then(() => {
      if (this.destroyed) return;
      this.destroyed = true;
      cancelAnimationFrame(this.animationFrame);
      this.onLost();
    });
  }

  setFlat(flat: boolean) {
    this.targetProgress = flat ? 1 : 0;
  }

  setFixedProgress(progress: number | null) {
    this.fixedProgress = progress;
    if (progress !== null) {
      this.rawProgress = progress;
    }
  }

  setMatrix(matrix: QRMatrix) {
    this.blockData = buildGPUBlockData(matrix);
    if (this.device) this.uploadBlockData(this.blockData);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.typeBuffer?.destroy?.();
    this.positionBuffer?.destroy?.();
    this.resistanceBuffer?.destroy?.();
    this.baseYBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.depthTexture?.destroy?.();
  }

  private uploadBlockData(data: GPUBlockData) {
    if (data.numBlocks > MAX_BLOCKS) {
      throw new Error(
        `QR world requires ${data.numBlocks} blocks, above the reference renderer limit of ${MAX_BLOCKS}.`,
      );
    }

    const paddedTypes = new Uint32Array(MAX_BLOCKS);
    paddedTypes.set(data.types);
    const paddedPositions = new Float32Array(MAX_BLOCKS * 4);
    paddedPositions.set(data.positions);
    const paddedResistance = new Float32Array(MAX_BLOCKS);
    paddedResistance.set(data.resistance);
    const paddedBaseY = new Float32Array(MAX_BLOCKS);
    paddedBaseY.set(data.baseY);

    this.device.queue.writeBuffer(this.typeBuffer, 0, paddedTypes);
    this.device.queue.writeBuffer(this.positionBuffer, 0, paddedPositions);
    this.device.queue.writeBuffer(this.resistanceBuffer, 0, paddedResistance);
    this.device.queue.writeBuffer(this.baseYBuffer, 0, paddedBaseY);
  }

  private installResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);
    this.resizeCanvas();
  }

  private resizeCanvas() {
    if (!this.device) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width === width && this.canvas.height === height && this.depthTexture) return;

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
    if (this.destroyed || !this.device || !this.context || !this.depthTexture || !this.blockBindGroup) return;

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

    const aspectRatio = this.canvas.width / Math.max(1, this.canvas.height);
    const uniformData = new Float32Array(UNIFORM_FLOATS);
    uniformData[0] = aspectRatio;
    uniformData[1] = (now - this.startTime) / 1000;
    uniformData[2] = this.blockData.numBlocks;
    uniformData[3] = progress;
    uniformData[4] = this.blockData.gridSize;
    uniformData[5] = -1;
    uniformData[6] = 0;
    uniformData[7] = -1;
    uniformData[8] = 0;
    uniformData[9] = 0;
    uniformData[10] = 0;
    uniformData[11] = 0;
    uniformData[12] = 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
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

    pass.setPipeline(this.skyPipeline);
    pass.setBindGroup(0, this.skyBindGroup);
    pass.draw(3);

    pass.setPipeline(this.shadowPipeline);
    pass.setBindGroup(0, this.skyBindGroup);
    pass.draw(6);

    pass.setPipeline(this.blocksPipeline);
    pass.setBindGroup(0, this.blockBindGroup);
    pass.draw(36 * this.blockData.numBlocks);

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.animationFrame = requestAnimationFrame(this.render);
  };
}

export function WebGPUWorld({
  matrix,
  scanMode,
  fixedProgress = null,
  onCanvasReady,
  onUnavailable,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReferenceWebGPURenderer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const fail = (cause?: unknown) => {
      if (cancelled) return;
      if (onUnavailable) {
        onUnavailable();
      } else {
        setError(cause instanceof Error ? cause.message : 'WebGPU initialization failed.');
      }
    };

    const renderer = new ReferenceWebGPURenderer(
      canvas,
      matrix,
      fixedProgress,
      () => fail(new Error('WebGPU device was lost.')),
    );
    rendererRef.current = renderer;
    renderer.setFlat(scanMode);
    onCanvasReady?.(canvas);

    renderer.init().catch(fail);

    return () => {
      cancelled = true;
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setFlat(scanMode);
  }, [scanMode]);

  useEffect(() => {
    rendererRef.current?.setFixedProgress(fixedProgress);
  }, [fixedProgress]);

  useEffect(() => {
    try {
      rendererRef.current?.setMatrix(matrix);
    } catch (cause) {
      if (onUnavailable) {
        onUnavailable();
      } else {
        setError(cause instanceof Error ? cause.message : 'Failed to update QR world buffers.');
      }
    }
  }, [matrix.content, matrix.moduleCount]);

  return (
    <div className="webgpu-world">
      <canvas ref={canvasRef} className="webgpu-canvas" />
      {error ? <div className="webgpu-error">{error}</div> : null}
    </div>
  );
}
