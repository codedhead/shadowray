/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-undef */
/// <reference types="@webgpu/types" />


import { OBJ } from 'webgl-obj-loader'
import { LITTLE_ENDIAN, alignTo, _assert, _debugAssert } from './util';

import { mat4 } from 'gl-matrix';
import stripJsonComments from 'strip-json-comments';
import { decodeRGBE } from '@derschmale/io-rgbe'
import { Float16Array } from '@petamoriken/float16';
import { AppInfo, FileInfo } from './rt_app_info';
import { Monaco } from '@monaco-editor/react';
import { _GPUShaderStageRTX } from 'webrtx';

interface ShaderSourceAndRecordData {
  shader: string; // filename
  shaderRecord?: ShaderRecord[];
}

type TransformDescription = {
  rowMajorMatrix?: mat4;
  translate?: [number, number, number];
  rotate?: [number, number, number, number]; // vec3(axis), float(rad)
  scale?: [number, number, number];
  lookAt?: {
    origin: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
  };
};

// to row major 3x4
function transformComputedValue(ts?: TransformDescription | TransformDescription[]): Float32Array | undefined {
  if (!ts) {
    return undefined;
  }
  if (!Array.isArray(ts)) {
    ts = [ts];
  }
  const m = mat4.create();
  mat4.identity(m);
  for (const t of ts) {
    if (t.rowMajorMatrix) {
      _assert(t.rowMajorMatrix.length === 16, 'error matrix');
      const colMajor = new Float32Array(16);
      mat4.transpose(colMajor, t.rowMajorMatrix);
      mat4.mul(m, m, colMajor);
    } else if (t.translate) {
      mat4.translate(m, m, t.translate);
    } else if (t.scale) {
      mat4.scale(m, m, t.scale);
    } else if (t.rotate) {
      mat4.rotate(m, m, t.rotate[3], [t.rotate[0], t.rotate[1], t.rotate[2]]);
    } else if (t.lookAt) {
      const mlookat = mat4.create();
      mat4.targetTo(m, t.lookAt.origin, t.lookAt.target, t.lookAt.up);
      // pbrt, mts style!!! n=target-eye, flip n,s (left-handed)
      mlookat[0] = -mlookat[0];
      mlookat[1] = -mlookat[1];
      mlookat[2] = -mlookat[2];
      mlookat[8] = -mlookat[8];
      mlookat[9] = -mlookat[9];
      mlookat[10] = -mlookat[10];
      mat4.mul(m, m, mlookat);
    } else {
      throw `unsupported transform: ${t}`
    }
  }
  const result = new Float32Array(12);
  const expectedLastRow = [0, 0, 0, 1];
  for (let col = 0; col < 4; ++col) {
    _assert(m[4 * col + 3] === expectedLastRow[col], "transform is not affine");
    result[3 * col + 0] = m[4 * col + 0];
    result[3 * col + 1] = m[4 * col + 1];
    result[3 * col + 2] = m[4 * col + 2];
  }
  return result;
}

interface Environment {
  rmiss: string;
}

interface ScalarShaderRecord {
  type: 'float';
  data: number;
}
interface VectorShaderRecord {
  type: 'vec2' | 'vec3' | 'vec4';
  data: number[];
}
interface MatrixShaderRecord {
  type: 'mat4';
  data: TransformDescription | TransformDescription[];
}

type ShaderRecord = ScalarShaderRecord | VectorShaderRecord | MatrixShaderRecord;

interface HitGroupMaterialShadersDescription {
  rchit?: string;
  rahit?: string;
  shaderRecord?: ShaderRecord[];
}
// per ray type or just the first ray type
type MaterialDescription = HitGroupMaterialShadersDescription | HitGroupMaterialShadersDescription[];

interface ObjGeometryDescription {
  type: 'obj';
  filename: string;
}

interface TrianglesListGeometryDescription {
  type: 'triangles';
  vertices: number[];
}

type TriangleGeometryDescription = ObjGeometryDescription | TrianglesListGeometryDescription;

type Vec3 = [number, number, number];
type AABB = [Vec3, Vec3];

interface AABBGeometryDescription {
  type: 'aabb';
  intersection: string | ShaderSourceAndRecordData; // TODO: does it make sense to support different shaders per ray type?
  aabb: AABB;
}

type GeometryDescription = TriangleGeometryDescription | AABBGeometryDescription;
interface BlasDescription {
  geometries: GeometryDescription[];
}

