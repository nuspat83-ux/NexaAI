import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { websiteHtml } from '../server/render.js';

test('CI render anchor: customer content, SEO and mobile navigation survive export', () => {
  const html = websiteHtml({
    business:'Premium Indian Restaurant',
    tagline:'',
    seo:{title:'Premium Indian Restaurant',description:'Modern luxury Indian dining.'},
    colors:{primary:'#c9a46c',secondary:'#111',background:'#101114',text:'#f6f0e5'},
    typography:{heading:'Playfair Display',body:'DM Sans'},
    nav:['Home','About','Menu','Gallery','Contact'],
    hero:{eyebrow:'Contemporary Indian dining',headline:'Indian cuisine, beautifully reimagined.',body:'Regional flavours and thoughtful hospitality.',cta:'Reserve your table',assetName:'hero.jpg'},
    sections:[{type:'menu',title:'A menu designed around flavour',body:'A focused selection.',items:['Tandoori cauliflower','Charred paneer']}],
    contact:{phone:'+91 9876543210',whatsapp:'+91 9876543210',email:'hello@restaurant.test',address:'Lower Parel, Mumbai',hours:'12pm-11:30pm'},
    footer:'Contemporary Indian dining in Mumbai.',
    features:['WhatsApp button','Google Maps','Contact form','SEO setup'],
    assets:[{name:'hero.jpg',type:'image/jpeg',url:'data:image/jpeg;base64,AAAA',data:'data:image/jpeg;base64,AAAA'}]
  });
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('google.com/maps/search'));
  assert.ok(html.includes('mailto:hello@restaurant.test'));
  assert.ok(html.includes('wa.me/919876543210'));
  assert.ok(html.includes('href="#top"'));
  assert.ok(html.includes('<details class="menu-wrap">'));
});
