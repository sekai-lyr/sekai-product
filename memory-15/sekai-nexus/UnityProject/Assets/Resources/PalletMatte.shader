Shader "Pallet/Matte"
{
    Properties { _Color ("Color", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Lambert fullforwardshadows addshadow
        #pragma target 3.0
        fixed4 _Color;
        struct Input { float3 worldPos; };
        void surf(Input IN, inout SurfaceOutput o)
        {
            o.Albedo = _Color.rgb;
            o.Alpha = 1;
        }
        ENDCG
    }
    Fallback "Diffuse"
}
