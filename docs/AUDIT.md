# Yayın öncesi güvenlik denetimi

Dolaşan "yayına almadan önce yapılacaklar" listesi web uygulamaları için
yazılmış: sunucu, veritabanı, çerez, CORS ve tarayıcı varsayıyor. Backup App
sunucusuz bir masaüstü uygulaması. Bu yüzden her madde üç sonuçtan biriyle
kapanır:

- **Geçerli** — bu kodda karşılığı var, denetlendi.
- **Karşılığı var** — web hâli geçersiz ama aynı riskin masaüstü karşılığı var.
- **Geçersiz** — bu mimaride böyle bir yüzey yok. Sebebi yazılı.

Denetim tarihi: 10–11 Eylül 2026. Sürüm 2.0.0. Bulgular düzeltildi ve her biri için
saldırı testi yazıldı (`--selftest`: Google sürümü 839, Lite 658 sınama).

---

## Düzeltilen bulgular

### B1 — Hesap parolası hızlı bir özetle saklanıyordu (orta)

`Account.HashPassword` tuzlu **SHA-256** kullanıyordu. Tuz vardı ama özet hızlı:
bir ekran kartı saniyede milyarlarca deneme yapar ve altı karakterlik bir parola
anında bulunur. Özet `config.json` içinde duruyor ve o dosya kopyalanabilir.

**Düzeltme:** PBKDF2-SHA512, 210.000 tur. Özet kendi tur sayısını taşır
(`pbkdf2$210000$…`), böylece ileride tur artırıldığında eski özetler yine
doğrulanır. Eski biçimdeki özetler kabul edilmeye devam eder ve
`Account.NeedsRehash` ile yenilenmek üzere işaretlenir.

**Not:** Arayüz yenilenmesinde parolayla giriş akışı kalktı, bu yüzden zayıf özet
şu an hiçbir ekrandan tetiklenmiyor. Eski ayar dosyalarında duran özetler için ve
akış geri gelirse diye yine de sertleştirildi.

### B2 — Cihaz güvenlik kodunun özeti USB belleğe yazılıyordu (düşük)

Kod dokuz basamak, özeti tuzsuz SHA-256 idi ve `.usbbackup_key` dosyasıyla
**cihazın kendisine** yazılıyordu. Belleği eline geçiren biri kodu saniyeler
içinde geri bulup sahibiymiş gibi doğrulama yapabilirdi.

**Düzeltme:** Üç ayrı değişiklik. Özet artık tuzlu ve PBKDF2-SHA256 ile 200.000
tur. Aynı kod her seferinde farklı bir özet üretir. Ve en önemlisi: özet cihaza
**hiç yazılmıyor**, yalnızca bu bilgisayardaki ayar dosyasında duruyor. Zaten
eşleşmede hiç kullanılmıyordu; cihazda durmasının bir sebebi yoktu.

### B3 — Ayar dosyasının yedeği yoktu (düşük)

`config.json` cihaz eşleşme belirteçlerini taşıyor. Kaybı, yetkili USB'lerin
tanınmaması ve hepsini yeniden yetkilendirmek demek. Yazma zaten atomikti ama
geri dönülecek bir kopya yoktu.

**Düzeltme:** Her kayıtta bir önceki hâli `config.json.bak` olarak bırakılıyor.
Ana dosya okunamazsa yedekten okunuyor ve bu günlüğe yazılıyor.

---

## İkinci tur: kurulu uygulamaya saldırı (11 Eylül 2026)

Birinci tur kodu okuyarak yapılmıştı. Bu tur, bu bilgisayarda **kurulu** hâle
karşı yapıldı: saldırganın gerçekten eline geçecek şeylere bakıldı —
`%AppData%\UsbBackup` içeriği, kayıt defteri, günlük ve yedeğin kendisi.

### B4 — Yetkili cihazın anahtar dosyası kopyalanabiliyordu (yüksek)

Bir USB'nin yetkili olup olmadığına yalnızca kökündeki gizli `.usbbackup_key`
dosyasındaki belirtece bakılıyordu. O dosya gizli ve sistem işaretli, ama
gizlemek korumak değildir: kopyalanabilir.

