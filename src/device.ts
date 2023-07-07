
let gpuDevice: GPUDevice | undefined;

const ERROR_MESSAGE = 'WebGPU is not supported or not enabled, please check chrome://flags/#enable-unsafe-webgpu';
export default async function getGPUDevice(): Promise<GPUDevice> {
  if (gpuDevice) {
    return gpuDevice;
  }
  console.log('preparing gpu device');
  if (!navigator.gpu || !navigator.gpu.requestAdapter) {
    alert(ERROR_MESSAGE);
    throw new Error('WebGPU is not enabled');
  }
  const gpuAdapter = await navigator.gpu.requestAdapter();
  if (!gpuAdapter) {
    alert(ERROR_MESSAGE);
    throw new Error('failed to requestAdapter')
  }
  gpuDevice = await gpuAdapter.requestDevice({
    requiredFeatures: ["ray_tracing" as GPUFeatureName],
  });
  if (!gpuDevice) {
    alert('failed to get gpu device');
    throw new Error('failed to get gpu device');
  }
  return gpuDevice;
}