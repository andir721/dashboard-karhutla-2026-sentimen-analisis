/* =====================================================================
   Versi statis (GitHub Pages): menggantikan api/dashboard.php.
   Membaca data/dashboard_data.json (hasil ekspor notebook) lalu menghitung
   ringkasan, tren, provinsi, dampak, dan feed langsung di browser,
   dengan aturan yang sama persis dengan versi website (PHP + MySQL).
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.KARHUTLA || {};
  var SUMBER = CFG.statis || 'data/dashboard_data.json';
  var ORDER = ['negatif', 'netral', 'positif'];
  var PROV = { kalbar: 'Kalimantan Barat', kalteng: 'Kalimantan Tengah', kalsel: 'Kalimantan Selatan', kaltim: 'Kalimantan Timur', kaltara: 'Kalimantan Utara' };
  var DAMPAK = { kesehatan: 'Kesehatan', lingkungan: 'Lingkungan', aktivitas: 'Aktivitas masyarakat' };
  var FEED_LIMIT = CFG.feedLimit || 12;
  var SEGAR_MS = 10 * 60 * 1000;   // ambil ulang file data paling cepat tiap 10 menit

  var cache = null, diambil = 0, janji = null;

  function muatData() {
    if (location.protocol === 'file:') {
      return Promise.reject(new Error('Buka halaman ini lewat alamat GitHub Pages (https://…), bukan dengan membuka file index.html langsung dari laptop.'));
    }
    if (cache && Date.now() - diambil < SEGAR_MS) return Promise.resolve(cache);
    if (janji) return janji;
    janji = fetch(SUMBER + '?t=' + Math.floor(Date.now() / SEGAR_MS), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('File data tidak ditemukan (' + SUMBER + '). Unggah dashboard_data.json ke folder data/.');
        return r.json();
      })
      .then(function (D) {
        if (!D || !D.agregat || !D.meta) throw new Error('Isi dashboard_data.json tidak dikenali. Ekspor ulang dari notebook.');
        siapkan(D);
        cache = D; diambil = Date.now(); janji = null;
        return D;
      }, function (e) { janji = null; throw e; });
    return janji;
  }

  // ---------------------------------------------------------------- tanggal (UTC, format YYYY-MM-DD)
  function keMs(t) { var p = t.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function keTgl(ms) { return new Date(ms).toISOString().slice(0, 10); }
  var HARI = 86400000;

  function siapkan(D) {
    var bit = {};
    (D.bendera || []).forEach(function (k, i) { bit[k] = 1 << i; });
    D._bit = bit;
    var t0 = keMs(D.tanggal_awal);
    D._tgl = {};
    D.agregat.forEach(function (r) { if (!D._tgl[r[0]]) D._tgl[r[0]] = keTgl(t0 + r[0] * HARI); });
  }

  function nol() { return { negatif: 0, netral: 0, positif: 0 }; }
  function jumlah(o) { return o.negatif + o.netral + o.positif; }
  function gabung(a, b) { var o = {}; for (var k in a) o[k] = a[k]; for (var j in b) o[j] = b[j]; return o; }

  function hitung(D, S) {
    var hari = Math.max(0, Math.min(3650, S.hari | 0));
    var bmkg = S.bmkg ? 1 : 0;
    var prov = PROV[S.prov] ? S.prov : '';
    var fs = ORDER.indexOf(S.fs) >= 0 ? S.fs : '';
    var B = D._bit, BM = B.siaran_bmkg;

    var sampai = D.meta.tanggal_max;
    var dari = hari > 0 ? keTgl(keMs(sampai) - (hari - 1) * HARI) : D.meta.tanggal_min;
    var dariBanding = hari > 0 ? keTgl(keMs(dari) - hari * HARI) : dari;

    var ringkas = nol(), banding = nol(), semua = nol(), tanpa = nol(), harian = {};
    var provAgg = {}, dampakAgg = {}, k;
    for (k in PROV) provAgg[k] = nol();
    for (k in DAMPAK) dampakAgg[k] = nol();
    var nBmkg = 0, nHariTerakhir = 0;

    D.agregat.forEach(function (r) {
      var t = D._tgl[r[0]], s = ORDER[r[1]], f = r[2], n = r[3];
      if (!s || t < dariBanding || t > sampai) return;
      var diPeriode = t >= dari;
      var cocokProv = prov === '' || (f & B['p_' + prov]) > 0;
      var isBmkg = (f & BM) > 0;
      if (diPeriode && cocokProv) { semua[s] += n; if (!isBmkg) tanpa[s] += n; }
      if (isBmkg && !bmkg) { if (diPeriode && cocokProv) nBmkg += n; return; }
      if (diPeriode) for (var p in PROV) if (f & B['p_' + p]) provAgg[p][s] += n;   // peta tidak ikut filter provinsi
      if (!cocokProv) return;
      if (!diPeriode) { banding[s] += n; return; }
      ringkas[s] += n;
      if (!harian[t]) harian[t] = nol();
      harian[t][s] += n;
      if (t === sampai) nHariTerakhir += n;
      for (var dk in DAMPAK) if (f & B['d_' + dk]) dampakAgg[dk][s] += n;
    });

    var seri = [];
    for (var ms = keMs(dari), akhir = keMs(sampai); ms <= akhir; ms += HARI) {
      var tg = keTgl(ms);
      seri.push(gabung({ t: tg }, harian[tg] || nol()));
    }
    var provList = Object.keys(PROV).map(function (p) { return gabung({ kode: p, nama: PROV[p], total: jumlah(provAgg[p]) }, provAgg[p]); });
    var dampakList = Object.keys(DAMPAK).map(function (dk) { return gabung({ kode: dk, nama: DAMPAK[dk], total: jumlah(dampakAgg[dk]) }, dampakAgg[dk]); });

    // feed: urutan sudah terbaru dulu (waktu, lalu id), sama seperti website; tidak ikut filter periode
    var feed = [];
    for (var i = 0; i < D.feed.length && feed.length < FEED_LIMIT; i++) {
      var r = D.feed[i], fb = r[5];
      if (!bmkg && (fb & BM)) continue;
      if (prov && !(fb & B['p_' + prov])) continue;
      if (fs && ORDER[r[3]] !== fs) continue;
      feed.push({ id: r[0], waktu: r[1], teks: r[2], sentimen: ORDER[r[3]], skor: r[4],
        prov: Object.keys(PROV).filter(function (p) { return fb & B['p_' + p]; }) });
    }

    return {
      status: 'success',
      dibuat: D.dibuat,
      refresh_detik: CFG.refresh || 600,
      meta: {
        total_semua: D.meta.total_semua, menunggu: 0,
        tanggal_min: D.meta.tanggal_min, tanggal_max: D.meta.tanggal_max,
        unggah_terakhir: D.meta.unggah_terakhir, masuk_terakhir: D.dibuat,
        layanan_aktif: false, model: null, prediksi_publik: false, contoh: !!D.contoh, statis: true
      },
      filter: { hari: hari, bmkg: bmkg, prov: prov, fs: fs, dari: dari, sampai: sampai },
      ringkas: gabung(ringkas, {
        total: jumlah(ringkas),
        banding: hari > 0 ? gabung(banding, { total: jumlah(banding) }) : null,
        hari_terakhir: nHariTerakhir,
        bmkg_dikecualikan: nBmkg
      }),
      bmkg_banding: { semua: semua, tanpa: tanpa },
      harian: seri,
      provinsi: provList,
      dampak: dampakList,
      feed: feed,
      analisis: D.analisis || null,
      analisis_diperbarui: D.dibuat,
      model: D.model || null
    };
  }

  // dashboard.js memanggil fungsi ini sebagai pengganti api/dashboard.php
  window.KARHUTLA_EMULATOR = function (S) { return muatData().then(function (D) { return hitung(D, S); }); };
  window.KARHUTLA_STATIS_UJI = { siapkan: siapkan, hitung: hitung };   // dipakai untuk pengujian
})();