**Saldırı.** Yetkili belleğe bir dakikalığına erişen biri anahtar dosyasını
kendi belleğine kopyalar. O belleği kurbanın bilgisayarına taktığında uygulama
onu yetkili cihaz sanır ve — "takılınca yedekle" açıksa — kurbanın klasörlerini
**saldırganın belleğine** yazar. Bir yedekleme uygulamasında bu, veri
sızdırmanın en kısa yoludur.

Profilde sürücünün birim seri numarası zaten saklanıyordu; hiçbir yerde
karşılaştırılmıyordu.

**Düzeltme:** Eşleşme artık belirteç **ve** birim seri numarası ister. Belirteci
taşıyıp sürücüsü tutmayan bir bellek yetkili sayılmaz; kullanıcıya "bu,
yetkilendirdiğiniz cihaz değil" bildirimi gider ve kendi cihazını biçimlediyse
yeniden yetkilendirmesi söylenir. Seri numarası bilinmeyen eski profiller ve
seri numarası vermeyen sürücüler eskisi gibi çalışır: yeni bir denetim, çalışan
bir kurulumu sessizce bozmamalı.

**Sınırı.** Birim seri numarası yönetici hakkıyla değiştirilebilir. Bu bir duvar
değil eşik: saldırı artık bir dosyayı kopyalamakla yapılamıyor.

### B5 — Tanıtım kodu kaldırıldı (düşük)

Bir gün süren bir tanıtım kodu vardı. İki ayrı zayıflığı çıktı.

Birincisi: bitiş tarihi `config.json` içinde duruyordu ve dosya kullanıcının
kendi hesabında. Tarihi 2099 yapmak bir metin düzenleme işiydi. Buna karşı
kayıt defterindeki ilk kullanım damgasıyla çapraz kontrol konuldu — süre,
ikisinden önce bitenle hesaplanır oldu.

İkincisi daha kötüydü ve düzeltmeyi anlamsız kılıyordu: kodun karşılığı olan
**imzalı Pro anahtarı uygulamanın ikilisinde duruyordu.** Tek dosyalık yayının
içinden çıkarılıp doğrudan üyelik kutusuna yapıştırılabilirdi ve o yoldan
gelindiğinde ayar dosyasında kodun adı yazmadığı için süre denetimi hiç
işlemiyordu. Yani bir günlük kod, süresiz bir üyeliğe dönüyordu — hem de her
bilgisayarda.

**Düzeltme:** Tanıtım kodu tamamen kaldırıldı. Anahtarı hiç taşımamak, taşıyıp
süresini korumaya çalışmaktan sağlam: artık iki sürümün ikilisinde de gömülü
hiçbir üyelik anahtarı yok. Üyelik yalnızca sahibin imzaladığı ve elden verdiği
anahtarla açılıyor.

### Denenip bir şey çıkmayanlar

| Deneme | Sonuç |
|---|---|
| Ayar dosyasına elle Owner rolü yazmak | Plan yalnızca imzalı anahtardan geliyor |
| Başka bir imzayla Owner anahtarı üretmek | İmza doğrulanmıyor, plan Free |
| Ayar dosyasından cihaz kodunu okumak | Kod yok; yalnızca PBKDF2 özeti (200.000 tur) |
| Ayar dosyasından kasa parolasını okumak | Parola ayar dosyasına hiç girmiyor |
| `credentials.bin` içinde düz metin aramak | Yok; DPAPI ile sarılı |
| Günlükte parola aramak | Yok |
| Yedeğin kendisinden dosya adı okumak | Adlar HMAC ile gizli, içerik AES-256-GCM |
| Şifreli bir dosyanın tek bitini değiştirmek | Çözme reddediliyor |

**Kaçınılmaz olan.** `config.json` hangi cihazların yetkili olduğunu, yedeğin
nereye gittiğini ve hangi klasörlerin yedeklendiğini gösterir. Bunlar
gizlenemez: uygulamanın çalışması için okunmaları gerekir ve dosya kullanıcının
kendi hesabındadır. Aynı hesapta çalışan bir program `credentials.bin`'i de
çözebilir — DPAPI'nin sınırı budur ve [SECURITY.md](SECURITY.md) içinde yazılı.

---

## Madde madde sonuç

