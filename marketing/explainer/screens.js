/* eslint-disable @typescript-eslint/no-unused-vars -- these helpers are used by the pages that load this script */
// Shared by index.html and christmas.html: the app screens drawn inside the phones, and the animation
// helpers. A page includes the containers these fill (lmark, emark, qr, peas, aPlace, bPlace, aUse, grid,
// aLists, aWish, bWish, aXmas); a page that doesn't show one keeps an empty hidden stand-in.
const $ = id => document.getElementById(id);
const IMG = n => `../../public/places/${n}.webp`;
const MARK = (stroke, fo) => `
  <path class="rays" d="M32 6v7M17 10l3.5 6M47 10l-3.5 6M9 21l6 3M55 21l-6 3" stroke="${stroke}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="lid" d="M14 30 32 23l18 7-18 7z" fill="${stroke}" fill-opacity="${fo}" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path class="box" d="M14 30v17l18 8 18-8V30M32 37v18" stroke="${stroke}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
document.getElementById('lmark').innerHTML = MARK('#f6c65b', .22);
document.getElementById('emark').innerHTML = MARK('#f6c65b', .22);
document.querySelectorAll('.banner .ic').forEach(e => e.innerHTML = `<svg width="30" height="30" viewBox="0 0 64 64">${MARK('#f6c65b', .22)}</svg>`);

// A fixed QR-like pattern for the sticker.
(() => {
  const q = document.getElementById('qr'); let s = 7;
  const finder = (r, c) => (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    s = (s * 9301 + 49297) % 233280;
    let on = s / 233280 > 0.5;
    if (finder(r, c)) { const rr = r % 6, cc = c % 6; on = !(rr === 1 && cc === 1) ; }
    const i = document.createElement('i'); i.style.background = on ? '#15211c' : 'transparent'; q.appendChild(i);
  }
})();
// Peas on the bag.
(() => {
  const p = document.getElementById('peas'); let s = 3;
  for (let k = 0; k < 16; k++) {
    s = (s * 9301 + 49297) % 233280; const a = s / 233280; s = (s * 9301 + 49297) % 233280; const b = s / 233280;
    const d = 24 + Math.round(a * 12); const i = document.createElement('i');
    Object.assign(i.style, { width: d + 'px', height: d + 'px', left: Math.round(((k % 8) / 8) * 170 + b * 8) + 'px', top: Math.round((k < 8 ? 6 : 44) + a * 18) + 'px' });
    p.appendChild(i);
  }
})();

const SB = `<div class="sb w"><span>9:41</span><span class="sbi"><i style="height:6px"></i><i style="height:9px"></i><i style="height:12px"></i><span class="batt"></span></span></div>`;
const SBD = SB.replace('sb w', 'sb');
const ICON = {
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  act: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  hh: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14c2.6 0 4.4 1.4 5 4"/>',
};
const tab = (k, l, on) => `<div class="tab${on ? ' on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>${l}</div>`;
const TABS = (on) => `<div class="tabs">${tab('home', 'Home', on === 'home')}${tab('search', 'Search')}<div class="tab"><div class="addbtn" data-add><svg width="22" height="22" viewBox="0 0 24 24" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div></div>${tab('act', 'Activity')}${tab('hh', 'Household')}</div>`;
const row = (n, s, pill) => `<div class="row"><div><div class="rn">${n}</div><div class="rs">${s}</div></div>${pill || ''}</div>`;
const placeHTML = (id) => `
  <div class="phead" style="background-image:url(${IMG('freezer-wide')})">${SB}<div class="ptitle"><div class="k">Freezer</div><div class="n">Garage freezer</div></div></div>
  <div class="pbody">
    <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#66706b" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>Search the garage freezer</div>
    <div class="chips"><span class="on">All</span><span>Meat</span><span>Veg</span><span>Ready meals</span><span>Sweet</span></div>
    <div class="newwrap" id="${id}New"><div class="row" id="${id}NewRow" style="background:#fff4d6"><div><div class="rn">Garden peas</div><div class="rs">1 pack · 750 g · best before Aug 2027</div></div><span class="pill newp">New</span></div></div>
    ${row('Leg of lamb', '1 · frozen 7 months ago', '<span class="pill soon">Use soon</span>')}
    ${row('Chicken curry', '2 portions · frozen 3 weeks ago')}
    ${row('Blackberries', '500 g · frozen in September')}
    ${row('Vanilla ice cream', '1 tub · best before Mar 2027')}
    ${row('Sausages', '8 · frozen 2 weeks ago')}
  </div>${TABS()}`;
