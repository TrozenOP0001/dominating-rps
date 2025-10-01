// --- STATE & STORAGE ---
const STORAGE_KEY = 'dominating_rps_save_v3';
let state = {
  userScore: 0,
  cpuScore: 0,
  games: 0,
  credits: 0,
  shards: 0,
  streak: 0,
  level: 1,
  xp: 0,
  xpNext: 100,
  powerUps: {},
  achievements: {},
  daily: { lastClaim: null, streak: 0 },
  leaderboard: [],
  lastRound: null
};

let musicOn = false;

// --- AUDIO ---
let audioCtx = null;
function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSfx(type) {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    if (type === 'win') o.frequency.value = 880;
    if (type === 'lose') o.frequency.value = 220;
    if (type === 'click') o.frequency.value = 440;
    g.gain.value = 0.0001;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
    setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, 250);
  } catch (e) { }
}

// --- CANVAS FX ---
let canvas = null, ctx = null, particles = [];
function resizeCanvas() { if (!canvas) return; canvas.width = innerWidth; canvas.height = innerHeight; }
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
function colorFromPalette(idx) {
  const pal = [[126, 231, 255], [202, 167, 255], [126, 240, 138], [255, 160, 120], [255, 110, 180]];
  return { r: pal[idx % pal.length][0], g: pal[idx % pal.length][1], b: pal[idx % pal.length][2] };
}

// --- UTILITIES ---
const $ = id => document.getElementById(id);

// --- LOAD/SAVE ---
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) state = Object.assign(state, JSON.parse(raw));
  renderAll();
}

// --- GAMEPLAY ---
function randChoice() { return ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)]; }
function cmp(a, b) {
  if (a === b) return 'tie';
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 'win';
  return 'lose';
}

function playRound(choice) {
  playSfx('click');
  const cpu = randChoice();
  const result = cmp(choice, cpu);
  if (result === 'win') { state.userScore++; spawnParticles(innerWidth / 2, innerHeight / 2, colorFromPalette(0), 20); playSfx('win'); }
  else if (result === 'lose') { state.cpuScore++; spawnParticles(innerWidth / 2, innerHeight / 2, colorFromPalette(4), 15); playSfx('lose'); }
  state.games++;
  state.streak = (result === 'win') ? state.streak + 1 : 0;
  state.lastRound = { user: choice, cpu, result, time: Date.now() };
  renderAll();
  save();
}

// --- BUTTONS ---
function setupButtons() {
  ['Rock', 'Paper', 'Scissors'].forEach(c => {
    $(`btn${c}`).addEventListener('click', () => playRound(c.toLowerCase()));
  });
  $('startBtn').addEventListener('click', () => {
    $('splash').style.display = 'none';
    $('gameRoot').style.display = 'grid';
    if (musicOn) playSfx('click');
  });
  $('musicBtn').addEventListener('click', () => { musicOn = !musicOn; $('musicBtn').innerText = musicOn ? 'Music: On' : 'Music: Off'; });
}

// --- RENDER ---
function renderAll() {
  $('userScore').innerText = state.userScore;
  $('cpuScore').innerText = state.cpuScore;
  $('games').innerText = state.games;
  $('streak').innerText = state.streak;
  $('level').innerText = state.level;
  $('xp').innerText = state.xp;
  $('xpNext').innerText = state.xpNext;
  $('xpfill').style.width = Math.min(100, (state.xp / state.xpNext) * 100) + '%';
}

// --- INIT ---
function init() {
  canvas = $('fxCanvas'); ctx = canvas.getContext('2d'); resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  fxLoop();
  setupButtons();
  load();
}

