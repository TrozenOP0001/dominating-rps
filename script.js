/* script.js — gameplay, shops, audio, particles, save/load for dominating-rps */
const STORAGE_KEY = 'dominating_rps_save_v1';
let musicOn = true;
let state = {
  userScore:0,cpuScore:0,games:0,credits:0,shards:0,streak:0,level:1,xp:0,xpNext:100,
  powerUps:{doublePoints:0,triplePoints:0,shield:0,extraLife:0,instantWin:0,predictor:0,timeFreeze:0,ultimateStreak:0,criticalStrike:0,rewind:0},
  achievements:{}, daily:{lastClaim:null,streak:0}, leaderboard:[], lastRound:null, ownedShardShop:{}
};

// Audio via WebAudio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx=null, bgOsc=null, bgGain=null;
function ensureAudio(){ if(!audioCtx) audioCtx = new AudioCtx(); }
function playSfx(type){
  try{
    ensureAudio();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    if(type==='win'){ o.type='sine'; o.frequency.value=880; }
    else if(type==='lose'){ o.type='sawtooth'; o.frequency.value=220; }
    else if(type==='click'){ o.type='triangle'; o.frequency.value=440; }
    else if(type==='level'){ o.type='sine'; o.frequency.value=1200; }
    g.gain.value = 0.0001; o.start();
    g.gain.exponentialRampToValueAtTime(0.12,audioCtx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+0.22);
    setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); },250);
  }catch(e){}
}
function startBgMusic(){
  try{
    ensureAudio();
    if(bgOsc) return;
    bgOsc = audioCtx.createOscillator(); bgOsc.type='sine'; bgOsc.frequency.value=110;
    bgGain = audioCtx.createGain(); bgGain.gain.value = 0.02;
    bgOsc.connect(bgGain); bgGain.connect(audioCtx.destination); bgOsc.start();
  }catch(e){}
}
function stopBgMusic(){ try{ if(bgOsc){ bgOsc.stop(); bgOsc.disconnect(); bgGain.disconnect(); bgOsc=null; bgGain=null; } }catch(e){} }
function toggleMusic(){ musicOn = !musicOn; if(musicOn) startBgMusic(); else stopBgMusic(); $('musicBtn').innerText = musicOn? 'Music: On':'Music: Off'; save(); }

// Canvas FX
let fxCanvas = null; let ctx = null; let particles = [];
function resizeCanvas(){ if(!fxCanvas) return; fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; }
function spawnParticles(x,y,color,count=18){ for(let i=0;i<count;i++){ particles.push({x,y,dx:(Math.random()-0.5)*6,dy:(Math.random()-0.9)*6,life:60+Math.random()*30,ttl:60+Math.random()*30,color}); } }
function fxLoop(){ if(!ctx) return; ctx.clearRect(0,0,fxCanvas.width,fxCanvas.height); for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.dx; p.y+=p.dy; p.dy+=0.12; p.life--; const alpha = Math.max(0, p.life/p.ttl); ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,alpha*4),0,Math.PI*2); ctx.fill(); if(p.life<=0) particles.splice(i,1); } requestAnimationFrame(fxLoop); }
function colorFromPalette(idx){ const pal=[[126,231,255],[202,167,255],[126,240,138],[255,160,120],[255,110,180]]; return pal[idx%pal.length]; }

// utilities
const $ = id=>document.getElementById(id);
function safeInt(n){ return Math.max(0, Math.floor(Number(n)||0)); }

// load/save
function load(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ const parsed = JSON.parse(raw); state = Object.assign({}, state, parsed); state.powerUps = Object.assign({}, state.powerUps, parsed.powerUps || {}); state.achievements = Object.assign({}, state.achievements || {}); state.leaderboard = parsed.leaderboard || state.leaderboard; } }catch(e){ console.error('load err',e); } renderAll(); }
function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ console.error('save err',e); } }

// [Game logic, shops, achievements, daily rewards, etc.] 
// -- Keep your existing functions like playerMove(), applyWin(), renderShops(), grantAchievement(), claimDaily(), renderAll(), rewindLast() --
// -- No changes needed here, just make sure fxCanvas variable is not re-declared --

