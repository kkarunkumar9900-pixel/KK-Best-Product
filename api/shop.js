// KK Best Product - shared shop backend for Vercel (api/shop.js)
// Needs an Upstash Redis database (Vercel > Storage > Upstash Redis). It adds
// KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN) automatically.
const crypto = require('crypto');
const envKeys = Object.keys(process.env);
const findEnv = (re, not) => { const k = envKeys.find(x => re.test(x) && !(not && not.test(x))); return k ? process.env[k] : undefined; };
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || findEnv(/REST(_API)?_URL$/);
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || findEnv(/REST(_API)?_TOKEN$/, /READ_ONLY/);
const HASHES = ['users', 'addrs', 'orders', 'products', 'supplier', 'reviews', 'support', 'LOT', 'LTK', 'rl', 'offers', 'wallets', 'payouts'];
const SHARED = ['products', 'supplier', 'reviews', 'support', 'offers'];
const sha = t => crypto.createHash('sha256').update('kk|' + t).digest('hex');
const lhash = t => sha('pw|' + t);
const rndT = () => crypto.randomBytes(12).toString('hex');
const lgEv = (u, t) => { u.ev = u.ev || []; u.ev.unshift({ t: Date.now(), e: t }); u.ev = u.ev.slice(0, 40); };
const fail = (m, code) => { const e = new Error(m); e.user = 1; if (code) e.code = code; throw e; };

