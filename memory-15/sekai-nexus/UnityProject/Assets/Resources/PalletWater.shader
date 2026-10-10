Shader "Pallet/Water"
{
    Properties { _Color ("Color", Color) = (.18,.68,.75,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Lambert fullforwardshadows
        fixed4 _Color;
        struct Input { float3 worldPos; };
        void surf(Input IN, inout SurfaceOutput o)
        {
            float2 p = IN.worldPos.xz;
            float wave = sin(p.x * 2 + p.y * .6 + _Time.y) * sin(p.y * 3 - _Time.y * .65);
            float streak = smoothstep(.75, .94, wave);
            o.Albedo = lerp(_Color.rgb, float3(.67,.94,.9), streak * .55);
            o.Emission = _Color.rgb * .12;
            o.Alpha = 1;
        }
        ENDCG
    }
    Fallback "Diffuse"
}
