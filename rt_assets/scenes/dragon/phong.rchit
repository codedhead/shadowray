#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

hitAttributeEXT HitAttributes {
  float beta, gamma;
  vec3 geometricNormal;
};

layout(shaderRecordEXT) buffer PhongBlock {
  vec3 KS;
  float exp;
}
phong;

void main() {
  const vec3 hitPoint =
      gl_WorldRayOriginEXT + gl_HitTEXT * gl_WorldRayDirectionEXT;
  payload.emit_radiance = doBsdfEval(vec4(0.), hitPoint, gl_WorldRayOriginEXT,
                                     gl_WorldRayDirectionEXT, geometricNormal);
  payload.hitPoint = hitPoint;

  const vec3 woW = -gl_WorldRayDirectionEXT;
  vec2 bsample = vec2(rand(payload.seed), rand(payload.seed));
  payload.bsdfSampleRecord =
      phongSampleBSDF(bsample, phong.KS, phong.exp, geometricNormal, woW);
}