async function rcmd(cmds) {
  if (!RURL || !RTOK) { const e = new Error('Database not connected. In Vercel open Storage, add Upstash Redis, then Redeploy.'); e.code = 503; e.user = 1; throw e; }
  const r = await fetch(RURL + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RTOK, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json().catch(() => null);
  if (!Array.isArray(j)) throw new Error('Database error');
  return j.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

async function loadDB() {
  const cmds = HASHES.map(h => ['HGETALL', 'kk:' + h]).concat([['GET', 'kk:settings'], ['GET', 'kk:seq'], ['GET', 'kk:ver']]);
  const res = await rcmd(cmds);
  const d = { snap: {} };
  HASHES.forEach((h, i) => {
    const flat = res[i] || [], m = {}, sn = {};
    for (let k = 0; k < flat.length; k += 2) { sn[flat[k]] = flat[k + 1]; m[flat[k]] = parse(flat[k + 1]); }
    d.snap[h] = sn; d[h] = m;
  });
  const n = HASHES.length;
  d.settings = parse(res[n]) || {}; d.snap.settings = res[n] || '';
  d.seq = parseInt(res[n + 1]) || 1000; d.snap.seq = d.seq;
  d.ver = parseInt(res[n + 2]) || 0;
  d.orders = Object.values(d.orders).filter(Boolean);
  return d;
}
async function commit(d) {
  const cmds = []; let shared = false;
  const orders = {}; d.orders.forEach(o => orders[String(o.id)] = o);
  for (const h of HASHES) {
    const cur = h === 'orders' ? orders : d[h], sn = d.snap[h], set = [];
    for (const f of Object.keys(cur)) { if (cur[f] == null) continue; const v = JSON.stringify(cur[f]); if (sn[f] !== v) set.push(f, v); }
    const del = Object.keys(sn).filter(f => cur[f] == null);
    for (let i = 0; i < set.length; i += 40) cmds.push(['HSET', 'kk:' + h].concat(set.slice(i, i + 40)));
    if (del.length) cmds.push(['HDEL', 'kk:' + h].concat(del));
    if ((set.length || del.length) && SHARED.includes(h)) shared = true;
  }
  const sj = JSON.stringify(d.settings);
  if (sj !== d.snap.settings) { cmds.push(['SET', 'kk:settings', sj]); shared = true; }
  if (d.seq !== d.snap.seq) cmds.push(['SET', 'kk:seq', String(d.seq)]);
  if (shared) { cmds.push(['INCR', 'kk:ver']); d.ver++; }
  if (cmds.length) await rcmd(cmds);
}
const pubSettings = s => { const { pwh, pass, cbMaxPct, stkTok, ...p } = s; return p; };
const sortP = L => L.sort((a, b) => String(a.id).length - String(b.id).length || String(a.id).localeCompare(String(b.id)));
const userView = (d, u) => ({ mobile: u.mobile, name: u.name, gender: u.gender || (u.prof && u.prof.gender) || '', dob: u.dob || (u.prof && u.prof.dob) || '', t: u.t || 0, ll: u.ll || 0, up: u.up || 0, blocked: !!u.blocked, note: u.note || '', prof: u.prof || {}, ev: u.ev || [], addrs: d.addrs[u.mobile] || [] });
const orderView = ({ tk, ...o }) => o;


async function route(u,b,C){const d=C.d,S=d.settings,adm=C.admin,bad=m=>{const e=new Error(m);e.user=1;throw e},sv=()=>{},me=(C.me&&d.users[C.me]&&!d.users[C.me].blocked)?d.users[C.me]:undefined,pOf=id=>d.products[String(id)],fest=()=>{const n=Date.now();return (S.fests||[]).find(f=>f.s<=n&&n<f.e)||null},eff=p=>{if(!p)return p;const f=fest();if(!f||!(+f.d>0))return p;return {...p,price:Math.max(1,Math.round(p.price*(1-f.d/100))),mrp:p.price}},need=()=>{if(!me)bad('Please login first');return me},mob=String(b.mobile||'').replace(/\D/g,''),pw=x=>typeof x=='string'&&x.length>=8&&/[A-Za-z]/.test(x)&&/\d/.test(x);
 const pr=b.purpose=='reset'?'reset':'register',L=()=>d.addrs[me.mobile]||(d.addrs[me.mobile]=[]);
 switch(u){
 case '/api/auth/me':return me?{mobile:me.mobile,name:me.name,gender:me.gender,prof:me.prof||{}}:bad('Not logged in');
 case '/api/auth/otp':bad('This option is turned off. Use mobile number and password.');
 case '/api/auth/verify-otp':bad('This option is turned off. Use mobile number and password.');
 case '/api/auth/register':bad('This option is turned off. Use mobile number and password.');
 case '/api/auth/reset':bad('This option is turned off. Use mobile number and password.');
 case '/api/auth/login':{const x=d.users[mob];if(!/^[6-9]\d{9}$/.test(mob)||!b.password)bad('Enter mobile number and password');if(!x)bad('This number is not registered. Please register first.');if(x.blocked)bad('This account is blocked. Please contact the seller.');
  const k='kkf'+mob,f=d.rl[k]||{n:0,t:0};if(f.n>=8&&Date.now()-f.t<9e5)bad('Too many attempts. Please wait a few minutes.');
  if(await lhash(String(b.password))!==x.pw){(d.rl[k]={n:f.n+1,t:Date.now()});bad('Wrong password')}(d.rl[k]={n:0,t:0});C.setMe(mob);x.ll=Date.now();sv();return{user:{mobile:x.mobile,name:x.name,gender:x.gender,prof:x.prof||{}}}}
 case '/api/auth/phone-register':{if(!/^[6-9]\d{9}$/.test(mob))bad('Enter a valid 10-digit mobile number');if(String(b.name||'').trim().length<2)bad('Enter your full name');if(!['Male','Female','Other'].includes(b.gender))bad('Select your gender');const dob=String(b.dob||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||isNaN(Date.parse(dob))||dob<'1900-01-01'||dob>new Date().toISOString().slice(0,10))bad('Enter a valid date of birth');if(!b.password||typeof b.password!='string')bad('Enter a password');if(d.users[mob])bad('This number is already registered. Please login.');d.users[mob]={mobile:mob,name:String(b.name).trim().slice(0,60),gender:b.gender,t:Date.now(),ll:Date.now(),ev:[{t:Date.now(),e:'Registered'}],pw:await lhash(b.password),dob:String(b.dob||''),prof:{dob:String(b.dob||''),gender:b.gender,av:(+mob.split('').reduce((a,c)=>a+(+c),0))%4}};C.setMe(mob);sv();const x=d.users[mob];return{user:{mobile:x.mobile,name:x.name,gender:x.gender}}}
 case '/api/auth/dob-verify':{if(!/^[6-9]\d{9}$/.test(mob))bad('Enter a valid 10-digit mobile number');const k='kkd'+mob,f=d.rl[k]||{n:0,t:0};if(f.n>=5&&Date.now()-f.t<9e5)bad('Too many attempts. Please wait a few minutes or contact us from Help.');
  const x=d.users[mob];if(!x)bad('This number is not registered. Please register first.');if(!x.dob)bad('No date of birth is saved for this account. Please contact us from Help and we will reset it for you.');
  const nz=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');if(nz(b.name)!==nz(x.name)||String(b.dob)!==x.dob){(d.rl[k]={n:f.n+1,t:Date.now()});bad('Details do not match. Check your name and date of birth, or contact us from Help.')}
  (d.rl[k]={n:0,t:0});const t=rndT();d.LTK[t]={m:mob,p:'reset'};return{token:t}}
 case '/api/auth/logout':C.setMe('');sv();return{ok:1};
 case '/api/account/addrs':need();return{list:L()};
 case '/api/account/bank':need();return{bank:null};
 case '/api/account/addr':{need();const l=L(),a={label:String(b.label||'Home').slice(0,20)};for(const k of['name','phone','house','road','pin','city','state'])a[k]=String(b[k]||'').trim();
  if(a.name.length<2||!/^[6-9]\d{9}$/.test(a.phone)||!/^\d{6}$/.test(a.pin)||!a.house)bad('Please fill name, 10-digit phone, house and 6-digit pincode');
  if(b.id){const x=l.find(y=>y.id==b.id);if(!x)bad('Address not found');Object.assign(x,a);if(b.def)l.forEach(y=>y.def=y.id==x.id)}else{if(l.length>=5)bad('You can save up to 5 addresses');const n={id:Date.now(),...a,def:!!b.def||!l.length};l.push(n);if(b.def)l.forEach(y=>y.def=y.id==n.id)}lgEv(me,b.id?'Edited a saved address':'Added a saved address');sv();return{list:l}}
 case '/api/account/addr-def':{need();const l=L();l.forEach(y=>y.def=y.id==b.id);sv();return{list:l}}
 case '/api/account/addr-del':{need();let l=L().filter(y=>y.id!=b.id);if(l.length&&!l.some(y=>y.def))l[0].def=true;d.addrs[me.mobile]=l;lgEv(me,'Deleted a saved address');sv();return{list:l}}
 case '/api/account/profile':{need();const o0={...(me.prof||{}),name:me.name,gender:me.gender};const n=String(b.name||'').trim().slice(0,60);if(n.length<2)bad('Enter a valid name');const pr={...(me.prof||{})};
  if('email' in b){const v=String(b.email||'').trim().slice(0,80);if(v&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))bad('Enter a valid email address');pr.email=v}
  if('dob' in b){const v=String(b.dob||'');if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(Date.parse(v))||v<'1900-01-01'||v>new Date().toISOString().slice(0,10)))bad('Enter a valid date of birth');pr.dob=v;if(v)me.dob=v}
  if('alt' in b){const v=String(b.alt||'').replace(/\D/g,'');if(v&&!/^[6-9]\d{9}$/.test(v))bad('Enter a valid 10-digit alternate mobile number');pr.alt=v}
  if('city' in b)pr.city=String(b.city||'').trim().slice(0,40);
  if('gender' in b&&['Male','Female','Other'].includes(b.gender)){me.gender=b.gender;pr.gender=b.gender}
  if('av' in b)pr.av=(+b.av||0)%4;
  if('photo' in b){const v=String(b.photo||'');if(v&&(!v.startsWith('data:image/jpeg;base64,')||v.length>400000))bad('Photo is too large');pr.photo=v}
  me.name=n;me.prof=pr;const ch=[],n0={...pr,name:n,gender:me.gender};for(const k of['name','gender','email','dob','alt','city'])if(String(o0[k]||'')!=String(n0[k]||''))ch.push(k=='alt'?'alternate mobile':k=='dob'?'date of birth':k);if(String(o0.photo||'')!=String(pr.photo||''))ch.push(pr.photo?'profile photo':'photo removed');if('av' in b&&o0.av!=pr.av&&!pr.photo)ch.push('character');if(ch.length){lgEv(me,'Updated profile: '+ch.join(', '));me.up=Date.now()}sv();return{name:n,prof:pr}}
  case '/api/account/bank-del':case '/api/account/bank':bad('Refund details are not available yet.');
 case '/api/checkout':{const ON=b.method=='on';if(ON&&!String(S.upi||'').includes('@'))bad('Online payment is not set up yet (seller UPI ID missing). Please choose Cash on Delivery.');const its=(b.items||[]).slice(0,20);if(!its.length)bad('Your cart is empty');const a=b.addr||{};
  if(String(a.name||'').trim().length<2||!/^[6-9]\d{9}$/.test(String(a.phone||''))||!/^\d{6}$/.test(String(a.pin||''))||!a.house)bad('Please fill name, 10-digit phone, house and 6-digit pincode');
  const tk=rndT(),g=its.length>1?'G'+Date.now():undefined,ids=[];its.forEach(i=>{const p=pOf(i.id);if(!p)bad('A product in your order was not found');if(p.avail===false)bad(p.name+' is currently unavailable');const e=eff(p),q=Math.min(20,Math.max(1,parseInt(i.q)||1));
   const o={id:++d.seq,t:Date.now(),pid:p.id,pname:p.name,img:p.img,rpol:p.rpol,size:i.size||'',qty:q,total:e.price*q,pay:ON?'Online (UPI)':'COD',pst:ON?'Verifying':undefined,status:'New',name:a.name,phone:a.phone,house:a.house,road:a.road||'',pin:a.pin,city:a.city||'',state:a.state||'',loc:b.loc||null,maplink:b.maplink||'',cust:me?me.mobile:'',grp:g,tk};d.orders.push(o);ids.push(o.id)});let upi;if(ON){const os=d.orders.filter(o=>ids.includes(o.id)),sub=os.reduce((t,o)=>t+o.total,0),off=Math.min(+S.onlineOff||0,Math.max(0,sub-1));if(me)os.forEach(o=>{const pp=pOf(o.pid);if(!pp)return;const cb=cbFor(d,pp,o.total,Date.now(),{qty:o.qty,off:sub>0?off*(o.total/sub):0});if(cb)o.cb=cb});os[0].total-=off;upi={pa:S.upi,pn:S.upiName||S.shop||'Shop',am:sub-off,tn:'Order '+ids.join(',')}}const cbSum=d.orders.filter(o=>ids.includes(o.id)).reduce((t,o)=>t+(o.cb?o.cb.amt:0),0);sv();return upi?{ids,token:tk,upi,cb:cbSum}:{ids,token:tk}}
 case '/api/mine':{const t=b.t||{};return d.orders.filter(o=>(me&&o.cust==me.mobile)||(t[o.id]&&t[o.id]==o.tk)).map(({tk,...o})=>o).sort((x,y)=>y.t-x.t)}
 case '/api/order-patch':{const o=d.orders.find(x=>x.id==b.id);if(!o)bad('Order not found');const ad=!!C.admin;
  if(b.del){if(!ad)bad('Admin login required');d.orders=d.orders.filter(x=>x!==o);sv();return{ok:1}}const p=b.patch||{};
  if(ad){for(const k of['status','pst','dAt','ret','note','utr','trk'])if(k in p)o[k]=p[k]}else{if(!((me&&o.cust==me.mobile)||(b.token&&b.token==o.tk)))bad('Not your order');if(!p.ret||p.ret.status!='Requested'||(o.ret&&o.ret.status!='Requested'))bad('Not allowed');o.ret=p.ret}sv();return{ok:1}}
 case '/api/utr':{const o=d.orders.find(x=>x.id==b.id&&(x.tk==b.token||(me&&x.cust==me.mobile)));if(!o)bad('Order not found');if(!/^\d{12}$/.test(String(b.utr||'').trim()))bad('Enter the 12-digit UTR number from your UPI app');d.orders.filter(x=>x.id==o.id||(o.grp&&x.grp==o.grp)).forEach(x=>{x.utr=String(b.utr).trim();x.pst='Verifying'});sv();return{ok:1}}
 case '/api/failed':return{ok:1};
 }{const e=new Error('Not found');e.code=404;throw e}}

