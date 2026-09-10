# Backup App — güvenlik notları ve tehdit modeli

Bu belge, güvenlik açısından kritik her bileşen için tek bir soruyu cevaplar:
**neye karşı koruyor, neye karşı korumuyor.** Abartılmış bir güvenlik vaadi,
hiç vaat etmemekten daha tehlikelidir.

Format ayrıntıları için [FORMAT.md](FORMAT.md).

---

## Uçtan uca şifreleme

**Korur:** Hedefteki veriyi görebilen herkese karşı. Bulut sağlayıcısı, NAS'a
erişen biri, çalınan bir USB bellek, ağı dinleyen biri. Dosya içerikleri
AES-256-GCM ile şifrelenir; dosya adları ve klasör yapısı gizlenir; her parça
kendi doğrulama etiketini taşır, tek bit değişse çözme reddedilir.

**Korumaz:** Bu bilgisayarda çalışan kötü amaçlı yazılıma karşı. Yedekleme
sırasında ana anahtar bellektedir ve kaynak dosyalar zaten açıktır. Parola
saklanıyorsa (varsayılan) Windows kullanıcı hesabını ele geçiren biri kasayı
açabilir.

**Korumaz:** Dosya **boyutlarına** ve **sayısına** karşı. Hedefe bakan biri kaç
dosya olduğunu ve her birinin yaklaşık boyutunu görür. İçeriği ve adı göremez.
Dolgu (padding) uygulanmaz; maliyeti veri miktarını artırmak olurdu.

**Korumaz:** Parola kaybına karşı. Parola ve kurtarma anahtarının ikisi de
kaybolursa yedek okunamaz. Bu bir kusur değil, uçtan uca şifrelemenin tanımıdır
ve kullanıcıya kurulum sırasında böyle söylenir.

## Anahtar yuvaları ve kurumsal emanet

Ana anahtar birden fazla yuvaya sarılır: parola, kurtarma anahtarı ve isteğe
bağlı olarak kurum yöneticisinin açık anahtarı (RSA-OAEP-SHA256).

**Korur:** Parolanın unutulmasına karşı. Yönetici, çalışanın parolasını
öğrenmeden veriyi kurtarabilir. Yuvalar birbirinden bağımsızdır; birinin
kaldırılması ötekini etkilemez ve son parola/kurtarma yuvası kaldırılamaz.

**Korumaz:** Emanet yuvası açıkken yöneticinin veriye erişmesine karşı — özellik
zaten budur. Bu yüzden emanet isteğe bağlıdır ve etkin olduğu kullanıcıya
arayüzde açıkça gösterilmelidir. Yöneticinin özel anahtarı ajanda hiçbir zaman
bulunmaz; kurtarma yalnızca o anahtarın durduğu makinede yapılabilir.

**Henüz yok:** Kurtarma işlemlerinin denetim kaydına yazılması ve kullanıcıya
bildirilmesi. Merkez bileşeni geldiğinde eklenecek. M-of-N paylaşımı (Shamir)
da yuva modeline sonradan bir yuva türü olarak eklenecek.

## Yalnızca ekleme (append-only)

Hedef başına açılır. Açıkken bu bilgisayar yedeğe **ekleyebilir**, ama var olan
veriyi değiştiremez ve silemez. Şifreli hedefte silinen dosya fiziksel olarak
yerinde kalır; dizinde "silindi" olarak işaretlenir ve geri alma süresi
(varsayılan 7 gün) dolana kadar geri getirilebilir.

**Korur:** Bu bilgisayarı ele geçiren bir saldırganın ya da fidye yazılımının
uygulama üzerinden yedekleri silmesine karşı. Silme ve üzerine yazma denemeleri
reddedilir ve günlüğe güvenlik olayı olarak yazılır. Silmeyi gerektiren modlar
(Tam Yenile ve şifresiz hedefte Ayna) baştan reddedilir; sessizce başka bir şey
yapılmaz.

**Korumaz:** Hedefin kimlik bilgilerini ele geçiren birine karşı. Bu kural
uygulamanın içinde çalışır; kimlik bilgilerini alan biri uygulamayı atlayıp
doğrudan silebilir. Gerçek koruma sağlayıcı tarafındadır: S3 Object Lock, ayrı
yazma/silme yetkili roller, NAS'ta ayrı kullanıcı ve anlık görüntü. Bugün
yalnızca S3 nesne kilidi sunuyor; kalan hedeflerde arayüz "yalnızca uygulama
içi" etiketiyle bunu açıkça söyler.