// Splash / Start button handling
const SPLASH_TIPS = [
  "💡 Tip: Use Predictor to nudge the CPU into losing.",
  "🔥 Tip: Save Prismatic Shards for premium upgrades.",
  "🎯 Tip: Critical Strike doubles points on your next win.",
  "🛡️ Tip: Shield blocks one loss — keep it for risky rounds.",
  "⏳ Tip: Time Freeze rerolls the CPU if you would lose."
];
let tipInterval = null;
function startTipCycle(){
  const tipEl = $('tip'); if(!tipEl) return;
  let i = 0; tipEl.innerText = SPLASH_TIPS[0];
  tipInterval = setInterval(()=>{ i=(i+1)%SPLASH_TIPS.length; tipEl.innerText=SPLASH_TIPS[i]; },1200);
}
function stopTipCycle(){ if(tipInterval){ clearInterval(tipInterval); tipInterval=null; } }
function startGameFromSplash(){
  const splash = $('splash'); const root = $('gameRoot');
  if(splash) splash.style.display='none';
  if(root) root.style.display='grid';
  stopTipCycle();
  try{ ensureAudio(); if(musicOn) startBgMusic(); $('musicBtn').innerText='Music: On'; }catch(e){}
  renderShops(); renderAchievements(); renderDaily(); renderLeaderboard(); renderAll();
}

// DOMContentLoaded init
document.addEventListener('DOMContentLoaded', ()=>{
  // Canvas
  fxCanvas = $('fxCanvas'); if(fxCanvas){ ctx=fxCanvas.getContext('2d'); resizeCanvas(); fxLoop(); }
  window.addEventListener('resize', resizeCanvas);

  // Buttons
  document.querySelectorAll('.choice-btn').forEach(btn=> btn.addEventListener('click', ()=> playerMove(btn.dataset.choice) ));
  $('musicBtn')?.addEventListener('click', toggleMusic);
  $('exportBtn')?.addEventListener('click', openExporter);
  $('importBtn')?.addEventListener('click', openImporter);
  $('claimDaily')?.addEventListener('click', claimDaily);
  $('submitScore')?.addEventListener('click', promptLeaderboardName);
  $('tabCredits')?.addEventListener('click', ()=> switchShop('credits'));
  $('tabShards')?.addEventListener('click', ()=> switchShop('shards'));
  $('tabAch')?.addEventListener('click', ()=> switchShop('ach'));

  document.addEventListener('keydown', e=>{ if(e.key==='1') playerMove('rock'); if(e.key==='2') playerMove('paper'); if(e.key==='3') playerMove('scissors'); if(e.key==='m') toggleMusic(); if(e.key==='r') rewindLast(); });

  load();
  startTipCycle();

  const startBtn = $('startBtn');
  if(startBtn) startBtn.addEventListener('click', ()=> startGameFromSplash());
  setTimeout(()=>{ const splash=$('splash'); if(splash && splash.style.display!=='none') startGameFromSplash(); },4000);
});  } catch (e) { }
}
function stopBgMusic() { try { if (bgOsc) { bgOsc.stop(); bgOsc.disconnect(); bgGain.disconnect(); bgOsc = null; bgGain = null; } } catch (e) { } }
function toggleMusic() { musicOn = !musicOn; if (musicOn) startBgMusic(); else stopBgMusic(); $('musicBtn')?.innerText = musicOn ? 'Music: On' : 'Music: Off'; save(); }

// --- Canvas / FX ---
let canvas = null, ctx = null;
let particles = [];
function resizeCanvas() { if (!canvas) return; canvas.width = innerWidth; canvas.height = innerHeight; }
window.addEventListener('resize', () => resizeCanvas());
function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, dx: (Math.random() - 0.5) * 6, dy: (Math.random() - 0.9) * 6, life: 60 + Math.random() * 30, ttl: 60 + Math.random() * 30, color });
  }
}
function fxLoop() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx; p.y += p.dy; p.dy += 0.12; p.life--;
    const alpha = Math.max(0, p.life / p.ttl);
    ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, alpha * 4), 0, Math.PI * 2); ctx.fill();
    if (p.life <= 0) particles.splice(i, 1);
  }
  requestAnimationFrame(fxLoop);
}
function colorFromPalette(idx) { const pal = [[126, 231, 255], [202, 167, 255], [126, 240, 138], [255, 160, 120], [255, 110, 180]]; return pal[idx % pal.length]; }