document.getElementById('aPlace').innerHTML = placeHTML('a');
document.getElementById('bPlace').innerHTML = placeHTML('b');

const urow = (img, n, place, cls, label) => `<div class="urow" data-a><img src="${IMG(img)}" alt=""><div class="m"><div class="rn">${n}</div><div class="rs">${place}</div></div><span class="pill ${cls}">${label}</span></div>`;
document.getElementById('aUse').innerHTML = `${SBD}
  <div class="usehead"><h3>Use first</h3><p>Across The Riverside House</p></div>
  <div class="ulist">
    ${urow('fridge', 'Greek yoghurt', 'Kitchen fridge', 'late', 'Use by yesterday')}
    ${urow('fridge', 'Mature cheddar', 'Kitchen fridge', 'soon', 'Use by Sat')}
    ${urow('fridge', 'Free-range eggs', 'Kitchen fridge', 'soon', 'Best before Tue')}
    ${urow('freezer', 'Leg of lamb', 'Garage freezer', 'soon', 'Frozen 7 months')}
    ${urow('pantry', 'Passata', 'Pantry', 'ok', 'Best before Jan')}
    ${urow('freezer', 'Chicken curry', 'Garage freezer', 'ok', 'Frozen 3 weeks')}
    ${urow('pantry', 'Basmati rice', 'Pantry', 'ok', 'Best before 2027')}
  </div>${TABS('home')}`;

const PLACES = [
  ['freezer', 'Garage freezer', '14 things'], ['fridge', 'Kitchen fridge', '22 things'], ['pantry', 'Pantry', '31 things'],
  ['attic', 'Attic', '9 things'], ['shed', 'Garden shed', '17 things'], ['wardrobe', 'Bedroom wardrobe', '12 things'],
];
const GX = 980, GY = 262, GW = 258, GH = 250, GG = 17;
document.getElementById('grid').innerHTML = PLACES.map(([img, n, s], k) =>
  `<div class="gcard abs" data-a id="g${k}" style="left:${GX + (k % 3) * (GW + GG)}px;top:${GY + Math.floor(k / 3) * (GH + GG)}px"><img src="${IMG(img)}" alt=""><div class="gn">${n}</div><div class="gs">${s}</div></div>`).join('');

