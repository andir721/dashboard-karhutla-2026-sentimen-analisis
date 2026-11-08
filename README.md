<p align="center">
  <img src="assets/logo-ith.png" width="96" alt="Logo Institut Teknologi Bacharuddin Jusuf Habibie">
</p>

# Pantau Karhutla

**Analisis Sentimen Percakapan Publik tentang Kebakaran Hutan dan Lahan di Kalimantan pada Media Sosial X
Menggunakan XLM-RoBERTa dan Support Vector Machine**

Tugas Akhir Proyek Sains Data · Program Studi Sains Data · Jurusan Sains · Institut Teknologi Bacharuddin Jusuf Habibie · 2026

### Disusun oleh

| Nama | NIM |
|---|---|
| Aril Muhammad Nurham | 241061012 |
| Rahmawati | 241061003 |
| Istiqamah | 241061025 |
| Jason | 231061012 |

### Pembimbing

1. Andi Indra Jaya, S.Stat., M.Stat.
2. Anas, M.Kom

Repositori ini berisi dashboard publik, notebook analisis, dan data ringkas hasil penelitian. Dashboard dapat
dibuka melalui tautan GitHub Pages di bagian *About* repositori ini.

## Ringkasan

Kebakaran hutan dan lahan (karhutla) di Kalimantan pada 2026 ramai dibicarakan di media sosial X. Penelitian ini
menilai nada 4.748 unggahan publik (1 Januari–29 Oktober 2026) dengan representasi teks XLM-RoBERTa dan
pengklasifikasi Support Vector Machine (SVM). Pada data uji, SVM mencapai akurasi 86,1% dan F1-makro 0,800,
lebih baik daripada dua varian Naive Bayes. Sebanyak 36,7% unggahan bernada negatif, 49,0% netral, dan 14,3%
positif. Percakapan memuncak pada Agustus–Oktober (89% dari seluruh unggahan), dengan pekan teramai 19–25 Oktober
2026. Kalimantan Tengah paling sering disebut, dan kesehatan menjadi dampak dengan porsi nada negatif tertinggi.

## Pertanyaan penelitian

1. Bagaimana komposisi nada (negatif, netral, positif) percakapan publik tentang karhutla di Kalimantan?
2. Kapan percakapan itu ramai, dan provinsi mana yang paling sering disebut?
3. Dampak dan topik apa yang paling banyak dibicarakan, dan bagaimana nadanya?
4. Seberapa baik kombinasi XLM-RoBERTa dan SVM menilai nada unggahan dibanding Naive Bayes?

## Data

| Keterangan | Jumlah |
|---|---|
| Unggahan unik setelah pembersihan | 5.876 |
| Siaran otomatis BMKG (dikecualikan dari analisis opini) | 1.128 |
| Unggahan yang dianalisis | 4.748 |
| Periode | 1 Januari – 29 Oktober 2026 |

Unggahan publik dikumpulkan dari X dengan kata kunci seputar karhutla. Tautan, nama akun, dan unggahan ganda
dibuang. Unggahan yang memenuhi minimal tiga ciri siaran peringatan dini BMKG ditandai dan tidak dihitung sebagai
opini publik.

## Metode

1. **Pembersihan teks**: menghapus URL, mention, dan simbol tagar; unggahan kurang dari tiga kata dibuang.
2. **Pelabelan awal**: label nada dibuat dengan model `w11wo/indonesian-roberta-base-sentiment-classifier`
   (negatif 1.672, netral 3.607, positif 597).
3. **Representasi teks**: `xlm-roberta-base` dengan *mean pooling* (768 dimensi, panjang maksimum 256 token).
4. **Klasifikasi**: SVM, Naive Bayes Multinomial, dan Naive Bayes Gaussian (dengan PCA) dilatih pada 4.700 data
   dan diuji pada 1.176 data. Parameter dipilih dengan *GridSearchCV* (validasi silang, F1-makro).
5. **Analisis lanjutan**: penanda provinsi dan dampak berbasis kamus kata kunci, kata khas tiap nada dengan
   *log-odds ratio* (Monroe dkk., 2008), topik dari jaringan kata yang sering muncul bersama (Jaccard + Louvain),
   serta negara dan kota/kabupaten yang disebut.

## Hasil utama

**Kinerja model (data uji, 1.176 unggahan)**

