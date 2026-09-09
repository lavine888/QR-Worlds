import { useEffect, useRef, useState } from 'react';
import { PixelRatio, View } from 'react-native';
import { Canvas, type CanvasRef } from 'react-native-webgpu';
import type { QRMatrix } from '../qr/generateQR';
import { buildGPUBlockData, type GPUBlockData } from '../webgpu/blockData';
import {
  blocksFragmentShader,
  blocksVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
  skyFragmentShader,
  skyVertexShader,
} from '../webgpu/shaders';

const LERP_SPEED = 4;
const UNIFORM_FLOATS = 16;
const MAX_GRID_SIZE = 41;
const MAX_BLOCKS = MAX_GRID_SIZE * MAX_GRID_SIZE * 18;

type GPULike = any;

type Props = {
  matrix: QRMatrix;
  scanMode: boolean;
  fixedProgress?: number | null;
  onUnavailable?: (message: string) => void;
};

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const defaultBlend = {
  color: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
};

const shadowBlend = {
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

function createPipeline(
  device: GPULike,
  format: string,
  bindGroupLayout: GPULike,
  vertex: string,
  fragment: string,
  depthWrite: boolean,
  depthCompare: string,
  blend: GPULike = defaultBlend,
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
      targets: [{ format, blend }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: {
      depthWriteEnabled: depthWrite,
      depthCompare,
      format: 'depth24plus',
    },
  });
}

function writeBlockBuffers(device: GPULike, data: GPUBlockData, buffers: {
  type: GPULike;
  position: GPULike;
  resistance: GPULike;
  baseY: GPULike;
}) {
  if (data.numBlocks > MAX_BLOCKS) {
    throw new Error(`Reference block capacity exceeded: ${data.numBlocks} > ${MAX_BLOCKS}`);
  }

  const types = new Uint32Array(MAX_BLOCKS);
  types.set(data.types);
  const positions = new Float32Array(MAX_BLOCKS * 4);
  positions.set(data.positions);
  const resistance = new Float32Array(MAX_BLOCKS);
  resistance.set(data.resistance);
  const baseY = new Float32Array(MAX_BLOCKS);
  baseY.set(data.baseY);

  device.queue.writeBuffer(buffers.type, 0, types);
  device.queue.writeBuffer(buffers.position, 0, positions);
  device.queue.writeBuffer(buffers.resistance, 0, resistance);
  device.queue.writeBuffer(buffers.baseY, 0, baseY);
}

