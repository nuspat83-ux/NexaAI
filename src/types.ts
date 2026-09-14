export type StepId = 1|2|3|4|5|6|7|8|9|10;
export type ProjectStatus = 'Draft'|'Generating'|'Generated'|'Awaiting Payment'|'Paid'|'Unlocked'|'Delivered'|'Failed';
export type Device = 'desktop'|'tablet'|'mobile';

export interface BuilderState {
  category: string;
  customBusiness: string;
  businessName: string;
  tagline: string;
  description: string;
  location: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  socials: string;
  existingWebsite: string;
  styles: string[];
  primary: string;
  secondary: string;
  font: string;
  theme: 'light'|'dark'|'ai';
  sections: string[];
  pages: string[];
  features: string[];
  assets: Asset[];
  brief: string;
  audience: string;
  plan: string;
}

export interface Asset { name: string; type: string; url: string; }
export interface WebsiteSpec { business:string; audience:string; personality:string[]; colors:{primary:string;secondary:string}; typography:string; pages:string[]; sections:string[]; features:string[]; content:string; imageRequirements:string[]; cta:string; responsive:string; }
