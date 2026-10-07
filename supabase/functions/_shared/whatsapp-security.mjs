export async function verifySignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature ?? '')) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(signature.slice(7).match(/../g),x=>parseInt(x,16));
  return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body));
}
export function safeMessage(message) {
  const types={image:'imagen',document:'documento',audio:'audio',video:'video',sticker:'sticker'};
  if(message.type==='text')return {tipo:'texto',contenido:String(message.text?.body??'').slice(0,3500),metadatos:{}};
  if(message.type==='interactive')return {tipo:'interaccion',contenido:String(message.interactive?.list_reply?.id??message.interactive?.button_reply?.id??'').slice(0,120),metadatos:{}};
  if(message.type==='button')return {tipo:'interaccion',contenido:String(message.button?.payload??message.button?.text??'').slice(0,120),metadatos:{}};
  const part=message[message.type]??{};
  return {tipo:types[message.type]??'otro',contenido:'',metadatos:{...(part.mime_type?{mime_type:String(part.mime_type).slice(0,100)}:{}),...(part.filename?{filename:String(part.filename).slice(0,180)}:{})}};
}