interface InstanceDescription {
  // name?: string;
  customIndex?: number;
  // mask?: number;
  blas: string | BlasDescription;
  material: string | string[]; // TODO: allow inline material
  transformToWorld?: TransformDescription | TransformDescription[];
}

interface BindingSampler {
  magFilter?: string;
  minFilter?: string;
}
interface Binding {
  binding: number;
  texture2D?: string;
  sampler?: BindingSampler;
}

async function loadTexture(filename: string, device: GPUDevice): Promise<GPUTextureView> {
  const dot = filename.lastIndexOf('.');
  const fext = filename.slice(dot + 1);
  switch (fext) {
    case 'hdr': {
      const fileContent = await (await fetch(filename)).arrayBuffer();
      const rgbe = decodeRGBE(new DataView(fileContent));
      const size = {
        width: rgbe.width,
        height: rgbe.height,
      };

      const tgt = new Float16Array(rgbe.data.length / 3 * 4);
      _assert(tgt.length / 4 === rgbe.width * rgbe.height, 'buffer wrong size');
      // const gamma = 1.0 / rgbe.gamma;
      for (let i = 0, j = 0; i < rgbe.data.length; i += 3) {
        // Math.pow(rgbe.data[i] * rgbe.exposure, gamma) * 0xff;
        tgt[j] = rgbe.data[i] * rgbe.exposure;
        tgt[j + 1] = rgbe.data[i + 1] * rgbe.exposure;
        tgt[j + 2] = rgbe.data[i + 2] * rgbe.exposure;
        tgt[j + 3] = 1.0;
        j += 4;
      }


      // TODO: rgba32float not working because not filterable?
      const texture = device.createTexture({
        size,
        format: 'rgba16float',
        usage:
          GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });
      device.queue.writeTexture({
        texture,
      }, tgt.buffer, { bytesPerRow: size.width * 4 * 2 }, size);
      return texture.createView({ // TODO: safe to drop tex?
        format: 'rgba16float',
        dimension: '2d',
      });
    }
    default:
      throw new Error(`unsupported texture file type: ${fext}`);
  }
}

async function createBinding(desc: Binding, device: GPUDevice): Promise<GPUBindGroupEntry> {
  let resource: GPUBindingResource;
  if (desc.texture2D) {
    resource = await loadTexture(desc.texture2D, device);
  } else if (desc.sampler) {
    resource = device.createSampler({
      magFilter: desc.sampler.magFilter as (GPUFilterMode | undefined),
      minFilter: desc.sampler.minFilter as (GPUFilterMode | undefined),
    });
  } else {
    throw 'unsupported binding resource type'
  }

  return {
    binding: desc.binding,
    resource,
  };
}

interface SceneDescription {
  version: string;
  rayTypes: number;
  rayGen: string | ShaderSourceAndRecordData;
  // may define per ray type
  rayMiss?: string | ShaderSourceAndRecordData | ShaderSourceAndRecordData[];
  bindings?: Binding[];
  materials: {
    [materialId: string]: MaterialDescription;
  };
  blas: {
    [blasId: string]: BlasDescription;
  };
  tlas: InstanceDescription[];
}

// let _aabbGeometryIdentifier = 1;
// const _aabbGeometryIdentifiers: Map<GeometryDescription, number> = new Map();
function geometryMaterialKey(intersectionIndex: number | undefined, materialName: string): string {
  if (intersectionIndex !== undefined) {
    // let i = _aabbGeometryIdentifiers.get(g);
    // if (i === undefined) {
    //   i = _aabbGeometryIdentifier++;
    //   _aabbGeometryIdentifiers.set(g, i);
    // }
    return `_aabb_${intersectionIndex}_${materialName}`;
  }
  return materialName;
}

