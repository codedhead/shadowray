#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

hitAttributeEXT HitAttributes {
  vec2 bary_coords;
  vec3 geometricNormal;
};
layout(shaderRecordEXT) buffer DiffuseBlock { vec3 albedo; };

void mirrorSampleBSDF(const vec3 KR, const vec3 N, const vec3 woW) {
  payload.bsdfSampleRecord.sampled_type = BSDF_SPECULAR_REFLECT;
  if (BELOW_SURFACE(woW, N)) {
    payload.bsdfSampleRecord.f = vec3(0.);
  } else {
    payload.bsdfSampleRecord.wiW =
        reflect(-woW, N);  // works with front/back side
    payload.bsdfSampleRecord.pdf_w = 1.f;
    payload.bsdfSampleRecord.f = KR;
  }
}

void main() {
  const vec3 hitPoint =
      gl_WorldRayOriginEXT + gl_HitTEXT * gl_WorldRayDirectionEXT;
  payload.emit_radiance = doBsdfEval(vec4(0.), hitPoint, gl_WorldRayOriginEXT,
                                     gl_WorldRayDirectionEXT, geometricNormal);
  payload.hitPoint = hitPoint;
  const vec3 woW = -gl_WorldRayDirectionEXT;
  mirrorSampleBSDF(albedo, geometricNormal, woW);

  // no need to sample light
  payload.lightSampleRecord.radiance_estimate = vec3(0.);
  payload.lightSampleRecord.bsdf_evaluation = vec4(0.);
}
