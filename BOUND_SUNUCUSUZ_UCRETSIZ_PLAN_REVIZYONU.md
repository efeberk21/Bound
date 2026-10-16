# BOUND — Sunucusuz ve Ücretsiz Mimari Revizyonu

**Tarih:** 16 Ekim 2026  
**Kısıtlar:** Tek kişi, 18–21 saat, VPS yok, ücretli plan yok, uygulama Vercel'de.  
**Durum:** Tasarım kararı; hesap oluşturulmadı, servis satın alınmadı, kod veya deployment yapılmadı.

Bu belge önceki BOUND planındaki dört sürekli süreç, Docker Compose, reverse proxy, tek replika ve bellekte kalıcı durum varsayımlarının yerine geçer. Ürün kapsamı korunur: tek ajan, Atlas/Boreal görevleri, iki araç endpoint'i, gerçek Arkiv izinleri, seçici iptal ve bağımsız doğrulayıcı. Alt ajan eklenmez.

Önceki final plan dosyası bu revizyon hazırlanırken beklenen yerel konumunda bulunamadığı için üzerine değişiklik yapılmamış; bu revizyon ayrı kaydedilmiştir.

## 1. Kesin seçim

**Bir Vercel Hobby projesi + bir Neon Free PostgreSQL veritabanı + Arkiv Tiramisu.**

- Vercel, arayüzü ve ihtiyaç olduğunda çalışan Node.js API fonksiyonlarını barındırır.
- Neon, fonksiyon kopyalarının ortak kullanacağı küçük çalışma durumunu tutar.
- Arkiv, izinlerin güncel ve doğrulanabilir kaynağıdır.
- Kendi sunucumuz, Docker, Linux yönetimi, sürekli çalışan process veya ücretli domain yoktur.
- Neon yönetilen, sunucusuz bir veritabanıdır. İkinci bir ücretsiz hesap/entegrasyon gerekir; her şeyin yalnızca Vercel'in kendi veri altyapısında bulunduğu iddia edilmez.

Vercel container çalıştırsa da kopyaları talebe göre çoğaltıp kapatır. Container kullanmak belleği ortak ve kalıcı yapmaz. Bu sürümde container runtime'a ihtiyaç yoktur. [Vercel container davranışı](https://vercel.com/docs/functions/runtimes/container)

## 2. Tek proje içindeki yapı

```text
Vercel projesi
  React/Vite arayüzü
  /api/control/...   -> demo oturumu, grant oluşturma/iptal
  /api/run           -> dar ajan akışı
  /api/content/...   -> içerik aracı, kendi Arkiv doğrulaması
  /api/preview/...   -> önizleme aracı, kendi Arkiv doğrulaması

API fonksiyonları -> Arkiv: güncel yetkiyi doğrula
API fonksiyonları -> Neon: nonce, oturum, önizleme ve işlem takibi

Bağımsız CLI -> kendi RPC bağlantısı -> Arkiv
```

