import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuilderState, ProjectStatus, WebsiteSpec } from './types.js';
export interface ProjectRecord { id:string; accessTokenHash:string; state:BuilderState; spec?:WebsiteSpec; status:ProjectStatus; price:number; createdAt:string; updatedAt:string; generationStage?:string; generationError?:string; razorpayOrderId?:string; razorpayPaymentId?:string; }
const filePath=path.resolve(process.env.NEXAAI_DATA_DIR||'./data','projects.json'); let writeQueue:Promise<void>=Promise.resolve();
function tokenHash(token:string){return crypto.createHash('sha256').update(token).digest('hex');}
async function readAll():Promise<ProjectRecord[]>{try{return JSON.parse(await fs.readFile(filePath,'utf8')) as ProjectRecord[]}catch(error:any){if(error?.code==='ENOENT')return [];throw error;}}
async function writeAll(items:ProjectRecord[]){await fs.mkdir(path.dirname(filePath),{recursive:true});const tmp=`${filePath}.tmp`;await fs.writeFile(tmp,JSON.stringify(items,null,2),'utf8');await fs.rename(tmp,filePath);}
async function mutate(fn:(items:ProjectRecord[])=>void){writeQueue=writeQueue.then(async()=>{const items=await readAll();fn(items);await writeAll(items);});await writeQueue;}
export async function createProject(state:BuilderState,price:number){const accessToken=crypto.randomBytes(32).toString('hex');const now=new Date().toISOString();const record:ProjectRecord={id:crypto.randomUUID(),accessTokenHash:tokenHash(accessToken),state,status:'DRAFT',price,createdAt:now,updatedAt:now};await mutate(items=>items.push(record));return{project:record,accessToken};}
export async function getProject(id:string,accessToken:string){const items=await readAll();return items.find(x=>x.id===id&&x.accessTokenHash===tokenHash(accessToken))||null;}
export async function updateProject(id:string,accessToken:string,patch:Partial<ProjectRecord>){let updated:ProjectRecord|null=null;await mutate(items=>{const idx=items.findIndex(x=>x.id===id&&x.accessTokenHash===tokenHash(accessToken));if(idx<0)return;updated={...items[idx],...patch,updatedAt:new Date().toISOString()};items[idx]=updated;});return updated;}
