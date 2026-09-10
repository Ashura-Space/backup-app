# Backup App — depo formatı

Bu belge, uygulamanın hedefe (USB, ağ klasörü, WebDAV, SFTP, S3, Google Drive,
OneDrive, Dropbox) yazdığı verinin biçimini tanımlar. Amaç açık: **uygulama
ortadan kalksa bile veriye erişilebilmeli.** Burada yazan her şey, parola ve
kurtarma anahtarı dışında hiçbir gizli bilgi gerektirmeden yeniden yazılabilir.

Format sürümü: **2** (`UBKV` dosya başlığındaki sürüm baytı ve dizin şeması).
Sürüm 1 okunmaya devam eder; yeni yazılan her şey sürüm 2'dir.

---

## 1. Şifresiz yedek

Şifreleme kapalıysa dosyalar hedefe **olduğu gibi** kopyalanır. Klasör yapısı
korunur, dosya adları değişmez, zaman damgaları taşınır. Özel bir biçim yoktur;
herhangi bir dosya yöneticisiyle okunur.

Kök klasör, hedef ayarındaki alt klasör adıdır (varsayılan `Backup`).

## 2. Şifreli yedek — dizin yerleşimi

Şifreli hedefte klasör ağacı **yeniden kurulmaz**. Klasör adları da bilgi
sızdırır ("Vergi", "Sağlık"), bu yüzden her şey tek bir düz klasörde durur:

```
<kök>/
  vault.json          kasa başlığı (açık metin JSON, gizli bilgi içermez)
  manifest.a.ubk      dizin, yuva A (şifreli)
  manifest.b.ubk      dizin, yuva B (şifreli)
  manifest.ubk        eski tek dosyalı dizin — yalnızca okunur (sürüm 1)
  <32 karakter>.ubk   içerik dosyaları, adları gizlenmiş
```

### Dosya adlarının gizlenmesi

```
ad = base32_crockford( HMAC-SHA256(adAnahtarı, BÜYÜKHARF(göreli\yol))[0..20] ) + ".ubk"
```

Aynı yol her zaman aynı adı verir; artımlı yedekleme bunun üzerine kurulu.
Hedefe bakan biri ne klasör yapısını ne de dosya adlarını görür.

## 3. Kasa başlığı — `vault.json`

Açık metin JSON. İçinde **hiçbir gizli değer yoktur**: yalnızca ana anahtarın
sarılmış hâlleri ve onları açmak için gereken parametreler.

Ana anahtar 256 bit rastgeledir ve **hiçbir zaman** diske yazılmaz. Her yuva
aynı ana anahtarı farklı bir sırla sarar; hangisi açılırsa aynı anahtar çıkar.
Bu yüzden parola değiştirmek ya da yeni bir kurtarma yolu eklemek terabaytlarca
yedeği yeniden şifrelemeyi gerektirmez.

```json
{
  "schema": 2,
  "createdUtc": "2026-09-10T12:00:00Z",
  "slots": [
    { "id": "…", "type": "passphrase", "kdf": "pbkdf2-sha512",
      "iterations": 600000, "salt": "b64(16)", "wrapped": "b64(60)",
      "label": "", "createdUtc": "…" },
    { "id": "…", "type": "recovery",  "…": "aynı biçim" },
    { "id": "…", "type": "escrow", "kdf": "", "iterations": 0, "salt": "",
      "wrapped": "b64(RSA-OAEP-SHA256)", "recipient": "b64(SPKI)",
      "label": "Şirket yöneticisi" }
  ]
}
```

| Yuva türü | Sarma | Kim açar |
|---|---|---|
| `passphrase` | `AES-256-GCM(PBKDF2-SHA512(parola, salt, 600000))` | Kullanıcı |
| `recovery` | Aynısı, kurtarma anahtarıyla | Kurtarma kodunu saklayan |
| `escrow` | `RSA-OAEP-SHA256(alıcının açık anahtarı)` | Kurum yöneticisi |

`wrapped` alanı sır tabanlı yuvalarda `nonce(12) ‖ şifreli ana anahtar(32) ‖
etiket(16)` biçimindedir.

