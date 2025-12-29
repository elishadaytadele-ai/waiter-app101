/* Firebase removed — lightweight local/demo storage used instead */
const BOOKINGS_KEY = 'wa_bookings';

function loadLocalBookings(){
  try{ return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]'); }catch(e){ return []; }
}

function saveLocalBooking(b){
  const arr = loadLocalBookings();
  arr.unshift(b);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(arr));
}

function renderLocalHistory(){
  const list = document.getElementById('historyList');
  if(!list) return;
  const items = loadLocalBookings();
  list.innerHTML = '';
  if(items.length===0){ list.appendChild(Object.assign(document.createElement('li'),{textContent:'No previous bookings yet.'})); return; }
  items.forEach(d=>{
    const li = document.createElement('li');
    const when = d.TimeStamp ? new Date(d.TimeStamp).toLocaleString() : '';
    li.textContent = `${d.serviceType || 'Wait in line'} — ${d.Minutes||0}m — ${d.customerName||''} ${when? '— '+when : ''}`;
    list.appendChild(li);
  });
}
// Simple frontend prototype logic for booking, matching, live tracking, and rating
const RATE_PER_MIN = 2;
// Defensive placeholders for inline handlers (avoid "undefined" during early clicks)
if(!window.showScreen) window.showScreen = (...args)=>{ console.warn('showScreen called before init', ...args); };
if(!window.endBooking) window.endBooking = (...args)=>{ console.warn('endBooking called before init', ...args); };
if(!window.setRating) window.setRating = (...args)=>{ console.warn('setRating called before init', ...args); };
if(!window.submitRating) window.submitRating = (...args)=>{ console.warn('submitRating called before init', ...args); };
if(!window.saveProfile) window.saveProfile = (...args)=>{ console.warn('saveProfile called before init', ...args); };
let liveTimerId = null;
let liveSeconds = 0;
let currentBooking = null;
let selectedPaymentMethod = null;

function showScreen(id){
  const duration = 60; // match CSS transition (ms)
  const current = document.querySelector('.screen.active');
  const target = document.getElementById(id);
  if(current && current.id === id) return;
  // animate current out
  if(current){
    current.classList.remove('fade-in');
    current.classList.add('fade-out');
    // keep it active during the fade, then remove
    setTimeout(()=>{
      current.classList.remove('active','fade-out');
    }, duration);
  }
  // animate target in
  if(target){
    // ensure any previous state cleared
    target.classList.remove('fade-out');
    target.classList.add('active','fade-in');
    // cleanup fade-in after animation
    setTimeout(()=>{ target.classList.remove('fade-in'); }, duration);
    // reset scroll
    try{ window.scrollTo(0,0); }catch(e){}
  }
}
function showPaymentOptions(){
  const paymentDiv = document.getElementById('paymentOptions');
  if(!paymentDiv) return;
  const active = document.querySelector('.screen.active');
  // If we're not on the dashboard, navigate there first so the panel is visible
  if(active && active.id !== 'dashboard'){
    showScreen('dashboard');
    // allow the screen transition to complete so the element becomes visible
    setTimeout(()=>{ paymentDiv.style.display = 'block'; }, 120);
  } else {
    paymentDiv.style.display = 'block';
  }
}

function selectPayment(method){
  selectedPaymentMethod = method;

  document.getElementById('paymentOptions').style.display = 'none';
  document.getElementById('proofSection').style.display = 'block';
}

