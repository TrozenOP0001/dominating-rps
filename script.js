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
  }catch(e){ /* audio blocked */ }
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
const canvas = $('fxCanvas'); const ctx = canvas.getContext('2d'); let particles=[];
function resizeCanvas(){ canvas.width = innerWidth; canvas.height = innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
function spawnParticles(x,y,color,count=18){ for(let i=0;i<count;i++){ particles.push({x,y,dx:(Math.random()-0.5)*6,dy:(Math.random()-0.9)*6,life:60+Math.random()*30,ttl:60+Math.random()*30,color}); } }
function fxLoop(){ ctx.clearRect(0,0,canvas.width,canvas.height); for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.dx; p.y+=p.dy; p.dy+=0.12; p.life--; const alpha = Math.max(0, p.life/ p.ttl); ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,alpha*4),0,Math.PI*2); ctx.fill(); if(p.life<=0) particles.splice(i,1); } requestAnimationFrame(fxLoop); } fxLoop();
function colorFromPalette(idx){ const pal=[[126,231,255],[202,167,255],[126,240,138],[255,160,120],[255,110,180]]; return pal[idx%pal.length]; }

// utilities
const $ = id=>document.getElementById(id);
function safeInt(n){ return Math.max(0, Math.floor(Number(n)||0)); }

// load/save
function load(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ const parsed = JSON.parse(raw); state = Object.assign({}, state, parsed); state.powerUps = Object.assign({}, state.powerUps, parsed.powerUps || {}); state.achievements = Object.assign({}, state.achievements || {}); state.leaderboard = parsed.leaderboard || state.leaderboard; } }catch(e){ console.error('load err',e); } renderAll(); }
function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ console.error('save err',e); } }

// gameplay helpers
function randChoice(){ return ['rock','paper','scissors'][Math.floor(Math.random()*3)]; }
function cmp(a,b){ if(a===b) return 'tie'; if((a==='rock'&&b==='scissors')||(a==='paper'&&b==='rock')||(a==='scissors'&&b==='paper')) return 'win'; return 'lose'; }
function losingTo(choice){ if(choice==='rock') return 'paper'; if(choice==='paper') return 'scissors'; return 'rock'; }

// gameplay main
function playerMove(choice){ playSfx('click'); disableChoices(true); setTimeout(()=>disableChoices(false),300);
  if(state.powerUps.instantWin>0){ state.powerUps.instantWin = Math.max(0, state.powerUps.instantWin-1); applyWin(choice,'instant'); save(); return; }
  let cpu = randChoice();
  if(state.powerUps.predictor>0 && Math.random()<0.25){ cpu = losingTo(choice); state.powerUps.predictor = Math.max(0, state.powerUps.predictor-1); showTemp('Predictor activated'); }
  let result = cmp(choice,cpu);
  if(result==='lose' && state.powerUps.timeFreeze>0){ let attempt=0; let nr=result; let ncpu=cpu; while(attempt<3 && nr==='lose'){ ncpu = randChoice(); nr = cmp(choice,ncpu); attempt++; } cpu = ncpu; result = nr; state.powerUps.timeFreeze = Math.max(0, state.powerUps.timeFreeze-1); if(attempt>0) showTemp('Time Freeze used'); }
  if(result==='lose'){ if(state.powerUps.shield>0){ state.powerUps.shield = Math.max(0, state.powerUps.shield-1); result='blocked'; showTemp('Shield blocked your loss'); } else if(state.powerUps.extraLife>0){ state.powerUps.extraLife = Math.max(0, state.powerUps.extraLife-1); result='saved'; showTemp('Extra Life saved you'); } }
  const critArmed = state.powerUps.criticalStrike && state.powerUps.criticalStrikeActive;
  if(result==='win'){ let pts=1; if(state.powerUps.triplePoints) pts=3; else if(state.powerUps.doublePoints) pts=2; if(state.powerUps.ultimateStreak) pts = Math.round(pts * (1 + Math.min(4, state.streak * 0.12))); if(critArmed){ pts *= 2; state.powerUps.criticalStrikeActive=false; state.powerUps.criticalStrike = Math.max(0,state.powerUps.criticalStrike-1); showTemp('Critical Strike!'); } state.userScore = safeInt(state.userScore + pts); state.credits = safeInt(state.credits + 10); state.shards = safeInt(state.shards + 1); state.streak++; state.xp = safeInt(state.xp + 20); state.games++; spawnParticles(window.innerWidth*0.5 + (Math.random()-0.5)*200, window.innerHeight*0.5 + (Math.random()-0.5)*120, colorFromPalette(0), 22); playSfx('win'); grantAchievement('first_win'); }
  else if(result==='lose'){ state.cpuScore = safeInt(state.cpuScore + 1); state.credits = safeInt(state.credits + 3); state.streak = 0; state.xp = safeInt(state.xp + 8); state.games++; spawnParticles(window.innerWidth*0.5, window.innerHeight*0.5, colorFromPalette(4), 10); playSfx('lose'); }
  else if(result==='blocked' || result==='saved'){ state.credits = safeInt(state.credits + 6); state.games++; state.xp = safeInt(state.xp + 10); state.streak = 0; playSfx('click'); }
  else { state.credits = safeInt(state.credits + 5); state.games++; state.xp = safeInt(state.xp + 6); playSfx('click'); }
  while(state.xp >= state.xpNext){ state.xp = state.xp - state.xpNext; state.level = safeInt(state.level + 1); state.xpNext = Math.round(state.xpNext * 1.25); state.shards = safeInt(state.shards + 5); playSfx('level'); showTemp('Level up!'); }
  if(state.userScore >= 100) grantAchievement('hundred_points'); if(state.streak >= 10) grantAchievement('ten_streak');
  state.lastRound = {user:choice,cpu:cpu,result:result,time:Date.now()}; save(); renderAll();
}

