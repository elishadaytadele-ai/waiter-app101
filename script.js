/* Firebase + booking form script */
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
const db = firebase.firestore();

// Theme: simple light/dark with persistence
function applyTheme(theme){
  if(theme === 'dark') document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('themeToggle');
  if(btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function initTheme(){
  const saved = localStorage.getItem('wa_theme');
  if(saved){ applyTheme(saved); return; }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}
function toggleTheme(){
  const active = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = active === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('wa_theme', next);
}

// Booking form handling
function showMsg(text, type='success'){
  const el = document.getElementById('msg');
  if(!el) return;
  el.textContent = text;
  el.className = 'msg ' + (type==='error' ? 'error' : 'success');
  setTimeout(()=>{ el.textContent=''; el.className='msg'; }, 5000);
}

async function submitBooking(ev){
  ev.preventDefault();
  const name = document.getElementById('customerName').value.trim();
  const minutes = Number(document.getElementById('minutes').value || 0);
  if(!name){ showMsg('Please enter your name', 'error'); return; }
  if(!minutes || minutes < 1){ showMsg('Please enter minutes (>=1)', 'error'); return; }
  const doc = {
    customerName: name,
    minutes: minutes,
    serviceType: 'Wait in line',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  try{
    await db.collection('bookings').add(doc);
    showMsg('Booking submitted — thank you!', 'success');
    document.getElementById('bookingForm').reset();
  }catch(err){
    console.error('Firestore error:', err);
    showMsg('Failed to submit booking', 'error');
  }
}

// Add a single sample booking on first run (so Firestore collection contains test data)
async function addSampleBookingOnce(){
  try{
    if(localStorage.getItem('wa_sample_added')) return;
    await db.collection('bookings').add({
      customerName: 'Test',
      minutes: 15,
      serviceType: 'Wait in line',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    localStorage.setItem('wa_sample_added','1');
    console.log('Sample booking added');
  }catch(err){
    console.warn('Could not add sample booking (offline or permissions):', err);
  }
}

// Live updates: print all bookings to console
function subscribeBookings(){
  try{
    db.collection('bookings').orderBy('timestamp','desc').onSnapshot(snapshot=>{
      const items = [];
      snapshot.forEach(doc=>{
        items.push(Object.assign({id:doc.id}, doc.data()));
      });
      console.log('Bookings (live):', items);
    }, err => console.error('Snapshot error', err));
  }catch(err){
    console.warn('subscribeBookings failed', err);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  initTheme();
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  const form = document.getElementById('bookingForm');
  form?.addEventListener('submit', submitBooking);
  document.getElementById('resetBtn')?.addEventListener('click', ()=> form?.reset());
  // attempt to add a sample booking (only once)
  addSampleBookingOnce();
  // subscribe to live updates and log bookings
  subscribeBookings();
  console.log('JavaScript loaded — Firebase initialized');
});