async function extra(u, b, C, req) {
  const d = C.d, S = d.settings, isAdm = !!C.admin, need = () => { if (!isAdm) fail('Admin login required', 401); };
  switch (u) {
    case '/api/data': {
      const cur = d.ver + (isAdm ? 'a' : '') + ':' + (C.me || '');
      if (b.ver && b.ver === cur) return { same: 1, ver: cur };
      const mine = Array.isArray(b.mymsg) ? b.mymsg.map(String) : [];
      let support = Object.values(d.support).filter(Boolean);
      if (!isAdm) support = support.filter(m => mine.includes(String(m.id)) || (C.me && m.cust === C.me));
      const out = { ver: cur, admin: isAdm, products: sortP(Object.values(d.products).filter(Boolean)), reviews: Object.values(d.reviews).filter(Boolean), offers: Object.values(d.offers).filter(Boolean), settings: pubSettings(S), support };
      if (isAdm) { out.supplier = Object.values(d.supplier).filter(Boolean); out.cbMaxPct = S.cbMaxPct == null || S.cbMaxPct === '' ? 50 : +S.cbMaxPct; }
      const cbmap = {}, off = +S.onlineOff || 0;
      for (const p of Object.values(d.products)) { if (!p) continue; const ep = effP(d, p); for (const o of Object.values(d.offers)) { if (!o) continue; const a = cbAmt(d, o, ep, ep.price, { qty: 1, off }); if (a > 0) (cbmap[p.id] = cbmap[p.id] || {})[o.id] = a; } }
      out.cbmap = cbmap;
      return out;
    }
    case '/api/store': {
      const c = String(b.c || ''), id = String(b.id || ''), op = b.op;
      if (!['products', 'supplier', 'reviews', 'support', 'offers'].includes(c) || !id || id.length > 80) fail('Bad request');
      const col = d[c], ex = col[id];
      if (isAdm) {
        if (op === 'put') { const v = { ...(b.d || {}), id }; col[id] = v; }
        else if (op === 'upd') { if (ex) col[id] = { ...ex, ...(b.d || {}), id }; }
        else if (op === 'del') { delete col[id]; }
        else fail('Bad request');
        return { ok: 1 };
      }
      if (op !== 'put') fail('Admin login required', 401);
      const x = b.d || {};
      if (c === 'reviews') {
        if (!d.orders.find(o => String(o.id) === id)) fail('Order not found');
        col[id] = { id, pid: String(x.pid || '').slice(0, 80), stars: Math.min(5, Math.max(1, +x.stars || 5)), text: String(x.text || '').slice(0, 500), name: String(x.name || '').slice(0, 40), t: Date.now(), hide: ex ? !!ex.hide : false, reply: ex ? ex.reply || '' : '' };
        return { ok: 1 };
      }
      if (c === 'support') {
        if (ex) fail('Not allowed');
        col[id] = { id, t: Date.now(), name: String(x.name || '').slice(0, 60), phone: String(x.phone || '').slice(0, 15), cust: C.me || '', oid: String(x.oid || '').slice(0, 20), text: String(x.text || '').slice(0, 800), status: 'New' };
        return { ok: 1 };
      }
      fail('Admin login required', 401);
    }
    case '/api/admin/login': {
      const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x').trim(), k = 'adm' + ip, f = d.rl[k] || { n: 0, t: 0 };
      if (f.n >= 8 && Date.now() - f.t < 9e5) fail('Too many attempts. Please wait a few minutes.', 429);
      const pw = String(b.password || ''), ok = S.pwh ? sha(pw) === S.pwh : pw === 'admin123';
      if (!ok) { d.rl[k] = { n: f.n + 1, t: Date.now() }; fail('Wrong password', 401); }
      d.rl[k] = { n: 0, t: 0 }; C.setAdmin(true); return { ok: 1 };
    }
    case '/api/admin/me': if (!isAdm) fail('Not admin', 401); return { ok: 1 };
    case '/api/admin/password': {
      need(); const cur = String(b.current || ''), nx = String(b.next || '');
      if (!(S.pwh ? sha(cur) === S.pwh : cur === 'admin123')) fail('Current password is wrong');
      if (nx.length < 6) fail('New password must be at least 6 characters');
      S.pwh = sha(nx); return { ok: 1 };
    }
    case '/api/admin/settings': {
      need(); const n = { ...(b.settings || {}) }; delete n.pwh; delete n.pass;
      d.settings = { ...n, pwh: S.pwh || '', stkTok: S.stkTok }; return { ok: 1 };
    }
    case '/api/admin/sync': need(); return { ok: 1 };
    case '/api/admin/orders': need(); return d.orders.map(orderView);
    case '/api/admin/bank': need(); return { bank: null };
    case '/api/admin/users': need(); return { list: Object.values(d.users).filter(Boolean).map(x => userView(d, x)) };
    case '/api/admin/user-op': {
      need(); let x = b.value; const m = String(b.mobile || ''), op = b.op, uu = d.users[m];
      if (!uu) fail('Account not found');
      if (op === 'block') { uu.blocked = !uu.blocked; lgEv(uu, uu.blocked ? 'Blocked by seller' : 'Unblocked by seller'); }
      else if (op === 'reset') { if (!x) fail('Enter a password'); uu.pw = lhash(String(x)); lgEv(uu, 'Password reset by seller'); }
      else if (op === 'note') uu.note = String(x || '').slice(0, 300);
      else if (op === 'edit') {
        x = x || {}; uu.prof = uu.prof || {}; const ch = [];
        const set = (k, v, lab) => { if (String(v || '') != String(k === 'name' || k === 'gender' || k === 'dob' ? (uu[k] || (k === 'gender' ? uu.prof.gender : '') || '') : (uu.prof[k] || ''))) ch.push(lab || k); };
        set('name', x.name, 'name'); set('gender', x.gender, 'gender'); set('dob', x.dob, 'date of birth'); set('email', x.email); set('alt', x.alt, 'alternate mobile'); set('city', x.city);
        uu.name = String(x.name || uu.name).slice(0, 60); uu.gender = x.gender || uu.gender; uu.prof.gender = uu.gender; uu.dob = x.dob || uu.dob; uu.prof.dob = uu.dob; uu.prof.email = x.email; uu.prof.alt = x.alt; uu.prof.city = x.city;
        if (ch.length) { lgEv(uu, 'Details edited by seller: ' + ch.join(', ')); uu.up = Date.now(); }
      }
      else if (op === 'del') { delete d.users[m]; delete d.addrs[m]; }
      else fail('Bad request');
      return { ok: 1 };
    }
    case '/api/admin/bulk': { // one-time move of data saved in the owner's browser to the shared database
      need(); const x = b.data || {}; const moved = {};
      for (const c of ['products', 'supplier', 'reviews', 'support']) {
        if (Array.isArray(x[c]) && !Object.keys(d[c]).length) { x[c].forEach(v => { if (v && v.id != null) d[c][String(v.id)] = v; }); moved[c] = x[c].length; }
      }
      if (x.settings && !Object.keys(S).length) { const n = { ...x.settings }; delete n.pass; d.settings = n; moved.settings = 1; }
      const k = x.kkl;
      if (k && !Object.keys(d.users).length && !d.orders.length) {
        Object.assign(d.users, k.users || {}); Object.assign(d.addrs, k.addrs || {});
        (k.orders || []).forEach(o => d.orders.push(o)); d.seq = Math.max(d.seq, +k.seq || 0); moved.users = Object.keys(k.users || {}).length; moved.orders = (k.orders || []).length;
      }
      return { ok: 1, moved };
    }
    case '/api/account/wallet': {
      if (!C.me || !d.users[C.me] || d.users[C.me].blocked) fail('Please login', 401);
      const w = d.wallets[C.me] || { bal: 0, tx: [] };
      const pl = d.orders.filter(o => o.cust === C.me && o.cb && !o.cbd && !o.cbr && o.status !== 'Cancelled' && o.pst !== 'Failed' && /Online/.test(o.pay || '')), pend = pl.reduce((t, o) => t + o.cb.amt, 0), pendList = pl.slice(-10).map(o => ({ id: o.id, amt: o.cb.amt, nm: o.cb.nm, why: o.utr ? 'We are verifying your payment' : 'Waiting for your payment (enter the UTR after paying)' }));
      const pays = Object.values(d.payouts).filter(x => x && x.mobile === C.me).sort((a, b) => b.t - a.t).slice(0, 20).map(x => ({ id: x.id, t: x.t, amt: x.amt, method: x.method, to: x.method === 'upi' ? x.upi : (x.holder + ' \u00b7 A/c ' + String(x.acc).replace(/.(?=.{4})/g, 'X') + ' \u00b7 ' + x.ifsc), st: x.st, ref: x.ref || '', note: x.note || '' }));
      return { bal: w.bal || 0, pend, pendList, tx: (w.tx || []).slice(0, 25), payouts: pays, min: +S.minPayout || 10 };
    }
    case '/api/account/payout': {
      if (!C.me || !d.users[C.me] || d.users[C.me].blocked) fail('Please login', 401);
      const w = d.wallets[C.me] || { bal: 0, tx: [] }, amt = Math.floor(+b.amt || 0), min = +S.minPayout || 10, method = b.method === 'bank' ? 'bank' : 'upi';
      if (amt < min) fail('Minimum withdrawal is \u20b9' + min);
      if (amt > (w.bal || 0)) fail('You only have \u20b9' + Math.floor(w.bal || 0) + ' available');
      if (Object.values(d.payouts).filter(x => x && x.mobile === C.me && x.st === 'Requested').length >= 3) fail('You already have 3 withdrawals being processed. Please wait for them.');
      const rec = { id: 'W' + Date.now().toString(36).toUpperCase(), t: Date.now(), mobile: C.me, name: d.users[C.me].name || '', amt, method, st: 'Requested', ref: '', note: '' };
      if (method === 'upi') { const upi = String(b.upi || '').trim(); if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/.test(upi)) fail('Enter a valid UPI ID like name@upi'); rec.upi = upi; }
      else { const acc = String(b.acc || '').replace(/\s/g, ''), ifsc = String(b.ifsc || '').toUpperCase().trim(), holder = cut(b.holder, 60).trim(); if (holder.length < 2) fail('Enter the account holder name'); if (!/^\d{9,18}$/.test(acc)) fail('Enter a valid bank account number'); if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) fail('Enter a valid IFSC code (like SBIN0001234)'); Object.assign(rec, { holder, acc, ifsc }); }
      w.bal -= amt; w.tx = w.tx || []; w.tx.unshift({ t: Date.now(), k: 'withdraw', a: -amt, n: 'Withdrawal requested (' + rec.id + ')' }); w.tx = w.tx.slice(0, 60);
      d.wallets[C.me] = w; d.payouts[rec.id] = rec; return { ok: 1, id: rec.id };
    }
    case '/api/admin/payouts': need(); return { list: Object.values(d.payouts).filter(Boolean).sort((a, b) => b.t - a.t).slice(0, 200) };
    case '/api/admin/payout-op': {
      need(); const x = d.payouts[String(b.id || '')]; if (!x) fail('Request not found'); if (x.st !== 'Requested') fail('This request is already ' + x.st);
      if (b.op === 'paid') { x.st = 'Paid'; x.ref = cut(b.ref, 60); x.tp = Date.now(); }
      else if (b.op === 'reject') { x.st = 'Rejected'; x.note = cut(b.note, 120); x.tp = Date.now(); const w = d.wallets[x.mobile] || (d.wallets[x.mobile] = { bal: 0, tx: [] }); w.bal += x.amt; w.tx.unshift({ t: Date.now(), k: 'refund', a: x.amt, n: 'Withdrawal ' + x.id + ' was not paid' + (x.note ? ': ' + x.note : '') + '. Amount returned to your wallet.' }); w.tx = w.tx.slice(0, 60); }
      else fail('Bad request');
      return { ok: 1 };
    }
    case '/api/admin/ai-desc': need(); return await aiDesc(b);
    case '/api/admin/stockcheck': need(); return await stockRun(d, { run: +b.run || Date.now(), budget: 7000 });
    case '/api/admin/stocktoken': need(); if (!S.stkTok) S.stkTok = rndT() + rndT(); return { tok: S.stkTok };
    case '/api/admin/stocklog': need(); return { log: parse((await rcmd([['GET', 'kk:stocklog']]))[0]) };
    case '/api/cron/stock': {
      const sec = process.env.CRON_SECRET, au = String(req.headers.authorization || '');
      if (sec ? au !== 'Bearer ' + sec : !/vercel-cron/i.test(String(req.headers['user-agent'] || ''))) fail('Not allowed', 401);
      const lg = parse((await rcmd([['GET', 'kk:stocklog']]))[0]);
      if (lg && Date.now() - lg.run < 20 * 36e5) return { skipped: 1 };
      return await stockRun(d, { run: Date.now(), budget: 50000 });
    }
    case '/api/verify': case '/api/failed': return { ok: 1 };
  }
  return undefined;
}