| # | Madde | Sonuç |
|---|---|---|
| 1 | Gömülü anahtarları çıkar | **Geçerli** — aşağıda |
| 2 | `.env`'i git geçmişinden sil | **Geçerli** — temiz |
| 3 | İzin kurallarını yaz | **Karşılığı var** — üyelik rolleri |
| 4 | Yetkiyi sunucuda tut | **Geçersiz** — sunucu yok |
| 5 | Girişe sınır koy | **Karşılığı var** — B2 ile düzeltildi |
| 6 | CORS'u kilitle | **Geçersiz** — web sunucusu yok |
| 7 | Güvenlik başlıkları | **Geçersiz** — HTTP servisi yok |
| 8 | HTTPS zorunlu | **Geçerli** — zaten zorunlu |
| 9 | Şifreleri hashle | **Geçerli** — B1 ile düzeltildi |
| 10 | Çerezi güvenli yap | **Geçersiz** — çerez yok |
| 11 | Hata mesajını kıs | **Geçerli** — zaten kısıtlı |
| 12 | Logları temizle | **Geçerli** — sır yazılmıyor |
| 13 | Sorguyu parametrele | **Geçersiz** — SQL yok |
| 14 | XSS'e karşı kaçır | **Karşılığı var** — XML kaçışı |
| 15 | Webhook imzası | **Geçersiz** — webhook yok |
| 16 | Admin'e rol koy | **Geçerli** — imzalı anahtar |
| 17 | Paketleri denetle | **Geçerli** — zafiyet yok |
| 18 | Otomatik yedek | **Geçerli** — B3 ile eklendi |
| 19 | Hesabı gerçekten sil | **Geçerli** — siliniyor |
| 20 | Harcama uyarısı kur | **Geçersiz** — faturalandırma yok |
| 21 | Saldırgan gibi dene | **Yapıldı** — 23 saldırı sınaması |
| 22 | Dosya yolu kaçışı | **Geçerli** — zaten kapalı |
| 23 | Dış komut enjeksiyonu | **Geçerli** — tam yol + kaçış |

### 1. Gömülü anahtarlar

Depoda gizli anahtar yok. Lisans imza anahtarı yalnızca sahibin bilgisayarında,
depo dışında duruyor.

`google-oauth.json` derlemede exe'ye gömülüyor ve içinde `client_secret` var.
Bu bir bulgu **değil**: Google, masaüstü istemcileri için bu değerin gizli
sayılmadığını açıkça söyler ve korumayı PKCE sağlar. Uygulama S256 kod sınaması
kullanıyor, yani sırrı çıkaran biri kod doğrulayıcı olmadan hiçbir şey yapamaz.
Dosyanın kendisi `.gitignore` içinde ve hiç işlenmemiş.

### 2. Git geçmişinde sır

`git log --all --diff-filter=A` ile eklenen bütün dosyalar tarandı.
`google-oauth.json`, `.env` benzeri bir dosya ya da anahtar dosyası hiç
işlenmemiş. Geçmiş temiz, yeniden yazmaya gerek yok.

### 3, 16. İzinler ve roller

Üç rol var: Free, Pro, Owner. Rol yalnızca **ECDSA P-256 ile imzalı** bir
anahtardan gelir. Ayar dosyasını elle düzenlemek hiçbir şey vermez; e-postanın
"doğrulanmış" görünmesi de vermez. Kural iki yerde birden uygulanır: arayüzde ve
yedekleme motorunda. Motorda da olmasının sebebi, arayüzü atlayan bir çağrının
kuralı atlamaması.

Bilinen sınır: denetim istemcide çalışıyor. Uygulamayı yeniden derleyen biri
denetimi kaldırabilir. Kaynak kodun kapalı tutulmasının sebebi bu.

### 5. Girişe sınır

Tekrarlanabilir bir "giriş" yüzeyi yok: sunucu yok, kilitlenecek hesap yok.
Karşılığı olan iki sır var ve ikisi de artık pahalı türetmeyle korunuyor: kasa
parolası (PBKDF2-SHA512, 600.000 tur) ve cihaz güvenlik kodu (B2).

### 8. HTTPS