async function loadGeometryButWithoutGPUBuffer(device: GPUDevice, desc: GeometryDescription): Promise<GPURayTracingAccelerationGeometryDescriptor> {
  switch (desc.type) {
    case 'triangles': {
      _assert(desc.vertices && desc.vertices.length >= 3, 'missing triangle vertices');
      const staging = new Float32Array(desc.vertices); // TODO: check length against stride
      return {
        usage: GPURayTracingAccelerationGeometryUsage.NONE,
        type: 'triangles',
        vertex: {
          buffer: staging as unknown as GPUBuffer, // cast ok: will allocate and replace GPUBuffer later,
          format: 'float32x3',
          stride: 3 * 4,
        },
      };
    }
    case 'obj': {
      const fileContent = await (await fetch(desc.filename)).text();
      const mesh = new OBJ.Mesh(fileContent);
      const vbufOriginalData = mesh.makeBufferData(new OBJ.Layout(
        OBJ.Layout.POSITION
      ));
      const vbufStaging = new Float32Array(vbufOriginalData); // TODO: check length against stride
      const ibuf16 = mesh.makeIndexBufferData();
      const ibuf32Staging = new Uint32Array(ibuf16.length);
      // TODO: endianness?
      for (let i = 0; i < ibuf16.length /* numItems? */; i++) {
        ibuf32Staging[i] = ibuf16[i];
      }
      return {
        usage: GPURayTracingAccelerationGeometryUsage.NONE,
        type: 'triangles',
        vertex: {
          buffer: vbufStaging as unknown as GPUBuffer, // cast ok: will allocate and replace GPUBuffer later,
          format: 'float32x3',
          stride: 3 * 4,
        },
        index: {
          buffer: ibuf32Staging as unknown as GPUBuffer, // cast ok: will allocate and replace GPUBuffer later,
          format: 'uint32',
        }
      };
    }
    case 'aabb': {
      const staging = new Float32Array(6);
      staging[0] = desc.aabb[0][0];
      staging[1] = desc.aabb[0][1];
      staging[2] = desc.aabb[0][2];
      staging[3] = desc.aabb[1][0];
      staging[4] = desc.aabb[1][1];
      staging[5] = desc.aabb[1][2];
      return {
        usage: GPURayTracingAccelerationGeometryUsage.NONE,
        type: 'aabbs',
        aabb: {
          buffer: staging as unknown as GPUBuffer, // cast ok: will allocate and replace GPUBuffer later,
          format: 'float32x2',
          stride: 3 * 4, // for vertex
        },
      };
    }
    default:
      throw 'unsupported geometry type: ' // + desc.type
  }
}

function allocateGPUBuffer(device: GPUDevice, allGeometries: GPURayTracingAccelerationGeometryDescriptor[]): void {
  const VBO_STRIDE = 3 * 4, IBO_STRIDE = 3 * 4, AABBO_STRIDE = 3 * 4;
  let vboSize = 0, iboSize = 0;
  for (const g of allGeometries) {
    switch (g.type) {
      case 'aabbs': {
        const staging = g.aabb.buffer as unknown as Float32Array;
        _debugAssert(staging instanceof Float32Array, "aabbo staging buffer not Float32Array");
        _debugAssert(staging.byteLength % AABBO_STRIDE === 0, "aabbo staging byteLength not aligned with stride");
        g.aabb.offset = vboSize;
        g.aabb.stride = AABBO_STRIDE;
        g.aabb.size = staging.byteLength;
        vboSize += g.aabb.size;
        break;
      }
      case 'triangles': {
        const staging = g.vertex.buffer as unknown as Float32Array;
        _debugAssert(staging instanceof Float32Array, "vbo staging buffer not Float32Array");
        _debugAssert(staging.byteLength % VBO_STRIDE === 0, "vbo staging byteLength not aligned with stride");
        g.vertex.offset = vboSize;
        g.vertex.stride = VBO_STRIDE;
        g.vertex.size = staging.byteLength;
        vboSize += g.vertex.size;
        if (g.index) {
          const iStaging = g.index.buffer as unknown as Uint32Array;
          _debugAssert(iStaging instanceof Uint32Array, "ibo staging buffer not Uint32Array");
          _debugAssert(iStaging.byteLength % IBO_STRIDE === 0, "ibo iStaging byteLength not aligned with stride");
          g.index.offset = iboSize;
          g.index.size = iStaging.byteLength;
          iboSize += g.index.size;
        }
        break;
      }
    }
  }

  const vbuf = device.createBuffer({
    size: vboSize,
    usage: GPUBufferUsageRTX.ACCELERATION_STRUCTURE_BUILD_INPUT_READONLY,
    mappedAtCreation: true,
  });
  const ibuf = device.createBuffer({
    size: iboSize,
    usage: GPUBufferUsageRTX.ACCELERATION_STRUCTURE_BUILD_INPUT_READONLY,
    mappedAtCreation: true,
  });
  const vMapped = vbuf.getMappedRange();
  const iMapped = ibuf.getMappedRange();
  for (const g of allGeometries) {
    switch (g.type) {
      case 'triangles':
        new Float32Array(vMapped, g.vertex.offset).set(g.vertex.buffer as unknown as Float32Array);
        g.vertex.buffer = vbuf; // replace GPUBuffer
        if (g.index) {
          // No need to offset indices as traversal code will add the vboOffset
          new Uint32Array(iMapped, g.index.offset).set(g.index.buffer as unknown as Uint32Array);
          g.index.buffer = ibuf; // replace GPUBuffer
        }
        break;
      case 'aabbs':
        new Float32Array(vMapped, g.aabb.offset).set(g.aabb.buffer as unknown as Float32Array);
        g.aabb.buffer = vbuf; // replace GPUBuffer
        break;
    }
  }
  vbuf.unmap();
  ibuf.unmap();
}