// ---------- automatic stock check (reads the supplier page like a customer would) ----------
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(x.hostname) && x.hostname.includes('.') ? x.href : ''; } catch (e) { return ''; } };
async function getPage(url) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 9000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13; Redmi Note 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36', accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-IN,en;q=0.9' } });
    const t = await r.text();
    return { status: r.status, html: t.slice(0, 1500000) };
  } finally { clearTimeout(to); }
}
function judgeStock(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  if (/access denied|captcha|are you a robot|unusual traffic/i.test(text) && text.length < 3000) return { s: 'unknown', note: 'The supplier site blocked the automatic check' };
  const hasAdd = /add to cart/i.test(text) && /buy now/i.test(text);
  const exact = /(this product is )?currently out of stock/i.test(text);
  const outTxt = /out of stock|sold out|currently unavailable|notify me|remind me/i.test(text);
  const flags = k => [...html.matchAll(new RegExp('"(?:' + k + ')"\\s*:\\s*(true|false)', 'gi'))].map(m => m[1].toLowerCase());
  const oos = flags('is_?out_?of_?stock|out_?of_?stock|isOutOfStock'), ins = flags('in_?stock|inStock|is_?in_?stock');
  const jsOut = (oos.length && oos.every(x => x === 'true')) || (ins.length && ins.every(x => x === 'false'));
  const jsIn = (oos.length && oos.every(x => x === 'false')) || (ins.length && ins.every(x => x === 'true'));
  if (exact) return { s: 'out', note: 'Page says currently out of stock' };
  if (!hasAdd && (outTxt || jsOut)) return { s: 'out', note: 'No Add to Cart / Buy Now, shows out of stock or Notify Me' };
  if (hasAdd) return { s: 'in', note: 'Add to Cart and Buy Now are available' };
  if (jsIn && !outTxt) return { s: 'in', note: 'Page data says in stock' };
  return { s: 'unknown', note: 'Could not read the stock status from the page (it may need JavaScript)' };
}
async function stockRun(d, o) {
  const t0 = Date.now(), run = o.run || t0;
  const prev = parse((await rcmd([['GET', 'kk:stocklog']]))[0]);
  const log = prev && prev.run === run ? prev : { run, t: t0, results: [] };
  const todo = Object.values(d.products).filter(p => p && d.supplier[p.id] && safeUrl(d.supplier[p.id].link) && (d.supplier[p.id].auto || 0) < run)
    .sort((a, b) => (d.supplier[a.id].chk || 0) - (d.supplier[b.id].chk || 0));
  const batch = [];
  let i = 0;
  while (i < todo.length && Date.now() - t0 < o.budget) {
    const part = todo.slice(i, i + 3); i += 3;
    const res = await Promise.all(part.map(async p => {
      let j;
      try {
        const g = await getPage(safeUrl(d.supplier[p.id].link));
        j = g.status >= 400 ? { s: 'unknown', note: 'The supplier site answered ' + g.status + ' (blocked or removed)' } : g.html.length < 1500 ? { s: 'unknown', note: 'The supplier page was empty' } : judgeStock(g.html);
      } catch (e) { j = { s: 'unknown', note: 'Could not open the page' }; }
      return { p, j };
    }));
    for (const { p, j } of res) {
      const sup = d.supplier[p.id]; sup.auto = Date.now(); let changed = false;
      if (j.s !== 'unknown') {
        sup.chk = Date.now();
        const want = j.s === 'in';
        if ((p.avail === false) === want) { d.products[p.id] = { ...p, avail: want }; changed = true; }
      }
      const row = { id: p.id, name: String(p.name || '').slice(0, 60), s: j.s, note: j.note, changed };
      batch.push(row); log.results.push(row);
    }
  }
  log.left = todo.length - i > 0 ? todo.length - i : 0; log.t = Date.now();
  await rcmd([['SET', 'kk:stocklog', JSON.stringify(log)]]);
  return { done: !log.left, left: log.left, results: batch, log };
}


