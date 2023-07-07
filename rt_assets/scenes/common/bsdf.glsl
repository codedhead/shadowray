
#ifndef _SHADOWRAY_BSDF_
#define _SHADOWRAY_BSDF_

#include "utils.glsl"

const uint BSDF_REFLECTION = 1;
const uint BSDF_TRANSMISSION = (1 << 1);
const uint BSDF_DIFFUSE = (1 << 2);
const uint BSDF_GLOSSY = (1 << 3);
const uint BSDF_SPECULAR = (1 << 4);

const uint BSDF_DIFFUSE_REFLECT = (BSDF_DIFFUSE | BSDF_REFLECTION);
const uint BSDF_SPECULAR_REFLECT = (BSDF_SPECULAR | BSDF_REFLECTION);
const uint BSDF_SPECULAR_TRANSMIT = (BSDF_SPECULAR | BSDF_TRANSMISSION);
const uint BSDF_GLOSSY_REFLECT = (BSDF_GLOSSY | BSDF_REFLECTION);
const uint BSDF_GLOSSY_TRANSMIT = (BSDF_GLOSSY | BSDF_TRANSMISSION);
const uint BSDF_ALL_TYPES = (BSDF_DIFFUSE | BSDF_SPECULAR | BSDF_GLOSSY);
const uint BSDF_ALL_REFLECTION = (BSDF_REFLECTION | BSDF_ALL_TYPES);
const uint BSDF_ALL_TRANSMISSION = (BSDF_TRANSMISSION | BSDF_ALL_TYPES);
const uint BSDF_ALL = (BSDF_ALL_REFLECTION | BSDF_ALL_TRANSMISSION);
const uint BSDF_NO_SPECULAR = (BSDF_ALL & ~BSDF_SPECULAR);

#define IS_TYPE_SPECULAR(t) (((t)&BSDF_SPECULAR) != 0)
#define IS_TYPE_DIFFUSE(t) (((t)&BSDF_DIFFUSE) != 0)
#define IS_TYPE_GLOSSY(t) (((t)&BSDF_GLOSSY) != 0)

#define ABOVE_SURFACE(w, Ns) (dot((w), (Ns)) > 0.)
#define BELOW_SURFACE(w, Ns) (dot((w), (Ns)) <= 0.)
#define STEP_IF_ABOVE_SURFACE(w, Ns) step(0., dot((w), (Ns)))

vec4 doBsdfEval(vec4 lemit_invarea, vec3 hitPoint, vec3 rayOrigin,
                vec3 rayDirection, const vec3 Ns) {
  const vec3 woW = -rayDirection;
  lemit_invarea.w =
      pdfArea2SolidAngle(lemit_invarea.w, rayOrigin, hitPoint, Ns);
  return STEP_IF_ABOVE_SURFACE(woW, Ns) * lemit_invarea;
}

bool matchBxDFFlag(uint required, uint flags) {
  // required bits must all be on in flags
  return (required & flags) == required;
}

#endif  // _SHADOWRAY_BSDF_