// Lists, present ideas and Christmas.
const LICON = {
  cart: '<path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11M12 9C10.5 5.5 6.5 4.5 6 7s3 2 6 2c3 0 6.5.5 6-2s-4.5-1.5-6 2"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  tree: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  box: '<path d="M3 8l9-4 9 4-9 4zM3 8v9l9 4 9-4V8M12 12v9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  eye: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7a9.8 9.8 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};
const svgI = (k, c = 'currentColor', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LICON[k]}</svg>`;
const lcard = (icon, n, vis, count) => `<div class="lcard c" data-a><div class="lic">${svgI(icon)}</div><div class="m"><div class="rn">${n}</div><div class="rs">${vis}</div></div>${count ? `<div class="lcount">${count}</div>` : ''}</div>`;
const opt = (id, t, sub) => `<div class="opt" id="${id}"><span class="radio"></span><div><div class="ot">${t}</div><div class="os">${sub}</div></div></div>`;
$('aLists').innerHTML = `${SBD}
  <div class="lhead"><div><h3>Lists</h3><p>Shared with the people you choose</p></div><div class="newbtn" id="newBtn">+ New list</div></div>
  <div class="lbody">
    <div class="lcard c xmas" data-a><div class="lic" style="background:rgba(255,255,255,.14);color:#f6c65b">${svgI('tree')}</div><div class="m"><div class="rn">Christmas</div><div class="rs" style="color:#f3d9d4">Presents, lists and decorations</div></div></div>
    <div class="newwrap" id="lNew"><div class="lcard" id="lNewRow"><div class="lic">${svgI('gift')}</div><div class="m"><div class="rn">Christmas dinner</div><div class="rs">Everyone at home and family</div></div><span class="pill newp">New</span></div></div>
    ${lcard('cart', 'Shopping list', 'Everyone at home', '6')}
    ${lcard('gift', 'Present ideas', "Everyone's wish lists", '')}
    ${lcard('book', 'Book wish lists', 'What everyone wants to read next', '')}
    ${lcard('list', 'Jobs before Gran visits', 'Just you', '3')}
  </div>${TABS()}
  <div class="dim layer" id="aDim" data-a></div>
  <div class="sheet abs" id="aSheet" data-a><div class="grab"></div>
    <div class="disp" style="font-size:22px;font-weight:800">New list</div>
    <div class="fl" style="margin-top:12px">Name</div><div class="fv"><span id="lname"></span></div>
    <div class="fl" style="margin-top:14px">Who can see it?</div>
    ${opt('opt0', 'Just me', 'Nobody else can see it')}
    ${opt('opt1', 'Everyone at home', 'Everyone in The Riverside House')}
    ${opt('opt2', 'Everyone at home and family', 'Family with their own homes too')}
    ${opt('opt3', 'A group I invite', 'Send a link. They see this list only.')}
  </div>`;

const STAR = (cx, cy, R) => { let pts = ''; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * .45 : R; pts += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `; } return `<polygon points="${pts}" fill="#f6e58d"/>`; };
const PIC = {
  marble: `<svg width="50" height="50" viewBox="0 0 50 50"><rect x="7" y="5" width="36" height="41" rx="3" fill="#ecd2aa"/><rect x="7" y="5" width="4" height="41" fill="#c99a62"/><rect x="39" y="5" width="4" height="41" fill="#c99a62"/><path d="M11 15l28 6M11 29l28-6M11 37l28 4" stroke="#a8743f" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="12" r="3.4" fill="#d64545"/><circle cx="33" cy="20" r="3.4" fill="#3d7fd6"/><circle cx="21" cy="34" r="3.4" fill="#f2b632"/></svg>`,
  paint: `<svg width="50" height="50" viewBox="0 0 50 50"><rect x="5" y="11" width="40" height="28" rx="4" fill="#fff" stroke="#d9d4cb" stroke-width="2"/>${['#d64545', '#f2b632', '#4c9a6a', '#3d7fd6', '#8a4fbf', '#e07a3a'].map((c, k) => `<circle cx="${13 + (k % 3) * 12}" cy="${19 + Math.floor(k / 3) * 12}" r="4.2" fill="${c}"/>`).join('')}</svg>`,
  pj: `<svg width="50" height="50" viewBox="0 0 50 50"><path d="M18 7l-11 7 4 8 5-2v23h18V20l5 2 4-8-11-7c-1 3-4 5-7 5s-6-2-7-5z" fill="#4c9a6a"/><path d="M19 27l3-4 3 4 3-4 3 4" stroke="#2f6b50" stroke-width="2.4" fill="none" stroke-linejoin="round"/><circle cx="21" cy="34" r="1.6" fill="#2f6b50"/><circle cx="29" cy="36" r="1.6" fill="#2f6b50"/></svg>`,
  stars: `<svg width="50" height="50" viewBox="0 0 50 50"><rect x="4" y="4" width="42" height="42" rx="7" fill="#22355c"/>${STAR(16, 17, 7)}${STAR(33, 27, 9)}${STAR(17, 36, 5)}${STAR(36, 11, 4)}</svg>`,
  book: `<svg width="50" height="50" viewBox="0 0 50 50"><rect x="11" y="5" width="29" height="40" rx="2" fill="#2c6a6a"/><rect x="11" y="5" width="5" height="40" fill="#1f4d4d"/><rect x="20" y="13" width="15" height="3" rx="1" fill="#f6c65b"/><rect x="20" y="19" width="11" height="2.4" rx="1" fill="#e0f0ee"/><path d="M28 30c-4 0-6 3-6 6h12c0-3-2-6-6-6z" fill="#7fc0a3"/></svg>`,
};
const idea = (pic, title, price, { id = '', mine = false, claimBy = null, added = '' } = {}) => `
  <div class="idea c${claimBy ? ' taken' : ''}" ${id ? `id="${id}"` : ''} data-a><span class="edge"></span><div class="pic">${PIC[pic]}</div>
    <div class="m"><div class="tt">${title}</div><div class="meta"><span class="price">${price}</span>${added ? `<span>${added}</span>` : ''}</div>
    ${claimBy ? `<span class="claim">✓ ${claimBy} is getting this</span>` : ''}${id === 'iNew' ? `<span class="claim" id="claimNew" style="position:absolute;opacity:0">✓ You're getting this</span>` : ''}</div>
    ${mine || claimBy ? '' : `<div class="getb" ${id === 'iNew' ? 'id="getNew"' : ''}>I'm getting<br>this</div>`}</div>`;
$('aWish').innerHTML = `
  <div class="wband">${SB}<div class="wt"><h3>Mia's wish list</h3><p>For Christmas · shared with family</p></div></div>
  <div class="paste" id="paste">${svgI('link', '#66706b', 18)}<span id="pasteT">Add an idea or paste a link</span></div>
  <div class="newwrap" id="wNew">${idea('marble', 'Wooden marble run', '£34', { id: 'iNew' })}</div>
  ${idea('paint', 'Watercolour paint set', '£18')}
  ${idea('pj', 'Dinosaur pyjamas', '£15', { claimBy: 'Grandad' })}
  ${idea('stars', 'Glow-in-the-dark stars', '£8')}
  ${idea('book', 'The Secret Garden', '£7.99')}`;
$('bWish').innerHTML = `
  <div class="wband">${SB}<div class="wt"><h3>Your wish list</h3><p>5 ideas</p></div></div>
  <div class="wnote" id="wnote">${svgI('eye', '#2a2112', 20)}<span>Others can say they're getting something. You won't see what.</span></div>
  ${idea('marble', 'Wooden marble run', '£34', { mine: true, added: 'added by Alex' })}
  ${idea('paint', 'Watercolour paint set', '£18', { mine: true })}
  ${idea('pj', 'Dinosaur pyjamas', '£15', { mine: true })}
  ${idea('stars', 'Glow-in-the-dark stars', '£8', { mine: true })}
  ${idea('book', 'The Secret Garden', '£7.99', { mine: true })}`;

const av = (l, c) => `<span class="av" style="background:${c}">${l}</span>`;
const gi = (lead, n, sub, { col = '', count = '' } = {}) => `<div class="gi">${lead}<div class="m"><div class="n">${n}</div><div class="s" ${col ? `style="color:${col}"` : ''}>${sub}</div></div>${count ? `<div class="lcount" style="font-size:18px">${count}</div>` : ''}</div>`;
const ic = (k, c = '#2f6b50') => `<span class="lic" style="width:32px;height:32px;border-radius:9px;color:${c}">${svgI(k, 'currentColor', 18)}</span>`;
$('aXmas').innerHTML = `<div class="sb" style="background:var(--bg)"><span>9:41</span><span class="sbi"><i style="height:6px"></i><i style="height:9px"></i><i style="height:12px"></i><span class="batt"></span></span></div>
  <div id="xScroll">
    <div class="xhead xs" data-a><h3>Christmas</h3><p>Presents, lists, decorations and room in the freezer, all in one place.</p></div>
    <div class="xs" data-a><div class="sl">Presents</div><div class="grp">
      ${gi(av('M', '#8f2d2d'), 'Mia', "You're getting 1 · 2 of 5 taken", { col: '#2f6b50' })}
      ${gi(av('G', '#22355c'), 'Grandad', '1 of 4 taken')}
      ${gi(av('S', '#2c6a6a'), 'Sam', "Everything's taken", { col: '#2c6a4c' })}
      ${gi(av('A', '#1f4d3d'), 'You', '3 ideas on your list')}
    </div></div>
    <div class="xs" data-a><div class="sl">Lists for the day</div><div class="grp">
      ${gi(ic('gift'), 'Christmas dinner', 'Turkey crown, sprouts, cranberry sauce', { count: '7' })}
      ${gi(ic('list'), 'Christmas Eve jobs', 'Wrap presents, collect the turkey', { count: '2' })}
    </div></div>
    <div class="xs" data-a><div class="sl">Decorations and Christmas things</div><div class="grp">
      ${gi(ic('box', '#b9852d'), 'Decorations box', 'Attic · 24 things')}
      ${gi(ic('tree', '#b9852d'), 'Fairy lights', 'Attic')}
    </div></div>
    <div class="xs" data-a><div class="sl">Make room in the freezer</div><div class="grp">
      ${gi(ic('snow', '#3b6e8f'), 'Leg of lamb', 'Garage freezer · frozen 7 months')}
      ${gi(ic('snow', '#3b6e8f'), 'Blackberries', 'Garage freezer · frozen in September')}
    </div></div>
  </div>${TABS('home')}`;

// ---------- Timeline helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => clamp((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const L = (a, b, x) => a + (b - a) * x;
function S(el, o = 1, x = 0, y = 0, s = 1, r = 0) {
  if (typeof el === 'string') el = $(el);
  el.style.opacity = clamp(o);
  el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  el.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`;
}
// Fade-in [a,a+d], fade-out [b-d2,b]; returns {o, y} for a gentle rise in and lift out.
function win(t, a, b, d = .55, d2 = .4, rise = 40) {
  const i = eo(P(t, a, a + d)), u = eio(P(t, b - d2, b));
  return { o: Math.min(i, 1 - u), y: (1 - i) * rise - u * 30 };
}
// Phone placed by centre point.
function phone(el, o, cx, cy, s = 1, r = 0) { S(el, o, cx - 195, cy - 410, s, r); }
function typed(el, text, x) { $(el).textContent = text.slice(0, Math.round(text.length * clamp(x))); }
function drawMark(svg, t0, t) {
  const box = svg.querySelector('.box'), lid = svg.querySelector('.lid'), rays = svg.querySelector('.rays');
  [box, lid].forEach(p => { p.style.strokeDasharray = 140; p.style.strokeDashoffset = 140 * (1 - eio(P(t, t0, t0 + .8))); });
  lid.style.fillOpacity = .22 * P(t, t0 + .6, t0 + 1);
  rays.style.opacity = P(t, t0 + .8, t0 + 1.0);
  rays.style.transformOrigin = '32px 30px';
  rays.style.transform = `scale(${L(.6, 1, back(P(t, t0 + .8, t0 + 1.3)))})`;
}