function applyWin(choice,reason){ state.userScore = safeInt(state.userScore + 2); state.credits = safeInt(state.credits + 10); state.shards = safeInt(state.shards + 2); state.xp = safeInt(state.xp + 25); state.streak++; state.games++; state.lastRound = {user:choice,cpu:'instant',result:'win',time:Date.now(),reason}; spawnParticles(window.innerWidth*0.5, window.innerHeight*0.5, colorFromPalette(1), 30); playSfx('win'); renderAll(); }

// shops
const creditShopItems = [
  {id:'doublePoints',name:'Double Points (toggle)',cost:150,action:()=>{ state.powerUps.doublePoints = state.powerUps.doublePoints?0:1 }},
  {id:'triplePoints',name:'Triple Points (toggle)',cost:300,action:()=>{ state.powerUps.triplePoints = state.powerUps.triplePoints?0:1 }},
  {id:'shield',name:'Shield (1 use)',cost:220,action:()=>{ state.powerUps.shield = (state.powerUps.shield||0)+1 }},
  {id:'extraLife',name:'Extra Life (1 use)',cost:180,action:()=>{ state.powerUps.extraLife = (state.powerUps.extraLife||0)+1 }},
  {id:'instantWin',name:'Instant Win (1 use)',cost:450,action:()=>{ state.powerUps.instantWin = (state.powerUps.instantWin||0)+1 }},
  {id:'predictor',name:'Predictor (1 use)',cost:320,action:()=>{ state.powerUps.predictor = (state.powerUps.predictor||0)+1 }},
  {id:'timeFreeze',name:'Time Freeze (1 use)',cost:260,action:()=>{ state.powerUps.timeFreeze = (state.powerUps.timeFreeze||0)+1 }},
  {id:'criticalStrike',name:'Critical Strike (arm)',cost:200,action:()=>{ state.powerUps.criticalStrike = (state.powerUps.criticalStrike||0)+1; state.powerUps.criticalStrikeActive=true }}
];
const shardShopItems = [
  {id:'ultimateStreak',name:'Ultimate Streak (enable)',cost:6,action:()=>{ state.powerUps.ultimateStreak = 1 }},
  {id:'rewind',name:'Time Rewind (revert last)',cost:4,action:()=>{ state.powerUps.rewind = (state.powerUps.rewind||0)+1 }},
  {id:'cosmetic_spark',name:'Neon Avatar (cosmetic)',cost:8,action:()=>{ state.ownedShardShop = state.ownedShardShop || {}; state.ownedShardShop.cosmetic_spark = true }},
  {id:'big_point_boost',name:'Shard Boost +50 pts',cost:10,action:()=>{ state.userScore = safeInt(state.userScore + 50) }}
];

