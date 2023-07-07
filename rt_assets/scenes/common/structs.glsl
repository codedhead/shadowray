
#ifndef _SHADOWRAY_STRUCT_
#define _SHADOWRAY_STRUCT_

struct BSDFSampleRecord {
  vec3 f;  // i.e. f*g/pA or f*cos/pW
  vec3 wiW;
  float pdf_w;
  uint sampled_type;
};

struct PointSampleRecord {
  vec3 p;
  vec3 n;  // geometric normal!!!
  // shape sample function will store pdf w.r.t area
  float pdf;  // will be eventually used as pdf w.r.t solid angle
};

struct LightSampleRecord {
  PointSampleRecord point_sample;
  vec3 radiance_estimate;  // = radiance*cos/pdf_w
  vec4 bsdf_evaluation;    // vec3(f), float(pdf)
};

struct RayPayload_PT_Radiance {
  uvec3 seed;
  bool done;  // e.g. ray miss
  // hitpoint information
  vec3 hitPoint;

  // sampling information for next ray, e.g. ray direction, evaluated BSDF value
  BSDFSampleRecord bsdfSampleRecord;
  // emitter current hitpoint
  vec4 emit_radiance;  // vec3(radiance), float(pdf_solid_angle)

  LightSampleRecord lightSampleRecord;

  vec3 alpha;  // throughput so far, products of sampled bsdf weight(f/pdf)
               // it's on emitter
};

#endif