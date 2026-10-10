Shader "Sekai/VoxelUnlit"
{
    Properties
    {
        _Color ("Color", Color) = (1, 1, 1, 1)
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float3 normal : TEXCOORD0;
                UNITY_FOG_COORDS(1)
            };

            fixed4 _Color;

            v2f vert(appdata input)
            {
                v2f output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.normal = UnityObjectToWorldNormal(input.normal);
                UNITY_TRANSFER_FOG(output, output.vertex);
                return output;
            }

            fixed4 frag(v2f input) : SV_Target
            {
                float3 lightDirection = normalize(_WorldSpaceLightPos0.xyz);
                float diffuse = max(0.0, dot(normalize(input.normal), -lightDirection));
                float celLight = diffuse > .62 ? 1.0 : diffuse > .22 ? .9 : .78;
                fixed4 shaded = fixed4(_Color.rgb * celLight, _Color.a);
                UNITY_APPLY_FOG(input.fogCoord, shaded);
                return shaded;
            }
            ENDCG
        }
    }
}
