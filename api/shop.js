// KK Best Product - shared shop backend for Vercel (api/shop.js)
// Needs an Upstash Redis database (Vercel > Storage > Upstash Redis). It adds
// KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN) automatically.
const crypto = require('crypto');
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const HASHES = ['users', 'addrs', 'orders', 'products', 'supplier', 'reviews', 'support', 'LOT', 'LTK', 'rl'];
const SHARED = ['products', 'supplier', 'reviews', 'support'];
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
const pubSettings = s => { const { pwh, pass, ...p } = s; return p; };
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
   const o={id:++d.seq,t:Date.now(),pid:p.id,pname:p.name,img:p.img,rpol:p.rpol,size:i.size||'',qty:q,total:e.price*q,pay:ON?'Online (UPI)':'COD',pst:ON?'Verifying':undefined,status:'New',name:a.name,phone:a.phone,house:a.house,road:a.road||'',pin:a.pin,city:a.city||'',state:a.state||'',loc:b.loc||null,maplink:b.maplink||'',cust:me?me.mobile:'',grp:g,tk};d.orders.push(o);ids.push(o.id)});let upi;if(ON){const os=d.orders.filter(o=>ids.includes(o.id)),sub=os.reduce((t,o)=>t+o.total,0),off=Math.min(+S.onlineOff||0,Math.max(0,sub-1));os[0].total-=off;upi={pa:S.upi,pn:S.upiName||S.shop||'Shop',am:sub-off,tn:'Order '+ids.join(',')}}sv();return upi?{ids,token:tk,upi}:{ids,token:tk}}
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
      const out = { ver: cur, admin: isAdm, products: sortP(Object.values(d.products).filter(Boolean)), reviews: Object.values(d.reviews).filter(Boolean), settings: pubSettings(S), support };
      if (isAdm) out.supplier = Object.values(d.supplier).filter(Boolean);
      return out;
    }
    case '/api/store': {
      const c = String(b.c || ''), id = String(b.id || ''), op = b.op;
      if (!['products', 'supplier', 'reviews', 'support'].includes(c) || !id || id.length > 80) fail('Bad request');
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
      d.settings = { ...n, pwh: S.pwh || '' }; return { ok: 1 };
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
    case '/api/verify': case '/api/failed': return { ok: 1 };
  }
  return undefined;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, o) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  try {
    const q = new URL(req.url || '/', 'http://x'); const u = (q.searchParams.get('route') || q.pathname).split('?')[0].replace(/\/+$/, '') || '/';
    let b = req.body; if (typeof b === 'string') b = parse(b); if (!b || typeof b !== 'object') b = {};
    const d = await loadDB();
    let tok = String(req.headers['x-kk-s'] || ''), sess = null;
    if (/^[a-f0-9]{32}$/.test(tok)) { const r = await rcmd([['GET', 'kk:s:' + tok]]); sess = parse(r[0]); }
    if (!sess) { tok = crypto.randomBytes(16).toString('hex'); sess = { me: '', admin: false }; }
    const before = JSON.stringify(sess);
    const C = { d, me: sess.me || '', admin: !!sess.admin, setMe(m) { sess.me = m; this.me = m; }, setAdmin(v) { sess.admin = v; this.admin = v; } };
    let out = await extra(u, b, C, req);
    if (out === undefined) out = await route(u, b, C);
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
