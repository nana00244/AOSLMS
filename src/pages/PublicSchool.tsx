import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowRight, BookOpen, Check, GraduationCap, Menu, Plus, Trash2, X } from 'lucide-react';
import type { SchoolWebsiteBlock, SchoolWebsiteContent, SchoolWebsitePage } from '../data';
import { useStore } from '../store';

const paths: Record<string, string> = {
  home: '/school', about: '/school/about', learning: '/school/academics',
  admissions: '/school/admissions', contact: '/school/contact',
};
const item = (title: string, body: string, detail = '') => ({ id: crypto.randomUUID(), title, body, detail });
const block = (kind: SchoolWebsiteBlock['kind'], title: string, body = '', eyebrow = ''): SchoolWebsiteBlock => ({
  id: crypto.randomUUID(), kind, eyebrow, title, body, actionLabel: '', actionPath: '', image: '', items: [],
});
function createDefaults(): SchoolWebsiteContent {
  const page = (eyebrow: string, title: string, intro: string, blocks: SchoolWebsiteBlock[]): SchoolWebsitePage => ({ eyebrow, title, intro, image: '', blocks });
  return {
    brandName: 'AYISATU OWEN', brandSubtitle: 'INTERNATIONAL SCHOOL',
    topLineLeft: 'TECHIMAN · BONO EAST REGION, GHANA', topLineRight: '“DEEPER UNDERSTANDING”',
    footerNote: 'Techiman, Bono East Region, Ghana', lmsLabel: 'LMS portal',
    navigation: [
      { label: 'Home', path: '/school' }, { label: 'Our school', path: '/school/about' },
      { label: 'Learning', path: '/school/academics' }, { label: 'Admissions', path: '/school/admissions' },
      { label: 'Contact', path: '/school/contact' },
    ],
    pages: {
      home: page('WELCOME TO AYISATU OWEN', 'Curious minds. Confident futures.', 'A community school in Techiman where every child is encouraged to explore, ask questions and grow with purpose.', [
        Object.assign(block('cards', 'A school that sees the whole child', 'Knowledge opens doors. Understanding helps us walk through them.', 'A JOURNEY THROUGH SCHOOL'), { items: [item('Wonder starts here.', 'Day nursery & kindergarten', 'EARLY YEARS'), item('Foundations take root.', 'Literacy, numeracy & discovery', 'PRIMARY'), item('Ideas meet possibility.', 'Challenge, projects & preparation', 'JUNIOR HIGH')] }),
        block('text', 'Rooted in community since 1997', 'Ayisatu Owen International School is a private, non-denominational basic school serving children from nursery through junior high. Our motto, “Deeper Understanding,” guides a learning experience built around curiosity, strong foundations and the whole child.', 'OUR STORY'),
        block('quote', 'Deeper understanding.', 'Our motto, and the way we think about every child’s education.'),
        Object.assign(block('cta', 'Let’s talk about your child’s next chapter.', 'We would love to welcome your family to our learning community.', 'COME SAY HELLO'), { actionLabel: 'Talk with our team', actionPath: '/school/admissions' }),
      ]),
      about: page('OUR SCHOOL', 'A place to belong, explore and become.', 'Founded in 1997, Ayisatu Owen International School is a private, non-denominational basic school in Techiman, Ghana.', [
        block('text', 'A school shaped by community', 'From its beginnings in Takofiano, the school has grown to serve learners across early childhood, primary and junior high. Families, educators and community partners share in each child’s progress.', 'OUR BEGINNING'),
        Object.assign(block('cards', 'What guides us', 'We want children to understand ideas, connect them to life and keep asking thoughtful questions.'), { items: [item('Whole-child growth', 'Academic foundations, creativity, confidence and care for others.'), item('Learning together', 'Families, educators and community partners share in each child’s progress.'), item('Room to discover', 'Clubs, projects and performances give interests room to flourish.')] }),
      ]),
      learning: page('LEARNING AT AYI', 'Strong foundations. Wide horizons.', 'Our basic school welcomes children from day nursery and kindergarten through primary and junior high school.', [
        Object.assign(block('cards', 'Every stage is a chance to grow.'), { items: [item('Early years', 'Play, language and discovery build a joyful foundation for lifelong learning.'), item('Primary', 'Children grow in literacy, numeracy, science and the confidence to investigate.'), item('Junior high', 'Subject learning, projects and preparation for the Basic Education Certificate Examination.')] }),
        block('text', 'Make room for questions.', 'Reading, science and maths expos, research projects, debate, sports, drama and cultural activities help students put learning into practice.', 'LEARNING BEYOND THE TEXTBOOK'),
      ]),
      admissions: page('JOIN OUR COMMUNITY', 'Every great journey starts with a question.', 'We welcome families interested in a caring, curious learning community in Techiman.', [
        block('text', 'Start a conversation', 'Contact the school to ask about available places, school visits, age requirements and the application process.'),
        Object.assign(block('cards', 'What happens next?'), { items: [item('Tell us about your child', 'Share the year group you are considering.'), item('Arrange a conversation', 'Learn about school life and ask questions.'), item('Plan next steps', 'The school team will guide you through the application process.')] }),
        Object.assign(block('cta', 'Ready to get in touch?'), { actionLabel: 'Contact the school', actionPath: '/school/contact' }),
      ]),
      contact: page('GET IN TOUCH', 'We’d love to hear from your family.', 'For admissions, school information or a visit, reach out to the school team.', [
        Object.assign(block('cards', 'Contact the school'), { items: [item('Find us', 'Techiman, Bono East Region, Ghana'), item('Call the school', '+233 35 232 0415', 'Weekdays, 6:30 am–5:00 pm'), item('Plan a visit', 'Contact us to arrange a visit and discuss admissions.')] }),
      ]),
    },
  };
}
const defaults = createDefaults();
function normalize(value: unknown): SchoolWebsiteContent {
  if (value && typeof value === 'object' && 'pages' in value && 'navigation' in value) return value as SchoolWebsiteContent;
  const legacy = value as { headline?: string; intro?: string; about?: string; contact?: string; heroImage?: string } | undefined;
  const migrated = createDefaults();
  if (legacy) {
    migrated.pages.home.title = legacy.headline || migrated.pages.home.title;
    migrated.pages.home.intro = legacy.intro || migrated.pages.home.intro;
    migrated.pages.home.image = legacy.heroImage || '';
    const aboutText = migrated.pages.about.blocks.find(b => b.kind === 'text');
    if (aboutText && legacy.about) aboutText.body = legacy.about;
    const contactText = migrated.pages.contact.blocks[0]?.items[0];
    if (contactText && legacy.contact) contactText.body = legacy.contact;
  }
  return migrated;
}

