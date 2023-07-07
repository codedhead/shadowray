#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

hitAttributeEXT HitAttributes {
  vec2 bary_coords;
  vec3 geometricNormal;
};
layout(shaderRecordEXT) buffer GlassBlock {
  vec3 KR, KT;
  vec2 etai_etat;
};

// cosi > 0
float fresnel_dielectric(float cosi, float eta) {
  float sint = clamp(cos2sin(cosi) * eta, -1., 1.);
  float cost = sin2cos(sint);

  float rll = (cosi - eta * cost) / (cosi + eta * cost);
  float r_l_ = (eta * cosi - cost) / (eta * cosi + cost);
  return 0.5 * (rll * rll + r_l_ * r_l_);
}

void glassSampleBSDF(vec2 bsample, const vec3 KR, const vec3 KT, float etai,
                     float etat, const vec3 Ns, const vec3 woW) {
  payload.bsdfSampleRecord.sampled_type = BSDF_SPECULAR_REFLECT;
  float wo_Ns = clamp(-1, 1, dot(woW, Ns));
  vec3 Nfixed = sign(wo_Ns) * Ns;
  float eta = wo_Ns > 0. ? etai / etat : etat / etai;

  float reflectProb = fresnel_dielectric(abs(wo_Ns), eta);

  float sample_t = step(reflectProb, bsample.x);
  payload.bsdfSampleRecord.wiW =
      mix(reflect(-woW, Nfixed), refract(-woW, Nfixed, eta), sample_t);
  payload.bsdfSampleRecord.pdf_w =
      mix(reflectProb, 1.f - reflectProb, sample_t);

  payload.bsdfSampleRecord.sampled_type =
      sample_t > 0. ? BSDF_SPECULAR_TRANSMIT : BSDF_SPECULAR_REFLECT;
  payload.bsdfSampleRecord.f = mix(KR, KT, sample_t);
}

void main() {
  const vec3 hitPoint =
      gl_WorldRayOriginEXT + gl_HitTEXT * gl_WorldRayDirectionEXT;
  payload.emit_radiance = doBsdfEval(vec4(0.), hitPoint, gl_WorldRayOriginEXT,
                                     gl_WorldRayDirectionEXT, geometricNormal);
  payload.hitPoint = hitPoint;
  const vec3 woW = -gl_WorldRayDirectionEXT;

  vec2 bsample = vec2(rand(payload.seed), rand(payload.seed));
  glassSampleBSDF(bsample, KR, KT, etai_etat.x, etai_etat.y, geometricNormal,
                  woW);

  // no need to sample light
  payload.lightSampleRecord.radiance_estimate = vec3(0.);
  payload.lightSampleRecord.bsdf_evaluation = vec4(0.);
}