function shaderRecordSize(records?: ShaderRecord[]): number {
  if (!records || !records.length) {
    return 0;
  }
  let size = 0;
  for (const r of records) {
    switch (r.type) {
      case 'float':
        size += 4;
        break;
      case 'vec2':
        size += 2 * 4;
        break;
      case 'vec3':
        size += 3 * 4;
        break;
      case 'vec4':
        size += 4 * 4;
        break;
      case 'mat4':
        size += 64;
        break;
      default:
        throw `unsupported shader record type`
    }
  }
  return size;
}

function toSingleShader(s: string | ShaderSourceAndRecordData): ShaderSourceAndRecordData {
  if (typeof s === 'string') {
    return {
      shader: s,
    };
  }
  return s;
}

function toShadersList(s: undefined | string | ShaderSourceAndRecordData | ShaderSourceAndRecordData[]): ShaderSourceAndRecordData[] {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  if (typeof s === 'string') {
    return [{
      shader: s,
    }];
  }
  return [s];
}

function visitSceneGeometrySync(sceneDescription: SceneDescription, visit: (g: GeometryDescription, mtlName: string) => void) {
  for (const instanceDesc of sceneDescription.tlas) {
    let blasDesc = instanceDesc.blas;
    if (typeof blasDesc === 'string') {
      blasDesc = sceneDescription.blas[blasDesc];
      if (!blasDesc) {
        throw `blas description not found for id '${instanceDesc.blas}'`
      }
    }
    if (Array.isArray(instanceDesc.material)) {
      if (instanceDesc.material.length !== blasDesc.geometries.length) {
        throw `number of materials in instance should match number of geometries in blas`
      }
    }
    const varyingMaterials = Array.isArray(instanceDesc.material);
    for (let gi = 0; gi < blasDesc.geometries.length; gi++) {
      const mName = (varyingMaterials ? instanceDesc.material[gi] : instanceDesc.material) as string;
      // const mDesc = sceneDescription.materials[mName];
      // if (!mDesc) {
      //   throw `material not found for name '${mName}'`
      // }
      visit(blasDesc.geometries[gi], mName);
    }
  }
}

async function visitSceneGeometryAsync(sceneDescription: SceneDescription, visit: (g: GeometryDescription, mtlName: string) => Promise<void>, parallel = false) {
  const promises: Promise<void>[] = [];
  for (const instanceDesc of sceneDescription.tlas) {
    let blasDesc = instanceDesc.blas;
    if (typeof blasDesc === 'string') {
      blasDesc = sceneDescription.blas[blasDesc];
      if (!blasDesc) {
        throw `blas description not found for id '${instanceDesc.blas}'`
      }
    }
    if (Array.isArray(instanceDesc.material)) {
      if (instanceDesc.material.length !== blasDesc.geometries.length) {
        throw `number of materials in instance should match number of geometries in blas`
      }
    }
    const varyingMaterials = Array.isArray(instanceDesc.material);
    for (let gi = 0; gi < blasDesc.geometries.length; gi++) {
      const mName = (varyingMaterials ? instanceDesc.material[gi] : instanceDesc.material) as string;
      // const mDesc = sceneDescription.materials[mName];
      // if (!mDesc) {
      //   throw `material not found for name '${mName}'`
      // }
      const p = visit(blasDesc.geometries[gi], mName);
      if (parallel) {
        promises.push(p);
      } else {
        await p;
      }
    }
  }
  parallel && (await Promise.all(promises));
}