window.onload = init;function fxLoop(){ if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.dx; p.y+=p.dy; p.dy+=0.12; p.life--; const alpha = Math.max(0,p.life/p.ttl); ctx.fillStyle=`rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,alpha*4),0,Math.PI*2); ctx.fill(); if(p.life<=0) particles.splice(i,1); } requestAnimationFrame(fxLoop); }
function colorFromPalette(idx){ const pal=[[126,231,255],[202,167,255],[126,240,138],[255,160,120],[255,110,180]]; return pal[idx%pal.length]; }

// --- UTILITIES ---
const $=id=>document.getElementById(id);
function safeInt(n){ return Math.max(0,Math.floor(Number(n)||0)); }

// --- LOAD/SAVE ---
function load(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw){ const parsed=JSON.parse(raw); state=Object.assign({},state,parsed); state.powerUps=Object.assign({},state.powerUps,parsed.powerUps||{}); state.achievements=Object.assign({},state.achievements||{}); state.leaderboard=parsed.leaderboard||state.leaderboard; } }catch(e){ console.error(e); } renderAll(); }
function save(){ try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }catch(e){ console.error(e); } }

// --- GAMEPLAY ---
function randChoice(){ return ['rock','paper','scissors'][Math.floor(Math.random()*3)]; }
function cmp(a,b){ if(a===b) return 'tie'; if((a==='rock'&&b==='scissors')||(a==='paper'&&b==='rock')||(a==='scissors'&&b==='paper')) return 'win'; return 'lose'; }
function losingTo(choice){ if(choice==='rock') return 'paper'; if(choice==='paper') return 'scissors'; return 'rock'; }

function playRound(choice){
  playSfx('click');
  const cpu=randChoice();
  let result=cmp(choice,cpu);
  if(result==='win'){ state.userScore+=1; spawnParticles(innerWidth/2,innerHeight/2,colorFromPalette(0),20); playSfx('win'); }
  else if(result==='lose'){ state.cpuScore+=1; spawnParticles(innerWidth/2,innerHeight/2,colorFromPalette(4),15); playSfx('lose'); }
  state.games+=1; state.streak=result==='win'?state.streak+1:0; renderAll();
  state.lastRound={user:choice,cpu,result,time:Date.now()};
}

// --- BUTTONS ---
const btnRock=$('btnRock'); const btnPaper=$('btnPaper'); const btnScissors=$('btnScissors');
const buttons=[btnRock,btnPaper,btnScissors];
buttons.forEach(btn=>{ btn.addEventListener('click',()=>playRound(btn.dataset.choice)); });

// --- RENDER ---
function renderAll(){
  $('userScore').innerText=state.userScore;
  $('cpuScore').innerText=state.cpuScore;
  $('games').innerText=state.games;
  $('streak').innerText=state.streak;
  $('level').innerText  renderShop();
  renderAchievements();
  initParticles();
  animateParticles();
});

// --- Music Toggle ---
document.getElementById('musicBtn').addEventListener('click',()=>{
  musicOn=!musicOn;
  document.getElementById('musicBtn').innerText=musicOn?'Music: On':'Music: Off';
  if(musicOn) musicAudio.play(); else musicAudio.pause();
});

// --- Tabs ---
Object.keys(tabs).forEach(id=>{
  document.getElementById(id).addEventListener('click',()=>{
    Object.keys(tabs).forEach(k=>{
      document.getElementById(k).classList.remove('active');
      tabs[k].style.display='none';
    });
    document.getElementById(id).classList.add('active');
    tabs[id].style.display='flex';
  });
});

// --- Play Round ---
buttons.forEach(btn=>{
  btn.addEventListener('click',()=>playRound(btn.dataset.choice));
});

function playRound(userChoice){
  const choices=['rock','paper','scissors'];
  const cpuChoice=choices[Math.floor(Math.random()*3)];
  let result='';
  
  if(userChoice===cpuChoice) result='Draw';
  else if(
    (userChoice==='rock' && cpuChoice==='scissors') ||
    (userChoice==='paper' && cpuChoice==='rock') ||
    (userChoice==='scissors' && cpuChoice==='paper')
  ) result='Win';
  else result='Lose';
  
  updateState(result);
  displayResult(result,userChoice,cpuChoice);
  checkAchievements();
  spawnParticles(result); // trigger particles
}

// --- Update State ---
function updateState(result){
  state.games++;
  if(result==='Win'){state.userScore++; state.streak++; state.credits+=10; state.shards+=1; state.xp+=20;}
  else if(result==='Lose'){state.cpuScore++; state.streak=0;}
  else{state.xp+=5;}
  
  if(state.xp>=state.xpNext){
    state.level++; state.xp-=state.xpNext; state.xpNext+=50;
  }
  
  updateUI();
}

function updateUI(){
  document.getElementById('userScore').innerText=state.userScore;
  document.getElementById('cpuScore').innerText=state.cpuScore;
  document.getElementById('games').innerText=state.games;
  document.getElementById('credits').innerText=state.credits;
  document.getElementById('shards').innerText=state.shards;
  document.getElementById('streak').innerText=state.streak;
  document.getElementById('level').innerText=state.level;
  document.getElementById('xp').innerText=state.xp;
  document.getElementById('xpNext').innerText=state.xpNext;
  xpFill.style.width=Math.min(100,(state.xp/state.xpNext*100))+'%';
  walletCredits.innerText=state.credits;
  walletShards.innerText=state.shards;
  displayLevel.innerText=state.level;
}

// --- Display Result ---
function displayResult(result,user,cpu){
  resultTitle.innerText=result==='Win'?'You Win!':result==='Lose'?'You Lose':'Draw';
  resultSub.innerText=`You: ${user.toUpperCase()} • CPU: ${cpu.toUpperCase()} • Streak: ${state.streak} • Level: ${state.level}`;
}

// --- Shop Items ---
const creditsItems=[
  {name:'Double Points',cost:50},
  {name:'Extra Life',cost:100}
];

const shardsItems=[
  {name:'Golden Skin',cost:10},
  {name:'Mystery Box',cost:20}
];

function renderShop(){
  shopCredits.innerHTML='';
  creditsItems.forEach((item,i)=>{
    const div=document.createElement('div');
    div.className='shop-item';
    div.innerHTML=`<span>${item.name}</span><button>Buy ${item.cost}</button>`;
    div.querySelector('button').addEventListener('click',()=>{
      if(state.credits>=item.cost){state.credits-=item.cost; alert(item.name+' bought!'); updateUI();}
      else alert('Not enough credits');
    });
    shopCredits.appendChild(div);
  });
  
  shopShards.innerHTML='';
  shardsItems.forEach(item=>{
    const div=document.createElement('div');
    div.className='shop-item';
    div.innerHTML=`<span>${item.name}</span><button>Buy ${item.cost}</button>`;
    div.querySelector('button').addEventListener('click',()=>{
      if(state.shards>=item.cost){state.shards-=item.cost; alert(item.name+' bought!'); updateUI();}
      else alert('Not enough shards');
    });
    shopShards.appendChild(div);
  });
}

// --- Achievements ---
const achievements=[
  {name:'First Win',check:()=>state.userScore>=1},
  {name:'Win 5 Games',check:()=>state.userScore>=5},
  {name:'High Roller',check:()=>state.credits>=200}
];

function renderAchievements(){
  shopAch.innerHTML='';
  achievements.forEach(a=>{
    const div=document.createElement('div');
    div.className='ach';
    div.innerHTML=`<span>${a.name}</span><span>${state.achievements[a.name]?'✅':'❌'}</span>`;
    shopAch.appendChild(div);
  });
}

function checkAchievements(){
  achievements.forEach(a=>{
    if(a.check() && !state.achievements[a.name]) state.achievements[a.name]=true;
  });
  renderAchievements();
}

// --- Save/Load ---
document.getElementById('exportBtn').addEventListener('click',()=>{
  const save=JSON.stringify(state);
  navigator.clipboard.writeText(save).then(()=>alert('Save copied!'));
});

document.getElementById('importBtn').addEventListener('click',()=>{
  const save=prompt('Paste your save:');
  if(save){state=JSON.parse(save); updateUI(); renderAchievements();}
});

// --- Daily Reward ---
document.getElementById('claimDaily').addEventListener('click',()=>{
  const today=new Date().toDateString();
  if(state.lastDaily!==today){
    state.credits+=50; state.shards+=5; state.dailyStreak++;
    state.lastDaily=today;
    alert('Daily reward claimed!');
    updateUI();
  } else alert('Daily reward already claimed today!');
});

// --- FX Canvas Particles ---
const canvas = document.getElementById('fxCanvas');
const ctx = canvas.getContext('2d');
let particles=[];

function initParticles(){
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  window.addEventListener('resize',()=>{canvas.width=window.innerWidth; canvas.height=window.innerHeight;});
}

function spawnParticles(type){
  const count=type==='Win'?20:type==='Lose'?10:5;
  for(let i=0;i<count;i++){
    particles.push({
      x:Math.random()*canvas.width,
      y:Math.random()*canvas.height,
      vx:(Math.random()-0.5)*4,
      vy:(Math.random()-0.5)*4,
      size:2+Math.random()*3,
      color:type==='Win'?'#7ef08a':type==='Lose'?'#ff7a7a':'#7ee7ff',
      alpha:1
    });
  }
}

function animateParticles(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.alpha-=0.02;
    ctx.fillStyle=`rgba(${hexToRgb(p.color)},${p.alpha})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    if(p.alpha<=0) particles.splice(i,1);
  }
  requestAnimationFrame(animateParticles);
}

function hexToRgb(hex){
  hex=hex.replace('#','');
  const bigint=parseInt(hex,16);
  const r=(bigint>>16)&255;
  const g=(bigint>>8)&255;
  const b=bigint&255;
  return `${r},${g},${b}`;
       }ringify(state)); }catch(e){ console.error('save err',e); } }

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
