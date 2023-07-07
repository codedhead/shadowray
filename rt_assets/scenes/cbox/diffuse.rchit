#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

hitAttributeEXT HitAttributes {
  float beta, gamma;
  vec3 geometricNormal;
};
layout(shaderRecordEXT) buffer DiffuseBlock {
  vec4 lemit_inv_area;  // vec3(L), inv_area
  vec3 albedo;
};

void main() {
  const vec3 hitPoint =
      gl_WorldRayOriginEXT + gl_HitTEXT * gl_WorldRayDirectionEXT;
  payload.emit_radiance =
      doBsdfEval(lemit_inv_area, hitPoint, gl_WorldRayOriginEXT,
                 gl_WorldRayDirectionEXT, geometricNormal);
  payload.hitPoint = hitPoint;

  const vec3 woW = -gl_WorldRayDirectionEXT;
  vec2 lsample = vec2(rand(payload.seed), rand(payload.seed));

  {
    LightSampleRecord light_rec = sampleLight(lsample, hitPoint);
    vec3 wiW = normalize(light_rec.point_sample.p - hitPoint);
    // on previous hitpoint
    light_rec.bsdf_evaluation =
        vec4(albedo * diffuseEvalBSDF(geometricNormal, woW, wiW),
             diffuseEvalBSDFPdf(geometricNormal, woW, wiW));
    payload.lightSampleRecord = light_rec;
  }

  vec2 bsample = vec2(rand(payload.seed), rand(payload.seed));
  payload.bsdfSampleRecord =
      diffuseSampleBSDF(bsample, albedo, geometricNormal, woW);
}
