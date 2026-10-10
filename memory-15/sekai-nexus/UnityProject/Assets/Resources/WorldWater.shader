Shader "Kanto/Water"
{
    Properties { _Color("Water",Color)=(.1,.48,.56,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        fixed4 _Color;
        struct Input { float3 worldPos; float3 viewDir; };
        void surf(Input i,inout SurfaceOutputStandard o)
        {
            float2 p=i.worldPos.xz;
            float a=sin(p.x*.5+p.y*.24+_Time.y*.65),b=sin(p.y*.8-p.x*.1-_Time.y*.8);
            float ribbons=smoothstep(.80,.98,a*b);
            float fresnel=pow(1-saturate(dot(normalize(i.viewDir),float3(0,0,1))),3);
            o.Albedo=lerp(_Color.rgb,float3(.59,.83,.82),fresnel*.65)+ribbons*.025;
            o.Normal=normalize(float3(a*.075,b*.075,1));
            o.Smoothness=.65;o.Metallic=.08;o.Emission=_Color.rgb*.08;
            o.Alpha=1;
        }
        ENDCG
    }
    Fallback "Diffuse"
}
