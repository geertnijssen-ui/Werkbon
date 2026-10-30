/* Werkbon MT Service: opslag (IndexedDB) en updates via de service worker */
/* ---------- opslag: IndexedDB met cache in het geheugen ---------- */
window.WBStore = {
  cache: {}, db: null, opFout: null,
  init: function(){
    var self = this;
    return new Promise(function(klaar){
      if(!window.indexedDB){ self.vanLocalStorage(); return klaar(); }
      var req = indexedDB.open("werkbon", 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore("kv"); };
      req.onerror = function(){ self.vanLocalStorage(); klaar(); };
      req.onsuccess = function(){
        self.db = req.result;
        var tx = self.db.transaction("kv", "readonly"), st = tx.objectStore("kv");
        var kr = st.getAllKeys(), vr = st.getAll();
        tx.oncomplete = function(){
          kr.result.forEach(function(k, i){ self.cache[k] = vr.result[i]; });
          if(!kr.result.length){
            /* eerste start na de update: gegevens uit localStorage overnemen */
            self.vanLocalStorage();
            Object.keys(self.cache).forEach(function(k){ self.zet(k, self.cache[k]); });
          }
          klaar();
        };
        tx.onerror = function(){ self.vanLocalStorage(); klaar(); };
      };
    }).then(function(){
      if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){});
    });
  },
  vanLocalStorage: function(){
    try {
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k.indexOf("wb_") === 0){ try { this.cache[k] = JSON.parse(localStorage.getItem(k)); } catch(e){} }
      }
    } catch(e){}
  },
  fout: function(){ if(this.opFout) this.opFout(); },
  zet: function(k, v){
    this.cache[k] = v;
    var self = this;
    if(!this.db){
      try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ self.fout(); }
      return;
    }
    try {
      var tx = this.db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(v, k);
      tx.onerror = tx.onabort = function(){ self.fout(); };
    } catch(e){ self.fout(); }
  },
  wis: function(k){
    delete this.cache[k];
    try { if(this.db) this.db.transaction("kv", "readwrite").objectStore("kv").delete(k); else localStorage.removeItem(k); } catch(e){}
  }
};
/* knop Update: vraagt Netlify of er een nieuwe sw.js is; zo ja installeert die zich en herlaadt de app */
var herladen = false;
window.zoekUpdate = function(){
  if(!navigator.onLine) return Promise.resolve("offline");
  if(!("serviceWorker" in navigator)){ setTimeout(function(){ location.reload(); }, 800); return Promise.resolve("nieuw"); }
  return navigator.serviceWorker.getRegistration().then(function(reg){
    if(!reg){ setTimeout(function(){ location.reload(); }, 800); return "nieuw"; }
    return reg.update().then(function(){
      if(!reg.installing && !reg.waiting) return "laatste";
      herladen = true;
      /* vangnet als controllerchange uitblijft */
      setTimeout(function(){ location.reload(); }, 10000);
      return "nieuw";
    });
  }).catch(function(){ return "fout"; });
};
if("serviceWorker" in navigator){
  /* nieuwe versie op Netlify: de service worker wordt vervangen en de app herlaadt eenmaal */
  herladen = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", function(){ if(herladen){ herladen = false; location.reload(); } });
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function(reg){
      /* iPhone: app komt vaak uit de achtergrond terug zonder herstart, dus dan ook controleren */
      document.addEventListener("visibilitychange", function(){ if(document.visibilityState === "visible") reg.update().catch(function(){}); });
    }).catch(function(){});
  });
}
