#version 460
#extension GL_EXT_ray_tracing : enable

layout(location = 0) rayPayloadInEXT vec3 payload;

hitAttributeEXT vec2 baryCoord;

void main() {
  payload = vec3(1.0 - baryCoord.x - baryCoord.y, baryCoord.x, baryCoord.y);
}