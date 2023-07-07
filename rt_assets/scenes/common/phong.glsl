#ifndef _SHADOWRAY_PHONG_
#define _SHADOWRAY_PHONG_

#include "bsdf.glsl"
#include "structs.glsl"
#include "utils.glsl"

vec3 phongEvalBSDF(const vec3 N, const vec3 ks, float phong_exp, const vec3 woW,
                   const vec3 wiW) {
  vec3 R = reflect(-woW, N);
  float alpha = dot(R, wiW);
  if (alpha <= 0.f) {
    return vec3(0.);
  }
  return abs(dot(N, wiW)) *
         (ks * 0.5f * M_1_PIf * (phong_exp + 2.f) * pow(alpha, phong_exp));
}

float phongEvalPdf(const vec3 N, float phong_exp, const vec3 woW,
                   const vec3 wiW) {
  vec3 R = reflect(-woW, N);
  float alpha = dot(R, wiW);
  return (alpha > 0.f) ? pdfExpHemisphere(alpha, phong_exp) : 0.;
}

// return f*cos/pdf
BSDFSampleRecord phongSampleBSDF(vec2 bsample, const vec3 KS, float phong_exp,
                                 const vec3 N, const vec3 woW) {
  BSDFSampleRecord ret;
  ret.sampled_type = BSDF_GLOSSY_REFLECT;  // set even if failed [check] if not
  vec3 R = reflect(-woW, N);
  vec3 local_wi = expHemisphere(bsample.x, bsample.y, phong_exp);
  Frame reflect_frame = makeFrame(R);
  ret.wiW = L2W(reflect_frame, local_wi);

  // may sampled a bad direction
  // e.g. this happens when part of the lobe lies under the surface

  ret.pdf_w = phongEvalPdf(N, phong_exp, woW, ret.wiW);
  ret.f = safe_rcp(ret.pdf_w) * phongEvalBSDF(N, KS, phong_exp, woW, ret.wiW);
  return ret;
}

#endif  // _SHADOWRAY_PHONG_