// Booking form interactions
const inputMinutes = () => document.getElementById('inputMinutes');
const inputPurchase = () => document.getElementById('inputPurchase');
function updateEstimate(){
  const mins = Number(inputMinutes().value||0);
  const purchase = Number(inputPurchase().value||0);
  const est = (mins * RATE_PER_MIN) + purchase;
  document.getElementById('estimatedCost').textContent = `${est.toFixed(2)}ETB`;
  document.getElementById('ratePerMin').textContent = `${RATE_PER_MIN.toFixed(2)}ETB`;
}
  document.addEventListener('DOMContentLoaded', () => {restoreLiveState();
  document.getElementById('inputMinutes')?.addEventListener('input',updateEstimate);
  document.getElementById('inputPurchase')?.addEventListener('input',updateEstimate);
  document.getElementById('confirmPrepayBtn')?.addEventListener('click',confirmPrepay);
  document.getElementById('proofInput')?.addEventListener('change',handleProof);
  // theme init
  initTheme();
  document.getElementById('themeToggle')?.addEventListener('click',toggleTheme);
  // menu init
  document.getElementById('menuToggle')?.addEventListener('click',()=>toggleMenu());
  const __backdropInit = document.getElementById('menuBackdrop');
  if(__backdropInit) __backdropInit.style.display = 'none';
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') toggleMenu(false); });
  // ensure menu theme button mirrors main theme
  // (menuThemeToggle removed from menu; top theme toggle remains)
  // render local history (if any)
  renderLocalHistory();
  // update profile UI (avatar initials, booking count, recent bookings)
  if(typeof refreshProfileUI === 'function') refreshProfileUI();
});
function restoreLiveState() {
  const saved = localStorage.getItem('wa_live_state');
  if (!saved) return;

  try {
    const { booking, liveSeconds: savedSeconds, isLive } = JSON.parse(saved);
    if (!isLive || !booking) return;

    currentBooking = booking;
    liveSeconds = savedSeconds;

    startLive(currentBooking);
  } catch (e) {
    console.error('Failed to restore live state', e);
  }
}

