const preset=(name,primary,shadow,contrast)=>({name,colors:{primary,shadow,contrast}});
export const COLOR_PRESETS={ white:preset('Fósforo blanco','#e8e5df','#383836','#ffffff'),green:preset('Fósforo verde','#9de665','#304c21','#e5ffbe'),amber:preset('Ámbar','#eebf5c','#614721','#fff1be'),violet:preset('Violeta','#c3a0ee','#49335f','#f4e7ff') };
export const presetsForBrush=()=>COLOR_PRESETS;
