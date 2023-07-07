/// <reference types="@webgpu/types" />
import { Std140Block } from "../../blocklayout";
import { LoadedSceneResult } from "../../scene_loader";
import "webrtx";
import getGPUDevice from "../../device";

const screenVert = `
@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  let pos:vec2<f32> = vec2<f32>(f32((VertexIndex << 1u) & 2u), f32(VertexIndex & 2u));
  return vec4<f32>(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;
const screenFrag = `
struct PixelBuffer {
  pixels: array<vec4<f32>>,
}
@group(0) @binding(0) var<storage, read> pixelBuffer: PixelBuffer;

struct ScreenDimension {
  resolution : vec2<f32>,
}
@group(0) @binding(1) var<uniform> screenDimension: ScreenDimension;

@fragment
fn main(
  @builtin(position) coord : vec4<f32>
)-> @location(0) vec4<f32> {
  let INV_GAMMA:vec3<f32> = vec3<f32>(1.0 / 2.2, 1.0 / 2.2, 1.0 / 2.2);
  let pixelIndex:u32 =
      u32(coord.x) + u32(coord.y) * u32(screenDimension.resolution.x);
  let pixelColor:vec4<f32> = pixelBuffer.pixels[pixelIndex];
  let w:f32 = mix(0., 1. / pixelColor.w, f32(pixelColor.w > 0.0));
  return vec4<f32>(pow((w * pixelColor).xyz, INV_GAMMA), 1.0);
}
`;

class SceneInteraction {
  private _changed = true;
  private _stable = false;
  private _accumulatedMovementX = 0;
  private _accumulatedMovementY = 0;
  private _enabled = true;

  reset(): void {
    this._changed = true;
    this._stable = false;
    this._accumulatedMovementX = 0;
    this._accumulatedMovementY = 0;
    this._enabled = true;
  }

  setEnabled(b: boolean): void {
    this._enabled = b;
  }

  recordMovement(x: number, y: number): void {
    if (!this._enabled) {
      return;
    }
    this._accumulatedMovementX += x;
    this._accumulatedMovementY += y;
    this._changed = true;
    this._stable = false;
  }

  isChanged(): boolean { return this._changed; }
  isStable(): boolean {
    const wasStable = this._stable;
    this._stable = true;
    return wasStable;
  }

  write(layout: Std140Block): void {
    layout.addUint32(1, 'reset'); // reset
    layout.addVec4(this._accumulatedMovementX, this._accumulatedMovementY, 0, 0);
    this._changed = false;
  }
}

function setupSceneInteractionListener(canvas: HTMLCanvasElement, sceneInteraction: SceneInteraction): void {
  let mouseDown = false;
  let lastX: number | undefined;
  let lastY: number | undefined;

  document.addEventListener('mousedown', () => {
    mouseDown = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = (e.button === 0);
    lastX = e.offsetX;
    lastY = e.offsetY;
    e.stopPropagation();
    return false;
  })

  canvas.addEventListener('mousemove', (e) => {
    if (!mouseDown) {
      return;
    }
    const x = e.offsetX, y = e.offsetY;
    if (lastX === undefined || lastY === undefined) {
      lastX = e.offsetX;
      lastY = e.offsetY;
      return;
    }

    const xmotion = (lastX - x) / canvas.width;
    const ymotion = (lastY - y) / canvas.height;
    sceneInteraction.recordMovement(xmotion, ymotion);
    lastX = x;
    lastY = y;
  });

  canvas.addEventListener('mouseup', () => {
    mouseDown = false;
  })
  canvas.addEventListener('mouseleave', () => {
    mouseDown = false;
  })

  // canvas.addEventListener('wheel', e => {});
}


class RtCanvas {
  private _renderPipeline: GPURenderPipeline | undefined;
  private _renderBindGroup: GPUBindGroup | undefined;
  private _sceneInteraction: SceneInteraction;
  private _uSceneDataLayout: Std140Block;
  private _context: GPUCanvasContext | undefined;
  private _pixelBuffer: GPUBuffer | undefined;
  private _sceneUniformBuffer: GPUBuffer | undefined;
  private _resolutionUniformBuffer: GPUBuffer | undefined;
  private _rtPipeline: GPURayTracingPipeline | undefined;
  private _rtBindGroup: GPUBindGroup | undefined;
  private _sbt: GPUShaderBindingTable | undefined;
  private _canvas: HTMLCanvasElement | undefined;
  private _device: GPUDevice | undefined;
  constructor() {
    this._sceneInteraction = new SceneInteraction();
    this._uSceneDataLayout = new Std140Block();
    this._sceneInteraction.write(this._uSceneDataLayout);
  }

  private _paused = false;
  private _raf = 0;
  toggleStartPause(start?: boolean): void {
    if (!this._rtPipeline) {
      return;
    }

    if (start === undefined) {
      this._paused = !this._paused;
    } else {
      this._paused = !start;
    }
    this._sceneInteraction.setEnabled(!this._paused);
    if (this._paused) {
      this._raf && cancelAnimationFrame(this._raf);
      this._raf = 0;
    } else if (!this._raf) {
      this._raf = requestAnimationFrame(this._onFrame.bind(this));
    }
  }

  async setupContext(canvas: HTMLCanvasElement): Promise<void> {
    if (canvas === this._canvas) {
      return;
    }

    console.log('setting up context');
    // destroy stuffs
    {
      this._sceneUniformBuffer?.destroy();
      this._pixelBuffer?.destroy();
      this._resolutionUniformBuffer?.destroy();
      // this._renderPipeline
      // this._renderBindGroup

      this._sceneUniformBuffer = undefined;
      this._pixelBuffer = undefined;
      this._resolutionUniformBuffer = undefined;
    }

    this._device = await getGPUDevice();
    this._canvas = canvas;

    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error('failed to getContext(webgpu)')
    }
    this._context = context;

    // const swapChainFormat = 'bgra8unorm';
    const swapChainFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device: this._device,
      format: swapChainFormat,
    });

    {
      const data8 = this._uSceneDataLayout.getFinalUint8Array();
      this._sceneUniformBuffer = this._device.createBuffer({
        size: data8.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
      });
      new Uint8Array(this._sceneUniformBuffer.getMappedRange()).set(data8);
      this._sceneUniformBuffer.unmap();
    }

    setupSceneInteractionListener(canvas, this._sceneInteraction);

    const pixelBufferSize = canvas.width * canvas.height * 4 * Float32Array.BYTES_PER_ELEMENT;
    this._pixelBuffer = this._device.createBuffer({
      size: pixelBufferSize,
      usage: GPUBufferUsage.STORAGE
    });

    const resolutionData = new Float32Array([
      canvas.width, canvas.height
    ]);
    this._resolutionUniformBuffer = this._device.createBuffer({
      size: resolutionData.byteLength,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Float32Array(this._resolutionUniformBuffer.getMappedRange()).set(resolutionData);
    this._resolutionUniformBuffer.unmap();
    this._renderPipeline = this._device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this._device.createShaderModule({
          code: screenVert,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: this._device.createShaderModule({
          code: screenFrag,
        }),
        entryPoint: "main",
        targets: [
          {
            format: swapChainFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        frontFace: "ccw",
        cullMode: "none",
      },
      // no depth stencil needed
    });

    this._renderBindGroup = this._device.createBindGroup({
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this._pixelBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this._resolutionUniformBuffer,
          },
        }
      ]
    });
  }

  loadScene(scene: LoadedSceneResult, cb: () => void) {
    this.toggleStartPause(false);
    if (!this._canvas || !this._device) {
      throw 'missing GPUDevice';
    }

    // TODO: destroy stuffs
    {
      // this._rtPipeline?.destroy(); // all internal buffers
      // todo: destroy tlas?
    }

    this._sceneInteraction.reset();
    this._rtPipeline = scene.rayTracingPipeline;
    this._sbt = scene.sbt;
    this._rtBindGroup = this._device.createBindGroup({
      layout: scene.rayTracingPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          // any ok: acceleration container is a new resource type introduced in WebRTX
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resource: scene.tlas as any,
        },
        {
          binding: 1,
          resource: {
            buffer: this._pixelBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this._sceneUniformBuffer,
          },
        },
      ].concat(scene.userBindGroupEntries),
    });

    this._raf = requestAnimationFrame(() => {
      cb();
      this.toggleStartPause(true);
      this._onFrame();
    });
  }

  private _onFrame(): void {
    this._raf = 0;
    if (this._paused) {
      return;
    }
    if (!this._canvas || !this._device) {
      throw 'missing GPUDevice';
    }
    if (!this._rtPipeline) {
      return;
    }
    if (!this._sbt || !this._context || !this._sceneUniformBuffer || !this._renderPipeline || !this._renderBindGroup || !this._rtBindGroup) {
      throw 'invalid state: objects not initialized'
    }

    const commandEncoder = this._device.createCommandEncoder();

    if (this._sceneInteraction.isChanged()) {
      this._uSceneDataLayout.reset();
      this._sceneInteraction.write(this._uSceneDataLayout);
      const data8 = this._uSceneDataLayout.getFinalUint8Array();
      const staging = this._device.createBuffer({
        size: data8.byteLength,
        usage: GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
      });
      new Uint8Array(staging.getMappedRange()).set(data8);
      staging.unmap();
      commandEncoder.copyBufferToBuffer(staging, 0, this._sceneUniformBuffer, 0, data8.byteLength);
    } else if (!this._sceneInteraction.isStable()) {
      // update once, mark stable
      const location = this._uSceneDataLayout.getLocation('reset');
      const staging = this._device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
      });
      new DataView(staging.getMappedRange()).setUint32(0, 0);
      staging.unmap();
      commandEncoder.copyBufferToBuffer(staging, 0, this._sceneUniformBuffer, location, 4);
    }

    // ray tracing pass
    {
      const passEncoder = commandEncoder.beginRayTracingPass();
      passEncoder.setPipeline(this._rtPipeline);
      passEncoder.setBindGroup(
        0,
        this._rtBindGroup);
      passEncoder.traceRays(
        this._device,
        this._sbt,
        this._canvas.width,
        this._canvas.height,
      );
      passEncoder.end();
    }
    // rasterization pass
    {
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear', // TODO:
          storeOp: 'store',
          view: this._context.getCurrentTexture().createView(),
        }]
      });
      passEncoder.setPipeline(this._renderPipeline);
      passEncoder.setBindGroup(0, this._renderBindGroup);
      passEncoder.draw(3, 1, 0, 0);
      passEncoder.end();
    }
    this._device.queue.submit([commandEncoder.finish()]);

    this._raf = requestAnimationFrame(this._onFrame.bind(this));
  }
}

const rtCanvas = new RtCanvas();
export default rtCanvas;