**Her yuvanın kendi tuzu vardır.** Tek bir tuz paylaşılsaydı, saldırganın bir
kez ürettiği tablo bütün yuvalara karşı kullanılabilirdi.

Son parola/kurtarma yuvası kaldırılamaz: geriye yalnızca emanet kalsaydı
kullanıcı kendi verisini kendi açamaz hâle gelirdi.

Dosya anahtarları ana anahtardan türetilir:

```
dosyaAnahtarı = HKDF-SHA256(anaAnahtar, salt = dosyaTuzu, info = "UsbBackup.Vault.v1.file", 32)
adAnahtarı    = HKDF-SHA256(anaAnahtar, salt = yok,        info = "UsbBackup.Vault.v1.names", 32)
```

### Şema 1 başlıkları

Şema 1'de yuva yoktu; iki sabit alan vardı (`wrappedByPassphrase`,
`wrappedByRecovery`) ve ikisi aynı `salt` ile `iterations` değerini
paylaşıyordu. Bu başlıklar okunmaya devam eder: okunurken iki yuvaya çevrilir.
Başlık yeniden yazıldığında şema 2 olur.

## 4. İçerik dosyası — `.ubk`

Küçük endian. Sürüm 2:

```
offset  boyut  alan
0       4      sihirli sayı "UBKV"
4       1      sürüm (1 veya 2)
5       16     dosya tuzu
21      4      parça boyu (bayt, varsayılan 4 MiB)
25      8      açık uzunluk (bilinmiyorsa -1)
--- yalnızca sürüm 2 ---
33      2      şifreli üst bilgi uzunluğu (0 = yok)
35      n      AES-256-GCM(dosyaAnahtarı, nonce = sayaç(-1)) ⇒ göreli yol ‖ etiket(16)
--- her iki sürüm ---
...     ...    parçalar
```

Her parça:

```
şifreli veri (parça boyu kadar, son parça daha kısa) ‖ GCM etiketi (16)
```

Nonce, parçanın sıra numarasıdır (`0, 1, 2, …`), 12 bayta küçük endian
yazılır. Her dosyanın kendi anahtarı olduğu için sayaç güvenlidir; rastgele
nonce yerine sayaç seçilmesinin sebebi budur. Şifreli üst bilgi `-1` sayacını
kullanır ve hiçbir parçayla çakışmaz.

**Tek bir bitin değişmesi o parçanın çözülmesini reddettirir.** Bozuk bir yedek
sessizce yanlış veri döndürmez.

### Neden yol dosyanın içinde?

Sürüm 1'de yolu yalnızca dizin biliyordu. Dizin bozulursa hedefte anlamsız
adlar kalıyordu ve yedek okunamaz hâle geliyordu. Sürüm 2'den itibaren her
dosya kendi göreli yolunu **şifreli** olarak başlığında taşır. Dizin, her
dosyanın yalnızca ilk birkaç yüz baytı okunarak yeniden kurulabilir; içerik
indirilmez, bulut hedeflerinde indirme maliyeti doğmaz.

## 5. Dizin — `manifest.a.ubk` / `manifest.b.ubk`

Bir `.ubk` dosyasıdır (yukarıdaki biçim, göreli yol alanı boş). Çözüldüğünde
UTF-8 JSON çıkar:

```json
{
  "schema": 2,
  "sequence": 42,
  "updatedUtc": "2026-09-10T12:00:00Z",
  "entries": [
    { "path": "Belgeler\\rapor.txt", "name": "8m3k…q1.ubk", "length": 20480,
      "modifiedUtc": "2026-09-09T21:14:00Z" }
  ]
}
```

`length` ve `modifiedUtc` dosyanın **açık** hâline aittir; artımlı ve ayna
modları karşılaştırmayı buradan yapar.

### İki yuva

Dizin tek dosyaya yazılsaydı, yazma sırasında kesilen elektrik bütün yedeği
okunamaz hâle getirirdi: yarım yazılmış bir GCM akışı çözülemez. Bu yüzden iki
yuva dönüşümlü kullanılır ve her yazma `sequence` değerini bir artırır.

