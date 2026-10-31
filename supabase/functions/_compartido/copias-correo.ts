/**
 * Copias explícitas del emisor. Ni el CRM ni Proveedores incluyen destinatarios
 * de copia preconfigurados. Las listas se validan antes de acceder a SMTP.
 */
const CORREO=/^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;
export function validarCopiasCorreo(body:Record<string,unknown>,principal:string) {
  const usadas=new Set([principal.trim().toLowerCase()]);
  const leer=(campo:'cc'|'cco') => {
    const valor=body[campo];
    if(valor===undefined||valor===null)return [] as string[];
    if(!Array.isArray(valor)||valor.length>10)throw new Error('Puedes incluir hasta 10 destinatarios en '+campo.toUpperCase());
    const lista:string[]=[];
    for(const item of valor){
      if(typeof item!=='string')throw new Error('Correo de copia inválido');
      const mail=item.trim().toLowerCase();
      if(mail.length>254||!CORREO.test(mail)||/[\r\n]/.test(mail))
        throw new Error('Correo de copia inválido: '+mail.slice(0,120));
      if(usadas.has(mail))continue;
      usadas.add(mail);
      lista.push(mail);
    }
    return lista;
  };
  return {cc:leer('cc'),cco:leer('cco')};
}