| Model | Akurasi | F1-makro | F1-makro validasi silang |
|---|---|---|---|
| **SVM (C = 1, kernel RBF)** | **86,1%** | **0,800** | **0,776** |
| Naive Bayes Multinomial | 78,9% | 0,685 | 0,658 |
| Naive Bayes Gaussian (PCA 32) | 76,5% | 0,646 | 0,665 |

**Nada percakapan (4.748 unggahan):** negatif 1.743 (36,7%) · netral 2.326 (49,0%) · positif 679 (14,3%).

**Waktu:** unggahan naik tajam sejak Agustus (916), September (1.470), dan Oktober (1.844). Pekan teramai adalah
19–25 Oktober 2026 dengan 572 unggahan.

**Wilayah yang disebut:** Kalimantan Tengah 1.153 · Kalimantan Barat 608 · Kalimantan Selatan 462 ·
Kalimantan Timur 228 · Kalimantan Utara 40. Kota yang paling sering disebut adalah Palangka Raya (392).

**Dampak:** lingkungan dibahas di 27,9% unggahan, aktivitas masyarakat 21,8%, dan kesehatan 21,2%. Unggahan
tentang kesehatan paling sering bernada negatif (47,4%).

**Topik terbesar:** kabut asap dan dampak ke warga (67% unggahan), penanganan pemerintah (49,7%), pemadaman api
(40,6%), satwa dan lingkungan (37,9%), serta jarak pandang terbatas (15,7%; 44% negatif). Satu unggahan bisa masuk
lebih dari satu topik.

**Negara lain:** 437 unggahan menyebut negara atau organisasi luar, terutama Malaysia (265), Singapura (171),
dan Jepang (87).

## Keterbatasan

- Label awal berasal dari model, bukan anotasi manusia, sehingga model belajar meniru pelabel tersebut.
  Sindiran dan keluhan yang ditulis dengan gaya berita cenderung dinilai netral.
- Provinsi dan dampak dikenali dari kamus kata kunci, jadi angkanya bersifat perkiraan.
- Data mencerminkan percakapan pengguna X yang terjaring kata kunci, bukan pendapat seluruh masyarakat.

## Isi repositori

| File / folder | Isi |
|---|---|
| `index.html` | Halaman dashboard |
| `assets/` | Tampilan dan grafik (`dashboard.css`, `dashboard.js`), perhitungan filter di browser (`data-statis.js`), dan logo ITH (`logo-ith.png`) |
| `data/dashboard_data.json` | Data dashboard: jumlah unggahan per hari, nada, provinsi, dampak, ringkasan analisis, dan contoh unggahan terbaru |
| `data/kalimantan.geojson` | Batas provinsi untuk peta |
| `notebook/Kode_Klasifikasi_Sentimen_Karhutla_XLMR.ipynb` | Notebook penelitian lengkap, dari data mentah sampai ekspor dashboard (bagian 11b) |
| `notebook/Ekspor_ke_GitHub.ipynb` | Membuat `dashboard_data.json` dari `dashboard_posts.csv` dan `dashboard_snapshot.json` tanpa melatih ulang model |

## Memperbarui data

1. Jalankan notebook penelitian di Google Colab sampai bagian 11b, atau jalankan `notebook/Ekspor_ke_GitHub.ipynb`.
   Hasilnya `dashboard_data.json`.
2. Di repositori, buka folder `data/` → **Add file → Upload files** → pilih `dashboard_data.json` → **Commit changes**.
3. Dashboard berubah dalam 1–2 menit. Muat ulang halaman dengan Ctrl+F5.

## Etika data

Repositori ini tidak memuat dataset mentah maupun nama akun. File data hanya berisi angka ringkasan dan teks
unggahan publik terbaru yang sudah dibersihkan dari tautan dan nama akun.

## Rujukan utama

- Conneau, A., dkk. (2020). *Unsupervised Cross-lingual Representation Learning at Scale*. ACL 2020.
- Monroe, B. L., Colaresi, M. P., & Quinn, K. M. (2008). *Fightin' Words: Lexical Feature Selection and Evaluation for Identifying the Content of Political Conflict*. Political Analysis, 16(4).
- Blondel, V. D., dkk. (2008). *Fast unfolding of communities in large networks*. Journal of Statistical Mechanics.
