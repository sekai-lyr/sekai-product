Shader "Sekai/SkyMarble"
{
    Properties
    {
        _BaseColor ("Marble base", Color) = (0.92, 0.97, 1, 1)
        _VeinColor ("Marble vein", Color) = (0.82, 0.58, 0.28, 1)
        _Scale ("Vein scale", Float) = 1.2
        _VeinStrength ("Vein strength", Range(0, 1)) = 0.12
        _Metallic ("Metallic", Range(0, 1)) = 0.1
        _Smoothness ("Smoothness", Range(0, 1)) = 0.82
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        LOD 250

        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma target 3.0

        fixed4 _BaseColor;
        fixed4 _VeinColor;
        half _Scale;
        half _VeinStrength;
        half _Metallic;
        half _Smoothness;

        struct Input
        {
            float3 worldPos;
        };

        float skyHash(float3 value)
        {
            return frac(sin(dot(value, float3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        void surf(Input input, inout SurfaceOutputStandard output)
        {
            float3 position = input.worldPos * _Scale;
            float warp = skyHash(floor(position * .35)) * 2.0 - 1.0;
            float wave = sin(position.x * 1.7 + position.z * 1.25 + position.y * .45 + warp * 3.8);
            float vein = smoothstep(.78, .96, abs(wave)) * _VeinStrength;
            output.Albedo = lerp(_BaseColor.rgb, _VeinColor.rgb, vein);
            output.Metallic = _Metallic;
            output.Smoothness = _Smoothness;
        }
        ENDCG
    }
    FallBack "Standard"
}
