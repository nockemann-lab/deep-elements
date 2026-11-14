"use strict";

var SFX={
  ctx:null,        
  muted:false,     
  volume:1,                       // the player's setting, 0.25 to 1
  VOLUME_STEPS:[1,0.75,0.5,0.25],
  MASTER_GAIN:0.35,MENU_MUSIC:0.35,LEVEL_MUSIC:0.25,
  musicHeld:false,                // the level music waits while the game is paused
  initialized:false,
  masterGain:null, 
  impactAudioPool:null,

  init:function(){
    if(this.initialized)return;
    try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();
      this.masterGain=this.ctx.createGain();this.masterGain.gain.value=this.MASTER_GAIN*this.volume;
      this.masterGain.connect(this.ctx.destination);this.initialized=true;
    }catch(e){console.warn("Web Audio not supported");}
  },
  resume:function(){if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();},
  osc:function(type,freq,start,dur,vol,dest){
    if(!this.ctx||this.muted)return;
    var o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.value=freq;
    g.gain.setValueAtTime(vol,start);g.gain.exponentialRampToValueAtTime(0.001,start+dur);
    o.connect(g);g.connect(dest||this.masterGain);
    o.start(start);o.stop(start+dur+0.05);return o;
  },
  noise:function(start,dur,vol,filterFreq,filterType){
    if(!this.ctx||this.muted)return;
    var sr=this.ctx.sampleRate,len=Math.floor(sr*dur),buf=this.ctx.createBuffer(1,len,sr);
    var d=buf.getChannelData(0);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1);
    var src=this.ctx.createBufferSource();src.buffer=buf;
    var filt=this.ctx.createBiquadFilter();filt.type=filterType||"lowpass";filt.frequency.value=filterFreq||2000;
    var g=this.ctx.createGain();g.gain.setValueAtTime(vol,start);g.gain.exponentialRampToValueAtTime(0.001,start+dur);
    src.connect(filt);filt.connect(g);g.connect(this.masterGain);
    src.start(start);src.stop(start+dur+0.05);
  },
  getEffectAudio:function(poolName,src,volume,size){
    var pool=this[poolName];
    if(!pool){
      pool=[];
      for(var i=0;i<(size||4);i++){
        var audio=/** @type {any} */(new Audio(src));
        audio.preload="auto";
        audio._base=volume;
        audio.volume=volume*this.volume;
        pool.push(audio);
      }
      this[poolName]=pool;
    }
    for(var pi=0;pi<pool.length;pi++){
      if(pool[pi].paused||pool[pi].ended)return pool[pi];
    }
    var fallback=/** @type {any} */(pool[0].cloneNode());
    fallback._base=volume;
    fallback.volume=volume*this.volume;
    pool.push(fallback);
    return fallback;
  },
  // One volume for everything: the synth effects through the master gain, the
  // recorded ones and the music on their own audio elements. (iOS ignores the
  // volume of an audio element, so there only the synth effects follow it.)
  applyVolume:function(){
    if(this.masterGain)this.masterGain.gain.value=this.MASTER_GAIN*this.volume;
    if(this.menuAudio)this.menuAudio.volume=this.MENU_MUSIC*this.volume;
    if(this.levelAudio)this.levelAudio.volume=this.LEVEL_MUSIC*this.volume;
    var pool=this.impactAudioPool;
    if(pool)for(var i=0;i<pool.length;i++)pool[i].volume=(pool[i]._base||0.7)*this.volume;
  },
  setVolume:function(v){
    this.volume=Math.max(0.25,Math.min(1,v));
    this.applyVolume();
    try{localStorage.setItem(this.VOLUME_KEY,String(this.volume));}catch(e){}
    this.syncButtons();
  },
  MUTE_KEY:"deepElements_muted",
  VOLUME_KEY:"deepElements_volume",
  // Read the saved sound settings (the page calls this once, when it loads)
  loadSettings:function(){
    var m=null,v=null;
    try{m=localStorage.getItem(this.MUTE_KEY);v=localStorage.getItem(this.VOLUME_KEY);}catch(e){}
    this.muted=m==="1";
    var n=parseFloat(v);
    this.volume=n>=0.25&&n<=1?n:1;
    this.applyVolume();
    this.syncButtons();
  },
  syncButtons:function(){
    var btn=document.getElementById("mute-btn");
    var mbtn=document.getElementById("menu-mute-btn");
    var vbtn=document.getElementById("volume-btn");
    if(btn)btn.textContent=this.muted?"\ud83d\udd07":"\ud83d\udd0a";
    if(mbtn)mbtn.textContent=this.muted?"\ud83d\udd07 Sound OFF":"\ud83d\udd0a Sound ON";
    if(vbtn)vbtn.textContent="\ud83d\udd09 Volume "+Math.round(this.volume*100)+"%";
  },
  // The level music stops while the game is paused and picks up where it left off
  holdMusic:function(on){
    this.musicHeld=!!on;
    if(!this.levelAudio)return;
    if(on)this.levelAudio.pause();
    else if(!this.muted&&this.levelMusicPlaying)this.levelAudio.play().catch(function(){});
  },
  stopEffectPool:function(poolName){
    var pool=this[poolName];
    if(!pool)return;
    for(var i=0;i<pool.length;i++){
      pool[i].pause();
      pool[i].currentTime=0;
    }
  },
  dig:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.08,0.5,1200,"lowpass");
    this.noise(t+0.02,0.05,0.3,800,"lowpass");
  },
  step:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.04,0.12,600,"lowpass");
  },
  splash:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.15,0.35,3000,"lowpass");
    this.noise(t+0.03,0.12,0.2,5000,"highpass");
  },
  collectElement:function(z){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    var baseFreq=600-Math.min(z||40,80)*3;
    this.osc("sine",baseFreq,t,0.12,0.25);
    this.osc("sine",baseFreq*1.5,t+0.08,0.12,0.2);
    this.osc("sine",baseFreq*2,t+0.16,0.18,0.2);
    this.osc("triangle",baseFreq*2.5,t+0.22,0.25,0.1);
  },
  collectBonus:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",523,t,0.1,0.2);   
    this.osc("sine",659,t+0.06,0.1,0.2);  
    this.osc("sine",784,t+0.12,0.1,0.2);  
    this.osc("sine",1047,t+0.18,0.15,0.25); 
    this.osc("triangle",1318,t+0.24,0.2,0.15); 
    this.osc("triangle",1568,t+0.3,0.3,0.1);   
  },
  collectPowerup:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",880,t,0.06,0.2);
    this.osc("sine",1100,t+0.05,0.06,0.2);
    this.osc("sine",1320,t+0.1,0.1,0.15);
    this.noise(t+0.05,0.08,0.08,6000,"highpass");
  },
  usePowerup:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.2,0.2,4000,"highpass");
    this.osc("sine",660,t+0.05,0.15,0.15);
    this.osc("sine",880,t+0.12,0.2,0.12);
  },
  placeDynamite:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.3,0.2,6000,"highpass");
    this.osc("sawtooth",200,t,0.05,0.15);
    this.osc("sine",150,t+0.05,0.1,0.1);
  },
  explode:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",60,t,0.3,0.5);
    this.osc("sine",40,t,0.4,0.35);
    this.noise(t,0.4,0.5,1500,"lowpass");
    this.noise(t+0.05,0.3,0.35,800,"lowpass");
    this.noise(t+0.15,0.2,0.2,3000,"highpass");
  },
  boulderFall:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",80,t,0.15,0.3);
    this.osc("sine",50,t+0.02,0.2,0.2);
    this.noise(t,0.1,0.25,500,"lowpass");
  },
  boulderPush:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.12,0.2,1200,"lowpass");
    this.osc("sine",100,t+0.05,0.08,0.15);
  },
  boulderImpact:function(){
    if(this.muted)return;
    var impact=this.getEffectAudio("impactAudioPool","impact.mp3",0.7,4);
    impact.currentTime=0;
    impact.play().catch(function(){});
  },
  crushEnemy:function(type){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    // Heavy impact thud
    this.osc("sine",60,t,0.18,0.4);
    this.osc("sine",40,t+0.01,0.22,0.3);
    // Crunch layers
    this.noise(t,0.15,0.5,2200,"lowpass");
    this.noise(t+0.02,0.1,0.3,5000,"highpass");
    this.noise(t+0.06,0.08,0.2,3500,"bandpass");
    // Satisfying pop
    this.osc("sine",400,t+0.01,0.04,0.25);
    this.osc("sine",200,t+0.04,0.06,0.15);
    // Squelch tail
    this.noise(t+0.1,0.12,0.15,1200,"lowpass");
    // Type-specific accent
    if(type==="bat") this.osc("sine",900,t,0.03,0.12);
    else if(type==="spider") this.noise(t+0.03,0.06,0.2,6000,"highpass");
    else if(type==="snake") this.osc("sawtooth",150,t+0.02,0.08,0.1);
    else if(type==="crab") { this.osc("square",500,t,0.03,0.15); this.osc("square",350,t+0.03,0.04,0.1); }
  },
  enemyAlert:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("square",880,t,0.04,0.15);
    this.osc("square",1100,t+0.05,0.06,0.12);
  },
  waterRelease:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.4,0.3,3000,"lowpass");
    this.noise(t+0.1,0.3,0.2,5000,"highpass");
    this.osc("sine",200,t,0.2,0.08);
    this.osc("sine",150,t+0.1,0.25,0.06);
  },
  waterDrip:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",1200,t,0.04,0.08);
    this.osc("sine",800,t+0.03,0.06,0.05);
  },
  lavaRelease:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.4,0.3,1500,"lowpass");
    this.osc("sawtooth",120,t,0.3,0.12);
    this.osc("sawtooth",80,t+0.15,0.25,0.08);
  },
  lavaDrip:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sawtooth",200,t,0.03,0.06);
    this.osc("sine",150,t+0.02,0.04,0.04);
  },
  basaltCrumble:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.noise(t,0.2,0.2,600,"lowpass");
    this.osc("sine",70,t,0.15,0.15);
    this.osc("sine",45,t+0.08,0.12,0.1);
  },
  timerTick:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("square",600,t,0.03,0.1);
  },
  timerUrgent:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("square",800,t,0.05,0.15);
    this.osc("square",800,t+0.1,0.05,0.15);
  },
  death:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sawtooth",400,t,0.15,0.2);
    this.osc("sawtooth",300,t+0.15,0.15,0.2);
    this.osc("sawtooth",200,t+0.3,0.15,0.2);
    this.osc("sawtooth",100,t+0.45,0.4,0.25);
    this.noise(t+0.1,0.3,0.15,800,"lowpass");
  },
  exitOpen:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    // Rising run: C5-E5-G5-C6-E6
    var run=[523,659,784,1047,1318];
    for(var i=0;i<run.length;i++){
      this.osc("sine",run[i],t+i*0.09,0.2,0.28);
      this.osc("triangle",run[i],t+i*0.09,0.1,0.18);
    }
    // Sustained C-major chord landing
    this.osc("sine",523,t+0.45,0.55,0.28);
    this.osc("sine",784,t+0.45,0.45,0.28);
    this.osc("sine",1047,t+0.45,0.4,0.28);
    this.osc("sine",1318,t+0.45,0.3,0.28);
    // Bright shimmer
    this.noise(t+0.4,0.65,0.15,8000,"highpass");
    this.noise(t,0.18,0.05,5000,"highpass");
  },
  levelWin:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    var notes=[523,659,784,1047,1318,1568];
    for(var i=0;i<notes.length;i++){
      this.osc("sine",notes[i],t+i*0.08,0.2,0.2);
      this.osc("triangle",notes[i]*0.5,t+i*0.08,0.15,0.08);
    }
    this.osc("sine",1568,t+0.5,0.5,0.15);
    this.noise(t+0.4,0.2,0.06,8000,"highpass");
  },
  levelStart:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",440,t,0.08,0.15);
    this.osc("sine",554,t+0.08,0.08,0.15);
    this.osc("sine",659,t+0.16,0.15,0.18);
  },
  combo:function(mult){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    var base=400+mult*80;
    this.osc("sine",base,t,0.1,0.2);
    this.osc("sine",base*1.25,t+0.04,0.1,0.18);
    this.osc("sine",base*1.5,t+0.08,0.15,0.15);
    this.osc("triangle",base*2,t+0.12,0.2,0.1);
  },
  glint:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",1200,t,0.06,0.08);
    this.osc("sine",900,t+0.06,0.08,0.06);
    this.osc("sine",1400,t+0.12,0.1,0.05);
  },
  wallBump:function(){
    if(!this.ctx||this.muted)return;var t=this.ctx.currentTime;
    this.osc("sine",120,t,0.04,0.12);
    this.noise(t,0.03,0.1,400,"lowpass");
  },

  // ─── Menu Background Music ───
  menuAudio:null,
  menuMusicPlaying:false,
  playMenuMusic:function(){
    if(!this.menuAudio){
      this.menuAudio=new Audio("Gentle%20Cavern%20Loops.mp3");
      this.menuAudio.loop=true;
      this.menuAudio.volume=this.MENU_MUSIC*this.volume;
    }
    // Marked as playing even when muted, so that unmuting starts it
    this.menuMusicPlaying=true;
    if(this.muted){this.menuAudio.pause();return;}
    this.menuAudio.play().catch(function(){});
  },
  stopMenuMusic:function(){
    if(this.menuAudio){
      this.menuAudio.pause();
      this.menuAudio.currentTime=0;
    }
    this.menuMusicPlaying=false;
  },

  // ─── Level Background Music ───
  levelTracksEndless:["Gentle%20Cavern%20Loop%201.mp3","Gentle%20Cavern%20Look%202.mp3"],
  levelTracksMission:["Cavern%20Loop%203.mp3","Cavern%20Loop%204.mp3"],
  levelTrackIndex:0,
  levelAudio:null,
  levelMusicPlaying:false,
  activeLevelTracks:null,
  playLevelMusic:function(tracks){
    var self=this;
    this.musicHeld=false;
    this.activeLevelTracks=tracks||this.levelTracksEndless;
    var src=this.activeLevelTracks[this.levelTrackIndex%this.activeLevelTracks.length];
    if(!this.levelAudio||this.levelAudio._src!==src){
      if(this.levelAudio){this.levelAudio.pause();this.levelAudio.removeEventListener("ended",this.levelAudio._onEnd);}
      this.levelAudio=new Audio(src);
      this.levelAudio._src=src;
      this.levelAudio.loop=false;
      this.levelAudio.volume=this.LEVEL_MUSIC*this.volume;
      this.levelAudio._onEnd=function(){
        self.levelTrackIndex++;
        var nextSrc=self.activeLevelTracks[self.levelTrackIndex%self.activeLevelTracks.length];
        self.levelAudio.src=nextSrc;
        self.levelAudio._src=nextSrc;
        if(!self.muted&&!self.musicHeld)self.levelAudio.play().catch(function(){});
      };
      this.levelAudio.addEventListener("ended",this.levelAudio._onEnd);
    }
    this.levelMusicPlaying=true;
    if(this.muted){this.levelAudio.pause();return;}
    this.levelAudio.play().catch(function(){});
  },
  stopLevelMusic:function(){
    if(this.levelAudio){
      this.levelAudio.pause();
      this.levelAudio.currentTime=0;
    }
    this.levelMusicPlaying=false;
    this.musicHeld=false;
    this.levelTrackIndex=0;
  }
};
window.toggleMute=function(){
  SFX.muted=!SFX.muted;
  try{localStorage.setItem(SFX.MUTE_KEY,SFX.muted?"1":"0");}catch(e){}
  SFX.syncButtons();
  if(SFX.menuAudio){
    if(SFX.muted){SFX.menuAudio.pause();}else if(SFX.menuMusicPlaying){SFX.menuAudio.play().catch(function(){});}
  }
  if(SFX.levelAudio){
    if(SFX.muted){SFX.levelAudio.pause();}else if(SFX.levelMusicPlaying&&!SFX.musicHeld){SFX.levelAudio.play().catch(function(){});}
  }
  if(SFX.muted){
    SFX.stopEffectPool("impactAudioPool");
  }
};
// Step down through the volume levels and back to full; a short blip shows the new one
window.cycleVolume=function(){
  var steps=SFX.VOLUME_STEPS,i=steps.indexOf(SFX.volume);
  SFX.setVolume(steps[(i+1)%steps.length]);
  if(SFX.ctx&&!SFX.muted)SFX.glint();
};
SFX.loadSettings();

function initAudioOnInteraction(){
  SFX.init();SFX.resume();
  // Retry any music that the browser's autoplay policy blocked before this gesture
  if(!SFX.muted){
    if(SFX.menuMusicPlaying&&SFX.menuAudio)SFX.menuAudio.play().catch(function(){});
    if(SFX.levelMusicPlaying&&SFX.levelAudio&&!SFX.musicHeld)SFX.levelAudio.play().catch(function(){});
  }
  document.removeEventListener("click",initAudioOnInteraction);
  document.removeEventListener("keydown",initAudioOnInteraction);
  document.removeEventListener("touchstart",initAudioOnInteraction);
}
document.addEventListener("click",initAudioOnInteraction);
document.addEventListener("keydown",initAudioOnInteraction);
document.addEventListener("touchstart",initAudioOnInteraction);