// ---------- cashback offers, wallet and payouts ----------
function effP(d, p) {
  const n = Date.now(), f = (d.settings.fests || []).find(x => x.s <= n && n < x.e);
  if (!f || !(+f.d > 0)) return p;
  return { ...p, price: Math.max(1, Math.round(p.price * (1 - f.d / 100))), mrp: p.price };
}
// Cashback is always limited by YOUR profit so it can never cause a loss.
// profit = selling price - your cost - online discount; cashback <= (max % of profit, default 50)
function cbAmt(d, o, p, amt, ctx) {
  const sup = d.supplier[p.id], cost = +(sup && sup.cost) || 0, qty = (ctx && ctx.qty) || 1, off = (ctx && ctx.off) || 0;
  if (!(cost > 0)) return 0;
  const profit = amt - cost * qty - off;
  if (profit <= 0) return 0;
  if (o.scope === 'sel' && !(o.pids || []).map(String).includes(String(p.id))) return 0;
  if (+o.min > 0 && amt < +o.min) return 0;
  const mp = d.settings.cbMaxPct == null || d.settings.cbMaxPct === '' ? 50 : Math.min(100, Math.max(0, +d.settings.cbMaxPct));
  let c = o.type === 'prof' ? Math.floor(profit * (+o.val || 0) / 100) : o.type === 'pct' ? Math.floor(amt * (+o.val || 0) / 100) : Math.floor(+o.val || 0);
  if (o.type === 'pct' && +o.cap > 0) c = Math.min(c, Math.floor(+o.cap));
  c = Math.min(c, Math.floor(profit * mp / 100), amt);
  return c > 0 ? c : 0;
}
function cbFor(d, p, amt, now, ctx) {
  let best = null;
  for (const o of Object.values(d.offers)) {
    if (!o || o.on === false) continue;
    if (o.s && now < o.s) continue;
    if (o.e && now > o.e) continue;
    const c = cbAmt(d, o, p, amt, ctx);
    if (c > 0 && (!best || c > best.amt)) best = { amt: c, id: o.id, nm: String(o.name || 'Cashback').slice(0, 60) };
  }
  return best;
}
function settleCashback(d) {
  const now = Date.now();
  for (const o of d.orders) {
    if (!o.cb || !o.cust || !(o.cb.amt > 0)) continue;
    const ok = /Online/.test(o.pay || '') && o.pst === 'Verified' && o.status !== 'Cancelled' && !(o.ret && o.ret.status === 'Refunded');
    const gone = o.status === 'Cancelled' || (o.ret && o.ret.status === 'Refunded');
    if (ok && !o.cbd) {
      const w = d.wallets[o.cust] || (d.wallets[o.cust] = { bal: 0, tx: [] });
      o.cbd = now; w.bal += o.cb.amt; w.tx.unshift({ t: now, k: 'credit', a: o.cb.amt, n: 'Cashback: ' + o.cb.nm + ' (Order #' + o.id + ')' }); w.tx = w.tx.slice(0, 60);
    } else if (o.cbd && !o.cbr && gone) {
      const w = d.wallets[o.cust] || (d.wallets[o.cust] = { bal: 0, tx: [] });
      o.cbr = now; w.bal -= o.cb.amt; w.tx.unshift({ t: now, k: 'reverse', a: -o.cb.amt, n: 'Cashback reversed: Order #' + o.id + ' was cancelled or returned' }); w.tx = w.tx.slice(0, 60);
    }
  }
}
function templateDesc(o, hint) {
  const head = o.type === 'prof' ? 'cashback' : o.type === 'pct' ? (o.val + '% cashback' + (+o.cap > 0 ? ' (up to \u20b9' + o.cap + ')' : '')) : ('\u20b9' + o.val + ' cashback');
  const till = o.e ? new Date(o.e + 19800000).toISOString().slice(0, 10) : '';
  return ['How to get ' + head + ' \u2013 ' + (o.name || 'Cashback offer'),
    '1. Login to your account (cashback is added to your account).',
    '2. Choose any product that shows the \ud83c\udf81 cashback tag and add it to cart.',
    '3. At payment choose "Pay Online (UPI)" and pay the amount.',
    '4. After paying, enter the 12-digit UTR number from your UPI app.',
    '5. We verify your payment. After it is verified, the cashback is added to your Balance (tap the \ud83d\udcb0 balance at the top, or open Account).',
    '6. Open your Balance page and withdraw it to your bank account or UPI ID. Money reaches you within 24 to 72 hours.',
    (+o.min > 0 ? 'Minimum order: \u20b9' + o.min + '. ' : '') + 'Cashback is only for online payments' + (till ? '. Offer valid till ' + till + '.' : '.') + ' If an order is cancelled or returned, its cashback is removed.'].join('\n');
}
async function aiDesc(b) {
  const o = b.offer || {}, hint = cut(b.prompt, 600), base = templateDesc(o, hint), key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { text: base, ai: false, note: 'AI key not set on Vercel (add ANTHROPIC_API_KEY), so the built-in writer was used.' };
  const facts = 'Offer name: ' + cut(o.name, 60) + '\nCashback: ' + (o.type === 'prof' ? 'a different amount for every product, shown on the product page' : o.type === 'pct' ? o.val + '% of product price' + (+o.cap > 0 ? ', maximum \u20b9' + o.cap : '') : '\u20b9' + o.val + ' per product') + '\nMinimum order: ' + (+o.min > 0 ? '\u20b9' + o.min : 'none') + '\nValid till: ' + (o.e ? new Date(o.e + 19800000).toISOString().slice(0, 16).replace('T', ' ') + ' India time' : 'no end date') + '\nApplies to: ' + (o.scope === 'sel' ? 'selected products' : 'all products') + '\nRules: customer must be logged in, choose Pay Online (UPI), pay, enter the 12-digit UTR; seller verifies the payment; then cashback is added to the customer Balance page (shown at the top and in Account); customer can withdraw to bank account or UPI ID; payout takes 24 to 72 hours; cancelled or returned orders lose the cashback.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 800, system: 'You write short, friendly, accurate instructions for customers of a small Indian online shop, explaining how to get a cashback offer. Use ONLY the facts given; never invent amounts, dates or rules. Plain text only (no markdown symbols), a one-line title then numbered steps, at most 8 short lines. Follow the shop owner instruction about language and style.', messages: [{ role: 'user', content: 'Facts:\n' + facts + '\n\nShop owner instruction: ' + (hint || 'Write simple steps in English.') }] }) });
    const j = await r.json(); const t = (j.content || []).map(x => x.text || '').join('').trim();
    if (!t) throw new Error((j.error && j.error.message) || 'empty answer');
    return { text: t.slice(0, 1500), ai: true };
  } catch (e) { return { text: base, ai: false, note: 'AI was not available (' + cut(e.message, 80) + '), so the built-in writer was used.' }; }
}

