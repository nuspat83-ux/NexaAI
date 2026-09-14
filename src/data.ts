export const categories=['Restaurant','Cafe','E-commerce','Real Estate','Portfolio','Agency','SaaS','Technology','Education','Healthcare','Fitness','Beauty / Salon','Hotel','Travel','Construction','Legal','Finance','Local Business','Personal Brand','Other'];
export const styles=['Minimal','Modern','Luxury','Corporate','Bold','Creative','Elegant','Dark','Light','Glassmorphism','Editorial','Premium','Tech','Friendly'];
export const sections=['Hero','About','Services','Products','Portfolio','Testimonials','Pricing','FAQ','Team','Contact','Location','Booking','Gallery','Blog','CTA sections'];
export const pages=['Home','About','Services','Products','Portfolio','Pricing','Blog','FAQ','Contact','Booking','Gallery','Team','Careers','Privacy Policy','Terms'];
export const features=['WhatsApp button','Contact form','Lead capture','Google Maps','Social media links','Testimonials','Reviews','FAQ','Gallery','Booking form','Newsletter','Search','Product catalog','Pricing calculator','Chat widget','Analytics-ready','SEO setup','Cookie banner','Custom animations'];
export const plans=[
 {name:'Starter',price:4999,description:'A polished launch site for a focused business.',includes:'Up to 4 pages'},
 {name:'Professional',price:7999,description:'A stronger digital presence with richer content.',includes:'Up to 7 pages'},
 {name:'Business',price:11999,description:'For teams that need conversion-focused depth.',includes:'Up to 10 pages'},
 {name:'Premium',price:17999,description:'A bespoke, high-content web experience.',includes:'Up to 15 pages'}
];
export const pagePrice=750;
export const featurePrices:Record<string,number>={
 'WhatsApp button':500,'Contact form':500,'Lead capture':750,'Google Maps':500,'Social media links':0,'Testimonials':0,'Reviews':500,'FAQ':0,'Gallery':750,'Booking form':1000,'Newsletter':750,'Search':1000,'Product catalog':1500,'Pricing calculator':1500,'Chat widget':1500,'Analytics-ready':500,'SEO setup':750,'Cookie banner':500,'Custom animations':1000
};
export const initialState={category:'Restaurant',customBusiness:'',businessName:'',tagline:'',description:'',location:'',phone:'',whatsapp:'',email:'',address:'',hours:'',socials:'',existingWebsite:'',styles:['Premium','Modern'],primary:'#C9A46C',secondary:'#111318',font:'Inter',theme:'ai' as const,sections:['Hero','About','Services','Gallery','Testimonials','Contact','CTA sections'],pages:['Home','About','Services','Gallery','Contact'],features:['WhatsApp button','Contact form','SEO setup','Analytics-ready'],assets:[],brief:'',audience:'',plan:'Starter'};
