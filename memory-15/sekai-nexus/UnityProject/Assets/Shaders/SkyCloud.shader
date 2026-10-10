Shader "Sekai/SkyCloud"
{
    Properties
    {
        _Color ("Cloud color", Color) = (1, 0.8, 0.95, 1)
        _Alpha ("Cloud alpha", Range(0, 1)) = .74
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
        half _Alpha;

        struct Input
        {
            float3 viewDir;
        };

        void surf(Input input, inout SurfaceOutputStandard output)
        {
            output.Albedo = _Color.rgb;
            output.Emission = _Color.rgb * .08;
            output.Smoothness = .05;
            output.Alpha = _Color.a * _Alpha;
        }
        ENDCG
    }
    FallBack "Transparent/Diffuse"
}
