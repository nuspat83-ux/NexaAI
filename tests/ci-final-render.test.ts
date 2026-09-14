import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { websiteHtml } from '../server/render.js';

test('final customer scenario render includes real features and responsive UX', () => {
  const html = websiteHtml({
    business:'Premium Indian Restaurant', tagline:'Contemporary Indian dining.',
    seo:{title:'Premium Indian Restaurant | Modern Indian Dining',description:'Luxury modern Indian dining in Mumbai.'},
    colors:{primary:'#C9A46C',secondary:'#111318',background:'#101114',text:'#F6F0E5'},
    typography:{heading:'Playfair Display',body:'DM Sans'}, nav:['Home','About','Menu','Gallery','Contact'],
    hero:{eyebrow:'Contemporary Indian dining',headline:'Indian cuisine, beautifully reimagined.',body:'Regional Indian flavours, seasonal ingredients and warm hospitality.',cta:'Reserve your table',assetName:'hero.jpg'},
    sections:[{type:'menu',title:'A menu designed around flavour',body:'A focused contemporary Indian menu.',items:['Tandoori cauliflower','Charred paneer']}],
    contact:{phone:'+91 9876543210',whatsapp:'+91 9876543210',email:'hello@restaurant.test',address:'Lower Parel, Mumbai',hours:'12pm-11:30pm'},
    footer:'Contemporary Indian dining in Mumbai.',
    features:['WhatsApp button','Google Maps','Contact form','Testimonials','Gallery','SEO setup'],
    assets:[{name:'hero.jpg',type:'image/jpeg',url:'data:image/jpeg;base64,AAAA',data:'data:image/jpeg;base64,AAAA'}]
  });
  for (const needle of ['data:image/jpeg;base64,AAAA','mailto:hello@restaurant.test','google.com/maps/search','wa.me/919876543210','application/ld+json','<details class="menu-wrap">','href="#top"','@media(max-width:860px)','@media(max-width:520px)']) assert.ok(html.includes(needle), `missing ${needle}`);
  assert.doesNotMatch(html,/lorem ipsum|coming soon|not implemented|placeholder|dummy|fake/i);
});
