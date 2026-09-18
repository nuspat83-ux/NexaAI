import type { CatalogData } from './catalog';

export type StepId=1|2|3|4|5|6|7|8|9|10;
export type ProjectStatus='DRAFT'|'CONFIGURED'|'GENERATING'|'PREVIEW_READY'|'PAYMENT_PENDING'|'PAID'|'UNLOCKED'|'EXPORTED'|'DEPLOYED';
export type Device='desktop'|'tablet'|'mobile';
export type CreationMode='guided'|'direct';
export interface BuilderState{creationMode:CreationMode;directBrief:string;businessDetails:Record<string,string>;catalog:CatalogData;category:string;customBusiness:string;businessName:string;tagline:string;description:string;location:string;phone:string;whatsapp:string;email:string;address:string;hours:string;socials:string;existingWebsite:string;styles:string[];primary:string;secondary:string;font:string;theme:'light'|'dark'|'ai';sections:string[];pages:string[];features:string[];assets:Asset[];brief:string;audience:string;plan:string;}
export interface Asset{name:string;type:string;url:string;data?:string;}
export interface WebsiteSection{type:string;title:string;body:string;items?:string[];assetNames?:string[];}
export interface WebsiteSpec{business:string;tagline:string;seo?:{title:string;description:string};colors:{primary:string;secondary:string;background?:string;text?:string};typography?:{heading:string;body:string};personality?:string[];pages?:string[];sections:string[]|WebsiteSection[];features?:string[];catalogMode?:'products'|'menu'|'services'|'none';orderFlow?:'none'|'whatsapp'|'cart'|'checkout';payment?:'whatsapp'|'cod'|'online'|'both'|'unknown';delivery?:import('./catalog').CatalogData['delivery'];products?:import('./catalog').Product[];services?:import('./catalog').ServiceItem[];content:string;imageRequirements:string[];cta:string;responsive:string;nav?:string[];hero?:{eyebrow:string;headline:string;body:string;cta:string;assetName?:string};contact?:{phone:string;whatsapp:string;email:string;address:string;hours:string};footer?:string;assets?:Asset[];}
