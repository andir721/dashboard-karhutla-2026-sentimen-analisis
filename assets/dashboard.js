/* =====================================================================
   Dashboard publik Karhutla — logika tampilan
   Tanpa library eksternal: semua grafik digambar sebagai SVG.
   Data: api/dashboard.php (diperbarui otomatis tiap KARHUTLA.refresh detik),
   atau — pada versi GitHub Pages — assets/data-statis.js yang membaca data/dashboard_data.json.
   Semua teks dari data dimasukkan lewat textContent (aman dari XSS).
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.KARHUTLA || { api: 'api/dashboard.php', prediksi: 'api/prediksi.php', refresh: 60 };
  var ORDER = ['negatif', 'netral', 'positif'];
  var LABEL = { negatif: 'Negatif', netral: 'Netral', positif: 'Positif' };
  var WARNA = { negatif: 'var(--neg)', netral: 'var(--net)', positif: 'var(--pos)' };
  var PROV = {
    // x,y = posisi ubin cadangan; ll = titik label di peta asli (bujur, lintang)
    kalbar: { nama: 'Kalimantan Barat', singkat: 'Kalbar', x: 0, y: 1, ll: [110.55, -0.15] },
    kalteng: { nama: 'Kalimantan Tengah', singkat: 'Kalteng', x: 1.04, y: 1.45, ll: [113.35, -1.65] },
    kalsel: { nama: 'Kalimantan Selatan', singkat: 'Kalsel', x: 2.08, y: 2.08, ll: [115.45, -3.05] },
    kaltim: { nama: 'Kalimantan Timur', singkat: 'Kaltim', x: 2.08, y: 1.04, ll: [116.55, 0.35] },
    kaltara: { nama: 'Kalimantan Utara', singkat: 'Kaltara', x: 2.08, y: 0, ll: [116.55, 3.25] }
  };
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var KOMUNITAS = ['var(--k1)', 'var(--k2)', 'var(--k3)', 'var(--k4)', 'var(--k5)', 'var(--k6)'];

  var S = { topikMode: 'daftar', hari: 0, prov: '', bmkg: 0, fs: '', gran: null, mode: 'jumlah', model: null, data: null, idLama: null, geo: undefined, terakhirMuat: 0 };

  // ------------------------------------------------------------------ util
  function $(s) { return document.querySelector(s); }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'cls') e.className = props[k];
      else if (k === 'style') e.style.cssText = props[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'fill' || k === 'stroke') e.style[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function kosongkan(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function angka(n) { return (n || 0).toLocaleString('id-ID'); }
  function persen(v, d) { d = d == null ? 1 : d; return (isFinite(v) ? v : 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }
  function ringkasAngka(n) { return n >= 10000 ? (n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb' : angka(n); }
  function tgl(t, tahun) { var p = t.split('-'); return +p[2] + ' ' + BULAN[+p[1] - 1] + (tahun ? ' ' + p[0] : ''); }
  function waktuWIB(iso, lengkap) {
    var d = new Date(iso);
    var o = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' };
    if (lengkap) { o.day = 'numeric'; o.month = 'short'; }
    return d.toLocaleString('id-ID', o) + ' WIB';
  }
  function relatif(iso) {
    var dt = (Date.now() - new Date(iso).getTime()) / 1000;
    if (dt < 0) dt = 0;
    if (dt < 90) return 'baru saja';
    if (dt < 3600) return Math.round(dt / 60) + ' menit lalu';
    if (dt < 86400 * 2) return Math.round(dt / 3600) + ' jam lalu';
    return waktuWIB(iso, true);
  }
  function jumlah(o) { return (o.negatif || 0) + (o.netral || 0) + (o.positif || 0); }
  function lebar(e) { return Math.max(260, e.clientWidth || e.parentNode.clientWidth || 600); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function terang(hex) {
    hex = (hex || '').replace('#', '');
    if (hex.length !== 6) return true;
    var c = [0, 2, 4].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.36;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function tabel(kolom, baris, opsi) {
    opsi = opsi || {};
    var t = h('table'), th = h('tr');
    kolom.forEach(function (k, i) { th.appendChild(h('th', { text: k, cls: i && opsi.angka !== false ? 'r' : '' })); });
    t.appendChild(h('thead', null, [th]));
    var tb = h('tbody');
    baris.forEach(function (b) {
      var tr = h('tr', b.sorot ? { cls: 'sorot' } : null);
      (b.sel || b).forEach(function (v, i) { tr.appendChild(h('td', { text: v, cls: i && opsi.angka !== false ? 'r' : '' })); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }
  function segbar(o, opsi) {
    opsi = opsi || {};
    var tot = jumlah(o), bar = h('div', { cls: 'segbar' + (opsi.tipis ? ' tipis' : ''), role: 'img' });
    var alt = [];
    ORDER.forEach(function (k) {
      var v = o[k] || 0;
      if (!v) return;
      var p = v / tot * 100;
      var seg = h('div', { cls: 's-' + k.slice(0, 3), style: 'flex:' + p + ' 1 0' });
      if (!opsi.tipis && p >= (opsi.minLabel || 11)) seg.textContent = persen(p, 0);
      seg.addEventListener('pointermove', function (e) { tip.tampil(e, LABEL[k], [[k, persen(p), angka(v) + ' unggahan']]); });
      seg.addEventListener('pointerleave', tip.sembunyi);
      bar.appendChild(seg);
      alt.push(LABEL[k] + ' ' + persen(p));
    });
    bar.setAttribute('aria-label', alt.join(', ') || 'tidak ada data');
    return bar;
  }

  // ------------------------------------------------------------------ tooltip
  var tip = (function () {
    var e = $('#tip');
    return {
      tampil: function (ev, judul, baris, catatan) {
        kosongkan(e);
        if (judul) e.appendChild(h('div', { cls: 'judul', text: judul }));
        (baris || []).forEach(function (b) {
          var kunci = b[0], warna = WARNA[kunci] || b[3];
          var r = h('div', { cls: 'baris' });
          if (warna) r.appendChild(h('i', { cls: 'sw garis', style: 'background:' + warna }));
          r.appendChild(h('b', { text: b[1] }));
          if (b[2]) r.appendChild(h('span', { text: b[2] }));
          e.appendChild(r);
        });
        if (catatan) e.appendChild(h('div', { cls: 'catatan', text: catatan }));
        e.classList.add('on');
        var x = ev.clientX + 14, y = ev.clientY + 14, w = e.offsetWidth, hh = e.offsetHeight;
        if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
        if (y + hh > window.innerHeight - 8) y = ev.clientY - hh - 14;
        e.style.left = x + 'px'; e.style.top = y + 'px';
      },
      sembunyi: function () { e.classList.remove('on'); }
    };
  })();
  window.addEventListener('scroll', tip.sembunyi, { passive: true });

  function toast(teks) {
    var t = $('#toast'); t.textContent = teks; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 3500);
  }

  // ------------------------------------------------------------------ state <-> URL
  function bacaHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    if (p.has('hari')) S.hari = Math.max(0, parseInt(p.get('hari'), 10) || 0);
    if (p.has('prov') && PROV[p.get('prov')]) S.prov = p.get('prov');
  }
  function tulisHash() {
    var p = new URLSearchParams();
    if (S.hari) p.set('hari', S.hari);
    if (S.prov) p.set('prov', S.prov);
    var str = p.toString();
    history.replaceState(null, '', str ? '#' + str : location.pathname + location.search);
  }
  function sinkronKontrol() {
    document.querySelectorAll('#f-hari button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === S.hari)); });
    $('#f-prov').value = S.prov;
    document.querySelectorAll('#feed-f button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === S.fs)); });
  }

  // ------------------------------------------------------------------ data
  function muat(diam) {
    var q = 'hari=' + S.hari + '&bmkg=' + S.bmkg + '&prov=' + encodeURIComponent(S.prov) + '&fs=' + encodeURIComponent(S.fs);
    if (!diam) $('#konten').classList.add('memuat');
    var janji = window.KARHUTLA_EMULATOR
      ? Promise.resolve(window.KARHUTLA_EMULATOR(S))
      : fetch(CFG.api + '?' + q, { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
    return janji.then(function (d) {
      if (!d || d.status !== 'success') throw new Error((d && d.message) || 'Gagal memuat data');
      S.terakhirMuat = Date.now();
      gambar(d);
    }).catch(function (err) {
      var pill = $('#status-live');
      pill.querySelector('.dot').className = 'dot';
      pill.lastChild.textContent = 'Tidak dapat memuat data';
      if (!S.data) toast(err.message);
    }).then(function () { $('#konten').classList.remove('memuat'); });
  }

  function gambar(d) {
    var lama = S.data;
    S.data = d;
    if (d.refresh_detik) CFG.refresh = d.refresh_detik;
    statusLive(d);
    hero(d);
    tren(d);
    provinsi(d);
    dampak(d);
    topik(d);
    sorotan(d);
    kataKhas(d);
    negara(d);
    feed(d, lama);
    tentangModel(d);
    prediksiStatus(d);
    var f = d.filter;
    $('#f-info').textContent = tgl(f.dari, true) + ' – ' + tgl(f.sampai, true);
    $('#periode-teks').textContent = f.hari ? f.hari + ' hari terakhir' : tgl(f.dari, true) + ' – ' + tgl(f.sampai, true);
    $('#footer-kanan').textContent = d.meta.masuk_terakhir ? (d.meta.statis ? 'Data diekspor ' : 'Data terakhir masuk ') + waktuWIB(d.meta.masuk_terakhir, true) : '';
  }

  function statusLive(d) {
    var pill = $('#status-live'), dot = pill.querySelector('.dot'), teks = pill.lastChild;
    if (d.meta.layanan_aktif) {
      dot.className = 'dot live';
      teks.textContent = 'Live · diperbarui ' + waktuWIB(d.dibuat);
    } else if (d.meta.contoh) {
      dot.className = 'dot';
      teks.textContent = 'Data contoh · ganti dengan hasil Colab';
    } else {
      dot.className = 'dot';
      teks.textContent = d.meta.tanggal_max ? 'Data s.d. ' + tgl(d.meta.tanggal_max, true) : 'Belum ada data';
    }
    pill.title = d.meta.statis ? 'Data dari hasil analisis yang diekspor ' + waktuWIB(d.dibuat, true) + '.'
      : 'Halaman memuat ulang data tiap ' + CFG.refresh + ' detik.' + (d.meta.menunggu ? ' ' + d.meta.menunggu + ' unggahan sedang diklasifikasi.' : '');
  }

  // ------------------------------------------------------------------ hero & KPI
  function hero(d) {
    var r = d.ringkas, b = r.banding, tot = r.total, pNeg = tot ? r.negatif / tot * 100 : 0;
    var wilayah = S.prov ? PROV[S.prov].nama : 'Kalimantan';
    var j = kosongkan($('#hero-judul'));
    if (!tot) j.textContent = 'Belum ada unggahan pada pilihan ini';
    else {
      j.appendChild(h('em', { text: persen(pNeg, 0) }));
      j.appendChild(document.createTextNode(' percakapan publik tentang karhutla di ' + wilayah + ' bernada negatif'));
    }
    $('#hero-lead').textContent = tot
      ? 'Berdasarkan ' + angka(tot) + ' unggahan di X (' + tgl(d.filter.dari, true) + ' – ' + tgl(d.filter.sampai, true) + ') yang dinilai otomatis oleh model kecerdasan buatan.'
      : 'Coba pilih periode yang lebih panjang atau provinsi lain.';
    $('#hero-total').textContent = angka(tot);
    var bar = $('#hero-bar'), baru = segbar(r, { minLabel: 101 }); baru.id = 'hero-bar'; bar.replaceWith(baru);
    var box = kosongkan($('#komposisi'));
    ORDER.forEach(function (k) {
      var p = tot ? r[k] / tot * 100 : 0, delta = null;
      if (b && b.total) {
        var dp = p - b[k] / b.total * 100;
        if (Math.abs(dp) >= 0.5) delta = h('span', { cls: 'delta', text: (dp > 0 ? '▲ ' : '▼ ') + Math.abs(dp).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' poin',
          title: 'Dibanding ' + d.filter.hari + ' hari sebelumnya' });
      }
      box.appendChild(h('div', { cls: 'kom' }, [
        h('div', { cls: 'kom-atas' }, [h('i', { cls: 'sw s-' + k.slice(0, 3) }), LABEL[k]]),
        h('div', { cls: 'kom-nilai', text: persen(p, 0) }),
        h('div', { cls: 'kom-sub' }, [angka(r[k]) + ' unggahan', delta ? ' · ' : '', delta])
      ]));
    });
  }

  // ------------------------------------------------------------------ tren
  function kelompokkan(harian, gran) {
    var out = [], idx = {};
    harian.forEach(function (r) {
      var key, label, mulai;
      if (gran === 'hari') { key = r.t; label = tgl(r.t); }
      else if (gran === 'bulan') { key = r.t.slice(0, 7); label = BULAN[+r.t.slice(5, 7) - 1] + ' ' + r.t.slice(2, 4); }
      else {
        var dt = new Date(r.t + 'T00:00:00Z'), dow = (dt.getUTCDay() + 6) % 7;
        dt.setUTCDate(dt.getUTCDate() - dow); mulai = dt.toISOString().slice(0, 10);
        key = mulai; label = tgl(mulai);
      }
      if (!(key in idx)) { idx[key] = out.length; out.push({ key: key, label: label, negatif: 0, netral: 0, positif: 0, hari: 0, dari: r.t, sampai: r.t }); }
      var o = out[idx[key]];
      ORDER.forEach(function (k) { o[k] += r[k]; });
      o.hari++; o.sampai = r.t;
    });
    return out;
  }
  function granOtomatis(n) { return n <= 45 ? 'hari' : n <= 400 ? 'minggu' : 'bulan'; }

  function tren(d) {
    var box = kosongkan($('#tren')), harian = d.harian || [];
    var gran = S.gran || granOtomatis(harian.length);
    document.querySelectorAll('#tren-gran button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === gran)); });
    var data = kelompokkan(harian, gran), persenMode = S.mode === 'persen';
    $('#tren-desk').textContent = 'Jumlah unggahan per ' + (gran === 'hari' ? 'hari' : gran === 'minggu' ? 'minggu' : 'bulan') + ', menurut nadanya. Arahkan kursor atau sentuh batang untuk melihat angkanya.';
    // tabel
    var tbWrap = kosongkan($('#tren-tabel'));
    tbWrap.appendChild(tabel(['Periode', 'Negatif', 'Netral', 'Positif', 'Total'], data.slice().reverse().map(function (o) {
      return [gran === 'hari' ? tgl(o.key, true) : gran === 'bulan' ? o.label : 'Minggu ' + tgl(o.dari, true), angka(o.negatif), angka(o.netral), angka(o.positif), angka(jumlah(o))];
    })));
    if (!data.length || !data.some(jumlah)) { box.appendChild(h('div', { cls: 'kosong', text: 'Belum ada unggahan pada periode ini.' })); return; }

    var W = lebar(box), H = Math.max(240, box.clientHeight || 300), m = { l: 44, r: 10, t: 22, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': 'Grafik batang bertumpuk tren sentimen' }, box);
    var maxV = persenMode ? 100 : niceMax(Math.max.apply(null, data.map(jumlah)));
    var y = function (v) { return m.t + ih - v / maxV * ih; };
    var nt = [4, 5, 3, 2].filter(function (k) { var st = maxV / k; return Math.abs(st - Math.round(st)) < 1e-9; })[0] || 4;
    for (var i = 0; i <= nt; i++) {
      var v = maxV / nt * i, yy = y(v);
      s('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, 'class': i ? 'grid-line' : 'axis-line' }, svg);
      s('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', 'class': 'num', text: persenMode ? v + '%' : ringkasAngka(v) }, svg);
    }
    var band = iw / data.length, bw = Math.max(2, Math.min(24, band * 0.72)), gap = data.length > 80 ? 1 : 2;
    var g = s('g', {}, svg);
    var tiapLabel = Math.ceil(data.length / Math.max(2, Math.floor(iw / 64)));
    var puncak = 0; data.forEach(function (o, i) { if (jumlah(o) > jumlah(data[puncak])) puncak = i; });

    data.forEach(function (o, i) {
      var tot = jumlah(o), cx = m.l + band * i + band / 2, x0 = cx - bw / 2;
      var kol = s('g', { 'class': 'mark' }, g), dasar = 0;
      var atas = ORDER.filter(function (k) { return o[k] > 0; }).pop();
      ORDER.forEach(function (k) {
        var v = persenMode ? (tot ? o[k] / tot * 100 : 0) : o[k];
        if (v <= 0) return;
        var y1 = y(dasar + v), y0 = y(dasar), tinggi = y0 - y1 - (dasar > 0 ? gap : 0);
        if (tinggi < 0.5) { dasar += v; return; }
        var yb = y0 - (dasar > 0 ? gap : 0), r = k === atas ? Math.min(4, bw / 2, tinggi) : 0;
        var dPath = 'M' + x0 + ',' + yb + 'V' + (yb - tinggi + r) + (r ? 'Q' + x0 + ',' + (yb - tinggi) + ' ' + (x0 + r) + ',' + (yb - tinggi) : '') +
          'H' + (x0 + bw - r) + (r ? 'Q' + (x0 + bw) + ',' + (yb - tinggi) + ' ' + (x0 + bw) + ',' + (yb - tinggi + r) : '') + 'V' + yb + 'Z';
        s('path', { d: dPath, fill: WARNA[k] }, kol);
        dasar += v;
      });
      if (i % tiapLabel === 0 || (data.length <= 14)) s('text', { x: cx, y: H - 10, 'text-anchor': 'middle', text: o.label }, svg);
      if (!persenMode && i === puncak && tot) s('text', { x: cx, y: y(tot) - 7, 'text-anchor': i > data.length - 3 ? 'end' : 'middle', 'class': 'lbl-kuat num', text: angka(tot) }, svg);
      var hit = s('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, 'class': 'hit' }, svg);
      var judul = gran === 'hari' ? tgl(o.key, true) : gran === 'bulan' ? o.label.replace(/ (\d\d)$/, ' 20$1') : 'Minggu ' + tgl(o.dari) + ' – ' + tgl(o.sampai, true);
      var parsial = (gran === 'minggu' && o.hari < 7) || (gran === 'bulan' && o.hari < new Date(Date.UTC(+o.key.slice(0, 4), +o.key.slice(5, 7), 0)).getUTCDate());
      hit.addEventListener('pointermove', function (e) {
        svg.classList.add('redup'); kol.classList.add('aktif');
        tip.tampil(e, judul, ORDER.slice().reverse().map(function (k) {
          return [k, persenMode ? persen(tot ? o[k] / tot * 100 : 0) : angka(o[k]), LABEL[k] + (persenMode ? ' · ' + angka(o[k]) : ' · ' + persen(tot ? o[k] / tot * 100 : 0))];
        }).concat([[null, angka(tot), 'total unggahan']]), parsial ? 'Periode belum lengkap (' + o.hari + ' hari data).' : null);
      });
      hit.addEventListener('pointerleave', function () { svg.classList.remove('redup'); kol.classList.remove('aktif'); tip.sembunyi(); });
    });
  }

  // ------------------------------------------------------------------ provinsi
  function warnaSeq(v, max) {
    var t = max ? v / max : 0, step = Math.min(7, Math.max(1, Math.round(1 + t * 6)));
    return { css: 'var(--seq-' + step + ')', hex: cssVar('--seq-' + step) };
  }
  function warnaApi(v, max) {
    var t = max ? Math.sqrt(v / max) : 0, step = Math.min(7, Math.max(1, Math.round(1 + t * 6)));
    return { css: 'var(--api-' + step + ')', hex: cssVar('--api-' + step) };
  }
  function pil(svg, x, y, judul, nilai) {
    // label berbentuk pil putih: terbaca di atas warna apa pun
    var w = Math.max(judul.length, nilai.length) * 7.2 + 16, g = s('g', { 'class': 'pil', transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' }, svg);
    s('rect', { x: -w / 2, y: -17, width: w, height: 34, rx: 9 }, g);
    s('text', { y: -3, 'text-anchor': 'middle', 'class': 'pil-nama', text: judul }, g);
    s('text', { y: 11, 'text-anchor': 'middle', 'class': 'pil-nilai num', text: nilai }, g);
    return g;
  }
  function muatGeo() {
    if (S.geo !== undefined) return Promise.resolve(S.geo);
    if (window.KARHUTLA_EMULATOR && !CFG.statis) { S.geo = null; return Promise.resolve(null); }
    return fetch('data/kalimantan.geojson').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (g) { S.geo = g; return g; }).catch(function () { S.geo = null; return null; });
  }
  function provinsi(d) {
    var list = d.provinsi || [], max = Math.max.apply(null, list.map(function (p) { return p.total; }).concat([1]));
    var byKode = {}; list.forEach(function (p) { byKode[p.kode] = p; });
    // daftar
    var wrap = kosongkan($('#prov-list'));
    list.slice().sort(function (a, b) { return b.total - a.total; }).forEach(function (p) {
      var row = h('button', { cls: 'prov-row', type: 'button', 'aria-pressed': String(S.prov === p.kode),
        onclick: function () { pilihProv(p.kode); } }, [
        h('span', { cls: 'nm', text: p.nama.replace('Kalimantan ', 'Kal. '), title: p.nama }), h('span', { cls: 'n num', text: angka(p.total) }), segbar(p, { tipis: true })]);
      wrap.appendChild(row);
    });
    kosongkan($('#prov-tabel')).appendChild(tabel(['Provinsi', 'Negatif', 'Netral', 'Positif', 'Total', '% negatif'], list.map(function (p) {
      return [p.nama, angka(p.negatif), angka(p.netral), angka(p.positif), angka(p.total), persen(p.total ? p.negatif / p.total * 100 : 0)];
    })));
    muatGeo().then(function (geo) { petaGambar(byKode, max, geo); });
    tempat(d);
  }
  function tempat(d) {
    var box = kosongkan($('#tempat')), daftar = (d.analisis && d.analisis.tempat) || [];
    if (S.prov) daftar = daftar.filter(function (t) { return t.prov === S.prov; });
    daftar = daftar.slice(0, 8);
    box.hidden = !daftar.length;
    if (!daftar.length) return;
    var maks = daftar[0].jumlah;
    box.appendChild(h('h3', { text: 'Kota/kabupaten yang paling sering disebut' + (S.prov ? ' di ' + PROV[S.prov].singkat : '') }));
    daftar.forEach(function (t) {
      box.appendChild(h('div', { cls: 'tempat-row' }, [
        h('span', { cls: 'nm' }, [t.tempat, h('small', { text: ' ' + t.singkat })]),
        h('span', { cls: 'bar-wrap' }, [h('i', { style: 'width:' + Math.max(3, t.jumlah / maks * 100) + '%' })]),
        h('span', { cls: 'n num', text: angka(t.jumlah) })
      ]));
    });
    box.appendChild(h('p', { cls: 'catatan-kecil', text: 'Dihitung dari seluruh periode.' }));
  }
  function petaGambar(byKode, max, geo) {
    var box = kosongkan($('#peta')), W = lebar(box);
    var tipProv = function (e, kode) {
      var p = byKode[kode] || { negatif: 0, netral: 0, positif: 0, total: 0, nama: PROV[kode].nama };
      tip.tampil(e, PROV[kode].nama, ORDER.map(function (k) { return [k, angka(p[k]), LABEL[k] + ' · ' + persen(p.total ? p[k] / p.total * 100 : 0)]; })
        .concat([[null, angka(p.total), 'unggahan menyebut provinsi ini']]), 'Klik untuk memfilter dashboard.');
    };
    var aktif = function (kode) { return !S.prov || S.prov === kode; };
    if (geo && geo.features) {
      var b = [180, 90, -180, -90];
      geo.features.forEach(function (f) { koordinat(f.geometry).forEach(function (c) { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }); });
      var pad = 6, sk = (W - pad * 2) / (b[2] - b[0]), H = Math.round((b[3] - b[1]) * sk + pad * 2);
      var X = function (lon) { return pad + (lon - b[0]) * sk; }, Y = function (lat) { return pad + (b[3] - lat) * sk; };
      var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': 'Peta provinsi Kalimantan' }, box);
      var lapLabel = s('g', {}, null);
      geo.features.forEach(function (f) {
        var kode = f.properties && f.properties.kode; if (!PROV[kode]) return;
        var p = byKode[kode] || { total: 0 }, w = warnaApi(p.total, max);
        var g = s('g', { 'class': 'peta-tile' + (S.prov === kode ? ' pilih-aktif' : '') + (aktif(kode) ? '' : ' redup-prov'), tabindex: 0, role: 'button', 'aria-label': PROV[kode].nama + ', ' + p.total + ' unggahan' }, svg);
        var dd = '';
        poligon(f.geometry).forEach(function (ring) {
          dd += ring.map(function (c, i) { return (i ? 'L' : 'M') + X(c[0]).toFixed(1) + ',' + Y(c[1]).toFixed(1); }).join('') + 'Z';
        });
        s('path', { d: dd, fill: w.css, stroke: 'var(--surface)', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
        g.addEventListener('pointermove', function (e) { tipProv(e, kode); });
        g.addEventListener('pointerleave', tip.sembunyi);
        g.addEventListener('click', function () { tip.sembunyi(); pilihProv(kode); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilihProv(kode); } });
        var ll = PROV[kode].ll, lx = Math.min(W - 34, Math.max(34, X(ll[0]))), ly = Math.min(H - 18, Math.max(18, Y(ll[1])));
        var lp = pil(lapLabel, lx, ly, PROV[kode].singkat, angka(p.total));
        if (!aktif(kode)) lp.setAttribute('opacity', '0.45');
      });
      svg.appendChild(lapLabel);   // label di atas semua wilayah
      lapLabel.style.pointerEvents = 'none';
      return;
    }
    // kartogram ubin (tanpa berkas peta): posisi kira-kira sesuai geografi
    var u = Math.min((W - 8) / 3.1, 96), H2 = u * 3.12;
    var svg2 = s('svg', { viewBox: '0 0 ' + (u * 3.1) + ' ' + H2, height: H2, style: 'max-width:' + (u * 3.1) + 'px;margin:0 auto', role: 'img', 'aria-label': 'Kartogram provinsi Kalimantan' }, box);
    Object.keys(PROV).forEach(function (kode) {
      var P = PROV[kode], p = byKode[kode] || { total: 0 }, w = warnaApi(p.total, max);
      var g = s('g', { 'class': 'peta-tile' + (S.prov === kode ? ' pilih-aktif' : '') + (aktif(kode) ? '' : ' redup-prov'), tabindex: 0, role: 'button', 'aria-label': P.nama + ', ' + p.total + ' unggahan' }, svg2);
      s('rect', { x: P.x * u + 2, y: P.y * u + 2, width: u - 4, height: u - 4, rx: 12, fill: w.css }, g);
      pil(g, P.x * u + u / 2, P.y * u + u / 2, P.singkat, angka(p.total));
      g.addEventListener('pointermove', function (e) { tipProv(e, kode); });
      g.addEventListener('pointerleave', tip.sembunyi);
      g.addEventListener('click', function () { tip.sembunyi(); pilihProv(kode); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilihProv(kode); } });
    });
  }
  function poligon(g) { return g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? [].concat.apply([], g.coordinates) : []; }
  function koordinat(g) { return [].concat.apply([], poligon(g)); }
  function pilihProv(kode) { S.prov = S.prov === kode ? '' : kode; sinkronKontrol(); tulisHash(); muat(); }

  // ------------------------------------------------------------------ dampak & BMKG
  function dampak(d) {
    var box = kosongkan($('#dampak')), tot = d.ringkas.total || 0;
    (d.dampak || []).forEach(function (r) {
      box.appendChild(h('div', { cls: 'dampak-row' }, [
        h('div', { cls: 'nm' }, [r.nama, h('small', { text: persen(tot ? r.total / tot * 100 : 0, 0) + ' dari semua unggahan' })]),
        r.total ? segbar(r) : h('div', { cls: 'catatan-kecil', text: 'tidak ada' }),
        h('div', { cls: 'n num', text: angka(r.total) })
      ]));
    });
    if ($('#dampak-tabel')) kosongkan($('#dampak-tabel')).appendChild(tabel(['Isu', 'Unggahan', '% dari unggahan', 'Negatif', 'Netral', 'Positif'], (d.dampak || []).map(function (r) {
      return [r.nama, angka(r.total), persen(tot ? r.total / tot * 100 : 0), persen(r.total ? r.negatif / r.total * 100 : 0), persen(r.total ? r.netral / r.total * 100 : 0), persen(r.total ? r.positif / r.total * 100 : 0)];
    })));
  }
  // ------------------------------------------------------------------ cakupan analisis kata
  // Kata khas, topik, dan negara dihitung di Python untuk seluruh periode. Bila satu provinsi dipilih,
  // dipakai rincian provinsi itu (per_prov) jika tersedia; keterangan cakupan selalu ditampilkan.
  function analisisAktif(d) {
    var A = d.analisis || {}, P = S.prov && A.per_prov ? A.per_prov[S.prov] : null;
    var wil = S.prov ? PROV[S.prov].nama : 'Seluruh Kalimantan', waktu = 'seluruh periode';
    var hasil = { kata_khas: A.kata_khas, topik: A.topik, negara: A.negara, label: {}, prov: !!P };
    ['kk', 'topik', 'negara'].forEach(function (k) { hasil.label[k] = wil + ' · ' + waktu; });
    if (S.prov && !P) {
      ['kk', 'topik', 'negara'].forEach(function (k) { hasil.label[k] = 'Seluruh Kalimantan · ' + waktu + ' (rincian per provinsi menunggu pembaruan analisis)'; });
    } else if (P) {
      hasil.topik = P.topik || A.topik; hasil.negara = P.negara || A.negara;
      if (P.kata_khas) hasil.kata_khas = P.kata_khas;
      else hasil.label.kk = 'Seluruh Kalimantan · ' + waktu + ' (unggahan ' + PROV[S.prov].singkat + ' terlalu sedikit untuk kata khas sendiri)';
    }
    if (d.filter.hari) ['kk', 'topik', 'negara'].forEach(function (k) { hasil.label[k] += '; tidak dipengaruhi pilihan ' + d.filter.hari + ' hari'; });
    return hasil;
  }
  function tulisCakupan(id, teks) {
    var e = $(id); if (!e) return;
    e.textContent = teks; e.hidden = !(S.prov || (S.data && S.data.filter.hari));
  }

  // ------------------------------------------------------------------ kata khas
  function kataKhas(d) {
    var box = kosongkan($('#kata-khas')), X = analisisAktif(d), a = { kata_khas: X.kata_khas };
    tulisCakupan('#cakupan-kk', X.label.kk);
    if (!a || !a.kata_khas) { box.appendChild(h('div', { cls: 'kosong', text: 'Analisis kata belum tersedia.' })); return; }
    ORDER.forEach(function (k) {
      var daftar = (a.kata_khas[k] || []).slice(0, 8), max = Math.max.apply(null, daftar.map(function (x) { return x.z; }).concat([1]));
      var kol = h('div', { cls: 'kk-kolom' }, [h('h4', null, [h('i', { cls: 'sw s-' + k.slice(0, 3) }), LABEL[k]])]);
      if (!daftar.length) kol.appendChild(h('div', { cls: 'catatan-kecil', text: 'Belum cukup data.' }));
      daftar.forEach(function (x) {
        var bar = h('div', { cls: 'kk-bar' }, [h('i', { style: 'width:' + (x.z / max * 72) + '%;background:' + WARNA[k] }), h('span', { text: angka(x.n) })]);
        var it = h('div', { cls: 'kk-item' }, [h('span', { cls: 'kata', text: x.kata }), bar]);
        it.addEventListener('pointermove', function (e) {
          tip.tampil(e, '“' + x.kata + '”', [[k, persen(x.pct_kelas), 'unggahan ' + k + ' memakai kata ini'], [null, persen(x.pct_lain), 'unggahan bernada lain']]);
        });
        it.addEventListener('pointerleave', tip.sembunyi);
        kol.appendChild(it);
      });
      box.appendChild(kol);
    });
  }

  // ------------------------------------------------------------------ jaringan kata (force layout sederhana)
  function tataKelompok(anggota) {
    // node terbesar di tengah; node berikutnya dicari di sepanjang spiral sampai tidak bertabrakan (lingkaran + label)
    var kotak = [];
    anggota.sort(function (a, b) { return b.n - a.n; }).forEach(function (n, i) {
      var w = Math.max(n.r * 2, n.label.length * n.fs * 0.58) + 6, hh = n.r * 2 + n.fs + 6;
      for (var t = 0; t < 4000; t++) {
        var rad = i === 0 ? 0 : 4 * Math.sqrt(t + 1), ang = t * 2.399963;
        var x = Math.cos(ang) * rad, y = Math.sin(ang) * rad * 0.8;
        var cy = y + n.fs / 2, bebas = kotak.every(function (k) { return Math.abs(k.x - x) * 2 >= k.w + w || Math.abs(k.y - cy) * 2 >= k.h + hh; });
        if (bebas) { n.lx = x; n.ly = y; kotak.push({ x: x, y: y + n.fs / 2, w: w, h: hh }); break; }
      }
    });
    var cx = 0, cy = 0; anggota.forEach(function (n) { cx += n.lx; cy += n.ly; }); cx /= anggota.length; cy /= anggota.length;
    var R = 0;
    anggota.forEach(function (n) { n.lx -= cx; n.ly -= cy; R = Math.max(R, Math.hypot(n.lx, n.ly + n.fs / 2) + Math.max(n.r, n.label.length * n.fs * 0.3) + 8); });
    return R;
  }
  function jaringan(d, box, leg) {
    kosongkan(box); kosongkan(leg);
    var J = d.analisis && d.analisis.jaringan;
    if (!J || !J.simpul || !J.simpul.length) { box.appendChild(h('div', { cls: 'kosong', text: 'Jaringan kata belum tersedia.' })); return; }
    var maxN = Math.max.apply(null, J.simpul.map(function (n) { return n.n; }));
    var warnaK = function (i) { return J.kelompok[i] && J.kelompok[i].negara ? 'var(--kn)' : KOMUNITAS[i % KOMUNITAS.length]; };
    var N = J.simpul.map(function (n) {
      return { id: n.id, label: n.label || n.id, n: n.n, k: n.k, negara: n.negara, r: 6 + 16 * Math.sqrt(n.n / maxN), fs: 11 + 4 * Math.sqrt(n.n / maxN) };
    });
    var idx = {}; N.forEach(function (n, i) { idx[n.id] = i; });
    // 1) tata tiap kelompok
    var G = J.kelompok.map(function (kel, i) {
      var ang = N.filter(function (n) { return n.k === i; });
      return { i: i, nama: kel.nama, anggota: ang, R: ang.length ? tataKelompok(ang) : 0 };
    }).filter(function (g) { return g.anggota.length; });
    // 2) pak lingkaran kelompok: terbesar di tengah, lainnya di spiral tanpa tumpang tindih (sisakan ruang nama kelompok)
    var urut = G.slice().sort(function (a, b) { return b.R - a.R; }), taruh = [];
    urut.forEach(function (g, i) {
      for (var t = 0; t < 6000; t++) {
        var rad = i === 0 ? 0 : 6 * Math.sqrt(t), ang = t * 0.7;
        var x = Math.cos(ang) * rad * 1.25, y = Math.sin(ang) * rad * 0.8;
        if (taruh.every(function (o) { return Math.hypot(o.x - x, o.y - y) >= o.R + g.R + 36; })) { g.x = x; g.y = y; taruh.push(g); break; }
      }
    });
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    G.forEach(function (g) { b[0] = Math.min(b[0], g.x - g.R); b[1] = Math.min(b[1], g.y - g.R - 22); b[2] = Math.max(b[2], g.x + g.R); b[3] = Math.max(b[3], g.y + g.R); });
    N.forEach(function (n) { var g = G.filter(function (x) { return x.i === n.k; })[0]; n.x = g.x + n.lx; n.y = g.y + n.ly; });
    var VW = b[2] - b[0] + 16, VH = b[3] - b[1] + 16;
    var W = lebar(box), Hh = Math.min(620, Math.max(320, W * VH / VW));
    box.style.height = Hh + 'px';
    var svg = s('svg', { viewBox: (b[0] - 8) + ' ' + (b[1] - 8) + ' ' + VW + ' ' + VH, height: Hh, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Jaringan kata yang sering muncul bersama' }, box);
    G.forEach(function (g) {
      var c = s('circle', { cx: g.x, cy: g.y, r: g.R, fill: warnaK(g.i), opacity: 0.08 }, svg); c.style.pointerEvents = 'none';
      var t = s('text', { x: g.x, y: g.y - g.R - 8, 'text-anchor': 'middle', 'class': 'lbl-kuat', style: 'font-size:13px', text: g.nama }, svg); t.style.fill = 'var(--ink-2)';
    });
    var E = J.garis.filter(function (e) { return e.a in idx && e.b in idx; }).map(function (e) { return { a: idx[e.a], b: idx[e.b], w: e.w }; });
    var maxW = Math.max.apply(null, E.map(function (e) { return e.w; }).concat([0.01]));
    var gE = s('g', {}, svg), gN = s('g', {}, svg);
    var elE = E.map(function (e) {
      var P = N[e.a], Q = N[e.b], antar = P.k !== Q.k;
      return s('line', { x1: P.x, y1: P.y, x2: Q.x, y2: Q.y, 'class': 'edge', 'stroke-width': (0.8 + 3.4 * e.w / maxW).toFixed(2), opacity: antar ? 0.25 : 0.8 }, gE);
    });
    N.forEach(function (n, i) {
      var g = s('g', { 'class': 'node', transform: 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')', tabindex: 0 }, gN);
      s('circle', { r: n.r, fill: warnaK(n.k) }, g);
      s('text', { y: n.r + n.fs * 0.95, 'text-anchor': 'middle', style: 'font-size:' + n.fs.toFixed(1) + 'px', text: n.label }, g);
      n.el = g;
      var masuk = function () {
        box.classList.add('fokus'); g.classList.add('dekat');
        E.forEach(function (e, k) { if (e.a === i || e.b === i) { elE[k].classList.add('dekat'); N[e.a === i ? e.b : e.a].el.classList.add('dekat'); } });
      };
      var keluar = function () { box.classList.remove('fokus'); tip.sembunyi(); box.querySelectorAll('.dekat').forEach(function (x) { x.classList.remove('dekat'); }); };
      g.addEventListener('pointerenter', masuk); g.addEventListener('focus', masuk);
      g.addEventListener('pointerleave', keluar); g.addEventListener('blur', keluar);
      g.addEventListener('pointermove', function (ev) {
        var pas = E.filter(function (e) { return e.a === i || e.b === i; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 3)
          .map(function (e) { return N[e.a === i ? e.b : e.a].label; });
        tip.tampil(ev, n.label, [[null, angka(n.n), 'unggahan memuat kata ini', warnaK(n.k)]], 'Kelompok: ' + J.kelompok[n.k].nama + (pas.length ? '. Sering bersama: ' + pas.join(', ') + '.' : ''));
      });
    });
    J.kelompok.forEach(function (kel, i) {
      leg.appendChild(h('span', null, [h('i', { cls: 'sw', style: 'background:' + warnaK(i) + ';border-radius:50%' }), kel.nama]));
    });
  }

  function topik(d) {
    var A = d.analisis || {}, J = A.jaringan, X = analisisAktif(d), T = X.topik;
    tulisCakupan('#cakupan-topik', S.topikMode === 'jaringan' ? 'Jaringan selalu untuk seluruh Kalimantan · seluruh periode' : X.label.topik);
    var daftarBox = kosongkan($('#topik')), jarBox = $('#jaringan'), leg = $('#jaringan-legenda');
    var modeJar = S.topikMode === 'jaringan';
    document.querySelectorAll('#topik-mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === (modeJar ? 'jaringan' : 'daftar'))); });
    daftarBox.hidden = modeJar; jarBox.parentNode.hidden = !modeJar;
    if (modeJar) { if (J && J.simpul && J.simpul.length) jaringan(d, jarBox, leg); return; }
    if (!J || !J.kelompok || !J.kelompok.length) { daftarBox.appendChild(h('div', { cls: 'kosong', text: 'Belum tersedia.' })); return; }
    var warnaK = function (i) { return KOMUNITAS[i % KOMUNITAS.length]; };
    if (T && T.length) {
      // versi baru: tiap topik punya jumlah unggahan & komposisi nada
      T.forEach(function (t) {
        var tot = jumlah(t), pNeg = tot ? t.negatif / tot * 100 : 0;
        var maks = t.kata.length ? t.kata[0].n : 1;
        daftarBox.appendChild(h('div', { cls: 'topik' }, [
          h('div', { cls: 'topik-judul' }, [h('i', { cls: 'sw', style: 'background:' + warnaK(t.k) + ';border-radius:50%' }), h('span', { text: t.nama }),
            h('span', { cls: 'topik-n', text: persen(t.persen, 0) + ' unggahan · ' + persen(pNeg, 0) + ' negatif' })]),
          segbar(t, { tipis: true }),
          h('div', { cls: 'topik-kata' }, t.kata.slice(0, 8).map(function (x) {
            return h('span', { cls: 'chip' + (x.n >= maks * 0.6 ? ' kuat' : ''), text: x.kata, title: angka(x.n) + ' unggahan' });
          }))
        ]));
      });
      return;
    }
    // cadangan untuk ringkasan lama (tanpa data topik)
    J.kelompok.forEach(function (kel, i) {
      if (kel.negara) return;
      var kata = J.simpul.filter(function (n) { return n.k === i; }).sort(function (a, b) { return b.n - a.n; });
      if (!kata.length) return;
      daftarBox.appendChild(h('div', { cls: 'topik' }, [
        h('div', { cls: 'topik-judul' }, [h('i', { cls: 'sw', style: 'background:' + warnaK(i) + ';border-radius:50%' }), kel.nama]),
        h('div', { cls: 'topik-kata' }, kata.slice(0, 8).map(function (n) { return h('span', { cls: 'chip', text: n.label || n.id }); }))
      ]));
    });
  }

  // ------------------------------------------------------------------ sorotan (kesimpulan otomatis)
  function sorotan(d) {
    var box = kosongkan($('#sorotan-isi')), poin = [], A = d.analisis || {}, X = analisisAktif(d);
    // 1. kapan paling ramai
    var data = kelompokkan(d.harian || [], granOtomatis((d.harian || []).length)), puncak = null;
    data.forEach(function (o) { if (!puncak || jumlah(o) > jumlah(puncak)) puncak = o; });
    if (puncak && jumlah(puncak)) {
      var gran = granOtomatis((d.harian || []).length);
      var kapan = gran === 'hari' ? 'tanggal ' + tgl(puncak.key, true) : gran === 'bulan' ? 'bulan ' + puncak.label.replace(/ (\d\d)$/, ' 20$1') : 'pekan ' + tgl(puncak.dari) + ' – ' + tgl(puncak.sampai, true);
      poin.push(['Paling ramai', 'pada ' + kapan + ', dengan ' + angka(jumlah(puncak)) + ' unggahan.']);
    }
    // 2. wilayah
    var prov = (d.provinsi || []).slice().sort(function (a, b) { return b.total - a.total; })[0];
    if (prov && prov.total && !S.prov) {
      var kota = (A.tempat || []).filter(function (t) { return t.prov === prov.kode; })[0];
      poin.push(['Wilayah', prov.nama + ' paling sering disebut (' + angka(prov.total) + ' unggahan)' + (kota ? ', terutama ' + kota.tempat : '') + '.']);
    }
    // 3. dampak
    var dm = (d.dampak || []).filter(function (x) { return x.total >= 20; });
    if (dm.length) {
      var banyak = dm.slice().sort(function (a, b) { return b.total - a.total; })[0];
      var negatif = dm.slice().sort(function (a, b) { return b.negatif / b.total - a.negatif / a.total; })[0];
      poin.push(['Dampak', 'yang paling banyak dibahas adalah ' + banyak.nama.toLowerCase() + ' (' + persen(d.ringkas.total ? banyak.total / d.ringkas.total * 100 : 0, 0) + ' unggahan)' +
        (negatif.kode !== banyak.kode ? '; yang paling bernada negatif adalah ' + negatif.nama.toLowerCase() + ' (' + persen(negatif.negatif / negatif.total * 100, 0) + ' negatif).' :
          ', sekaligus paling bernada negatif (' + persen(negatif.negatif / negatif.total * 100, 0) + ').')]);
    }
    // 4. topik / harapan
    if (X.topik && X.topik.length) {
      var t = X.topik.slice().sort(function (a, b) { return b.jumlah - a.jumlah; })[0];
      poin.push(['Topik terbesar', t.nama.charAt(0).toLowerCase() + t.nama.slice(1) + ', dibahas di ' + persen(t.persen, 0) + ' unggahan (' + persen(jumlah(t) ? t.negatif / jumlah(t) * 100 : 0, 0) + ' bernada negatif).']);
    } else if (X.kata_khas && X.kata_khas.positif && X.kata_khas.positif.length) {
      poin.push(['Nada positif', 'umumnya memuat kata ' + X.kata_khas.positif.slice(0, 3).map(function (x) { return '“' + x.kata + '”'; }).join(', ') + '.']);
    }
    box.parentNode.hidden = !poin.length;
    poin.forEach(function (p) { box.appendChild(h('li', null, [h('b', { text: p[0] + ' ' }), p[1]])); });
  }

  // ------------------------------------------------------------------ negara
  function negara(d) {
    var box = kosongkan($('#negara')), X = analisisAktif(d), N = X.negara;
    tulisCakupan('#cakupan-negara', X.label.negara);
    if (!N || !N.daftar || !N.daftar.length) { box.appendChild(h('div', { cls: 'kosong', text: 'Belum ada negara luar yang disebut.' })); $('#negara-desk').textContent = ''; return; }
    $('#negara-desk').textContent = persen(N.n_total ? N.n_pernah / N.n_total * 100 : 0, 0) + ' unggahan menyebut negara atau organisasi lain, terutama karena kabut asap lintas batas. Klik nama untuk konteksnya.';
    var max = N.daftar[0].jumlah;
    N.daftar.slice(0, 6).forEach(function (r, i) {
      var det = h('details', { cls: 'neg-row' });
      det.appendChild(h('summary', null, [
        h('span', null, [h('b', { text: r.negara })]),
        h('span', null, [h('div', { cls: 'bar', style: 'width:' + Math.max(2, r.jumlah / max * 100) + '%' })]),
        h('span', { cls: 'n num', text: angka(r.jumlah) + ' unggahan' })]));
      det.appendChild(h('p', null, [h('span', { cls: 'chip', text: r.jenis }), ' ', r.konteks]));
      box.appendChild(det);
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(N.konteks_per || '')) {
      box.appendChild(h('p', { cls: 'catatan-kecil', style: 'margin-top:10px', text: 'Konteks dirangkum dari pemberitaan per ' + tgl(N.konteks_per, true) + '.' }));
    }
  }

  // ------------------------------------------------------------------ feed
  function feed(d, lama) {
    var box = kosongkan($('#feed')), idLama = S.idLama, baru = 0;
    if (!d.feed.length) box.appendChild(h('div', { cls: 'kosong', text: 'Belum ada unggahan.' }));
    d.feed.slice(0, 6).forEach(function (p) {
      var isBaru = idLama && !idLama.has(p.id);
      if (isBaru) baru++;
      var atas = h('div', { cls: 'atas' }, [
        h('span', { cls: 'label-s' }, [h('i', { cls: 'sw s-' + p.sentimen.slice(0, 3) }), LABEL[p.sentimen]]),
        h('span', { text: '· ' + relatif(p.waktu) })
      ]);
      p.prov.forEach(function (k) { if (PROV[k]) atas.appendChild(h('span', { cls: 'chip', text: PROV[k].singkat })); });
      box.appendChild(h('article', { cls: 'post ' + p.sentimen + (isBaru ? ' baru' : '') }, [atas, h('div', { cls: 'teks', text: p.teks })]));
    });
    if (baru && lama && lama.filter.fs === d.filter.fs && lama.filter.prov === d.filter.prov) toast(baru + ' unggahan baru masuk');
    S.idLama = new Set(d.feed.map(function (p) { return p.id; }));
  }

  // ------------------------------------------------------------------ prediksi
  var CONTOH = ['Asap makin pekat di Palangka Raya, anak-anak batuk dan sekolah diliburkan lagi. Pemerintah ke mana?',
    'Alhamdulillah hujan deras turun di Pontianak, semoga titik api cepat padam.',
    'BPBD bersama TNI melakukan pemadaman di Kabupaten Kubu Raya pagi ini.'];
  function prediksiStatus(d) {
    if (!$('#btn-pred')) return;
    var aktif = !!d.meta.prediksi_publik;
    $('#btn-pred').disabled = !aktif;
    $('#pred-status').textContent = aktif ? '' : 'Layanan model sedang offline. Fitur ini aktif saat server model berjalan.';
  }
  function siapkanPrediksi() {
    if (!$('#form-pred')) return;
    var c = $('#contoh-pred');
    CONTOH.forEach(function (t, i) { c.appendChild(h('button', { type: 'button', text: 'Contoh ' + (i + 1), title: t, onclick: function () { $('#teks-pred').value = t; } })); });
    $('#form-pred').addEventListener('submit', function (e) {
      e.preventDefault();
      var teks = $('#teks-pred').value.trim(), out = kosongkan($('#hasil-pred')), btn = $('#btn-pred');
      if (teks.length < 10) { out.appendChild(h('span', { cls: 'catatan-kecil', text: 'Tulis minimal satu kalimat.' })); return; }
      btn.disabled = true; $('#pred-status').textContent = 'Memproses…';
      fetch(CFG.prediksi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: teks }) })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r.status !== 'success') throw new Error(r.message || 'Gagal');
          out.appendChild(h('div', { cls: 'catatan-kecil', text: 'Model menilai teks ini' }));
          out.appendChild(h('div', { cls: 'besar' }, [h('i', { cls: 'sw s-' + r.label.slice(0, 3), style: 'width:14px;height:14px' }), LABEL[r.label] || r.label]));
          var sk = r.skor_kelas || {}; var o = {}; ORDER.forEach(function (k) { o[k] = Math.round((sk[k] || 0) * 1000); });
          out.appendChild(h('div', { style: 'margin:12px 0 6px' }, [segbar(o, { minLabel: 14 })]));
          out.appendChild(h('div', { cls: 'catatan-kecil', text: 'Skor relatif tiap kelas (softmax dari fungsi keputusan SVM), bukan probabilitas terkalibrasi.' }));
          if (r.penanda) {
            var tags = Object.keys(PROV).filter(function (k) { return r.penanda['p_' + k]; }).map(function (k) { return PROV[k].singkat; });
            ['kesehatan', 'lingkungan', 'aktivitas'].forEach(function (k) { if (r.penanda['d_' + k]) tags.push('isu ' + k); });
            if (tags.length) out.appendChild(h('div', { style: 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap' }, tags.map(function (t) { return h('span', { cls: 'chip', text: t }); })));
          }
          $('#pred-status').textContent = '';
        })
        .catch(function (err) { out.appendChild(h('span', { cls: 'catatan-kecil', text: err.message })); $('#pred-status').textContent = ''; })
        .then(function () { btn.disabled = !(S.data && S.data.meta.prediksi_publik); });
    });
  }

  // ------------------------------------------------------------------ model
  var NAMA_METRIK = [['accuracy', 'Akurasi'], ['precision_macro', 'Presisi (macro)'], ['recall_macro', 'Recall (macro)'], ['f1_macro', 'F1 (macro)'], ['cv_f1_macro', 'F1 macro 5-fold CV']];
  function tentangModel(d) {
    var M = d.model, ring = $('#model-ringkas'), det = kosongkan($('#model-detail'));
    var kotak = $('#model-angka'), banding = $('#model-banding');
    if (kotak) kosongkan(kotak);
    if (banding) kosongkan(banding);
    if (!M || !M.model || !M.model.length) { ring.textContent = ''; det.appendChild(h('div', { cls: 'catatan-kecil', text: 'Ringkasan evaluasi belum diimpor.' })); return; }
    var best = M.model.filter(function (m) { return m.nama === M.terbaik; })[0] || M.model[0];
    if (kotak) {
      [['Akurasi', persen(best.accuracy * 100, 1), 'tebakan nada yang tepat'],
       ['F1-makro', best.f1_macro != null ? persen(best.f1_macro * 100, 1) : '–', 'rata-rata ketiga nada'],
       ['Data uji', angka(M.n_test), 'unggahan di luar data latih']].forEach(function (x) {
        kotak.appendChild(h('div', { cls: 'ma' }, [h('span', { cls: 'ma-label', text: x[0] }), h('span', { cls: 'ma-nilai num', text: x[1] }), h('span', { cls: 'ma-sub', text: x[2] })]));
      });
      ring.textContent = 'Model yang dipakai: ' + best.nama + (M.model.length > 1 ? ', karena F1-makronya tertinggi di antara ' + M.model.length + ' model yang diuji.' : '.');
    } else {
      ring.textContent = 'Pada data uji yang tidak dipakai saat pelatihan (' + angka(M.n_test) + ' unggahan), model ' + best.nama +
        ' mencapai akurasi ' + persen(best.accuracy * 100, 0) + (best.f1_macro != null ? ' dan F1-makro ' + persen(best.f1_macro * 100, 0) : '') + '.';
    }
    if (banding && M.model.length > 1) {
      banding.appendChild(h('div', { cls: 'mb-judul', text: 'F1-makro tiap model (0–100%)' }));
      M.model.slice().sort(function (a, b) { return (b.f1_macro || 0) - (a.f1_macro || 0); }).forEach(function (x) {
        var v = (x.f1_macro || 0) * 100, dipakai = x.nama === M.terbaik;
        banding.appendChild(h('div', { cls: 'mb-row' + (dipakai ? ' dipakai' : ''), title: x.nama + (dipakai ? ' (dipakai)' : '') + ' — F1-makro ' + persen(v) + ', akurasi ' + persen((x.accuracy || 0) * 100) }, [
          h('span', { cls: 'mb-nama', text: x.nama + (dipakai ? ' · dipakai' : '') }),
          h('span', { cls: 'mb-track' }, [h('span', { cls: 'mb-bar', style: 'width:' + Math.max(0, Math.min(100, v)).toFixed(1) + '%' })]),
          h('span', { cls: 'mb-nilai num', text: persen(v) })
        ]));
      });
    }
    det.appendChild(h('div', { cls: 'tbl-wrap' }, [tabel(['Model'].concat(NAMA_METRIK.map(function (x) { return x[1]; })), M.model.map(function (x) {
      return { sorot: x.nama === M.terbaik, sel: [x.nama + (x.nama === M.terbaik ? ' (dipakai)' : '')].concat(NAMA_METRIK.map(function (nm) { return persen((x[nm[0]] || 0) * 100); })) };
    }))]));
    det.appendChild(h('div', { cls: 'catatan-kecil', style: 'margin:12px 0 6px', text: 'Matriks kebingungan ' + best.nama + ' (baris = label, kolom = tebakan model)' }));
    var cm = h('div', { cls: 'cm' });
    cm.appendChild(h('div', { cls: 'h' })); ORDER.forEach(function (k) { cm.appendChild(h('div', { cls: 'h', text: LABEL[k] })); });
    best.confusion.forEach(function (row, i) {
      var tot = row.reduce(function (a, b) { return a + b; }, 0);
      cm.appendChild(h('div', { cls: 'h', text: LABEL[ORDER[i]] }));
      row.forEach(function (v) {
        var w = warnaSeq(tot ? v / tot : 0, 1);
        cm.appendChild(h('div', { style: 'background:' + w.css + ';color:' + (terang(w.hex) ? '#0b0b0b' : '#fff') }, [h('b', { text: angka(v) })]));
      });
    });
    det.appendChild(cm);
    var la = M.label_awal;
    det.appendChild(h('p', { cls: 'catatan-kecil', style: 'margin-top:10px', text: 'Fitur: ' + M.fitur + '. ' + angka(M.n_train) + ' data latih, ' + angka(M.n_test) +
      ' data uji. Label latih dibuat otomatis' + (M.pelabel ? ' oleh ' + M.pelabel : '') + ' (weak label), bukan anotasi manusia' +
      (la ? ': negatif ' + angka(la.negatif) + ', netral ' + angka(la.netral) + ', positif ' + angka(la.positif) : '') + '.' }));
  }

  // ------------------------------------------------------------------ kontrol
  function pasangKontrol() {
    document.querySelectorAll('#f-hari button').forEach(function (b) {
      b.addEventListener('click', function () { S.hari = +b.dataset.v; S.gran = null; sinkronKontrol(); tulisHash(); muat(); });
    });
    $('#f-prov').addEventListener('change', function (e) { S.prov = e.target.value; tulisHash(); muat(); });
    document.querySelectorAll('#feed-f button').forEach(function (b) {
      b.addEventListener('click', function () { S.fs = b.dataset.v; S.idLama = null; sinkronKontrol(); muat(); });
    });
    document.querySelectorAll('#tren-gran button').forEach(function (b) { b.addEventListener('click', function () { S.gran = b.dataset.v; tren(S.data); }); });
    document.querySelectorAll('#topik-mode button').forEach(function (b) { b.addEventListener('click', function () { S.topikMode = b.dataset.v; topik(S.data); }); });
    $('#tema').addEventListener('click', function () {
      var root = document.documentElement, gelap = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      var t = gelap ? 'light' : 'dark'; root.setAttribute('data-theme', t);
      try { localStorage.setItem('karhutla-tema', t); } catch (e) { /* abaikan */ }
      if (S.data) { provinsi(S.data); }
    });
    var tunda;
    window.addEventListener('resize', function () {
      clearTimeout(tunda);
      tunda = setTimeout(function () { if (S.data) { tren(S.data); provinsi(S.data); if (S.topikMode === 'jaringan') topik(S.data); } }, 200);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - S.terakhirMuat > CFG.refresh * 1000) muat(true);
    });
    setInterval(function () { if (!document.hidden) muat(true); }, Math.max(15, CFG.refresh) * 1000);
  }

  bacaHash();
  sinkronKontrol();
  pasangKontrol();
  siapkanPrediksi();
  muat();
})();
