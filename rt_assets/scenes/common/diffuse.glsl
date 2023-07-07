
#ifndef _SHADOWRAY_DIFFUSE_
#define _SHADOWRAY_DIFFUSE_

#include "bsdf.glsl"
#include "structs.glsl"
#include "utils.glsl"

// bDOUBLE_FACE = false, bSTRICT_NORMAL = false
float diffuseEvalBSDF(const vec3 N, const vec3 woW, const vec3 wiW) {
  return M_1_PIf * abs(dot(N, wiW));  // no kd
}

// bDOUBLE_FACE = false, bSTRICT_NORMAL = false
float diffuseEvalBSDFPdf(const vec3 N, const vec3 woW, const vec3 wiW) {
  return pdfCosineHemisphere(wiW, N);
}

// f = brdf*cos/pdf
BSDFSampleRecord diffuseSampleBSDF(vec2 bsample, const vec3 KD, const vec3 N,
                                   const vec3 woW) {
  BSDFSampleRecord bsdfSampleRecord;
  bsdfSampleRecord.sampled_type = BSDF_DIFFUSE_REFLECT;  // even if failed?
  const float stp = STEP_IF_ABOVE_SURFACE(woW, N);
  Frame frame = makeFrame(N);  // Ns in world space
  float pdf_w = 0.;
  bsdfSampleRecord.wiW =
      L2W(frame, cosineHemisphere(bsample.x, bsample.y,
                                  pdf_w));  // should remain normalized
  bsdfSampleRecord.f = stp * KD;
  bsdfSampleRecord.pdf_w = pdf_w;
  return bsdfSampleRecord;
}

#endif  // _SHADOWRAY_DIFFUSE_