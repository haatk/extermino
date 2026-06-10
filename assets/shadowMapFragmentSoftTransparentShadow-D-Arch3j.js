import{S as r}from"./index-BTngboFx.js";const a="shadowMapFragmentSoftTransparentShadow",o=`#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(((fragmentInputs.position.xy)%(8.0)))))/64.0>=uniforms.softTransparentShadowSM.x*alpha) {discard;}
#endif
`;r.IncludesShadersStoreWGSL[a]||(r.IncludesShadersStoreWGSL[a]=o);const t={name:a,shader:o};export{t as shadowMapFragmentSoftTransparentShadowWGSL};
//# sourceMappingURL=shadowMapFragmentSoftTransparentShadow-D-Arch3j.js.map
