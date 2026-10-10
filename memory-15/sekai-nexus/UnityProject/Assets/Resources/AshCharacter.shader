Shader "Pallet/AshCharacter"
{
    Properties { _Color ("Color", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Cull Off
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            #include "AutoLight.cginc"
            fixed4 _Color;
            struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; };
            struct v2f { float4 pos:SV_POSITION; float3 normal:TEXCOORD0; SHADOW_COORDS(1) UNITY_FOG_COORDS(2) };
            v2f vert(appdata v)
            {
                v2f o; o.pos=UnityObjectToClipPos(v.vertex); o.normal=UnityObjectToWorldNormal(v.normal);
                TRANSFER_SHADOW(o); UNITY_TRANSFER_FOG(o,o.pos); return o;
            }
            fixed4 frag(v2f i):SV_Target
            {
                // Soft cel fill keeps the face readable beneath the cap and in shade.
                float light=dot(normalize(i.normal),normalize(_WorldSpaceLightPos0.xyz));
                float tone=.82+.18*smoothstep(-.15,.65,light);
                tone*=lerp(.92,1,SHADOW_ATTENUATION(i));
                fixed4 c=fixed4(_Color.rgb*tone,1); UNITY_APPLY_FOG(i.fogCoord,c); return c;
            }
            ENDCG
        }
        UsePass "Legacy Shaders/VertexLit/SHADOWCASTER"
    }
    Fallback "Diffuse"
}