function renderShops(){
  const creditsDiv = $('shopCredits'); creditsDiv.innerHTML='';
  creditShopItems.forEach(it=>{ const d=document.createElement('div'); d.className='shop-item'; d.innerHTML = `<div><strong>${it.name}</strong><div style='font-size:12px;color:var(--muted)'>Cost: ${it.cost} credits</div></div><div><button onclick="buyCredits('${it.id}',${it.cost})">Buy</button></div>`; creditsDiv.appendChild(d); });
  const shardsDiv = $('shopShards'); shardsDiv.innerHTML='';
  shardShopItems.forEach(it=>{ const d=document.createElement('div'); d.className='shop-item'; d.innerHTML = `<div><strong>${it.name}</strong><div style='font-size:12px;color:var(--muted)'>Cost: ${it.cost} shards</div></div><div><button onclick="buyShards('${it.id}',${it.cost})">Buy</button></div>`; shardsDiv.appendChild(d); });
}

// buy functions
function buyCredits(id,cost){ if(state.credits < cost) return alert('Not enough credits'); state.credits = safeInt(state.credits - cost); const item = creditShopItems.find(x=>x.id===id); if(item) item.action(); save(); renderAll(); }
function buyShards(id,cost){ if(state.shards < cost) return alert('Not enough shards'); state.shards = safeInt(state.shards - cost); const item = shardShopItems.find(x=>x.id===id); if(item) item.action(); save(); renderAll(); }

// achievements & rewards
const ACH = [
  {id:'first_win',name:'First Victory',desc:'Win your first round',rewardShards:1},
  {id:'hundred_points',name:'Centurion',desc:'Reach 100 points',rewardShards:5},
  {id:'ten_streak',name:'Streaker',desc:'Reach a streak of 10',rewardShards:4}
];
function renderAchievements(){ const div=$('shopAch'); div.innerHTML=''; ACH.forEach(a=>{ const unlocked = state.achievements[a.id]; const d=document.createElement('div'); d.className='shop-item'; d.innerHTML = `<div><strong>${a.name}</strong><div style='font-size:12px;color:var(--muted)'>${a.desc}</div></div><div>${unlocked?'<strong style="color:var(--success)">Unlocked</strong>':`Reward: ${a.rewardShards} shards`}</div>`; div.appendChild(d); }); }
function grantAchievement(id){ if(state.achievements[id]) return; const a = ACH.find(x=>x.id===id); if(!a) return; state.achievements[id]=true; state.shards = safeInt(state.shards + (a.rewardShards||0)); showTemp(`Achievement: ${a.name} (+${a.rewardShards} shards)`); save(); }

// daily rewards
const DAILY_REWARDS = [{credits:10,shards:1},{credits:15,shards:1},{credits:20,shards:2},{credits:25,shards:2},{credits:40,shards:4},{credits:60,shards:6},{credits:100,shards:10}];
function claimDaily(){ const today = new Date().toDateString(); if(state.daily.lastClaim === today) return alert('Already claimed today'); const yesterday = new Date(Date.now()-86400000).toDateString(); if(state.daily.lastClaim === yesterday) state.daily.streak = (state.daily.streak||0) + 1; else state.daily.streak = 1; state.daily.lastClaim = today; const idx = Math.min(state.daily.streak-1, DAILY_REWARDS.length-1); const r = DAILY_REWARDS[idx]; state.credits = safeInt(state.credits + (r.credits||0)); state.shards = safeInt(state.shards + (r.shards||0)); showTemp(`Daily: +${r.credits} credits +${r.shards} shards`); save(); renderAll(); }
function renderDaily(){ const container = $('dailyDays'); container.innerHTML=''; for(let i=0;i<7;i++){ const d=document.createElement('div'); d.className='day'; d.innerText = i+1; if(i < (state.daily.streak||0)) d.style.border = '2px solid '+getComputedStyle(document.documentElement).getPropertyValue('--accent'); container.appendChild(d);} $('dailyStreak').innerText = state.daily.streak||0; }

// leaderboard (local)
function promptLeaderboardName(){ const name = prompt('Enter name to submit score (max 20 chars)'); if(!name) return; const entry = {name: name.substring(0,20), score: state.userScore, time: Date.now()}; state.leaderboard = state.leaderboard || []; state.leaderboard.push(entry); state.leaderboard.sort((a,b)=>b.score-a.score); state.leaderboard = state.leaderboard.slice(0,20); save(); renderLeaderboard(); alert('Score submitted'); }
function renderLeaderboard(){ const div = $('leaderboard'); div.innerHTML=''; (state.leaderboard||[]).forEach((r,i)=>{ const row = document.createElement('div'); row.className='lb-row'; row.innerHTML = `<div>${i+1}. ${r.name}</div><div>${r.score}</div>`; div.appendChild(row); }); }