// Lists, present ideas and Christmas, on the explainer's clock (christmas.html maps its own clock onto it).
function centreIn(id) {
  let el = $(id), x = el.offsetWidth / 2, y = el.offsetHeight / 2;
  while (el && !el.classList.contains('screen')) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
  return [x, y];
}

function listScreens(t) {
  // Lists, then a new list shared with family.
  S('aLists', t > 43 ? 1 : 0);
  $('aLists').querySelectorAll('.lcard.c').forEach((r, k) => { const x = eo(P(t, 44.1 + k * .12, 44.6 + k * .12)); S(r, x, (1 - x) * 40); });
  const nb = P(t, 45.6, 45.9); $('newBtn').style.transform = `scale(${1 - .08 * Math.sin(nb * Math.PI)})`;
  const sh = eo(P(t, 45.85, 46.3)) * (1 - eio(P(t, 48.4, 48.8)));
  S('aDim', sh); S('aSheet', sh > 0.001 ? 1 : 0, 0, (1 - sh) * 540);
  typed('lname', 'Christmas dinner', P(t, 46.3, 46.95));
  const picked = t > 47.4;
  $('opt0').classList.toggle('on', !picked); $('opt2').classList.toggle('on', picked);
  $('lNew').style.height = 74 * eio(P(t, 48.75, 49.25)) + 'px';
  $('lNewRow').style.background = `rgba(255,244,214,${1 - P(t, 49.6, 50.4)})`;
  // Mia's wish list: paste a link, then say you're getting it.
  S('aWish', P(t, 49.9, 50.3));
  $('aWish').querySelectorAll('.idea.c:not(#iNew)').forEach((r, k) => { const x = eo(P(t, 50.3 + k * .1, 50.8 + k * .1)); S(r, x, (1 - x) * 40); });
  const pt = $('pasteT');
  if (t < 50.95) { pt.textContent = 'Add an idea or paste a link'; pt.style.color = ''; }
  else if (t < 51.45) { pt.textContent = 'https://…/wooden-marble-run'; pt.style.color = '#15211c'; }
  else if (t < 51.95) { pt.textContent = 'Getting the name, price and picture…'; pt.style.color = '#2f6b50'; }
  else { pt.textContent = 'Add an idea or paste a link'; pt.style.color = ''; }
  $('paste').style.boxShadow = t > 50.95 && t < 51.95 ? 'inset 0 0 0 2px #f6c65b' : '';
  $('wNew').style.height = 84 * eio(P(t, 51.9, 52.35)) + 'px';
  const taken = t > 53.1;
  $('iNew').classList.toggle('taken', taken);
  $('getNew').style.opacity = 1 - P(t, 53.0, 53.2);
  $('getNew').style.transform = `scale(${1 - .08 * Math.sin(P(t, 52.85, 53.1) * Math.PI)})`;
  const cl = P(t, 53.15, 53.5); $('claimNew').style.position = cl > 0 ? 'static' : 'absolute';
  S('claimNew', eo(cl), 0, 0, L(.6, 1, back(cl)));
  // Christmas page, scrolling down.
  S('aXmas', P(t, 58.4, 58.85));
  $('aXmas').querySelectorAll('.xs').forEach((r, k) => { const x = eo(P(t, 58.8 + k * .15, 59.3 + k * .15)); S(r, x, 0, (1 - x) * 30); });
  $('xScroll').style.transform = `translateY(${-250 * eio(P(t, 60.6, 63.4))}px)`;
}

