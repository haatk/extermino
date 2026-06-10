import{S as r}from"./index-CZTiS8Sn.js";const e="passPixelShader",a=`varying vec2 vUV;uniform sampler2D textureSampler;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=texture2D(textureSampler,vUV);}`;r.ShadersStore[e]||(r.ShadersStore[e]=a);const t={name:e,shader:a};export{t as passPixelShader};
//# sourceMappingURL=pass.fragment-CmR2qyi2.js.map