function Field({ label, value, onChange, multiline = false, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  return <label className="site-edit-field"><span>{label}</span>{multiline ? <textarea rows={4} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /> : <input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}</label>;
}

export function PublicSchool() {
  const { pathname } = useLocation();
  const { role, data, update } = useStore();
  const saved = normalize(data.settings.publicSite);
  const [site, setSite] = useState(saved);
  const [draft, setDraft] = useState(saved);
  const [menu, setMenu] = useState(false);
  const [selectedPage, setSelectedPage] = useState('home');
  const [notice, setNotice] = useState('');
  useEffect(() => { const next = normalize(data.settings.publicSite); setSite(next); setDraft(next); }, [data.settings.publicSite]);
  const admin = pathname === '/school-admin';
  const pageKey = pathname.endsWith('/about') ? 'about' : pathname.endsWith('/academics') ? 'learning' : pathname.endsWith('/admissions') ? 'admissions' : pathname.endsWith('/contact') ? 'contact' : 'home';
  const page = site.pages[pageKey] || site.pages.home;
  const draftPage = draft.pages[selectedPage] || draft.pages.home;
  const setPage = (key: string, next: SchoolWebsitePage) => setDraft(current => ({ ...current, pages: { ...current.pages, [key]: next } }));
  const setBlock = (key: string, id: string, edit: (value: SchoolWebsiteBlock) => SchoolWebsiteBlock) => {
    const current = draft.pages[key]; setPage(key, { ...current, blocks: current.blocks.map(value => value.id === id ? edit(value) : value) });
  };
  const upload = (event: ChangeEvent<HTMLInputElement>, apply: (value: string) => void) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 500_000) { setNotice('Choose a PNG or JPEG image smaller than 500 KB.'); return; }
    const reader = new FileReader(); reader.onload = () => apply(String(reader.result)); reader.readAsDataURL(file);
  };
  const save = async () => {
    const result = await update(state => ({ ...state, settings: { ...state.settings, publicSite: draft } }), 'Updated public school website');
    setNotice(result ? 'All website changes have been saved.' : 'Could not save. Check the workspace status and try again.');
  };
  if (admin) {
    if (role !== 'Administrator') return <main className="school-admin-gate"><div><GraduationCap size={36}/><h1>School website editor</h1><p>Sign in with an administrator account to update the public school website.</p><Link className="school-button" to="/">Open staff sign in <ArrowRight size={17}/></Link></div></main>;
    return <main className="school-admin"><header><Link to="/school" className="school-brand"><span className="school-seal"><GraduationCap/></span><span>{draft.brandName}<small>{draft.brandSubtitle}</small></span></Link><Link to="/school">Preview website <ArrowRight size={16}/></Link></header><section className="editor-wrap"><p className="school-kicker">WEBSITE CONTENT STUDIO</p><h1>Edit every page.</h1><p className="school-lead">Update the page copy, section cards, navigation, calls to action and photos shown to families.</p><div className="editor-card"><h2>Site-wide content</h2><div className="site-edit-grid"><Field label="School name" value={draft.brandName} onChange={value=>setDraft({...draft,brandName:value})}/><Field label="School name, second line" value={draft.brandSubtitle} onChange={value=>setDraft({...draft,brandSubtitle:value})}/><Field label="Top bar, left" value={draft.topLineLeft} onChange={value=>setDraft({...draft,topLineLeft:value})}/><Field label="Top bar, right" value={draft.topLineRight} onChange={value=>setDraft({...draft,topLineRight:value})}/><Field label="Footer location / information" value={draft.footerNote} onChange={value=>setDraft({...draft,footerNote:value})}/><Field label="LMS link label" value={draft.lmsLabel} onChange={value=>setDraft({...draft,lmsLabel:value})}/></div><h2>Navigation links</h2>{draft.navigation.map((link,index)=><div className="site-edit-row" key={`${index}-${link.path}`}><Field label="Link label" value={link.label} onChange={value=>setDraft(s=>({...s,navigation:s.navigation.map((item,i)=>i===index?{...item,label:value}:item)}))}/><Field label="Destination" value={link.path} onChange={value=>setDraft(s=>({...s,navigation:s.navigation.map((item,i)=>i===index?{...item,path:value}:item)}))}/><button className="site-icon-btn danger" aria-label="Remove navigation link" onClick={()=>setDraft(s=>({...s,navigation:s.navigation.filter((_,i)=>i!==index)}))}><Trash2/></button></div>)}<button className="site-add-button" onClick={()=>setDraft(s=>({...s,navigation:[...s.navigation,{label:'New link',path:'/school'}]}))}><Plus/> Add navigation link</button><h2>Page content</h2><label className="site-edit-field"><span>Choose a page to edit</span><select value={selectedPage} onChange={event=>setSelectedPage(event.target.value)}>{Object.entries(draft.pages).map(([key,value])=><option key={key} value={key}>{value.title}</option>)}</select></label><div className="site-edit-grid"><Field label="Page eyebrow" value={draftPage.eyebrow} onChange={value=>setPage(selectedPage,{...draftPage,eyebrow:value})}/><Field label="Page title" value={draftPage.title} onChange={value=>setPage(selectedPage,{...draftPage,title:value})}/><Field label="Page introduction" multiline value={draftPage.intro} onChange={value=>setPage(selectedPage,{...draftPage,intro:value})}/></div><label className="site-edit-field"><span>Page hero photo (PNG or JPEG, max 500 KB)</span><input type="file" accept="image/png,image/jpeg" onChange={event=>upload(event,value=>setPage(selectedPage,{...draftPage,image:value}))}/></label>{draftPage.image&&<img className="editor-preview" src={draftPage.image} alt="Page hero preview"/>}<div className="site-block-list">{draftPage.blocks.map((section,index)=><article className="site-block-editor" key={section.id}><div className="site-block-head"><strong>Section {index+1}</strong><div><button className="site-icon-btn" aria-label="Move section up" disabled={index===0} onClick={()=>setPage(selectedPage,{...draftPage,blocks:draftPage.blocks.map((value,i)=>i===index-1?section:i===index?draftPage.blocks[index-1]:value)})}><ArrowUp/></button><button className="site-icon-btn" aria-label="Move section down" disabled={index===draftPage.blocks.length-1} onClick={()=>setPage(selectedPage,{...draftPage,blocks:draftPage.blocks.map((value,i)=>i===index+1?section:i===index?draftPage.blocks[index+1]:value)})}><ArrowDown/></button><button className="site-icon-btn danger" aria-label="Delete section" onClick={()=>setPage(selectedPage,{...draftPage,blocks:draftPage.blocks.filter(value=>value.id!==section.id)})}><Trash2/></button></div></div><label className="site-edit-field"><span>Section type</span><select value={section.kind} onChange={event=>setBlock(selectedPage,section.id,value=>({...value,kind:event.target.value as SchoolWebsiteBlock['kind']}))}><option value="text">Text section</option><option value="cards">Cards / list</option><option value="quote">Quote</option><option value="cta">Call to action</option></select></label><Field label="Section eyebrow" value={section.eyebrow} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,eyebrow:value}))}/><Field label="Section title" value={section.title} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,title:value}))}/><Field label="Section text" multiline value={section.body} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,body:value}))}/>{section.kind==='cta'&&<div className="site-edit-row"><Field label="Button label" value={section.actionLabel} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,actionLabel:value}))}/><Field label="Button destination" value={section.actionPath} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,actionPath:value}))}/></div>}{section.kind==='cards'&&<><h3>Cards / list items</h3>{section.items.map((entry,itemIndex)=><div className="site-item-editor" key={entry.id}><div className="site-block-head"><strong>Item {itemIndex+1}</strong><button className="site-icon-btn danger" aria-label="Delete item" onClick={()=>setBlock(selectedPage,section.id,b=>({...b,items:b.items.filter(item=>item.id!==entry.id)}))}><Trash2/></button></div><Field label="Item title" value={entry.title} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,items:b.items.map(item=>item.id===entry.id?{...item,title:value}:item)}))}/><Field label="Item text" multiline value={entry.body} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,items:b.items.map(item=>item.id===entry.id?{...item,body:value}:item)}))}/><Field label="Small label / detail" value={entry.detail} onChange={value=>setBlock(selectedPage,section.id,b=>({...b,items:b.items.map(item=>item.id===entry.id?{...item,detail:value}:item)}))}/></div>)}<button className="site-add-button" onClick={()=>setBlock(selectedPage,section.id,b=>({...b,items:[...b.items,item('New item','Describe this item')]}))}><Plus/> Add item</button></>}{section.kind==='text'&&<label className="site-edit-field"><span>Section image (PNG or JPEG, max 500 KB)</span><input type="file" accept="image/png,image/jpeg" onChange={event=>upload(event,value=>setBlock(selectedPage,section.id,b=>({...b,image:value})))}/></label>}{section.image&&<img className="editor-preview" src={section.image} alt="Section image preview"/>}</article>)}</div><button className="site-add-button" onClick={()=>setPage(selectedPage,{...draftPage,blocks:[...draftPage.blocks,block('text','New section')]})}><Plus/> Add content section</button><button className="school-button site-save" onClick={()=>void save()}><Check size={17}/> Save all website changes</button>{notice&&<p role="status">{notice}</p>}<p className="editor-note">All page text and site navigation are saved to the shared school workspace.</p></div></section></main>;
  }
  return <div className="school-site"><div className="school-topline"><span>{site.topLineLeft}</span><span>{site.topLineRight}</span></div><header className="school-header"><Link to="/school" className="school-brand"><span className="school-seal"><GraduationCap/></span><span>{site.brandName}<small>{site.brandSubtitle}</small></span></Link><button className="school-menu-btn" aria-label="Toggle navigation" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><nav className={menu?'school-nav open':'school-nav'}>{site.navigation.map((link,index)=><Link key={`${link.path}-${index}`} to={link.path} onClick={()=>setMenu(false)}>{link.label}</Link>)}<Link className="school-lms" to="/"><BookOpen size={16}/> LMS portal</Link></nav></header><section className={pageKey==='home'?'school-hero':'school-page-hero'}>{pageKey==='home'&&<div className="hero-copy"><p className="school-kicker"><span/>{page.eyebrow}</p><h1>{page.title}</h1><p>{page.intro}</p>{page.blocks.find(section=>section.kind==='cta')&&<div className="hero-actions"><Link className="school-button" to={page.blocks.find(section=>section.kind==='cta')!.actionPath}>{page.blocks.find(section=>section.kind==='cta')!.actionLabel}<ArrowRight size={17}/></Link></div>}</div>}{pageKey!=='home'&&<><p className="school-kicker">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.intro}</p></>}{page.image&&<img className="school-page-image" src={page.image} alt=""/>}{pageKey==='home'&&!page.image&&<div className="hero-visual"><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/><div className="visual-sun"/><div className="visual-hill hill-back"/><div className="visual-hill hill-front"/><div className="visual-school"><div className="school-roof"/><div className="school-building"><div className="school-building-name">{site.brandName}</div><div className="school-windows"><i/><i/><i/><i/></div><div className="school-door"/></div><div className="school-flag"/></div><span className="floating-label">{site.pages.learning.title}</span></div>}</section>{page.blocks.map(section=>section.kind==='quote'?<section className="school-quote" key={section.id}><span>“</span><blockquote>{section.title}</blockquote><p>{section.body}</p></section>:section.kind==='cta'?<section className="school-cta" key={section.id}><div><p className="school-kicker">{section.eyebrow}</p><h2>{section.title}</h2><p>{section.body}</p></div>{section.actionLabel&&<Link className="school-button" to={section.actionPath}>{section.actionLabel}<ArrowRight size={17}/></Link>}</section>:section.kind==='cards'?<section className="school-learning" key={section.id}><div className="section-heading"><div><p className="school-kicker">{section.eyebrow}</p><h2>{section.title}</h2><p>{section.body}</p></div></div><div className="learning-cards">{section.items.map(entry=><article key={entry.id}><span className="learning-icon"><GraduationCap/></span>{entry.detail&&<p>{entry.detail}</p>}<h3>{entry.title}</h3><small>{entry.body}</small></article>)}</div></section>:<section className="home-about" key={section.id}><div className="home-about-art">{section.image?<img src={section.image} alt=""/>:<div className="art-circle"><GraduationCap size={56}/></div>}</div><div><p className="school-kicker">{section.eyebrow}</p><h2>{section.title}</h2><p>{section.body}</p></div></section>)}<footer className="school-footer"><Link to="/school" className="school-brand"><span className="school-seal"><GraduationCap/></span><span>{site.brandName}<small>{site.brandSubtitle}</small></span></Link><div><p>{site.footerNote}</p><p>© {new Date().getFullYear()} {site.brandName} {site.brandSubtitle}</p></div><Link to="/">{site.lmsLabel} <ArrowRight size={16}/></Link></footer></div>;
}
