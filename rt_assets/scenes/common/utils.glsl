#ifndef _SHADOWRAY_UTILS_
#define _SHADOWRAY_UTILS_

#define EPSILON 1e-4
#define M_PI_4f 0.785398163397448309616f
#define M_1_PIf 0.31830988618379067154f
#define M_PIf 3.14159265358979323846f
#define M_TWOPI 6.28318530718f
#define INV_PI M_1_PIf
#define INV_TWOPI 0.15915494309189533577f

struct Frame {
  vec3 u, v, w;  // tangent binormal normal;
};

Frame makeFrame(const vec3 normal) {
  Frame frame;
  frame.w = normal;

  if (abs(normal.x) > abs(normal.z)) {
    frame.v = vec3(-normal.y, normal.x, 0);
  } else {
    frame.v = vec3(0, -normal.z, normal.y);
  }

  frame.v = normalize(frame.v);
  frame.u = cross(frame.v, frame.w);
  return frame;
}

vec3 L2W(const Frame frame, const vec3 l) {
  return l.x * frame.u + l.y * frame.v + l.z * frame.w;
}

float zup_w2abscostheta(const vec3 w) { return abs(w.z); }

vec3 zup_spherical2cartesian(float sintheta, float costheta, float phi) {
  return vec3(sintheta * cos(phi), sintheta * sin(phi), costheta);
}

float cos2sin(float cosx) { return sqrt(1. - cosx * cosx); }

float sin2cos(float sinx) { return sqrt(1. - sinx * sinx); }

float pdfCosineHemisphere(const vec3 w, const vec3 n) {
  return abs(dot(w, n)) * M_1_PIf;
}

float pdfCosineHemisphere(const vec3 w)  // float costheta, float phi
{
  return zup_w2abscostheta(w) /*costheta*/ * M_1_PIf;
}

vec2 square_to_disk(float u1, float u2) {
  float phi, r;

  const float a = 2.0f * u1 - 1.0f;
  const float b = 2.0f * u2 - 1.0f;

  if (a > -b) {
    if (a > b) {
      r = a;
      phi = M_PI_4f * (b / a);
    } else {
      r = b;
      phi = M_PI_4f * (2.0f - (a / b));
    }
  } else {
    if (a < b) {
      r = -a;
      phi = M_PI_4f * (4.0f + (b / a));
    } else {
      r = -b;
      phi = (b != 0.0) ? M_PI_4f * (6.0f - (a / b)) : 0.0f;
    }
  }

  return vec2(r * cos(phi), r * sin(phi));
}

vec3 uniformHemisphere(float u1, float u2) {
  float r = sqrt(1. - u1 * u1);
  float phi = 2. * 3.141592 * u2;
  return vec3(r * cos(phi), r * sin(phi), u1);
}

float safe_sqrt(float x) { return sqrt(max(0, x)); }

vec3 cosineHemisphere(float u1, float u2, out float pdf) {
  vec2 ondisk = square_to_disk(u1, u2);
  vec3 w = vec3(ondisk, safe_sqrt(1.0 - dot(ondisk, ondisk)));
  pdf = pdfCosineHemisphere(w);
  return w;
}

vec3 expHemisphere(float u1, float u2, float cexp) {
  // phi=2pi*u1
  // cos_theta=(1-u2)^(1/(exp+1))
  cexp = mix(cexp, 2e10, (cexp > 990000.));
  float phi = u2 * M_TWOPI;
  float costheta = pow(u1, 1.f / (cexp + 1.f));
  return zup_spherical2cartesian(cos2sin(costheta), costheta, phi);
}

float pdfExpHemisphere(float costheta, float cexp) {
  return pow(costheta, cexp) * (cexp + 1.f) * INV_TWOPI;
}

float safe_rcp(float x) { return x == 0. ? 0. : 1. / x; }

float pdfArea2SolidAngle(float pdf_area, const vec3 p, const vec3 p_next,
                         const vec3 n_next) {
  vec3 w = p_next - p;
  float len2 = dot(w, w);
  w *= safe_rcp(sqrt(len2));
  return pdf_area * len2 * safe_rcp(abs(dot(n_next, w)));
}

// 0 pi
float yup_spherical_theta(const vec3 v) { return acos(clamp(-v.y, -1.f, 1.f)); }

// 0 2pi
float yup_spherical_phi(const vec3 v) {
  float p = atan(v.x, -v.z);  // mitsuba use -v.z???
  return (p < 0.f) ? p + M_TWOPI : p;
}

vec2 yup_spherical_uv(const vec3 w) {
  return vec2(INV_TWOPI * yup_spherical_phi(w),
              INV_PI * yup_spherical_theta(w));
}

// at distance 1
vec2 getImagePlaneSize(float vfov) {
  float y = 2.0 * tan(vfov);
  float aspect_ratio = gl_LaunchSizeEXT.x / gl_LaunchSizeEXT.y;
  return vec2(aspect_ratio * y, y);
}

void rotate_two_axis(inout mat4 m, uint axis1, uint axis2, float rad) {
  float c = cos(rad), s = sin(rad);
  vec3 new_axis1 = m[axis1].xyz * c + m[axis2].xyz * s;
  vec3 new_axis2 = m[axis2].xyz * c - m[axis1].xyz * s;
  m[axis1].xyz = new_axis1;
  m[axis2].xyz = new_axis2;
}

#endif