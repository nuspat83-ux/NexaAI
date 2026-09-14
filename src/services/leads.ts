const WEBHOOK='https://script.google.com/macros/s/AKfycbyMMbEI9AT86dCnRvJrLj8UfMtY45SM4jqFozoxT1NeI-_-UgoRdMsuyxszsNVG5gYDKA/exec';
export interface Lead {leadId:string;clientName:string;business:string;email:string;phone:string;website:string;serviceRequested:string;budget:string;timeline:string;projectDetails:string;source:string;timestamp:string;}
export async function captureLead(lead:Lead):Promise<boolean>{
 try{await fetch(WEBHOOK,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead)});return true}catch{return false}
}
export const whatsappUrl=(number:string,message:string)=>`https://wa.me/${number.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