**Henüz yok:** Saklama süresi temizliğinin merkezde ve ayrı kimlik bilgileriyle
yapılması. Şu an süresi dolan mezar taşları listelenir ama silinmez; silme
yetkisi merkez bileşeniyle gelecek.

## Parola ve anahtar saklama

Parolalar, gizli anahtarlar ve OAuth yenileme jetonları Windows DPAPI ile
(`ProtectedData`, `CurrentUser` kapsamı) sarılarak saklanır. Düz metin olarak
diske, günlüğe ya da yapılandırma dosyasına **hiçbir zaman** yazılmaz.
`config.json` içinde yalnızca gizli olmayan alanlar bulunur (sunucu adresi,
kullanıcı adı, kova adı).

**Korur:** Başka bir kullanıcı hesabının ya da diski çıkarıp okuyan birinin
kimlik bilgilerini almasına karşı.

**Korumaz:** Aynı Windows hesabında çalışan bir programa karşı. DPAPI'nin
sınırı budur.

## Dizinin bütünlüğü

Dizin iki yuvaya dönüşümlü yazılır ve her yazma bir sıra numarası taşır. Yarıda
kalan bir yazma yalnızca o yuvayı bozar.

**Korur:** Elektrik kesintisi, zorla kapatma, ağ kopması sırasında dizinin
tamamen kaybolmasına karşı. İki yuva da bozulursa dizin, dosyaların kendi
başlığındaki şifreli yollardan yeniden kurulur.

**Korumaz:** Hedefe yazma yetkisi olan birinin dizini kasten silmesine karşı.
Bu, ajan yetkilerinin daraltılmasıyla (append-only) çözülür ve henüz
uygulanmadı.

## Üyelik anahtarları

Anahtarlar ECDSA P-256 ile imzalanır; doğrulama gömülü açık anahtarla yapılır.
Gizli imza anahtarı yalnızca sahibin bilgisayarındadır ve depoda bulunmaz.

**Korur:** Sahte anahtar üretilmesine karşı. Yabancı bir anahtarla imzalanmış
Owner anahtarı hiçbir sürümde kabul edilmez.

**Korumaz:** Uygulamayı yeniden derleyip denetimi kaldıran birine karşı. Bu,
istemcide çalışan her lisans denetiminin sınırıdır; kaynak kodun kapalı
tutulmasının sebebi de budur.

## USB Guard

Dört koruma: AutoPlay kapatma, takılınca Defender taraması, yabancı yazma
izleyicisi, değişiklik tespiti.

**Korur:** Takılan bir cihazın kendiliğinden bir şey çalıştırmasına karşı;
bilinen kötü amaçlı yazılıma karşı (Defender kadar); cihazda bizim dışımızda
bir şeyin değiştiğini fark etmeye yarar.

**Korumaz:** Başka bir programın USB'yi **okumasına** karşı. Bunun için çekirdek
sürücüsü ve yönetici hakkı gerekir; uygulama yönetici hakkı istemez. Bu, arayüzde
de açıkça yazar.

## Yedekleme motorunun yıkıcı işlemleri

Ayna ve Tam Yenile modları hedefte silme yapar. Silme yalnızca yedek klasörünün
içinde ve yalnızca bağlantı noktası (junction/symlink) bulunmayan yollarda
gerçekleşir; kaynak okunamadıysa hiçbir silme planlanmaz.

**Korur:** Bir bağlantı noktası üzerinden hedef klasörün dışına çıkıp veri
silinmesine karşı; erişilemeyen bir kaynağın "boş" sanılıp hedefin
temizlenmesine karşı.

## Henüz korunmayanlar

Bunlar bilinen boşluklardır ve yol haritasında yerleri vardır:

- Sağlayıcı tarafında nesne kilidi (S3 Object Lock) henüz açılmıyor.
- Merkez-ajan iletişimi (henüz merkez yok).
- M-of-N kurtarma (Shamir); kurumsal emanet eklendi.
- Ransomware davranış tespiti.
- Değiştirilemez (immutable) arşiv ve nesne kilidi.
