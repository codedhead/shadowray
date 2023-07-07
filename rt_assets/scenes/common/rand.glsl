
#ifndef _SHADOWRAY_RAND_
#define _SHADOWRAY_RAND_

// https://www.shadertoy.com/view/XlGcRh
// https://www.reedbeta.com/blog/hash-functions-for-gpu-rendering/
// see also https://www.shadertoy.com/view/Xt3cDn
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;

  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;

  v ^= v >> 16u;

  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;

  return v;
}

float rand(inout uvec3 v) {
  uvec3 hash = pcg3d(v);
  v.z += 1;
  return float(hash) * (1.0 / float(0xffffffffu));
}

#endif