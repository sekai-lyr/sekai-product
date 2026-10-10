Shader "Kanto/Nature"
{
    Properties { _Color("Tint",Color)=(1,1,1,1) _Wind("Wind",Float)=0 _Detail("Ground detail",Float)=0 }
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
            #pragma multi_compile_instancing
            #pragma target 3.0
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "AutoLight.cginc"
            fixed4 _Color; float _Wind, _Detail;
            struct appdata { float4 vertex:POSITION;float3 normal:NORMAL;fixed4 color:COLOR;UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos:SV_POSITION;float3 worldPos:TEXCOORD0;float3 normal:TEXCOORD1;fixed4 color:COLOR;SHADOW_COORDS(2) UNITY_FOG_COORDS(3) };
            v2f vert(appdata v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                v2f o;
                float3 p=mul(unity_ObjectToWorld,v.vertex).xyz;
                float sway=sin(p.x*.19+p.z*.13+_Time.y*1.4)+sin(p.z*.4+_Time.y*2)*.3;
                v.vertex.x+=sway*v.color.a*_Wind;
                v.vertex.z+=cos(p.x*.21+_Time.y)*v.color.a*_Wind*.35;
                o.pos=UnityObjectToClipPos(v.vertex);o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
                o.normal=UnityObjectToWorldNormal(v.normal);o.color=v.color;
                TRANSFER_SHADOW(o);UNITY_TRANSFER_FOG(o,o.pos);return o;
            }
            fixed4 frag(v2f i):SV_Target
            {
                float diffuse=dot(normalize(i.normal),normalize(_WorldSpaceLightPos0.xyz));
                float tone=.62+.38*smoothstep(-.2,.8,diffuse);
                float shadow=lerp(.70,1,SHADOW_ATTENUATION(i));
                float n=sin(i.worldPos.x*.26+sin(i.worldPos.z*.21))*sin(i.worldPos.z*.31);
                fixed4 c=fixed4(i.color.rgb*_Color.rgb*tone*shadow*(1+n*.035*_Detail),1);
                UNITY_APPLY_FOG(i.fogCoord,c);return c;
            }
            ENDCG
        }
        UsePass "Legacy Shaders/VertexLit/SHADOWCASTER"
    }
    Fallback "Diffuse"
}
