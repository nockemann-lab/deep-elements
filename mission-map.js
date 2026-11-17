"use strict";

// ═══════════════════════════════════════════════════════════════════
// mission-map.js - World mine map for Critical Missions
// Real mines plotted at real coordinates, each linked to a mission
// through an element that the mine genuinely produces (to a fair
// approximation). Levels are free-choice; progress (stars) persists.
// The mine descriptions in this file are content under CC BY-NC-SA 4.0,
// not the MIT License - see LICENSE-CONTENT.md.
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;
  var PROGRESS_KEY = "deepElements_missionProgress";

  // ─── The 31 mines (index = mission index in Levels/manifest.json) ───
  // In rising order of difficulty. A mine and its level file move together:
  // reorder both, bump ORDER_VERSION and extend migrateProgress() so that saved
  // stars follow their mines.
  var MINES = [
    { mine:"Chuquicamata",      country:"Chile",        flag:"🇨🇱", lat:-22.3, lon:-68.9,  elem:"Cu", diff:"easy",
      fact:"One of the largest open pits ever dug - now mined from tunnels beneath the old crater." },
    { mine:"Neves-Corvo",       country:"Portugal",     flag:"🇵🇹", lat:37.57, lon:-7.97,  elem:"In", diff:"easy",
      fact:"Copper-zinc ores that carry indium - the transparent electrode in most screens." },
    { mine:"Fresnillo",         country:"Mexico",       flag:"🇲🇽", lat:23.18, lon:-102.87,elem:"Ag", diff:"medium",
      fact:"Mined since 1554 and long the world's greatest silver mine - silver paste prints the contacts on most solar cells." },
    { mine:"Greenbushes",       country:"Australia",    flag:"🇦🇺", lat:-33.86,lon:116.06, elem:"Li", diff:"medium",
      fact:"The world's richest hard-rock lithium mine - spodumene for battery cathodes." },
    { mine:"Bayan Obo",         country:"China",        flag:"🇨🇳", lat:41.77, lon:109.97, elem:"Nd", diff:"medium",
      fact:"The largest rare-earth deposit on Earth - neodymium for permanent magnets." },
    { mine:"Mount Weld",        country:"Australia",    flag:"🇦🇺", lat:-28.86,lon:122.55, elem:"Nd", diff:"medium",
      fact:"One of the richest rare-earth ore bodies outside China - magnets for turbines." },
    { mine:"Mogalakwena",       country:"South Africa", flag:"🇿🇦", lat:-24.0, lon:28.9,   elem:"Pt", diff:"medium",
      fact:"The world's largest open-pit platinum mine - catalyst metal for fuel cells." },
    { mine:"Bisie Mine",        country:"DR Congo",     flag:"🇨🇩", lat:-1.2,  lon:28.0,   elem:"Sn", diff:"medium",
      fact:"Cassiterite (tin ore) from North Kivu - the solder in every phone." },
    { mine:"Araxá (CBMM)", country:"Brazil",       flag:"🇧🇷", lat:-19.66,lon:-46.93, elem:"Nb", diff:"medium",
      fact:"Supplies most of the world's niobium - for stronger steel and superconducting magnet wire." },
    { mine:"Tellnes Mine",      country:"Norway",       flag:"🇳🇴", lat:58.33, lon:6.43,   elem:"Ti", diff:"medium",
      fact:"Europe's great ilmenite deposit - its titanium whitens paint, and titanium metal is what bone grows onto." },
    { mine:"Norilsk",           country:"Russia",       flag:"🇷🇺", lat:69.34, lon:88.2,   elem:"Ni", diff:"hard",
      fact:"Arctic nickel - the backbone of jet-engine superalloys." },
    { mine:"Tanco Mine",        country:"Canada",       flag:"🇨🇦", lat:50.43, lon:-95.45, elem:"Ta", diff:"hard",
      fact:"The TANtalum Mining COrporation mine - once a major source of tantalum for capacitors, now mainly caesium and lithium." },
    { mine:"San Rafael",        country:"Peru",         flag:"🇵🇪", lat:-14.23,lon:-70.32, elem:"Sn", diff:"hard",
      fact:"One of the world's largest and richest tin mines - solder joints along every cable." },
    { mine:"Rampura Agucha",    country:"India",        flag:"🇮🇳", lat:25.83, lon:74.73,  elem:"Zn", diff:"hard",
      fact:"One of the world's great zinc mines - galvanising steel against salt water." },
    { mine:"Spor Mountain",     country:"USA (Utah)",   flag:"🇺🇸", lat:39.72, lon:-113.2, elem:"Be", diff:"hard",
      fact:"Supplies most of the world's beryllium - the Webb telescope's mirrors are made of it." },
    { mine:"Spruce Pine",       country:"USA (N.C.)",   flag:"🇺🇸", lat:35.92, lon:-82.06, elem:"Si", diff:"hard",
      fact:"Quartz of a purity found almost nowhere else - the crucibles for nearly every silicon chip." },
    { mine:"Sangdong Mine",     country:"South Korea",  flag:"🇰🇷", lat:37.08, lon:128.83, elem:"W",  diff:"hard",
      fact:"One of the largest tungsten deposits - reopened in 2025 after 30 years of silence." },
    { mine:"Red Dog Mine",      country:"USA (Alaska)", flag:"🇺🇸", lat:68.07, lon:-162.8, elem:"Ge", diff:"hard",
      fact:"One of the world's largest zinc mines - and a key source of germanium for fibre optics." },
    { mine:"Agbogbloshie",      country:"Ghana",        flag:"🇬🇭", lat:5.55,  lon:-0.23,  elem:"Au", diff:"hard",
      fact:"Not a rock mine at all: Accra's famous e-waste yard (cleared in 2021) - a tonne of circuit boards held far more gold than a tonne of ore." },
    { mine:"Mponeng",           country:"South Africa", flag:"🇿🇦", lat:-26.42,lon:27.42,  elem:"Au", diff:"hard",
      fact:"The deepest mine on Earth - nearly 4 km down into the dark for gold." },
    { mine:"Gotthard Base Tunnel", country:"Switzerland", flag:"🇨🇭", lat:46.6, lon:8.6,   elem:"Si", diff:"medium",
      fact:"Not a mine - the world's longest rail tunnel (57 km), most of it bored through the Alps by four giant tunnel boring machines." },

    { mine:"Escondida",         country:"Chile",        flag:"🇨🇱", lat:-24.27,lon:-69.07, elem:"Cu", diff:"easy",
      fact:"'The hidden one' - the world's biggest copper-producing mine, high in the Atacama desert." },
    { mine:"Kiruna",            country:"Sweden",       flag:"🇸🇪", lat:67.86, lon:20.19,  elem:"Fe", diff:"easy",
      fact:"Europe's giant iron mine - the ore runs under the town, so its centre is being moved 3 km east." },
    { mine:"Ytterby",           country:"Sweden",       flag:"🇸🇪", lat:59.43, lon:18.35,  elem:"Y",  diff:"easy",
      fact:"A tiny quarry that named four elements - yttrium, ytterbium, terbium and erbium." },
    { mine:"Salar de Atacama",  country:"Chile",        flag:"🇨🇱", lat:-23.5, lon:-68.25, elem:"Li", diff:"medium",
      fact:"No digging here: lithium-rich brine dries in vast evaporation ponds under the desert sun." },
    { mine:"Oyu Tolgoi",        country:"Mongolia",     flag:"🇲🇳", lat:43.01, lon:106.87, elem:"Cu", diff:"medium",
      fact:"'Turquoise Hill' - a copper giant reaching more than a kilometre beneath the Gobi desert." },
    { mine:"Sudbury Basin",     country:"Canada",       flag:"🇨🇦", lat:46.6,  lon:-81.0,  elem:"Ni", diff:"medium",
      fact:"Nickel from a 1.8-billion-year-old meteorite crater - the impact melted the rock and concentrated Earth's own metals." },
    { mine:"Jwaneng",           country:"Botswana",     flag:"🇧🇼", lat:-24.6, lon:24.7,   elem:"C",  diff:"medium",
      fact:"The world's richest diamond mine - pure carbon under the Kalahari sands." },
    { mine:"Grasberg",          country:"Indonesia",    flag:"🇮🇩", lat:-4.05, lon:137.11, elem:"Au", diff:"hard",
      fact:"Gold and copper at 4,000 m altitude in Papua, beside the last tropical glaciers between the Himalayas and the Andes - now almost melted away." },
    { mine:"Cigar Lake",        country:"Canada",       flag:"🇨🇦", lat:58.06, lon:-104.54,elem:"U",  diff:"hard",
      fact:"Uranium ore so rich that machines mine it remotely - no human enters the ore body." },
    { mine:"Cerro Rico",        country:"Bolivia",      flag:"🇧🇴", lat:-19.62,lon:-65.75, elem:"Ag", diff:"hard",
      fact:"The 'rich mountain' of Potosí - nearly 500 years of silver that once bankrolled an empire." }
  ];

  // A mine only shows as unavailable if its level file is actually missing.
  function getLevelFor(i) {
    return Game.levels ? Game.levels.get(i) : null;
  }
  function isAvailable(i) {
    return !!getLevelFor(i);
  }
  function availableCount() {
    var n = 0;
    for (var i = 0; i < MINES.length; i++) if (isAvailable(i)) n++;
    return n;
  }

  var DIFF_LABEL = { easy:"EASY", medium:"MEDIUM", hard:"HARD" };

  // ─── Projection: equirectangular, lat 78N..58S ───
  var LAT_TOP = 78, LAT_BOT = -58;
  function projX(lon) { return (lon + 180) / 360; }
  function projY(lat) { return (LAT_TOP - lat) / (LAT_TOP - LAT_BOT); }

  // ─── Stylised continent outlines (lon,lat) - coarse, retro-pixel look ───
  var LAND = [
    // North + Central America
    [[-166,68],[-160,71],[-140,70],[-125,72],[-110,73],[-95,72],[-85,70],[-78,72],[-70,68],[-65,60],
     [-55,52],[-60,47],[-67,44],[-70,42],[-74,39],[-76,35],[-80,32],[-81,26],[-84,30],[-90,29],[-94,29],
     [-97,26],[-97,21],[-94,18],[-92,15],[-88,13],[-84,10],[-80,8],[-78,7],[-83,9],[-88,16],[-92,17],
     [-97,17],[-104,19],[-106,24],[-110,24],[-113,29],[-117,33],[-122,37],[-124,43],[-124,48],[-128,52],
     [-132,57],[-140,60],[-152,60],[-158,58],[-165,60],[-168,65]],
    // Greenland
    [[-45,60],[-55,68],[-58,74],[-40,77],[-25,71],[-32,66],[-40,62]],
    // South America
    [[-78,7],[-72,12],[-65,10],[-60,8],[-52,5],[-45,-2],[-38,-5],[-35,-8],[-38,-15],[-40,-20],[-48,-26],
     [-53,-33],[-58,-38],[-62,-40],[-65,-45],[-68,-50],[-72,-53],[-75,-48],[-73,-40],[-71,-32],[-70,-25],
     [-72,-18],[-77,-12],[-80,-6],[-81,0],[-79,4]],
    // Eurasia
    [[-9,37],[-9,43],[-2,44],[0,46],[-2,48],[1,50],[5,53],[8,55],[8,57],[5,58],[10,59],[5,62],[12,66],
     [16,69],[25,71],[33,69],[40,67],[45,68],[55,69],[65,70],[75,73],[85,75],[95,76],[105,75],[115,74],
     [130,72],[140,72],[150,70],[160,70],[170,67],[178,65],[170,61],[160,60],[157,53],[150,55],[142,50],
     [135,44],[131,42],[128,39],[126,35],[121,37],[121,31],[117,24],[110,20],[108,12],[105,9],[103,2],
     [98,8],[97,15],[94,17],[90,22],[86,20],[82,16],[80,12],[77,8],[73,16],[70,21],[66,25],[61,25],
     [57,26],[59,23],[56,17],[52,15],[48,13],[43,12],[39,20],[35,28],[34,32],[36,36],[30,36],[26,39],
     [23,37],[21,38],[19,42],[16,41],[18,40],[15,38],[12,42],[14,45],[10,44],[5,43],[3,41],[0,39],[-5,36]],
    // Africa
    [[-6,35],[3,37],[11,37],[11,33],[19,32],[29,31],[33,31],[35,28],[37,21],[38,18],[43,11],[48,11],
     [51,11],[46,2],[41,-3],[40,-10],[36,-18],[35,-24],[32,-29],[27,-34],[20,-35],[18,-32],[15,-27],
     [12,-18],[9,-8],[9,0],[6,4],[0,6],[-8,5],[-13,8],[-17,12],[-17,15],[-16,20],[-13,26],[-9,31]],
    // Australia
    [[114,-22],[114,-26],[115,-33],[118,-35],[124,-33],[129,-32],[132,-32],[135,-35],[138,-35],[140,-38],
     [146,-39],[150,-37],[153,-32],[153,-27],[151,-24],[148,-20],[146,-18],[142,-11],[137,-12],[135,-15],
     [137,-16],[132,-12],[129,-14],[125,-14],[122,-18]],
    // British Isles
    [[-5,50],[-2,53],[-1,55],[-4,58],[-7,57],[-6,52]],
    // Japan
    [[130,31],[134,34],[140,36],[143,43],[145,44],[141,45],[139,41],[135,34],[131,32]],
    // Madagascar
    [[43,-22],[47,-16],[50,-16],[49,-20],[47,-25],[44,-25]],
    // Sumatra / Borneo / New Guinea
    [[95,5],[102,-1],[106,-6],[103,-2],[97,3]],
    [[109,1],[114,4],[117,1],[116,-3],[110,-2]],
    [[131,-1],[138,-2],[146,-6],[141,-8],[134,-4]],
    // New Zealand
    [[167,-46],[172,-44],[174,-41],[175,-37],[173,-35],[171,-40],[168,-44]]
  ];

  // NASA Blue Marble (topography + bathymetry, public domain) - the physical
  // world map base. Vector coastlines below remain as a loading fallback.
  var mapImg = null, mapImgReady = false;
  function loadMapImg() {
    if (mapImg) return;
    mapImg = new Image();
    mapImg.onload = function() { mapImgReady = true; scheduleDraw(); };
    mapImg.src = "world-map.jpg";
  }

  // Redrawn on every zoom/pan change so the map stays crisp at any
  // zoom level (the canvas itself is never CSS-scaled).
  function drawMapView() {
    var canvas = /** @type {HTMLCanvasElement & { _hw?: number }} */ (document.getElementById("map-canvas"));
    var holder = document.getElementById("map-holder");
    if (!canvas || !holder) return;
    var hw = holder.clientWidth || 880;
    if (canvas._hw !== hw) {
      canvas.width = Math.min(2400, Math.max(800, Math.round(hw * (window.devicePixelRatio || 1) * 1.5)));
      canvas.height = Math.round(canvas.width * (LAT_TOP - LAT_BOT) / 360);
      canvas._hw = hw;
    }
    // Drawing space: fixed 2600-wide map coords; R maps CSS px → canvas px
    var W = 2600, H = Math.round(W * (LAT_TOP - LAT_BOT) / 360);
    var R = canvas.width / hw;
    var scale = canvas.width / W * view.k;
    var lw = 1 / view.k; // keeps stroke widths constant on screen
    var ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, view.tx * R, view.ty * R);

    // Ocean: deep vertical gradient with a soft atmospheric glow
    var sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, "#0d1930");
    sea.addColorStop(0.5, "#0a1424");
    sea.addColorStop(1, "#070e1a");
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.55);
    glow.addColorStop(0, "rgba(70,120,190,0.10)");
    glow.addColorStop(1, "rgba(70,120,190,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Fine graticule every 15°, equator slightly stronger
    function drawGraticule() {
      ctx.lineWidth = 1.6 * lw;
      for (var lon = -165; lon <= 165; lon += 15) {
        var gx = projX(lon) * W;
        ctx.strokeStyle = lon === 0 ? "rgba(200,220,255,0.09)" : "rgba(200,220,255,0.045)";
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (var lat = 75; lat >= -45; lat -= 15) {
        var gy = projY(lat) * H;
        ctx.strokeStyle = lat === 0 ? "rgba(200,220,255,0.09)" : "rgba(200,220,255,0.045)";
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
    }

    if (mapImgReady) {
      // Physical satellite map, cropped to the projection's lat window
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      var isy = (90 - LAT_TOP) / 180 * mapImg.height;
      var ish = (LAT_TOP - LAT_BOT) / 180 * mapImg.height;
      ctx.drawImage(mapImg, 0, isy, mapImg.width, ish, 0, 0, W, H);
      // dark glaze so markers, labels and the UI palette stay readable
      ctx.fillStyle = "rgba(7,11,22,0.30)";
      ctx.fillRect(0, 0, W, H);
      drawGraticule();
      return;
    }

    drawGraticule();

    // Fallback while the image loads: smoothed coastlines with a soft rim glow
    function tracePoly(poly) {
      var pts = poly.map(function(p) { return [projX(p[0]) * W, projY(p[1]) * H]; });
      var n = pts.length;
      ctx.beginPath();
      var m0x = (pts[0][0] + pts[1][0]) / 2, m0y = (pts[0][1] + pts[1][1]) / 2;
      ctx.moveTo(m0x, m0y);
      for (var i = 1; i <= n; i++) {
        var p = pts[i % n], q = pts[(i + 1) % n];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      ctx.closePath();
    }
    var landFill = ctx.createLinearGradient(0, 0, 0, H);
    landFill.addColorStop(0, "#2a4736");
    landFill.addColorStop(1, "#1e3427");
    LAND.forEach(function(poly) {
      tracePoly(poly);
      // rim glow beneath the coastline
      ctx.strokeStyle = "rgba(90,200,160,0.10)";
      ctx.lineWidth = 12 * lw; ctx.lineJoin = "round"; ctx.stroke();
      ctx.strokeStyle = "rgba(90,200,160,0.06)";
      ctx.lineWidth = 24 * lw; ctx.stroke();
      ctx.fillStyle = landFill;
      ctx.fill();
      // crisp coastline
      ctx.strokeStyle = "rgba(150,225,185,0.45)";
      ctx.lineWidth = 2.5 * lw; ctx.stroke();
      // inner shading for a hint of relief
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 10 * lw;
      ctx.translate(0, 5 * lw);
      tracePoly(poly);
      ctx.stroke();
      ctx.restore();
    });
  }

  var drawPending = false;
  function scheduleDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(function() { drawPending = false; drawMapView(); });
  }

  function positionMarkers() {
    var holder = document.getElementById("map-holder");
    var hold = document.getElementById("map-markers");
    if (!holder || !hold) return;
    var w = holder.clientWidth, h = holder.clientHeight;
    for (var i = 0; i < hold.children.length; i++) {
      var b = /** @type {HTMLElement} */ (hold.children[i]);
      b.style.left = (parseFloat(b.dataset.fx) * w * view.k + view.tx) + "px";
      b.style.top = (parseFloat(b.dataset.fy) * h * view.k + view.ty) + "px";
    }
  }

  // ─── Zoom & pan ───
  var view = { k: 1, tx: 0, ty: 0 };
  var MAX_K = 14;
  var zoomBound = false;

  function applyView() {
    var holder = document.getElementById("map-holder");
    if (!holder) return;
    var w = holder.clientWidth, h = holder.clientHeight;
    view.k = Math.max(1, Math.min(MAX_K, view.k));
    view.tx = Math.min(0, Math.max(w - w * view.k, view.tx));
    view.ty = Math.min(0, Math.max(h - h * view.k, view.ty));
    holder.classList.toggle("zoomed", view.k >= 2.6);
    var zr = document.getElementById("map-zreset");
    if (zr) zr.style.opacity = view.k > 1.01 ? "1" : "0.4";
    scheduleDraw();
    positionMarkers();
  }

  function zoomAt(px, py, factor) {
    var newK = Math.max(1, Math.min(MAX_K, view.k * factor));
    view.tx = px - (px - view.tx) * (newK / view.k);
    view.ty = py - (py - view.ty) * (newK / view.k);
    view.k = newK;
    applyView();
  }

  function resetView() { view.k = 1; view.tx = 0; view.ty = 0; applyView(); }

  function bindZoom() {
    if (zoomBound) return;
    var holder = document.getElementById("map-holder");
    if (!holder) return;
    zoomBound = true;

    var pointers = {}, nPointers = 0, dragMoved = false, downX = 0, downY = 0;
    function rel(cx, cy) {
      // Scale-corrected: the card's pop-in animation transforms the holder,
      // so map client coords through the rect→layout ratio
      var r = holder.getBoundingClientRect();
      return { x: (cx - r.left) * (r.width ? holder.clientWidth / r.width : 1),
               y: (cy - r.top) * (r.height ? holder.clientHeight / r.height : 1) };
    }

    holder.addEventListener("wheel", function(e) {
      e.preventDefault();
      var p = rel(e.clientX, e.clientY);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0022));
    }, { passive: false });

    holder.addEventListener("dblclick", function(e) {
      var p = rel(e.clientX, e.clientY);
      if (view.k > MAX_K - 0.01) resetView(); else zoomAt(p.x, p.y, 2);
    });

    holder.addEventListener("pointerdown", function(e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      nPointers++;
      if (nPointers === 1) { dragMoved = false; downX = e.clientX; downY = e.clientY; }
    });

    window.addEventListener("pointermove", function(e) {
      var me = pointers[e.pointerId];
      if (!me) return;
      if (nPointers === 1) {
        view.tx += e.clientX - me.x; view.ty += e.clientY - me.y;
        applyView();
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) dragMoved = true;
      } else if (nPointers === 2) {
        var other = null;
        for (var id in pointers) if (+id !== e.pointerId) other = pointers[id];
        if (other) {
          var d0 = Math.sqrt(Math.pow(me.x - other.x, 2) + Math.pow(me.y - other.y, 2));
          var d1 = Math.sqrt(Math.pow(e.clientX - other.x, 2) + Math.pow(e.clientY - other.y, 2));
          var m0 = rel((me.x + other.x) / 2, (me.y + other.y) / 2);
          var m1 = rel((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
          if (d0 > 0) zoomAt(m0.x, m0.y, d1 / d0);
          view.tx += m1.x - m0.x; view.ty += m1.y - m0.y;
          applyView();
          dragMoved = true;
        }
      }
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    });

    function drop(e) {
      if (pointers[e.pointerId]) { delete pointers[e.pointerId]; nPointers--; }
    }
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);

    // A drag that ends on a marker must not count as a click on it
    holder.addEventListener("click", function(e) {
      if (dragMoved) { e.stopPropagation(); e.preventDefault(); dragMoved = false; }
    }, true);

    var zi = document.getElementById("map-zin"), zo = document.getElementById("map-zout"), zr = document.getElementById("map-zreset");
    function center() { return { x: holder.clientWidth / 2, y: holder.clientHeight / 2 }; }
    if (zi) zi.onclick = function() { var c = center(); zoomAt(c.x, c.y, 1.6); };
    if (zo) zo.onclick = function() { var c = center(); zoomAt(c.x, c.y, 1 / 1.6); };
    if (zr) zr.onclick = resetView;
  }

  // ─── Progress persistence ───
  // Progress is stored by mission index. The missions were put in order of
  // difficulty in November 2026 (order 2); stars saved under the first order
  // are moved to the new index of the same mine, once.
  var ORDER_KEY = "deepElements_missionOrder", ORDER_VERSION = "2";
  var ORDER_1_TO_2 = [7, 17, 0, 1, 2, 3, 4, 5, 6, 10, 9, 11, 12, 13, 8, 14, 15, 16, 18, 19, 20];
  function migrateProgress() {
    try {
      if (localStorage.getItem(ORDER_KEY) === ORDER_VERSION) return;
      var old = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (old && typeof old === "object") {
        var moved = {};
        for (var k in old) {
          var i = +k;
          moved[i >= 0 && i < ORDER_1_TO_2.length ? ORDER_1_TO_2[i] : k] = old[k];
        }
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(moved));
      }
      localStorage.setItem(ORDER_KEY, ORDER_VERSION);
    } catch (e) {}
  }
  function getProgress() {
    migrateProgress();
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
  }

  var selected = -1;

  function starsHtml(n) {
    var h = "";
    for (var i = 1; i <= 3; i++) h += '<span style="opacity:' + (i <= n ? 1 : 0.25) + '">⭐</span>';
    return h;
  }

  function renderMarkers() {
    var holder = document.getElementById("map-markers");
    if (!holder) return;
    holder.innerHTML = "";
    var prog = getProgress();
    MINES.forEach(function(m, i) {
      var locked = !isAvailable(i);
      var b = document.createElement("button");
      b.className = "mine-marker diff-" + m.diff + (prog[i] ? " done" : "") + (i === selected ? " selected" : "") + (locked ? " level-missing" : "");
      b.dataset.fx = String(projX(m.lon));
      b.dataset.fy = String(projY(m.lat));
      b.innerHTML = '<span class="mk-txt">' + (locked ? "🔒" : (prog[i] ? "✓" : (i + 1))) + '</span>' +
        '<span class="mine-label">' + m.mine + '</span>';
      b.title = m.mine + ", " + m.country + (locked ? " - mission file missing" : "");
      b.onclick = function() { selectMine(i); };
      holder.appendChild(b);
    });
    positionMarkers();
  }

  function renderList() {
    var list = document.getElementById("map-list");
    if (!list) return;
    list.innerHTML = "";
    var prog = getProgress();
    MINES.forEach(function(m, i) {
      var locked = !isAvailable(i);
      var lvl = getLevelFor(i);
      var chip = document.createElement("button");
      chip.className = "mine-chip diff-" + m.diff + (i === selected ? " selected" : "") + (locked ? " level-missing" : "");
      chip.innerHTML = '<span class="mc-num">' + (locked ? "🔒" : (i + 1)) + '</span>' +
        '<span class="mc-name">' + m.mine + '</span>' +
        '<span class="mc-elem">' + m.elem + '</span>' +
        '<span class="mc-stars">' + (locked ? '<span class="mc-missing">MISSING</span>' : (prog[i] ? starsHtml(prog[i].stars) : '<span style="opacity:.3">⭐⭐⭐</span>')) + '</span>';
      chip.title = (lvl ? lvl.levelName + " - " : "") + m.country + " - " + DIFF_LABEL[m.diff] + (locked ? " - mission file missing" : "");
      chip.onclick = function() { selectMine(i); };
      list.appendChild(chip);
    });
  }

  function selectMine(i) {
    selected = i;
    var m = MINES[i];
    var locked = !isAvailable(i);
    var lvl = getLevelFor(i);
    var prog = getProgress();
    var el = (typeof ALL_ELEMENTS !== "undefined" && ALL_ELEMENTS[m.elem]) ? ALL_ELEMENTS[m.elem] : null;
    var detail = document.getElementById("map-detail");
    if (detail) {
      var actionHtml = locked
        ? '<div class="md-missing-note">🔒 This mission\'s level file could not be loaded. Check that its file is listed in <strong>Levels/manifest.json</strong>, then rebuild the level bundle.</div>'
        :
          '<button class="overlay-btn primary" style="width:100%" data-action="startMission" data-arg="' + i + '">⛏️ ' + (prog[i] ? 'MINE AGAIN' : 'START MISSION') + '</button>';
      detail.innerHTML =
        '<div class="md-head">' +
          '<span class="md-flag">' + m.flag + '</span>' +
          '<div class="md-title"><span class="md-mine">' + m.mine + '</span>' +
          '<span class="md-country">' + m.country + '</span></div>' +
          '<span class="md-diff diff-' + m.diff + '">' + DIFF_LABEL[m.diff] + '</span>' +
        '</div>' +
        '<div class="md-body">' +
          '<span class="md-elem" style="color:' + (el ? el.color : "#fff") + '">' + m.elem + '</span>' +
          '<div class="md-info">' +
            '<div class="md-mission">MISSION ' + (i + 1) + (lvl ? ' - ' + lvl.levelName.toUpperCase() : ' - ?') + '</div>' +
            '<div class="md-fact">' + m.fact + '</div>' +
            '<div class="md-stars">' + (locked ? '' : (prog[i] ? 'Best: ' + starsHtml(prog[i].stars) + ' · ' + prog[i].score + ' pts' : 'Not yet mined')) + '</div>' +
          '</div>' +
        '</div>' + actionHtml;
    }
    renderMarkers();
    renderList();
  }

  Game.map = {
    mines: MINES,

    show: function() {
      Game.ui.closeNotebook();
      document.getElementById("menu-overlay").classList.add("hidden");
      document.getElementById("game-overlay").classList.remove("visible");
      document.getElementById("map-overlay").classList.remove("hidden");
      loadMapImg();
      drawMapView(); // sizes the canvas synchronously so layout is settled
      bindZoom();
      resetView();
      renderMarkers();
      renderList();
      var prog = getProgress();
      var done = Object.keys(prog).length;
      var avail = availableCount();
      var counter = document.getElementById("map-progress");
      if (counter) counter.innerHTML = done >= avail
        ? '🎉 ALL ' + avail + ' MINES CONQUERED! 🎉'
        : done + ' / ' + avail + ' mines conquered';
      SFX.stopLevelMusic();
      SFX.playMenuMusic();
    },

    hide: function() {
      document.getElementById("map-overlay").classList.add("hidden");
    },

    backToMenu: function() {
      Game.map.hide();
      Game.ui.showMenu();
    },

    start: function(i) {
      if (!isAvailable(i)) return;
      Game.map.hide();
      s.mode = "custom";
      window.startLevel(i);
    },

    difficultyLabel: function(i) { return MINES[i] ? MINES[i].diff : null; },

    mineInfo: function(i) {
      var m = MINES[i];
      return m ? { mine: m.mine, country: m.country, flag: m.flag, diff: m.diff, fact: m.fact } : null;
    },

    // The next playable mine after i that has not been completed (wraps round)
    nextUnfinished: function(i) {
      var prog = getProgress();
      for (var step = 1; step < MINES.length; step++) {
        var j = (i + step) % MINES.length;
        if (isAvailable(j) && !prog[j]) return j;
      }
      return -1;
    },

    recordResult: function(levelIdx, stars, score) {
      var prog = getProgress();
      var prev = prog[levelIdx];
      prog[levelIdx] = {
        stars: Math.max(stars, prev ? prev.stars : 0),
        score: Math.max(score, prev ? prev.score : 0)
      };
      saveProgress(prog);
    },

    starTotal: function() {
      var prog = getProgress(), n = 0;
      for (var k in prog) n += prog[k].stars || 0;
      return n;
    },

    completedCount: function() {
      return Object.keys(getProgress()).length;
    },

    total: function() { return availableCount(); }
  };

  window.showMissionMap = function() { Game.map.show(); };
})();