// --- Utilities ---
const $ = id => document.getElementById(id);
function safeInt(n) { return Math.max(0, Math.floor(Number(n) || 0)); }

// --- Load / Save ---
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign({}, state, parsed);
      state.powerUps = Object.assign({}, state.powerUps, parsed.powerUps || {});
      state.achievements = Object.assign({}, state.achievements || {});
      state.leaderboard = parsed.leaderboard || state.leaderboard;
    }
  } catch (e) { console.error('load err', e); }
  renderAll();
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error('save err', e); } }

// --- Gameplay helpers ---
function randChoice() { return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)]; }
function cmp(a, b) { if (a === b) return 'tie'; if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 'win'; return 'lose'; }
function losingTo(choice) { if (choice === 'rock') return 'paper'; if (choice === 'paper') return 'scissors'; return 'rock'; }

// --- Main gameplay ---
function playerMove(choice) {
  playSfx('click'); disableChoices(true); setTimeout(() => disableChoices(false), 300);
  if (state.powerUps.instantWin > 0) { state.powerUps.instantWin--; applyWin(choice, 'instant'); save(); return; }

  let cpu = randChoice();
  if (state.powerUps.predictor > 0 && Math.random() < 0.25) { cpu = losingTo(choice); state.powerUps.predictor--; showTemp('Predictor activated'); }
  let result = cmp(choice, cpu);

  if (result === 'lose' && state.powerUps.timeFreeze > 0) {
    let attempt = 0, nr = result, ncpu = cpu;
    while (attempt < 3 && nr === 'lose') { ncpu = randChoice(); nr = cmp(choice, ncpu); attempt++; }
    cpu = ncpu; result = nr; state.powerUps.timeFreeze--; if (attempt > 0) showTemp('Time Freeze used');
  }

  if (result === 'lose') {
    if (state.powerUps.shield > 0) { state.powerUps.shield--; result = 'blocked'; showTemp('Shield blocked your loss'); }
    else if (state.powerUps.extraLife > 0) { state.powerUps.extraLife--; result = 'saved'; showTemp('Extra Life saved you'); }
  }

  const critArmed = state.powerUps.criticalStrike && state.powerUps.criticalStrikeActive;

  if (result === 'win') {
    let pts = state.powerUps.triplePoints ? 3 : state.powerUps.doublePoints ? 2 : 1;
    if (state.powerUps.ultimateStreak) pts = Math.round(pts * (1 + Math.min(4, state.streak * 0.12)));
    if (critArmed) { pts *= 2; state.powerUps.criticalStrikeActive = false; state.powerUps.criticalStrike--; showTemp('Critical Strike!'); }
    state.userScore += pts; state.credits += 10; state.shards++; state.streak++; state.xp += 20; state.games++;
    spawnParticles(window.innerWidth / 2 + (Math.random() - 0.5) * 200, window.innerHeight / 2 + (Math.random() - 0.5) * 120, colorFromPalette(0), 22); playSfx('win'); grantAchievement('first_win');
  } else if (result === 'lose') {
    state.cpuScore++; state.credits += 3; state.streak = 0; state.xp += 8; state.games++; spawnParticles(window.innerWidth / 2, window.innerHeight / 2, colorFromPalette(4), 10); playSfx('lose');
  } else if (result === 'blocked' || result === 'saved') { state.credits += 6; state.games++; state.xp += 10; playSfx('click'); }
  else { state.credits += 5; state.games++; state.xp += 6; playSfx('click'); }

  while (state.xp >= state.xpNext) { state.xp -= state.xpNext; state.level++; state.xpNext = Math.round(state.xpNext * 1.25); state.shards += 5; playSfx('level'); showTemp('Level up!'); }

  if (state.userScore >= 100) grantAchievement('hundred_points');
  if (state.streak >= 10) grantAchievement('ten_streak');

  state.lastRound = { user: choice, cpu, result, time: Date.now() }; save(); renderAll();
}

function applyWin(choice, reason) {
  state.userScore += 2; state.credits += 10; state.shards += 2; state.xp += 25; state.streak++; state.games++;
  state.lastRound = { user: choice, cpu: 'instant', result: 'win', time: Date.now(), reason };
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, colorFromPalette(1), 30); playSfx('win'); renderAll();
}

// ---