export function RNWebGPUWorld({
  matrix,
  scanMode,
  fixedProgress = null,
  onUnavailable,
}: Props) {
  const canvasRef = useRef<CanvasRef>(null);
  const stateRef = useRef<{
    device: GPULike;
    buffers: { type: GPULike; position: GPULike; resistance: GPULike; baseY: GPULike };
    blockData: GPUBlockData;
    target: number;
    raw: number;
    fixed: number | null;
    frame: number;
    stopped: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout = 0;

    const fail = (cause: unknown) => {
      if (cancelled) return;
      const message = cause instanceof Error ? cause.message : 'React Native WebGPU initialization failed.';
      setError(message);
      onUnavailable?.(message);
    };

    const init = async () => {
      const canvasHandle = canvasRef.current;
      if (!canvasHandle) throw new Error('Reference Canvas is not mounted.');

      const context = canvasHandle.getContext('webgpu') as GPULike;
      if (!context) throw new Error('Reference WebGPU context is unavailable.');

      const adapter = await (navigator as any).gpu?.requestAdapter();
      if (!adapter) throw new Error('No WebGPU adapter was found.');
      const device = await adapter.requestDevice();
      const format = (navigator as any).gpu.getPreferredCanvasFormat();

      const nativeCanvas = context.canvas as HTMLCanvasElement;
      const pixelRatio = PixelRatio.get();
      const rect = nativeCanvas.getBoundingClientRect?.();
      const cssWidth = rect?.width || nativeCanvas.clientWidth || window.innerWidth;
      const cssHeight = rect?.height || nativeCanvas.clientHeight || window.innerHeight * 0.6;
      nativeCanvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
      nativeCanvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));

      context.configure({ device, format, alphaMode: 'premultiplied' });

      const usage = (globalThis as any).GPUBufferUsage;
      const stage = (globalThis as any).GPUShaderStage;
      const textureUsage = (globalThis as any).GPUTextureUsage;
      if (!usage || !stage || !textureUsage) throw new Error('WebGPU globals are unavailable.');

      const uniformBuffer = device.createBuffer({
        size: UNIFORM_FLOATS * 4,
        usage: usage.UNIFORM | usage.COPY_DST,
      });
      const buffers = {
        type: device.createBuffer({ size: MAX_BLOCKS * 4, usage: usage.STORAGE | usage.COPY_DST }),
        position: device.createBuffer({ size: MAX_BLOCKS * 16, usage: usage.STORAGE | usage.COPY_DST }),
        resistance: device.createBuffer({ size: MAX_BLOCKS * 4, usage: usage.STORAGE | usage.COPY_DST }),
        baseY: device.createBuffer({ size: MAX_BLOCKS * 4, usage: usage.STORAGE | usage.COPY_DST }),
      };

      const blockLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: stage.VERTEX | stage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
          { binding: 2, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
          { binding: 3, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
          { binding: 4, visibility: stage.VERTEX, buffer: { type: 'read-only-storage' } },
        ],
      });
      const skyLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: stage.VERTEX | stage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
      const blockBindGroup = device.createBindGroup({
        layout: blockLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: buffers.type } },
          { binding: 2, resource: { buffer: buffers.position } },
          { binding: 3, resource: { buffer: buffers.resistance } },
          { binding: 4, resource: { buffer: buffers.baseY } },
        ],
      });
      const skyBindGroup = device.createBindGroup({
        layout: skyLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const skyPipeline = createPipeline(
        device, format, skyLayout, skyVertexShader, skyFragmentShader, false, 'always',
      );
      const shadowPipeline = createPipeline(
        device, format, skyLayout, shadowVertexShader, shadowFragmentShader, false, 'always', shadowBlend,
      );
      const blocksPipeline = createPipeline(
        device, format, blockLayout, blocksVertexShader, blocksFragmentShader, true, 'less',
      );
      const depthTexture = device.createTexture({
        size: [nativeCanvas.width, nativeCanvas.height],
        format: 'depth24plus',
        usage: textureUsage.RENDER_ATTACHMENT,
      });

      const blockData = buildGPUBlockData(matrix);
      writeBlockBuffers(device, blockData, buffers);

      const state = {
        device,
        buffers,
        blockData,
        target: scanMode ? 1 : 0,
        raw: fixedProgress ?? 0,
        fixed: fixedProgress,
        frame: 0,
        stopped: false,
      };
      stateRef.current = state;

      const uniformData = new Float32Array(UNIFORM_FLOATS);
      let last = performance.now();
      const started = last;
      const aspectRatio = nativeCanvas.width / nativeCanvas.height;

      const render = () => {
        if (state.stopped) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        let progress: number;
        if (state.fixed !== null) {
          progress = state.fixed;
        } else {
          state.raw += (state.target - state.raw) * Math.min(1, LERP_SPEED * dt);
          if (Math.abs(state.raw - state.target) < 0.001) state.raw = state.target;
          progress = easeInOutCubic(state.raw);
        }

        uniformData.fill(0);
        uniformData[0] = aspectRatio;
        uniformData[1] = (now - started) / 1000;
        uniformData[2] = state.blockData.numBlocks;
        uniformData[3] = progress;
        uniformData[4] = state.blockData.gridSize;
        uniformData[5] = -1;
        uniformData[7] = -1;
        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
          },
        });

        pass.setPipeline(skyPipeline);
        pass.setBindGroup(0, skyBindGroup);
        pass.draw(3);
        pass.setPipeline(shadowPipeline);
        pass.setBindGroup(0, skyBindGroup);
        pass.draw(6);
        pass.setPipeline(blocksPipeline);
        pass.setBindGroup(0, blockBindGroup);
        pass.draw(36 * state.blockData.numBlocks);
        pass.end();
        device.queue.submit([encoder.finish()]);
        context.present();
        state.frame = requestAnimationFrame(render);
      };

      render();
    };

    timeout = window.setTimeout(() => {
      init().catch(fail);
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      const state = stateRef.current;
      if (state) {
        state.stopped = true;
        cancelAnimationFrame(state.frame);
        state.buffers.type.destroy?.();
        state.buffers.position.destroy?.();
        state.buffers.resistance.destroy?.();
        state.buffers.baseY.destroy?.();
      }
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stateRef.current) stateRef.current.target = scanMode ? 1 : 0;
  }, [scanMode]);

  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.fixed = fixedProgress;
      if (fixedProgress !== null) stateRef.current.raw = fixedProgress;
    }
  }, [fixedProgress]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    try {
      const data = buildGPUBlockData(matrix);
      writeBlockBuffers(state.device, data, state.buffers);
      state.blockData = data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Failed to update reference buffers.';
      setError(message);
      onUnavailable?.(message);
    }
  }, [matrix.content, matrix.moduleCount]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
      <Canvas ref={canvasRef} opaque={false} style={{ flex: 1, backgroundColor: 'transparent' }} />
      {error ? (
        <View
          // @ts-expect-error web-only text fallback inside parity branch
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="webgpu-error">{error}</div>
        </View>
      ) : null}
    </View>
  );
}
