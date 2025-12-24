// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfYtxWYiTOAGDN7-mEM_Vq-LCeNOVx6oQ",
  authDomain: "waiter-app101.firebaseapp.com",
  projectId: "waiter-app101",
  storageBucket: "waiter-app101.firebasestorage.app",
  messagingSenderId: "451129298666",
  appId: "1:451129298666:web:c48799cb276da1f18dd193"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

db.collection("test").add({
  connected: true,
  time: new Date()
})
.then(() => {
  console.log("Firebase connected successfully");
})
.catch((error) => {
  console.error("Firebase error:", error);
});
// Simple frontend prototype logic for booking, matching, live tracking, and rating
const RATE_PER_MIN = 0.5;
// Defensive placeholders for inline handlers (avoid "undefined" during early clicks)
if(!window.showScreen) window.showScreen = (...args)=>{ console.warn('showScreen called before init', ...args); };
if(!window.endBooking) window.endBooking = (...args)=>{ console.warn('endBooking called before init', ...args); };
if(!window.setRating) window.setRating = (...args)=>{ console.warn('setRating called before init', ...args); };
if(!window.submitRating) window.submitRating = (...args)=>{ console.warn('submitRating called before init', ...args); };
if(!window.saveProfile) window.saveProfile = (...args)=>{ console.warn('saveProfile called before init', ...args); };
let liveTimerId = null;
let liveSeconds = 0;
let currentBooking = null;

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
}

// Booking form interactions
const inputMinutes = () => document.getElementById('inputMinutes');
const inputPurchase = () => document.getElementById('inputPurchase');
function updateEstimate(){
  const mins = Number(inputMinutes().value||0);
  const purchase = Number(inputPurchase().value||0);
  const est = (mins * RATE_PER_MIN) + purchase;
  document.getElementById('estimatedCost').textContent = `$${est.toFixed(2)}`;
  document.getElementById('ratePerMin').textContent = `$${RATE_PER_MIN.toFixed(2)}`;
}

document.addEventListener('DOMContentLoaded',()=>{
  updateEstimate();
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
  const mBtn = document.getElementById('menuThemeToggle');
  if(mBtn) mBtn.addEventListener('click',()=>{
    // delay slightly so applyTheme runs first
    setTimeout(syncMenuThemeButton,120);
  });
  // initialize auth UI wiring
  if(typeof initAuthUI === 'function') initAuthUI();
});

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
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const authStatus = document.getElementById('authStatus');
  const bookingSection = document.getElementById('booking');
  const bookNowBtn = document.querySelector('.bookNow');

  // hide booking UI by default until auth state resolved
  if(bookingSection) bookingSection.style.display = 'none';
  if(bookNowBtn) bookNowBtn.style.display = 'none';

  if(loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = (document.getElementById('loginEmail')?.value || '').trim();
      const password = document.getElementById('loginPassword')?.value || '';
      if(!email || !password){ if(authStatus) authStatus.textContent = 'Enter email and password'; return; }
      try{
        await auth.signInWithEmailAndPassword(email, password);
        if(authStatus) authStatus.textContent = 'Logged in as ' + (auth.currentUser?.email || '');
      }catch(err){
        console.error('Login error', err);
        if(authStatus) authStatus.textContent = 'Login failed: ' + (err.message || err);
      }
    });
  }

  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{
    if(authStatus) authStatus.textContent = 'Logged out';
    auth.signOut();
  });

  // Keep UI in sync with auth state
  auth.onAuthStateChanged(user=>{
    if(user){
      if(bookingSection) bookingSection.style.display = 'block';
      if(bookNowBtn) bookNowBtn.style.display = 'inline-block';
      if(loginForm) loginForm.style.display = 'none';
      if(logoutBtn) logoutBtn.style.display = 'inline-block';
      if(authStatus) authStatus.textContent = 'Logged in as ' + user.email;
    } else {
      if(bookingSection) bookingSection.style.display = 'none';
      if(bookNowBtn) bookNowBtn.style.display = 'none';
      if(loginForm) loginForm.style.display = 'block';
      if(logoutBtn) logoutBtn.style.display = 'none';
      if(authStatus) authStatus.textContent = 'Please sign in';
    }
  });
}


function confirmPrepay(){
  // require signed-in user
  if(!auth || !auth.currentUser){
    alert('Please sign in to submit a booking.');
    showScreen('dashboard');
    return;
  }
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
  setTimeout(()=>{
    // fake waiter
    const waiter = {name:'Alex P.',rating:4.8,jobs:142,img:'https://via.placeholder.com/72'};
    document.querySelector('#matching .waiterCard img').src = waiter.img;
    document.getElementById('waiterName').textContent = waiter.name;
    document.getElementById('waiterMeta').textContent = `${waiter.rating} • ${waiter.jobs} jobs`;
  },800);
  // simulate matched -> start live after short delay
  setTimeout(()=>startLive(currentBooking),2500);
}

function startLive(booking){
  booking.started = true;
  booking.startTs = Date.now();
  booking.seconds = 0;
  liveSeconds = 0;
  showScreen('live');
  // populate live UI
  document.getElementById('liveWaiterName').textContent = 'Alex P.';
  document.getElementById('liveWaiterStatus').textContent = 'Arriving';
  document.getElementById('liveEarning').textContent = `Rate: $${RATE_PER_MIN.toFixed(2)}/min`;
  updateLiveCost();
  if(liveTimerId) clearInterval(liveTimerId);
  liveTimerId = setInterval(()=>{
    liveSeconds++;
    document.getElementById('liveTimer').textContent = formatTime(liveSeconds);
    updateLiveCost();
    // update status slightly
    if(liveSeconds===10) document.getElementById('liveWaiterStatus').textContent='Waiting';
    if(liveSeconds===30) document.getElementById('liveWaiterStatus').textContent='Completing';
  },1000);
}

