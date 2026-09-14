export type ProjectStatus='Draft'|'Generating'|'Generated'|'Awaiting Payment'|'Paid'|'Unlocked'|'Delivered'|'Failed';
export interface ProjectRecord{id:string;clientId:string;business:string;price:number;status:ProjectStatus;createdAt:string;websiteSpec?:unknown;}
export interface ProjectStore{create(p:ProjectRecord):Promise<void>;get(id:string):Promise<ProjectRecord|null>;updateStatus(id:string,status:ProjectStatus):Promise<void>;list():Promise<ProjectRecord[]>;}
export interface AuthBoundary{verify(request:Request):Promise<{userId:string;role:'admin'}|null>;}
