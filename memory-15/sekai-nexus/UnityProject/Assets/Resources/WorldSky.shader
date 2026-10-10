Shader "Kanto/Sky"
{
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct v2f { float4 p:SV_POSITION; float3 dir:TEXCOORD0; };
            v2f vert(appdata_base v) { v2f o;o.p=UnityObjectToClipPos(v.vertex);o.dir=v.vertex.xyz;return o; }
            float hash(float2 p) { return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453); }
            float noise(float2 p) { float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(hash(i),hash(i+float2(1,0)),f.x),lerp(hash(i+float2(0,1)),hash(i+1),f.x),f.y); }
            fixed4 frag(v2f i):SV_Target
            {
                float3 d=normalize(i.dir);
                float3 sky=lerp(float3(.79,.87,.84),float3(.18,.48,.68),pow(saturate(d.y),.55));
                float2 p=d.xz/max(.16,d.y)*1.5+float2(_Time.y*.0015,0);
                float n=noise(p)*.6+noise(p*2.1)*.26+noise(p*4.2)*.14;
                float clouds=smoothstep(.50,.69,n)*smoothstep(.01,.18,d.y);
                sky=lerp(sky,lerp(float3(.77,.84,.86),float3(1,.98,.89),n),clouds*.93);
                float sun=dot(d,normalize(float3(-.4,.65,-.5)));
                sky+=float3(1,.78,.42)*pow(saturate(sun),300)*.55;
                return float4(sky,1);
            }
            ENDCG
        }
    }
}
