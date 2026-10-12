/** Reintenta errores transitorios del servicio SEO sin repetir fallos de autenticación.
 * No mantiene métricas ficticias ni datos de períodos anteriores en la UI.
 */
export const TRANSITORIOS_SEO = [429,502,503,504];
export const esErrorTransitorioSEO = error =>
  TRANSITORIOS_SEO.includes(Number(error?.status || error?.context?.status || 0));

export async function ejecutarConReintentosSEO(operacion, {
  maxIntentos=3,
  espera=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}) {
  const limite=Math.max(1,Math.min(3,Math.trunc(maxIntentos)));
  for(let intento=1;intento<=limite;intento++){
    try{return await operacion();}
    catch(error){
      if(!esErrorTransitorioSEO(error)||intento===limite)throw error;
      await espera(intento===1?400:1100);
    }
  }
}