WebDAV adresleri varsayılan olarak yalnızca `https://` kabul eder; düz `http`
ancak kullanıcı bilerek açarsa geçer. S3, Google Drive, OneDrive ve Dropbox
zaten TLS üzerinden. SFTP kendi taşıma katmanını kullanır ve sunucu parmak izi
saklanır.

Google girişindeki geri dönüş adresi `http://127.0.0.1:<port>` — bu doğru olan.
Dinleyici yalnızca yerel arayüze bağlanıyor, dışarıdan erişilemiyor ve `state`
değeri doğrulanıyor.

### 11. Hata mesajları

Kasa hataları bilerek tek tip: "yanlış parola", "bozuk dosya" ve "başka bir
kasaya ait" ayrımı yapılmaz. Ayrım yapmak deneyen birine bilgi vermek olurdu.
Yığın izleri kullanıcıya gösterilmiyor; günlüğe yazılıyor.

### 12. Loglar

Bütün `Logger` çağrıları tarandı: parola, parola cümlesi, jeton ya da gizli
anahtar hiçbir yerde yazılmıyor. Yazılan şey durum kodları ve özel durum
mesajları. Sınama, günlükte sınama parolalarının geçmediğini doğruluyor.

### 14. Kaçış

HTML yok, ama kullanıcı metni bir yerde biçimli belgeye giriyor: Görev
Zamanlayıcı XML'i. Orada `SecurityElement.Escape` kullanılıyor ve geçici dosya
adı rastgele.

### 17. Paketler

`dotnet list package --vulnerable --include-transitive`: zafiyetli paket yok.
Tek dış bağımlılık SSH.NET 2026.0.0 (MIT).

### 18. Otomatik yedek

B3 ile eklendi. Ayrıca kasa dizini zaten iki yuvaya dönüşümlü yazılıyor ve
kaybolursa dosyaların kendi başlıklarından yeniden kuruluyor.

### 19. Hesabı gerçekten silmek

"Hesabı sil" üç şeyi birden yapar: Google Drive'daki gizli kopyayı siler,
yenileme jetonunu Google'da iptal eder ve yerel dosyadan siler, ad/e-posta/geri
dönüş kaydını temizler. Silinemezse kullanıcıya söylenir; sessizce bırakılmaz.
"Çıkış yap" bilerek farklıdır: Drive'daki kopya kalır, çünkü aynı hesapla başka
bir bilgisayardan girildiğinde geri gelmesi beklenir.

### 20. Harcama uyarısı

Bizim faturalandırdığımız bir şey yok. Karşılığı, kullanıcının kendi bulut
hesabındaki kota ve maliyet uyarısı olurdu; yol haritasında duruyor, henüz yok.

### 21. Saldırgan gibi denemek

Yazılan saldırı sınamaları, hepsi reddedildi:

- Ayar dosyasını elle düzenleyip rol almak.
- Başkasının imzasıyla üretilmiş Owner anahtarı.
- Başka bir kasanın başlığını kurbanın klasörüne koyup dosya açmak (içerik ve
  gizli yol, ikisi de reddedildi).
- Yedeğin dizinine `..\..\` içeren yol koyup geri yüklemede klasörün dışına
  yazmak.
- Tahmin edilmiş belirteçle sahte cihaz anahtar dosyası.
- Aynı güvenlik kodunun iki kez aynı özeti vermesi.
- Kimlik deposunun diskte düz metin tutması.
- Günlüğe parola sızması.

Ayrıca daha önce yazılmış olanlar: bağlantı noktasıyla hedefin dışına çıkıp
silme, okunamayan kaynağı boş sayıp aynalama, yalnızca ekleme kipinde silme ve
üzerine yazma, yarıda kesilen yedekleme, bozuk dizin.

---

## Kalan bilinen sınırlar

Bunlar bulgu değil, mimarinin bilinçli sınırları. Ayrıntısı
[SECURITY.md](SECURITY.md) içinde:

- Lisans denetimi istemcide çalışır.
- DPAPI, aynı Windows hesabında çalışan bir programa karşı korumaz.
- Yalnızca ekleme kipi uygulama içinde uygulanır; sağlayıcı tarafında nesne
  kilidi yalnızca S3'te mümkün ve henüz açılmıyor.
- Merkez bileşeni yok; denetim kaydı ve uzaktan yetki daraltma onunla gelecek.