- **Yazma:** son yazılanın ötekine yaz, sırayı artır.
- **Okuma:** ikisini de dene, çözülebilenlerden `sequence` büyük olanı seç.
- Yarıda kalan yazma yalnızca o yuvayı bozar; öteki bir önceki tutarlı hâli taşır.

Yeniden adlandırma gerektirmez, bu yüzden nesne depolarında da (S3, Drive)
çalışır.

### Ara kayıt

Dizin yalnızca yedeğin sonunda yazılsaydı, yarıda kesilen bir çalışma o ana
kadar aktarılan her şeyi "yok" sayardı. Bu yüzden **200 dosyada bir ya da
256 MiB'de bir** yuvaya yazılır. Kesinti sonrası bir sonraki çalışma kaldığı
yerden devam eder.

## 6. Sürümler ve geriye dönük uyumluluk

| Sürüm | Değişiklik | Okuma |
|---|---|---|
| 1 | İlk biçim; yol yalnızca dizinde, dizin tek dosya (`manifest.ubk`) | Okunur |
| 2 | Dosya başlığında şifreli göreli yol; iki yuvalı dizin; `sequence`; kasa başlığında anahtar yuvaları | Yazılan biçim |

Sürüm 1 yedekleri açılır ve geri yüklenir. Aynı hedefe yeni bir yedekleme
yapıldığında dizin iki yuvalı biçime geçer; sürüm 1 içerik dosyalarına
dokunulmaz, yalnızca değişen dosyalar sürüm 2 olarak yeniden yazılır.
Sürüm 1 dosyaları yollarını taşımadığı için dizin yeniden kurulurken atlanır
ve bu durum raporlanır.

## 7. Kurtarma aracı

Depoyla birlikte `ubk-recover.exe` dağıtılır: ana uygulamadan **hiçbir kod
paylaşmayan**, tek dosyalık bağımsız bir araç. Yalnızca yedek klasörünü ve
parolayı ister.

```
ubk-recover list    <yedek-klasörü>
ubk-recover verify  <yedek-klasörü>
ubk-recover restore <yedek-klasörü> <hedef-klasör> [--only <metin>]
```

Parola `UBK_PASSPHRASE` ortam değişkeninden ya da ekrandan alınır; komut
satırında verilmez, çünkü komut satırı işlem listesinde ve kabuk geçmişinde
görünür. Kurtarma anahtarı da kabul edilir.

Dizin okunamıyorsa araç onu dosyaların kendi başlıklarından kurar. Bu durumda
yollar normalleştirilmiş (büyük harf) hâlleriyle, boyutlar da şifreli hâlleriyle
görünür; içerik yine doğru çözülür.

`verify` her dosyayı çözer ama diske yazmaz: bütün parçaların doğrulama
etiketleri tutuyor mu diye bakar.

## 8. Elde geri yükleme

Uygulama olmadan veriye erişmek için gereken adımlar:

1. `vault.json` içinden `type` değeri `passphrase` olan yuva alınır (şema 1'de
   `salt` ile `wrappedByPassphrase` alanları).
2. `PBKDF2-SHA512(parola, salt, iterations, 32)` ile sarma anahtarı türetilir.
3. `AES-256-GCM` ile ana anahtar açılır (`nonce ‖ şifreli ‖ etiket` biçimi).
4. `HKDF-SHA256` ile ad anahtarı ve dosya anahtarları türetilir.
5. Dizin yuvalarından biri çözülür; `path` ↔ `name` eşlemesi oradan okunur.
   Dizin yoksa her `.ubk` dosyasının başlığındaki şifreli yol okunur.
6. Her dosyanın parçaları sırayla çözülür.

Kurtarma anahtarıyla aynı adımlar `recovery` yuvası üzerinden yürür. Emanet
yuvasında adım 2-3 yerine yöneticinin RSA özel anahtarıyla `RSA-OAEP-SHA256`
çözmesi yeterlidir.