// THEME: light/dark toggle with persistence
function applyTheme(theme){
  if(theme==='dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('themeToggle');
  if(btn){
    btn.textContent = theme==='dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', theme==='dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme==='dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  // keep menu button label in sync
  syncMenuThemeButton();
}

function syncMenuThemeButton(){
  const menuBtn = document.getElementById('menuThemeToggle');
  if(!menuBtn) return;
  const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  menuBtn.textContent = active === 'dark' ? 'Switch to light' : 'Switch to dark';
}

function initTheme(){
  const saved = localStorage.getItem('wa_theme');
  if(saved){ applyTheme(saved); return; }
  // fallback to OS preference
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

function toggleTheme(){
  const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = active === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('wa_theme', next);
}

// MENU: open/close mobile menu
function toggleMenu(open){
  const isOpen = document.documentElement.getAttribute('data-menu') === 'open';
  const next = typeof open === 'boolean' ? open : !isOpen;
  const menu = document.getElementById('mobileMenu');
  const toggle = document.getElementById('menuToggle');
  const backdrop = document.getElementById('menuBackdrop');
  if(next){
    document.documentElement.setAttribute('data-menu','open');
    if(toggle) toggle.setAttribute('aria-expanded','true');
    if(menu) menu.setAttribute('aria-hidden','false');
    if(backdrop) backdrop.style.display='block';
  } else {
    document.documentElement.removeAttribute('data-menu');
    if(toggle) toggle.setAttribute('aria-expanded','false');
    if(menu) menu.setAttribute('aria-hidden','true');
    if(backdrop) backdrop.style.display='none';
  }
}

// AUTH: Email/password authentication UI wiring
function initAuthUI(){
  // auth UI removed — login/signup removed from markup per request
}

function confirmPrepay(){
  // proceed without requiring sign-in
  const location = document.getElementById('inputLocation').value || 'Unknown location';
  const task = document.getElementById('inputTask').value;
  const mins = Number(inputMinutes().value||0);
  const purchase = Number(inputPurchase().value||0);
  const prepaid = (mins * RATE_PER_MIN) + purchase;
  // simple prepay check
  if(mins < 5){ alert('Please enter at least 5 minutes'); return; }
  currentBooking = {id:Date.now(),location,task,mins,purchase,prepaid,started:false};
  // show matching screen and simulate waiter found
  document.getElementById('waiterName').textContent = 'Finding...';
  document.getElementById('waiterMeta').textContent = '';
  showScreen('matching');
  // start live timer immediately so user sees time tracked as soon as they confirm
  try{ startLive(currentBooking); }catch(e){console.error('startLive failed',e)}
  // Save booking locally (non-blocking)
  try{
    const bookingRecord = {
      customerName: (document.getElementById('bookingCustomerName')?.value || 'Anonymous'),
      Minutes: Number(mins),
      purchase: Number(purchase),
      prepaid: Number(prepaid),
      TimeStamp: new Date().toISOString(),
      serviceType: task,
      location: location
    };
    saveLocalBooking(bookingRecord);
    const msg = document.getElementById('bookingMsg');
    if(msg){ msg.textContent = 'Booking saved.'; setTimeout(()=>msg.textContent = '',3000); }
    renderLocalHistory();
    if(typeof refreshProfileUI === 'function') refreshProfileUI();
  }catch(err){ console.error('Failed to save booking locally:', err); }
  setTimeout(()=>{
    // fake waiter
    const waiter = {name:'Alex P.',rating:4.8,jobs:142,img:'assets/waiterpfp.jpg'};
    const img = document.querySelector('#matching .waiterCard img');
    if(img) img.src = waiter.img;
    document.getElementById('waiterName').textContent = waiter.name;
    document.getElementById('waiterMeta').textContent = `${waiter.rating} • ${waiter.jobs} jobs`;
    // if user was viewing matching, switch to live view now that waiter found
    startLive(currentBooking);
  },800);
}

function startLive(booking) {
  if (booking.started) return; // prevent double start

  booking.started = true;
  booking.startTs = Date.now();
  liveSeconds = 0;

  showScreen('live');

  // UI
  document.getElementById('liveWaiterName').textContent = 'Alex P.';
  document.getElementById('liveWaiterStatus').textContent = 'Arriving';
  document.getElementById('liveEarning').textContent =
    `Rate: ${RATE_PER_MIN.toFixed(2)}ETB/min`;

  // TIMER (authoritative)
 liveTimerId = setInterval(() => {
  liveSeconds++;
  document.getElementById('liveTimer').textContent =
    formatTime(liveSeconds);
  updateLiveCost();
  persistLiveState();
  if (liveSeconds === 10)
    document.getElementById('liveWaiterStatus').textContent = 'Waiting';
  if (liveSeconds === 30)
    document.getElementById('liveWaiterStatus').textContent = 'Completing';
}, 1000);

  // GEOLOCATION
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        updateWaiterMarker(pos.coords.latitude, pos.coords.longitude);
      },
      err => console.error('Geolocation error:', err),
      { enableHighAccuracy: true }
    );
  }

  // Fix map resize
  setTimeout(() => map?.invalidateSize(), 300);
}
function updateLiveCost(){
  const minutes = liveSeconds / 60;
  const cost =
    (minutes * RATE_PER_MIN) +
    (currentBooking?.purchase || 0);

  document.getElementById('liveCost').textContent =
    `${cost.toFixed(2)}ETB`;
}
function endBooking() {
  // Try to find a proof file input in several places (robust to id mismatches)
  let proofFile = null;
  const proofEl = document.getElementById('proofInput') || document.getElementById('proofInputDashboard') || document.querySelector('#proofSection input[type="file"]');
  if (proofEl && proofEl.files && proofEl.files.length > 0) proofFile = proofEl.files[0];

  if (!selectedPaymentMethod) {
    alert('Select a payment method first.');
    return;
  }

  if (!proofFile) {
    alert('Upload proof first.');
    return;
  }

  // Optional: stop live timer (only if relevant)
  if (liveTimerId) clearInterval(liveTimerId);

  // Calculate final cost
  const totalMinutes = Math.max(1, Math.ceil(liveSeconds / 60));
  const finalCost =
    (totalMinutes * RATE_PER_MIN) +
    (currentBooking?.purchase || 0);

  document.getElementById('finalSummary').textContent =
    `Paid via ${selectedPaymentMethod} — ${finalCost.toFixed(2)}ETB — ${totalMinutes} minute(s)`;

  // Clean up payment UI
  selectedPaymentMethod = null;
  const paymentDiv = document.getElementById('paymentOptions');
  if (paymentDiv) paymentDiv.style.display = 'none';
  const proofSection = document.getElementById('proofSection');
  if (proofSection) proofSection.style.display = 'none';
  const proofInputEl = document.getElementById('proofInput') || document.querySelector('#proofSection input[type="file"]');
  if (proofInputEl) proofInputEl.value = '';

  // Go to completion screen
  showScreen('complete');
}
function showPaymentOptions() {
  const paymentDiv = document.getElementById('paymentOptions');
  const activeBooking = document.getElementById('activeBookingMock');
  if (!paymentDiv) return;

  // Ensure the active booking card is visible so its children can be shown
  if (activeBooking) activeBooking.style.display = 'block';

  const active = document.querySelector('.screen.active');
  if (active && active.id !== 'dashboard') {
    showScreen('dashboard');
    // allow the screen transition to complete before showing the panel
    setTimeout(() => { paymentDiv.style.display = 'block'; }, 140);
  } else {
    paymentDiv.style.display = 'block';
  }
}
function selectPayment(method) {
  selectedPaymentMethod = method;
  document.getElementById('proofSection').style.display = 'block';
}