// rewind
function rewindLast(){ if(!state.powerUps.rewind || state.powerUps.rewind <=0) return alert('No rewinds owned'); if(!state.lastRound) return alert('No round to rewind'); state.powerUps.rewind = Math.max(0, state.powerUps.rewind-1); const last = state.lastRound; if(last.result==='win'){ state.userScore = Math.max(0, state.userScore - 2); state.credits = Math.max(0, state.credits - 10); } else if(last.result==='lose'){ state.cpuScore = Math.max(0, state.cpuScore - 1); state.credits = Math.max(0, state.credits - 3); } state.games = Math.max(0, state.games - 1); state.lastRound = null; save(); renderAll(); showTemp('Rewind used'); }

// UI & helpers
function renderAll(){ $('userScore').innerText = state.userScore; $('cpuScore').innerText = state.cpuScore; $('games').innerText = state.games; $('credits').innerText = state.credits; $('shards').innerText = state.shards; $('walletCredits').innerText = state.credits; $('walletShards').innerText = state.shards; $('streak').innerText = state.streak; $('level').innerText = state.level; $('displayLevel').innerText = state.level; $('xp').innerText = state.xp; $('xpNext').innerText = state.xpNext; const pct = Math.min(100, Math.round((state.xp / state.xpNext) * 100)); $('xpfill').style.width = pct + '%'; renderShops(); renderAchievements(); renderDaily(); renderLeaderboard(); save(); }
function showTemp(msg){ $('resultTitle').innerText = msg; setTimeout(()=>{ $('resultTitle').innerText = 'Make a move'; },2400); }
function disableChoices(val){ document.querySelectorAll('.choice-btn').forEach(b=>b.style.pointerEvents = val? 'none':'auto'); }

// export/import save
function openExporter(){ const payload = JSON.stringify(state); if(navigator.clipboard){ navigator.clipboard.writeText(payload).then(()=>alert('Save JSON copied to clipboard — store it safely.')); } else { prompt('Copy this JSON to backup', payload); } }
function openImporter(){ const raw = prompt('Paste save JSON to import (this will replace local progress).'); if(!raw) return; try{ const parsed = JSON.parse(raw); if(!parsed) throw new Error('Invalid'); localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); load(); alert('Imported save — refreshed.'); }catch(e){ alert('Import failed: invalid JSON'); } }

// init UI events
document.addEventListener('DOMContentLoaded', ()=>{
  // buttons
  document.querySelectorAll('.choice-btn').forEach(btn=> btn.addEventListener('click', ()=> playerMove(btn.dataset.choice) ));
  $('musicBtn').addEventListener('click', toggleMusic);
  $('exportBtn').addEventListener('click', openExporter);
  $('importBtn').addEventListener('click', openImporter);
  $('claimDaily').addEventListener('click', claimDaily);
  $('submitScore').addEventListener('click', promptLeaderboardName);
  document.getElementById('tabCredits').addEventListener('click', ()=> switchShop('credits'));
  document.getElementById('tabShards').addEventListener('click', ()=> switchShop('shards'));
  document.getElementById('tabAch').addEventListener('click', ()=> switchShop('ach'));

  // keyboard shortcuts
  document.addEventListener('keydown', e=>{ if(e.key==='1') playerMove('rock'); if(e.key==='2') playerMove('paper'); if(e.key==='3') playerMove('scissors'); if(e.key==='m') toggleMusic(); if(e.key==='r') rewindLast(); });

  // attempt autoplay on load
  try{ ensureAudio(); if(musicOn){ startBgMusic(); } }catch(e){ console.warn('audio init failed',e); }
  // render & load
  load();
  // render shop items
  renderShops();
});

// switch shop tab
function switchShop(tab){ $('shopCredits').style.display = tab==='credits' ? 'block':'none'; $('shopShards').style.display = tab==='shards' ? 'block':'none'; $('shopAch').style.display = tab==='ach' ? 'block':'none'; document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); if(tab==='credits') $('tabCredits').classList.add('active'); if(tab==='shards') $('tabShards').classList.add('active'); if(tab==='ach') $('tabAch').classList.add('active'); }

// initial load call for safety
load(); renderAll();