// ---------- visitor analytics (anonymous id; no raw IP stored) ----------
const dayKey = (t) => new Date((t || Date.now()) + 19800000).toISOString().slice(0, 10); // India time
const cut = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
const BOT = /bot|crawl|spider|preview|facebookexternalhit|slurp|headless|lighthouse/i;
async function track(req, b) {
  const ua = String(req.headers['user-agent'] || '');
  if (BOT.test(ua)) return { ok: 1 };
  const v = String(b.v || '');
  if (!/^[a-z0-9]{6,32}$/.test(v)) fail('Bad request');
  const evs = Array.isArray(b.ev) ? b.ev.slice(0, 40) : [];
  if (!evs.length) return { ok: 1 };
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x').trim();
  const minute = Math.floor(Date.now() / 60000);
  const pre = await rcmd([['HGET', 'kk:vis', v], ['INCR', 'kk:rl:' + ip + ':' + minute], ['EXPIRE', 'kk:rl:' + ip + ':' + minute, 120]]);
  if (pre[1] > 90) fail('Too many requests', 429);
  const old = parse(pre[0]);
  const c = b.ctx || {};
  const dec = x => { try { return decodeURIComponent(x || ''); } catch (e) { return x || ''; } };
  const city = cut(dec(req.headers['x-vercel-ip-city']), 40), reg = cut(req.headers['x-vercel-ip-country-region'], 20), cty = cut(req.headers['x-vercel-ip-country'], 4);
  const rec = old || { id: v, first: Date.now(), n: 0, pg: 0, ck: 0, acts: [] };
  const isNew = !old;
  Object.assign(rec, { last: Date.now(), dev: cut(c.dev, 40), os: cut(c.os, 24), br: cut(c.br, 24), lang: cut(c.lang, 12), scr: cut(c.scr, 14), net: cut(c.net, 8), tz: cut(c.tz, 32), city: city || rec.city || '', reg: reg || rec.reg || '', cty: cty || rec.cty || '' });
  if (c.src) rec.src = cut(c.src, 40);
  if (b.name) { rec.name = cut(b.name, 60); rec.mobile = cut(b.mobile, 15); }
  const day = dayKey(), dk = 'kk:d:' + day, cmds = [], zs = new Set(), where = [rec.city, rec.reg].filter(Boolean).join(', ') || 'Unknown';
  const z = (k, m) => { if (m) { cmds.push(['ZINCRBY', 'kk:z:' + k, 1, cut(m, 60)]); zs.add(k); } };
  const feed = [];
  for (const e of evs) {
    const t = Math.min(Date.now(), Math.max(Date.now() - 36e5, +e.t || Date.now())), type = cut(e.e, 12), pg = cut(e.p, 30), d = cut(e.d, 60), f = cut(e.f, 30);
    if (!['visit', 'view', 'click', 'search', 'photo_search'].includes(type)) continue;
    if (type === 'visit') {
      rec.n++; cmds.push(['HINCRBY', dk, 'visits', 1], ['PFADD', 'kk:u:' + day, v], ['HINCRBY', 'kk:tot', 'visits', 1]);
      z('src', rec.src || 'Direct'); z('dev', rec.dev || rec.os || 'Unknown'); z('os', rec.os); z('city', where); z('lang', rec.lang);
    } else if (type === 'view') {
      rec.pg++; rec.lastp = pg + (d ? ' ' + d : ''); cmds.push(['HINCRBY', dk, 'views', 1]); z('page', pg);
      if (pg === 'prod' && d) { z('prod', d); cmds.push(['HINCRBY', 'kk:tot', 'prod_view', 1]); }
      if (pg === 'review') cmds.push(['HINCRBY', 'kk:tot', 'checkout', 1]);
      if (pg === 'done') cmds.push(['HINCRBY', 'kk:tot', 'order', 1]);
    } else if (type === 'click') {
      rec.ck++; cmds.push(['HINCRBY', dk, 'clicks', 1]); z('click', f || d);
      if (/addCart/.test(f)) cmds.push(['HINCRBY', 'kk:tot', 'add_cart', 1]);
    } else if (type === 'search') { z('search', d.toLowerCase()); cmds.push(['HINCRBY', 'kk:tot', 'search', 1]); }
    else if (type === 'photo_search') cmds.push(['HINCRBY', 'kk:tot', 'photo_search', 1]);
    rec.acts.unshift({ t, e: type, p: pg, d: d || f });
    feed.push(JSON.stringify({ t, v: v.slice(0, 6), name: rec.name || '', city: rec.city, e: type, p: pg, d: d || f }));
  }
  rec.acts = rec.acts.slice(0, 14);
  if (isNew) cmds.push(['HINCRBY', 'kk:tot', 'visitors', 1]);
  cmds.push(['HSET', 'kk:vis', v, JSON.stringify(rec)], ['EXPIRE', dk, 7776000], ['EXPIRE', 'kk:u:' + day, 7776000]);
  feed.forEach(f => cmds.push(['LPUSH', 'kk:ev', f]));
  cmds.push(['LTRIM', 'kk:ev', 0, 299]);
  zs.forEach(k => cmds.push(['ZREMRANGEBYRANK', 'kk:z:' + k, 0, -501]));
  await rcmd(cmds);
  return { ok: 1 };
}
async function stats() {
  const now = Date.now(), days = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(now - i * 864e5));
  const zk = ['src', 'dev', 'city', 'lang', 'prod', 'search', 'click', 'page', 'os'];
  const cmds = [];
  days.forEach(d => { cmds.push(['HGETALL', 'kk:d:' + d], ['PFCOUNT', 'kk:u:' + d]); });
  cmds.push(['HGETALL', 'kk:tot']);
  zk.forEach(k => cmds.push(['ZREVRANGE', 'kk:z:' + k, 0, 9, 'WITHSCORES']));
  cmds.push(['HGETALL', 'kk:vis'], ['LRANGE', 'kk:ev', 0, 39]);
  const r = await rcmd(cmds);
  const h = a => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };
  const out = { days: [], top: {} };
  days.forEach((d, i) => { const x = h(r[i * 2]); out.days.push({ d, visits: +x.visits || 0, views: +x.views || 0, clicks: +x.clicks || 0, uniq: +r[i * 2 + 1] || 0 }); });
  let k = days.length * 2;
  const tot = h(r[k++]); out.tot = {}; Object.keys(tot).forEach(x => out.tot[x] = +tot[x]);
  zk.forEach(z => { const a = r[k++] || [], l = []; for (let i = 0; i < a.length; i += 2) l.push([a[i], +a[i + 1]]); out.top[z] = l; });
  const vis = Object.values(h(r[k++])).map(parse).filter(Boolean).sort((a, b) => b.last - a.last);
  out.visitorsTotal = vis.length; out.now = vis.filter(x => now - x.last < 300000).length;
  out.today = out.days[out.days.length - 1];
  out.vis = vis.slice(0, 60);
  out.feed = (r[k++] || []).map(parse).filter(Boolean);
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, o) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  try {
    const q = new URL(req.url || '/', 'http://x'); const u = (q.searchParams.get('route') || q.pathname).split('?')[0].replace(/\/+$/, '') || '/';
    let b = req.body; if (typeof b === 'string') b = parse(b); if (!b || typeof b !== 'object') b = {};
    if (u === '/api/stock-report') {
      const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      const done = code => { res.statusCode = code; res.setHeader('Content-Type', 'image/gif'); res.end(gif); };
      try {
        const sp = q.searchParams, d0 = await loadDB(), st = sp.get('s');
        if (!d0.settings.stkTok || sp.get('k') !== d0.settings.stkTok || !['in', 'out'].includes(st)) return done(401);
        const m = String(sp.get('u') || '').match(/\/p\/([A-Za-z0-9]+)/);
        if (!m) return done(404);
        const want = st === 'in'; let hit = 0;
        for (const p of Object.values(d0.products)) {
          const sup = p && d0.supplier[p.id];
          if (!sup || !String(sup.link || '').includes('/p/' + m[1])) continue;
          hit++; sup.chk = Date.now();
          if ((p.avail === false) === want) d0.products[p.id] = { ...p, avail: want };
        }
        if (!hit) return done(404);
        await commit(d0);
        return done(200);
      } catch (e) { return done(500); }
    }
    if (u === '/api/track') return send(200, await track(req, b));
    let tok = String(req.headers['x-kk-s'] || ''), sess = null;
    if (/^[a-f0-9]{32}$/.test(tok)) { const r = await rcmd([['GET', 'kk:s:' + tok]]); sess = parse(r[0]); }
    if (u === '/api/admin/stats') { if (!sess || !sess.admin) fail('Admin login required', 401); return send(200, await stats()); }
    const d = await loadDB();
    if (!sess) { tok = crypto.randomBytes(16).toString('hex'); sess = { me: '', admin: false }; }
    const before = JSON.stringify(sess);
    const C = { d, me: sess.me || '', admin: !!sess.admin, setMe(m) { sess.me = m; this.me = m; }, setAdmin(v) { sess.admin = v; this.admin = v; } };
    let out = await extra(u, b, C, req);
    if (out === undefined) out = await route(u, b, C);
    settleCashback(d);
    await commit(d);
    const cmds = [];
    if (JSON.stringify(sess) !== before) cmds.push(['SET', 'kk:s:' + tok, JSON.stringify(sess), 'EX', 2592000]);
    if (cmds.length) await rcmd(cmds);
    res.setHeader('x-kk-s', tok);
    return send(200, out === undefined ? { ok: 1 } : out);
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : (e.user ? 400 : 500);
    if (code === 500) console.error(e);
    return send(code, { error: e.user || code === 404 ? e.message : 'Server error. Please try again.' });
  }
};