async function visitSceneInstanceAsync(sceneDescription: SceneDescription, visit: (instance: InstanceDescription, g: BlasDescription) => Promise<void>, parallel = false) {
  const promises: Promise<void>[] = [];
  for (const instanceDesc of sceneDescription.tlas) {
    let blasDesc = instanceDesc.blas;
    if (typeof blasDesc === 'string') {
      blasDesc = sceneDescription.blas[blasDesc];
      if (!blasDesc) {
        throw `blas description not found for id '${instanceDesc.blas}'`
      }
    }
    if (Array.isArray(instanceDesc.material)) {
      if (instanceDesc.material.length !== blasDesc.geometries.length) {
        throw `number of materials in instance should match number of geometries in blas`
      }
    }
    const p = visit(instanceDesc, blasDesc);
    if (parallel) {
      promises.push(p);
    } else {
      await p;
    }
  }
  parallel && (await Promise.all(promises));
}

function writeShaderRecords(dvSbtBuffer: DataView, records: ShaderRecord[] | undefined, byteOffset: number) {
  if (!records || !records.length) {
    return;
  }
  for (const sr of records) {
    switch (sr.type) {
      case 'float': {
        _assert(!isNaN(sr.data), 'not a number');
        dvSbtBuffer.setFloat32(byteOffset, sr.data, LITTLE_ENDIAN);
        byteOffset += 4;
        break;
      }
      case 'vec2':
        if (!sr.data || sr.data.length !== 2) {
          throw `expecting vec2 shader record data: ${sr.data}`
        }
        dvSbtBuffer.setFloat32(byteOffset, sr.data[0], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 4, sr.data[1], LITTLE_ENDIAN);
        byteOffset += 8;
        break;
      case 'vec3':
        if (!sr.data || sr.data.length !== 3) {
          throw `expecting vec3 shader record data: ${sr.data}`
        }
        dvSbtBuffer.setFloat32(byteOffset, sr.data[0], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 4, sr.data[1], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 8, sr.data[2], LITTLE_ENDIAN);
        byteOffset += 12;
        break;
      case 'vec4':
        if (!sr.data || sr.data.length !== 4) {
          throw `expecting vec4 shader record data: ${sr.data}`
        }
        dvSbtBuffer.setFloat32(byteOffset, sr.data[0], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 4, sr.data[1], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 8, sr.data[2], LITTLE_ENDIAN);
        dvSbtBuffer.setFloat32(byteOffset + 12, sr.data[3], LITTLE_ENDIAN);
        byteOffset += 16;
        break;
      case 'mat4': {
        const f32_12 = transformComputedValue(sr.data);
        if (!f32_12 || f32_12.length !== 12) {
          throw 'expected mat4x3'
        }
        for (let c = 0; c < 4; c++) {
          for (let r = 0; r < 3; r++) {
            dvSbtBuffer.setFloat32(byteOffset, f32_12[c * 3 + r], LITTLE_ENDIAN);
            byteOffset += 4;
          }
          dvSbtBuffer.setFloat32(byteOffset, 0., LITTLE_ENDIAN);
          byteOffset += 4;
        }
        break;
      }
    }
  }
}

export interface LoadedSceneResult {
  rayTracingPipeline: GPURayTracingPipeline;
  tlas: GPURayTracingAccelerationContainer_top;
  sbt: GPUShaderBindingTable;
  userBindGroupEntries: GPUBindGroupEntry[];
}

// TODO: move into class
function getFileContent(file: FileInfo | undefined, monacoRef: Monaco): string {
  if (!file) return '';
  const m = monacoRef.editor.getModel(monacoRef.Uri.parse(file.path));
  return m?.getValue() || file.code;
}

