#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

hitAttributeEXT HitAttributes {
  float beta, gamma;
  vec3 geometricNormal;
};

layout(shaderRecordEXT) buffer CheckerBlock {
  vec3 albedo1;
  vec3 albedo2;
};

void main() {
  float repeat = 11.;
  vec2 t0 = vec2(0.f, 0.f);
  vec2 t1 = vec2(1.f, 0.f);
  vec2 t2 = vec2(1.f, 1.f);
  vec2 uv = t1 * beta + t2 * gamma + t0 * (1.0f - beta - gamma);
  uv = sign(fract(uv * repeat) - vec2(0.5));
  vec3 albedo = mix(albedo1, albedo2, float(uv.x * uv.y > 0.));
  const vec3 hitPoint =
      gl_WorldRayOriginEXT + gl_HitTEXT * gl_WorldRayDirectionEXT;
  payload.emit_radiance = doBsdfEval(vec4(0.), hitPoint, gl_WorldRayOriginEXT,
                                     gl_WorldRayDirectionEXT, geometricNormal);
  payload.hitPoint = hitPoint;

  const vec3 woW = -gl_WorldRayDirectionEXT;
  vec2 bsample = vec2(rand(payload.seed), rand(payload.seed));
  payload.bsdfSampleRecord =
      diffuseSampleBSDF(bsample, albedo, geometricNormal, woW);
}
