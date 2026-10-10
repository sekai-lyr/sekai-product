Shader "Sekai/SkyGlow"
{
    Properties
    {
        _Color ("Glow color", Color) = (0.4, 0.85, 1, 1)
        _Emission ("Emission", Range(0, 8)) = 2.5
        _Alpha ("Alpha", Range(0, 1)) = 1
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows alpha:fade
        #pragma target 3.0

        fixed4 _Color;
        half _Emission;
        half _Alpha;

        struct Input
        {
            float3 viewDir;
        };

        void surf(Input input, inout SurfaceOutputStandard output)
        {
            half rim = pow(1.0 - saturate(dot(normalize(input.viewDir), float3(0, 0, 1))), 2.0);
            output.Albedo = _Color.rgb * .12;
            output.Emission = _Color.rgb * (_Emission + rim * 1.5);
            output.Smoothness = .72;
            output.Alpha = _Color.a * _Alpha;
        }
        ENDCG
    }
    FallBack "Transparent/Diffuse"
}