export default class SceneLoader {
  async load(monacoRef: Monaco, appInfo: AppInfo, device: GPUDevice): Promise<LoadedSceneResult> {
    // assume valid
    const sceneDescription = JSON.parse(stripJsonComments(getFileContent(appInfo.sceneConfig, monacoRef))) as SceneDescription;
    if (sceneDescription.rayTypes === undefined) {
      sceneDescription.rayTypes = 1;
    }
    _assert(!isNaN(sceneDescription.rayTypes) && sceneDescription.rayTypes > 0, "number of ray types must be greater than 0");
    const NUM_RAY_TYPES = sceneDescription.rayTypes;

    const userBindGroupEntries = sceneDescription.bindings ?
      await Promise.all(sceneDescription.bindings.map(b => createBinding(b, device))) : [];

    type _ShaderStageDesc = GPURayTracingShaderStageDescriptor & { _index: number };
    const shaderFilenameToStage = new Map<string, _ShaderStageDesc>();

    const shaderFiles: Map<string, FileInfo> = new Map();
    for (const s of appInfo.shaders) {
      shaderFiles.set(s.filename, s);
    }

    async function addShader(shaderStage: _GPUShaderStageRTX, filename: string): Promise<_ShaderStageDesc> {
      const stage = shaderFilenameToStage.get(filename);
      if (stage) {
        return stage;
      }
      if (!shaderFiles.has(filename)) {
        throw `missing shader file ${filename}`;
      }
      const shaderFileInfo = shaderFiles.get(filename)!;
      const desc = {
        // manually include common.glsl content
        glslCode: getFileContent(shaderFileInfo, monacoRef).replace('#include "common.glsl"', `${getFileContent(appInfo.commonCode, monacoRef)}\n`),
        stage: shaderStage,
        entryPoint: 'main', // TODO: configurable
        _index: shaderFilenameToStage.size,
      };
      shaderFilenameToStage.set(filename, desc);
      return desc;
    }

    _assert(Boolean(sceneDescription.rayGen), "ray gen shader not defined");
    const rayGenDesc = toShadersList(sceneDescription.rayGen);
    _assert(rayGenDesc.length === 1, "only one ray gen shader is allowed");
    const rgen = await addShader(GPUShaderStageRTX.RAY_GENERATION, rayGenDesc[0].shader);
    const rayGenGroups: GPURayTracingShaderGroupDescriptor[] = [{
      type: 'general',
      generalIndex: rgen._index,
    }];
    const maxRgenShaderRecordSize = shaderRecordSize(rayGenDesc[0].shaderRecord);

    const rayMissGroups: GPURayTracingShaderGroupDescriptor[] = [];
    let maxRmissShaderRecordSize = 0;
    if (sceneDescription.rayMiss) {
      const shaders = toShadersList(sceneDescription.rayMiss);
      sceneDescription.rayMiss = shaders;
      _assert(shaders.length <= NUM_RAY_TYPES, `number of ray miss shaders must be <= ${NUM_RAY_TYPES}`);
      for (const s of shaders) {
        const rmiss = await addShader(GPUShaderStageRTX.RAY_MISS, s.shader);
        rayMissGroups.push({
          type: 'general',
          generalIndex: rmiss._index,
        });
        maxRmissShaderRecordSize = Math.max(maxRmissShaderRecordSize, shaderRecordSize(s.shaderRecord));
      }
    }

    let maxRintShaderRecordByteSize = 0;
    let maxRchitRahitShaderRecordByteSize = 0;
    let hitShaderGroupIndex = 0;
    type _HitShaderGroupDesc = GPURayTracingShaderGroupDescriptor & { _hitShaderGroupIndex: number };
    const materialKeyToHitShaderGroups = new Map<string, _HitShaderGroupDesc[]>();
    await visitSceneGeometryAsync(sceneDescription, async (g, mtlName) => {
      const mtlDesc = sceneDescription.materials[mtlName];
      if (!mtlDesc) {
        throw `material not found for name '${mtlName}'`
      }
      let intersectionIndex: number | undefined;
      if (g.type === 'aabb') {
        const rint = toSingleShader(g.intersection);
        maxRintShaderRecordByteSize = Math.max(maxRintShaderRecordByteSize, shaderRecordSize(rint.shaderRecord));
        intersectionIndex = (await addShader(GPUShaderStageRTX.RAY_INTERSECTION, rint.shader))._index;
      }
      const mtlKey = geometryMaterialKey(intersectionIndex, mtlName);

      const materialGroupsForRayTypes = Array.isArray(mtlDesc) ? mtlDesc : [mtlDesc];
      const groups: _HitShaderGroupDesc[] = [];
      for (const desc of materialGroupsForRayTypes) {
        maxRchitRahitShaderRecordByteSize = Math.max(
          maxRchitRahitShaderRecordByteSize,
          shaderRecordSize(desc.shaderRecord)); // TODO: maybe duplicated calc?
        if (materialKeyToHitShaderGroups.has(mtlKey)) {
          continue;
        }

        _assert(Boolean(desc.rchit || desc.rahit), 'must specify at least one of rchit shader and rahit shader');
        const _hitShaderGroupIndex = hitShaderGroupIndex++;
        let closestHitIndex: number | undefined;
        let anyHitIndex: number | undefined;
        if (desc.rchit) {
          closestHitIndex = (await addShader(GPUShaderStageRTX.RAY_CLOSEST_HIT, desc.rchit))._index;
        }
        if (desc.rahit) {
          anyHitIndex = (await addShader(GPUShaderStageRTX.RAY_ANY_HIT, desc.rahit))._index;
        }
        if (g.type === 'aabb') {
          groups.push({
            type: 'procedural-hit-group',
            _hitShaderGroupIndex,
            closestHitIndex,
            anyHitIndex,
            intersectionIndex: intersectionIndex!,
          });
        } else {
          groups.push({
            type: 'triangles-hit-group',
            _hitShaderGroupIndex,
            closestHitIndex,
            anyHitIndex,
          });
        }
      }
      if (groups.length > 0) {
        materialKeyToHitShaderGroups.set(mtlKey, groups);
      }
    });
    const maxHitGroupShaderRecordByteSize = maxRintShaderRecordByteSize + maxRchitRahitShaderRecordByteSize;

    const collectedAllUniqueGeometries: GPURayTracingAccelerationGeometryDescriptor[] = [];
    const instances: GPURayTracingAccelerationInstanceDescriptor[] = [];
    // only build unique blases
    const uniqueBlas: Map<BlasDescription, GPURayTracingAccelerationContainerDescriptor_bottom> = new Map();
    let totalInstanceGeometries = 0;
    await visitSceneInstanceAsync(sceneDescription, async (instanceDesc, blasDesc) => {
      // NUM_RAY_TYPES hitGroup(s) per geometry
      const hitGroupIdStart = totalInstanceGeometries * NUM_RAY_TYPES;
      let blas = uniqueBlas.get(blasDesc);
      if (!blas) {
        const geometries = await Promise.all(blasDesc.geometries.map(async gDesc => await loadGeometryButWithoutGPUBuffer(device, gDesc)));
        blas = {
          usage: GPURayTracingAccelerationContainerUsage.NONE,
          level: <const>'bottom',
          geometries,
        }
        uniqueBlas.set(blasDesc, blas);
        collectedAllUniqueGeometries.push(...geometries);
      }
      totalInstanceGeometries += blas.geometries.length;
      instances.push({
        usage: GPURayTracingAccelerationInstanceUsage.NONE,
        mask: 0xFF,
        transformMatrix: transformComputedValue(instanceDesc.transformToWorld),
        instanceCustomIndex: instanceDesc.customIndex,
        instanceSBTRecordOffset: hitGroupIdStart,
        blas,
      });
    }, false /* hitGroupIdStart dependency */);

    allocateGPUBuffer(device, collectedAllUniqueGeometries);

    const tlas = device.createRayTracingAccelerationContainer({
      level: 'top',
      usage: GPURayTracingAccelerationContainerUsage.NONE,
      instances,
    });
    device.hostBuildRayTracingAccelerationContainer(tlas);

    const _stages = Array.from(shaderFilenameToStage.values());
    _stages.sort((a, b) => a._index - b._index);
    const stages = _stages as GPURayTracingShaderStageDescriptor[];

    // with hitGroupId increasing from 0
    const flattenedSortedHitShaderGroups: _HitShaderGroupDesc[] = [];
    for (const hsgs of materialKeyToHitShaderGroups.values()) {
      flattenedSortedHitShaderGroups.push(...hsgs);
    }
    flattenedSortedHitShaderGroups.sort((a, b) => a._hitShaderGroupIndex - b._hitShaderGroupIndex);
    // mind the layout, always fixed: rgen => rmiss => hit => callable
    const groups = rayGenGroups.concat(rayMissGroups).concat(flattenedSortedHitShaderGroups);
    const pipeline = await device.createRayTracingPipeline({
      stages,
      groups,
    }, tlas);
    // same layout
    const groupHandles: ShaderGroupHandle[] = pipeline.getShaderGroupHandles(0, groups.length);

    const sbt: GPUShaderBindingTable = {
      rayGen: {},
      rayMiss: {},
      rayHit: {},
      callable: {
        start: 0,
        stride: 0,
        size: 0,
      },
    } as GPUShaderBindingTable;
    // always start at 0
    sbt.rayGen.start = 0;
    sbt.rayGen.stride = alignTo(
      device.ShaderGroupHandleSize + maxRgenShaderRecordSize,
      device.ShaderGroupHandleAlignment);
    sbt.rayGen.size = rayGenGroups.length * sbt.rayGen.stride;

    // insert a constant rmiss0
    sbt.rayMiss.start = alignTo(sbt.rayGen.start + sbt.rayGen.size, device.ShaderGroupBaseAlignment);
    sbt.rayMiss.stride = alignTo(
      device.ShaderGroupHandleSize + maxRmissShaderRecordSize,
      device.ShaderGroupHandleAlignment);
    sbt.rayMiss.size = rayMissGroups.length * sbt.rayMiss.stride;

    sbt.rayHit.start = alignTo(sbt.rayMiss.start + sbt.rayMiss.size, device.ShaderGroupBaseAlignment);
    sbt.rayHit.stride = alignTo(
      device.ShaderGroupHandleSize + maxHitGroupShaderRecordByteSize,
      device.ShaderGroupHandleAlignment);
    // including all instances
    sbt.rayHit.size = totalInstanceGeometries * NUM_RAY_TYPES * sbt.rayHit.stride;

    const alignedSbtSize = alignTo(sbt.rayHit.start + sbt.rayHit.size, device.ShaderGroupBaseAlignment);
    sbt.buffer = device.createBuffer({
      size: alignedSbtSize,
      usage: GPUBufferUsageRTX.SHADER_BINDING_TABLE,
      mappedAtCreation: true,
    });
    {
      let groupHandleIndex = 0;
      const dvSbtBuffer = new DataView(sbt.buffer.getMappedRange());

      {
        for (let i = 0; i < rayGenGroups.length; i++, groupHandleIndex++) {
          const byteOffset = sbt.rayGen.start + i * sbt.rayGen.stride;
          dvSbtBuffer.setUint32(byteOffset, groupHandles[groupHandleIndex], LITTLE_ENDIAN);
          writeShaderRecords(dvSbtBuffer, rayGenDesc[i]?.shaderRecord, byteOffset + device.ShaderGroupHandleSize);
        }
      }

      {
        const shaderDesc = toShadersList(sceneDescription.rayMiss);
        for (let i = 0; i < rayMissGroups.length; i++, groupHandleIndex++) {
          const byteOffset = sbt.rayMiss.start + i * sbt.rayMiss.stride;
          dvSbtBuffer.setUint32(byteOffset, groupHandles[groupHandleIndex], LITTLE_ENDIAN);
          writeShaderRecords(dvSbtBuffer, shaderDesc[i]?.shaderRecord, byteOffset + device.ShaderGroupHandleSize);
        }
      }

      // NUM_RAY_TYPES * num_geometries hitGroups
      let hitGroupId = 0;
      visitSceneGeometrySync(sceneDescription, (g, mtlName) => {
        let intersectionIndex: number | undefined;
        let intersectionShaderRecord: ShaderRecord[] | undefined;
        if (g.type === 'aabb') {
          const rint = toSingleShader(g.intersection);
          intersectionIndex = shaderFilenameToStage.get(rint.shader)?._index;
          if (intersectionIndex === undefined) {
            throw `no shader stage found for ${g.intersection}`;
          }
          intersectionShaderRecord = rint.shaderRecord;
        }
        const hitShaderGroupDesc = materialKeyToHitShaderGroups.get(geometryMaterialKey(intersectionIndex, mtlName));
        const mDesc = sceneDescription.materials[mtlName];
        if (!hitShaderGroupDesc || !mDesc) {
          throw `material not found for name '${mtlName}'`
        }

        const hitGroupMaterialDescPerRayType = Array.isArray(mDesc) ? mDesc : [mDesc];
        for (let rayType = 0; rayType < NUM_RAY_TYPES; ++rayType) {
          const hitGroupDesc = hitGroupMaterialDescPerRayType[rayType];
          const handle = hitGroupDesc ? groupHandles[
            groupHandleIndex /* num ray gen + num ray miss */
            + hitShaderGroupDesc[rayType]._hitShaderGroupIndex] : WEBRTX_HIT_GROUP_ALL_SHADERS_UNUSED_HANDLE;

          // every geometry:ray_type pair occupy one group
          let byteOffset = sbt.rayHit.start + (hitGroupId++) * sbt.rayHit.stride;
          dvSbtBuffer.setUint32(byteOffset, handle, LITTLE_ENDIAN);
          byteOffset += device.ShaderGroupHandleSize;
          //! ensure always word aligned
          writeShaderRecords(dvSbtBuffer, hitGroupDesc?.shaderRecord, byteOffset);
          writeShaderRecords(dvSbtBuffer, intersectionShaderRecord, byteOffset + maxRchitRahitShaderRecordByteSize);
        }
      });
    }
    sbt.buffer.unmap();

    return { rayTracingPipeline: pipeline, tlas, sbt, userBindGroupEntries };
  }
}
