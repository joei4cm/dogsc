#version 440

layout(location = 0) in vec2 coord;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float radius;
    float smoothness;
    float borderWidth;
    vec2 size;
    vec4 fillColor;
    vec4 borderColor;
};

// Soft Silver continuous corner ≈ Apple cornerCurve.continuous.
// smoothness 0 → circular SDF; higher → squircle/superellipse (n climbs).
float sdContinuousRect(vec2 p, vec2 halfSize, float r, float smoothAmt)
{
    float n = mix(2.0, 5.0, clamp(smoothAmt, 0.0, 1.0));
    vec2 q = abs(p) - halfSize + vec2(r);
    // Outside the corner disks: Euclidean; inside the straight body: box.
    float box = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    // Superellipse blend near corners for continuous curvature.
    vec2 s = abs(p) / max(halfSize, vec2(1.0));
    float super = pow(pow(s.x, n) + pow(s.y, n), 1.0 / n) - 1.0;
    float w = smoothstep(0.0, 1.0, length(max(q, 0.0)) / max(r, 1.0));
    return mix(box, super * min(halfSize.x, halfSize.y), w * smoothAmt);
}

void main()
{
    vec2 pixel = coord * size;
    vec2 center = size * 0.5;
    vec2 p = pixel - center;
    float r = min(radius, min(size.x, size.y) * 0.5);
    float d = sdContinuousRect(p, center, r, smoothness);

    float aa = 1.0;
    float cover = 1.0 - smoothstep(-aa, aa, d);
    float inner = 1.0 - smoothstep(-aa, aa, d + max(borderWidth, 0.0));

    vec4 fill = fillColor;
    vec4 border = borderColor;
    vec4 rgb = mix(border, fill, inner);
    fragColor = rgb * cover * qt_Opacity;
}
