#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

layout(set = 0, binding = 3) uniform sampler samp;
layout(set = 0, binding = 4) uniform texture2D texEnvmap;

layout(shaderRecordEXT) buffer RayMissBlock { mat4 to_world; }
envmap;

void main() {
  if (payload.alpha != vec3(0.)) {
    // world to object
    vec3 w = vec3(dot(envmap.to_world[0].xyz, gl_WorldRayDirectionEXT),
                  -dot(envmap.to_world[1].xyz, gl_WorldRayDirectionEXT),
                  dot(envmap.to_world[2].xyz, gl_WorldRayDirectionEXT));
    vec2 uv = yup_spherical_uv(w);
    payload.emit_radiance =
        vec4(vec3(texture(sampler2D(texEnvmap, samp), uv)), 1.);
  }
  payload.done = true;
}