import{S as r}from"./index-DWT-ji29.js";const e="rgbdDecodePixelShader",o=`varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=vec4(fromRGBD(texture2D(textureSampler,vUV)),1.0);}`;r.ShadersStore[e]||(r.ShadersStore[e]=o);const a={name:e,shader:o};export{a as rgbdDecodePixelShader};
//# sourceMappingURL=rgbdDecode.fragment-Dn4dGW7A.js.map