Tek repo, tek Vercel deployment ve bir SQL migration dosyası kullanılır. ORM, ayrı auth platformu, kuyruk sistemi veya yönetim dashboard'u eklenmez. SQL işlemleri `@neondatabase/serverless` üzerinden parametreli sorgularla yapılır. HTTP sürücüsü tek sorguları ve etkileşimsiz transaction'ları destekler. [Neon sürücüsü](https://neon.com/docs/serverless/serverless-driver)

Content ve Preview ayrı mantıksal yürütücülerdir. Her biri aynı açık kaynak verifier paketini çağırır ve doğrudan Arkiv okur; Control API'sinden ALLOW cevabı almaz.

**Dürüst sınır:** Bu dağıtım iki ayrı şirketin işlettiği veya anahtarları birbirinden tamamen izole edilmiş servis değildir. Vercel projesinin environment değişkenleri ortak güven sınırındadır. Owner/agent anahtarları modele veya browser'a verilmez; sunucu koduna güvenilir. Bağımsız işletmecilerin aynı veri sözleşmesini kullanabilmesi CLI ve entegrasyon örneğiyle gösterilir.

## 3. Hangi veri nerede?

| Veri | Konum | Karar |
|---|---|---|
| Grant kapsamı, agent, creator, owner, expiry ve iptal | Arkiv | Yetki için tek esas kaynak |
| Demo session ve kota | Neon | Fonksiyon restart'ından etkilenmez |
| Challenge/nonce | Neon | Tek kullanım atomik işlemle sağlanır |
| Önizleme metni ve revizyon | Neon | Gerçek yan etki, kalıcı durum |
| Zincire gönderim durumu ve idempotency anahtarı | Neon | Tekrarlı gönderimler takip edilir |
| Son görülen blok yüksekliği | Neon | Farklı fonksiyon kopyaları aynı kontrol durumunu görür |
| Sentetik kaynak metni | Repo fixture'ı | Gerçek müşteri dosyası yok |
| Özel anahtarlar ve bağlantı secret'ları | Vercel server environment | Frontend ve Arkiv'e yazılmaz |

Neon'da `allow=true` veya Arkiv kontrolünün yerine geçen izin tablosu oluşturulmaz. Grant anahtarı işlem takibi için tutulabilir; grant'in hâlâ geçerli olduğu her araç çağrısında Arkiv'den kontrol edilir.

“SQL kullanıldı, Arkiv gereksiz oldu” sonucundan kaçınmanın yolu SQL'i gizlemek değil, rollerini açık tutmaktır: Arkiv ortak yetki durumunu, SQL servis işlemlerinin çalışma durumunu taşır. Neon erişilemezse eski izinle işlem yapmaya devam edilmez.

## 4. Nonce ve yan etki: en önemli değişiklik

Eski plandaki process-local `Map`, `Set`, sayaç ve mutex güvenlik durumu için kullanılmaz.

1. Araç servisi rastgele bir challenge oluşturur ve Neon'a servis, ajan, deployment ve son kullanma zamanı ile yazar.
2. Ajan EIP-712 imzasında nonce, servis, kaynak, işlem, grant anahtarı, body hash ve istek süresini bağlar.
3. Endpoint imzayı ve Arkiv grant'ini doğrular.
4. **Nonce'ın hâlâ geçerli olduğunu kontrol etme, tüketme ve preview güncelleme aynı kısa SQL transaction'ında yapılır.**
5. Nonce satırını yalnızca bir işlem tüketebilir. İkinci eşzamanlı kopya değişiklik yapamaz.
6. Transaction başarısızsa nonce tüketimi ve preview değişikliği birlikte geri alınır.

Uygulama deseni: koşullu `DELETE ... RETURNING` ile gerçekten tüketilen satırdan beslenen preview güncellemesi; sıfır satır tüketildiyse sıfır güncelleme. Ayrı bir SELECT ardından koşulsuz DELETE/UPDATE yapılmaz. Alternatif olarak aynı kısa transaction içinde satır kilidi kullanılabilir. Uygulamada seçilecek tek desen, koşullu tüketim ve güncellemeyi birleştiren parametreli SQL'dir. [PostgreSQL DELETE/RETURNING](https://www.postgresql.org/docs/current/sql-delete.html)

SQL çalışma zamanı kontrolünde challenge, request ve grant'in sabit `notAfter` sınırı yeniden değerlendirilir. Veritabanı saatine göre süresi geçen istek yan etki oluşturmaz. Arkiv okuması çok gecikmişse SQL'e geçmeden yeni doğrulama gerekir; ağ kontrolü boyunca transaction açık tutulmaz.

Bu atomiklik yalnızca **Neon'daki nonce ve preview değişikliği** içindir. Arkiv iptali ile SQL işlemi tek dağıtık transaction değildir; kontrol/işlem yarışı ve devam eden iş sınırı önceki plandaki gibi açıklanır. Harici GitHub/Vercel deploy gibi yan etkiler bu sürüme eklenmez.

Content okumada nonce atomik tüketilir, sonra sabit metin döndürülür. Ağ cevabı kaybolursa eski nonce tekrar kullanılamaz; yeni challenge ve yeni Arkiv kontrolü gerekir. Tam olarak bir kez cevap teslimi garantisi verilmez.

## 5. Oturum, kota ve zincir gönderimi

- HttpOnly/Secure/SameSite cookie korunur. Cookie doğrulanır ve session süresi Neon'dan kontrol edilir.
- Tek aktif demo oturumu sınırı gerekiyorsa süreç belleğiyle değil, veritabanındaki atomik kayıtla uygulanır.
- Model bütçesi, challenge kotası ve idempotency bilgileri de paylaşımlı depoda tutulur.
- Preview/session kayıtları süre sonunda sorgulardan dışlanır; sınırlı temizlik yeni oturum açılırken yapılabilir. Sürekli çalışan cron gerekmez.
- Her grant/revoke işleminin `(run_id, resource, operation)` idempotency kimliği olur.
- Aynı owner signer için bir pending zincir işlemi varken yeni farklı işlem başlatılmaz. Bu durum veritabanında tutulur; fonksiyon belleğindeki kuyruk kullanılmaz.
- Hazırlanmış imzalı transaction, gönderilmeden önce kalıcı kaydedilir. Aynı operasyon için compare-and-set ile tek transaction seçilir; tekrar denemeler kayıtlı aynı transaction'ı kullanır.
- Gönderim sonucu belirsizse tx hash üzerinden receipt kontrol edilir. “Zaman aşımı oldu” diye yeni grant veya farklı transaction nonce ile kör tekrar yapılmaz.
- Fonksiyon süresi dolduğunda tarayıcı durum endpoint'ini tekrar çağırarak ilerler. Arka planda sınırsız poll veya sürekli worker yoktur.

SQL şeması küçük tutulur: `sessions`, `challenges`, `previews`, `chain_operations`, `runtime_state`. Constraint ve transaction'lar migration dosyasında bulunur. Session kayıtları yetki kaydı yerine geçmez.

## 6. Sunucusuz ortamda zorunlu test değişiklikleri

1. Aynı imzalı preview isteğini iki ayrı process/handler örneğinden eşzamanlı gönder: yalnızca bir revizyon artmalı.
2. Başarılı çağrıdan sonra process'i yeniden başlat ve aynı isteği gönder: yeniden yazmamalı.
3. Kullanılmamış, süresi dolmamış challenge restart sonrasında çalışabilir; bunu güvensizlik sayma. Durum artık DB'de korunur.
4. Nonce tüketimi ile preview güncellemesi arasında test hatası oluştur: transaction rollback olmalı.
5. Neon kesintisi/zaman aşımı: yan etki yapılmamalı; yerel memory fallback olmamalı.
6. İşlem sonucunun HTTP cevabı kaybolursa preview tekrar değiştirilmemeli; yeniden sorgu ile durum görülebilmeli.
7. İki ayrı grant create/revoke isteği aynı signer için çakıştığında zincir nonce veya çift grant hatası oluşmamalı.
8. T01–T20 içindeki creator, scope, imza, expiry, yanlış ajan ve seçici iptal testleri korunur.

## 7. Bağımsızlık gösterisini doğru değiştirme

Tek Vercel projesi durdurulduğunda bütün endpoint'ler durur. Bu yüzden eski “Control process'ini kapat, aynı public sitede iki servis çalışsın” gösterisi aynen kullanılamaz.

Yeni kanıt:

- Araç endpoint'lerinin Control API'sine HTTP isteği yapmadığı entegrasyon testiyle kontrol edilir.
- İzole yerel testte yönetim endpoint'leri gerçekten erişilemez yapılır; araç handler'ları doğrudan Arkiv ile çalışmaya devam eder. Bunun tek deployment içinde bir bağımlılık testi olduğu belirtilir.
- Bağımsız CLI, web uygulamasına bağlanmadan kendi RPC'sinden Atlas/Boreal grant'lerini ve doğrulama sonuçlarını üretir.
- Başka geliştiricinin örnek endpoint'i kendi ortamında kurma yolu belgelenir.

Bu, hosting arızasına dayanıklılık veya iki farklı işletmeci kanıtı değildir. Ürünün ortak, açık yetki sözleşmesini ve özel yönetim API'sinden bağımsız doğrulamayı gösterir.

## 8. Sıfır ödeme sınırı

| Parça | Seçim | Sınır |
|---|---|---|
| Hosting | Vercel Hobby | Kişisel/ticari olmayan demo, ücretsiz kota içinde |
| Veritabanı | Neon Free | Ücretsiz plan; ücretli plana geçiş yok |
| Domain | Varsayılan `vercel.app` | Domain satın alınmaz |
| Zincir | Arkiv Tiramisu testnet | Faucet ve uygun ücretsiz erişim kullanılır; erişim ilk gün doğrulanır |
| Canlı AI | Vercel AI Gateway'in hesaba tanımlı ücretsiz kredisi varsa | Kredi satın alma, otomatik yükleme ve ücretli fallback yok |

16 Ekim 2026 kontrolünde Vercel Hobby ücretsizdir ve kişisel/ticari olmayan kullanım içindir; kota aşımlarında erişim kısıtlanabilir. Neon Free kredi kartı gerektirmeden aylık 100 CU-saat/proje ve 1 GB/proje depolama listeler. Bunlar sınırsız erişim veya kesintisizlik garantisi değildir. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Neon Free](https://neon.com/pricing)

AI Gateway dokümanı uygun modeller için aylık 5 USD değerinde ücretsiz kredi belirtir. Kullanıcının mevcut bakiyesi ve hesap erişimi kontrol edilmeden canlı AI sözü verilmez. Vercel AI SDK ile ücretsiz katmana uygun tek model kullanılır; çıktı Zod ile doğrulanır. Responses API ve ücretli OpenAI anahtarı zorunluluğu kaldırılır. Oturum başına çağrı sınırı ve toplam ücretsiz bütçe kontrolü uygulanır. [AI Gateway fiyatlandırması](https://vercel.com/docs/ai-gateway/pricing)

Ücretsiz AI erişimi yoksa veya kota biterse deterministik mod devam eder; yapay olarak canlı AI sonucu gösterilmez. Neon/Vercel kotası biterse ücretli yükseltme yapılmaz. Gereksiz polling kapatılır, sadece kullanıcı eylemi sırasında ve işlem beklerken sınırlı sorgu yapılır.

## 9. Yeni çalışma sırası ve bütçe

1. Vercel Hobby ve Neon Free erişimini doğrula; ücretli seçenek seçme.
2. Tek repo ve tek Vercel projesini aç; boş API ve DB bağlantısını erken deploy et.
3. Küçük SQL migration'ını uygula; nonce/preview transaction'ını iki eşzamanlı istemciyle test et.
4. Arkiv grant adapter'ını ve doğrulayıcıyı bağla.
5. Content/Preview handler'larını, Atlas iptal/Boreal devam akışını tamamla.
6. Session ve zincir gönderimi idempotency kontrollerini ekle.
7. Ücretsiz model erişimi uygunsa en fazla 45 dakika ayır.
8. Tek ekran, CLI, friction, kanıt ve videoyu tamamla.

Docker, reverse proxy, dört deployment ve process yönetimi kaldırıldığı için SQL eklemek otomatik olarak dört servisli plandan daha fazla toplam iş demek değildir. Bununla birlikte doğru atomik işlem ve eşzamanlılık testleri ek çalışma gerektirir. İlk kurulum/SQL doğrulaması için mevcut bütçeden yaklaşık 2 saat ayrılır; bu tahmindir. Model ve görsel polish kesilebilir, güvenlik testleri kesilmez.

Üç günlük 18 saatlik temel bütçe ve 3 saat tampon korunur; gün sonu hedefleri değişmez:

- Gün 1: gerçek grant, gerçek işlem, atomik replay kontrolü ve iptal.
- Gün 2: public Vercel demo, iki görev, hata testleri ve varsa canlı model.
- Gün 3: bağımsız tekrar, belgeler, video ve teslim.

**Korunan vurucu an:** Atlas iptal edilir, iki araç Atlas isteğini reddeder; aynı ajan Boreal işini sürdürür. Sunucusuz dağıtım bu davranışı zayıflatmaz. Değişen şey barındırma ve çalışma durumu saklama biçimidir.