function addToHistory(entry){
  const list = document.getElementById('historyList');
  const li = document.createElement('li');
  li.textContent = `${entry.task} — ${entry.cost.toFixed(2)}ETB — ${entry.minutes}m`;
  list.prepend(li);
}

function formatTime(s){
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function handleProof(e){
  const file = e.target.files[0];
  if(!file) return;
  // show a tiny thumbnail somewhere — for now, alert name
  alert('Proof uploaded: '+file.name);
}

function setRating(n){
  alert('Rating: '+n+' stars — thanks!');
}

function submitRating(){
  const tip = Number(document.getElementById('tipInput').value||0);
  alert('Thanks — tip: '+tip.toFixed(2)+'ETB');
  showScreen('dashboard');
}

function saveProfile(){
  alert('Profile saved');
  showScreen('dashboard');
}

// Initialize map with a fallback
let map = null;
let waiterMarker = null;
let mapInitialized = false;

function initLiveMap(lat, lng) {
  if (mapInitialized) return;

  map = L.map('mapPlaceholder').setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  waiterMarker = L.marker([lat, lng]).addTo(map);

  mapInitialized = true;

  // Fix partial loading when screen becomes visible
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

function updateWaiterMarker(lat, lng) {
  if (!mapInitialized) {
    initLiveMap(lat, lng);
    return;
  }

  waiterMarker.setLatLng([lat, lng]);
  map.panTo([lat, lng]);
}

function persistLiveState() {
  localStorage.setItem('wa_live_state', JSON.stringify({
    booking: currentBooking,
    liveSeconds,
    isLive: true
  }));
}

// Expose commonly-used functions to the global scope so inline handlers work reliably
window.showScreen = showScreen;
window.confirmPrepay = confirmPrepay;
window.endBooking = endBooking;
window.submitRating = submitRating;
window.saveProfile = saveProfile;
window.setRating = setRating;
window.toggleTheme = toggleTheme;
window.toggleMenu = toggleMenu;

console.log("JavaScript is working");
// Booking interceptor removed — saving now handled inside confirmPrepay().
// Firebase-dependent subscriptions and auth listeners removed.

// Profile UI helpers
function initialsFromName(name){
  if(!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + (parts[1][0]||'')).toUpperCase();
}

function refreshProfileUI(){
  const avatar = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName')?.value || '';
  if(avatar) avatar.textContent = initialsFromName(name) || 'U';
  const bookings = loadLocalBookings();
  const countEl = document.getElementById('bookingCount');
  if(countEl) countEl.textContent = String(bookings.length || 0);
  const recent = document.getElementById('profileRecent');
  if(recent){
    recent.innerHTML = '';
    const slice = bookings.slice(0,5);
    if(slice.length===0){ recent.innerHTML = '<li>No recent bookings.</li>'; }
    slice.forEach(b=>{ const li = document.createElement('li'); li.textContent = `${b.serviceType || 'Wait'} — ${b.Minutes||0}m — ${b.customerName||''}`; recent.appendChild(li); });
  }
  // update avatar live when editing name
  const nameInput = document.getElementById('profileName');
  if(nameInput && !nameInput._profileBound){
    nameInput.addEventListener('input', ()=>{ if(avatar) avatar.textContent = initialsFromName(nameInput.value); });
    nameInput._profileBound = true;
  }
}


