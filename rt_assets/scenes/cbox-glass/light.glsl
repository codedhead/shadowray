#ifndef _SHADOWRAY_LIGHT_
#define _SHADOWRAY_LIGHT_

#include "../common/structs.glsl"
#include "../common/utils.glsl"

struct XZPlaneQuadLight {
  float y;
  vec2 min, max;
};

LightSampleRecord sampleLight(vec2 u2, vec3 fromHitPoint) {
  const XZPlaneQuadLight ceiling_light = {
      548.29999,
      {213, 227},
      {343, 332},
  };

  vec2 xz = mix(ceiling_light.min, ceiling_light.max, u2);
  vec3 p = vec3(xz[0], ceiling_light.y, xz[1]);
  vec3 n = vec3(0., -1., 0.);
  vec2 d = ceiling_light.max - ceiling_light.min;
  float pdf = 1.0 / (d.x * d.y);

  vec3 dir = normalize(fromHitPoint - p);
  float facing_light = step(0., dot(n, dir));
  // from area measure to solid angle measure
  pdf = facing_light * pdfArea2SolidAngle(pdf, fromHitPoint, p, n);
  const vec3 radiance = facing_light * vec3(15.6) * safe_rcp(pdf);
  LightSampleRecord rec = {{p, n, pdf}, radiance, vec4(0.)};
  return rec;
}

#endif