function updateLiveCost(){
  const minutes = liveSeconds/60;
  const cost = (minutes * RATE_PER_MIN) + (currentBooking?.purchase||0) || 0;
  document.getElementById('liveCost').textContent = `$${cost.toFixed(2)}`;
}

function endBooking(finishWithoutPay=false){
  // stop timer and show completion
  if(liveTimerId) clearInterval(liveTimerId);
  const totalMinutes = Math.max(1, Math.ceil(liveSeconds/60));
  const workCost = totalMinutes * RATE_PER_MIN;
  const finalCost = workCost + (currentBooking?.purchase||0);
  document.getElementById('finalSummary').textContent = `Total: $${finalCost.toFixed(2)} — ${totalMinutes} minute(s)`;
  // save to history
  addToHistory({id:currentBooking.id,cost:finalCost,minutes:totalMinutes,task:currentBooking.task});
  showScreen('complete');
}

function addToHistory(entry){
  const list = document.getElementById('historyList');
  const li = document.createElement('li');
  li.textContent = `${entry.task} — $${entry.cost.toFixed(2)} — ${entry.minutes}m`;
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
  alert('Thanks — tip: $'+tip.toFixed(2));
  showScreen('dashboard');
}

function saveProfile(){
  alert('Profile saved');
  showScreen('dashboard');
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

// --- Added: Booking submission integration with Firebase Auth ---
// Intercept confirmPrepay button click early (capture) to enforce auth and save booking
(function(){
  const btn = document.getElementById('confirmPrepayBtn');
  if(!btn) return;
  // guard to avoid double writes
  window.__bookingWriteInProgress = window.__bookingWriteInProgress || false;
  btn.addEventListener('click', async function interceptBooking(e){
    // run during capture so we can stop if not authenticated
    // don't prevent existing UI flow (we will let original handler run afterwards),
    // but enforce auth and save booking to Firestore here.
    try{
      if(!auth || !auth.currentUser){
        e.preventDefault();
        alert('You must be logged in to submit a booking.');
        return;
      }
      if(window.__bookingWriteInProgress) return;
      window.__bookingWriteInProgress = true;

      // collect booking data from existing form fields
      const customerName = auth.currentUser.displayName || auth.currentUser.email || (document.getElementById('profileName')?.value || 'Anonymous');
      const minutes = Number((document.getElementById('inputMinutes')?.value) || 0);
      const serviceType = document.getElementById('inputTask')?.value || 'Wait in line';

      if(!minutes || minutes < 1){
        e.preventDefault();
        alert('Please enter a valid number of minutes.');
        window.__bookingWriteInProgress = false;
        return;
      }

      // write booking to Firestore with required fields
      await db.collection('bookings').add({
        customerName: String(customerName),
        Minutes: Number(minutes),
        TimeStamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: auth.currentUser.uid,
        serviceType: serviceType
      });

      // show simple success feedback (non-invasive)
      try{ alert('Booking saved successfully.'); }catch(e){ console.log('Booking saved'); }

    }catch(err){
      console.error('Error saving booking:', err);
      try{ alert('Failed to save booking: ' + (err.message || err)); }catch(e){ }
    }finally{
      window.__bookingWriteInProgress = false;
    }
  }, {capture:true});
})();

// --- Optional: display bookings for current user in `#historyList` ---
(function(){
  let unsubscribeUserBookings = null;

  function clearHistoryList(){
    const list = document.getElementById('historyList');
    if(!list) return;
    list.innerHTML = '';
  }

  function renderBookingsSnapshot(snapshot){
    const list = document.getElementById('historyList');
    if(!list) return;
    list.innerHTML = '';
    if(snapshot.empty){
      const li = document.createElement('li'); li.textContent = 'No previous bookings yet.'; list.appendChild(li); return;
    }
    snapshot.forEach(doc=>{
      const d = doc.data();
      const minutes = d.Minutes || d.minutes || 0;
      const when = d.TimeStamp && d.TimeStamp.toDate ? d.TimeStamp.toDate().toLocaleString() : '';
      const li = document.createElement('li');
      li.textContent = `${d.serviceType || 'Wait in line'} — ${minutes}m — ${d.customerName || ''} ${when ? '— ' + when : ''}`;
      list.appendChild(li);
    });
  }

  // subscribe to bookings for a user id
  function subscribeUserBookings(uid){
    if(unsubscribeUserBookings) unsubscribeUserBookings();
    try{
      unsubscribeUserBookings = db.collection('bookings')
        .where('userId','==',uid)
        .orderBy('TimeStamp','desc')
        .onSnapshot(renderBookingsSnapshot, err => console.error('bookings snapshot error', err));
    }catch(err){
      console.warn('Could not subscribe to user bookings:', err);
      unsubscribeUserBookings = null;
    }
  }

  // hook into auth state to subscribe/unsubscribe
  if(auth && typeof auth.onAuthStateChanged === 'function'){
    auth.onAuthStateChanged(user=>{
      if(user){ subscribeUserBookings(user.uid); }
      else { if(unsubscribeUserBookings) unsubscribeUserBookings(); clearHistoryList(); const li = document.createElement('li'); li.textContent='No previous bookings yet.'; document.getElementById('historyList')?.appendChild(li); }
    });
  }

})();
