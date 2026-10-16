# BOUND — Final Proje ve Uygulama Planı

**Plan tarihi:** 16 Ekim 2026 · Türkiye saati  
**Kapasite:** Tek geliştirici, üç gün, günde 6–7 odaklı saat  
**Bütçe:** 18 saat planlanmış iş + en fazla 3 saat hata/altyapı tamponu  
**Hedef:** Security ve Open Source kategorilerine güçlü, çalışan ve tekrar üretilebilir bir başvuru  
**Durum:** Uygulama planı. Bu belge kodun yazıldığı, testlerin geçtiği veya güvenlik denetimi yapıldığı anlamına gelmez.

> **Kesin ürün kararı:** Bir ajan, iki küçük araç servisi, iki bağımsız görev. Arkiv'deki süreli izinler gerçek işlemleri yetkilendirir. Bir görev iptal edildiğinde onun yeni işlemleri durur; diğer görev çalışmaya devam eder. Canlı LLM yalnızca dar bir içerik düzenleme akışında kullanılır. Alt ajan bu teslimde yapılmaz.

Bu belge, önceki araştırmalardaki alternatif kapsamların yerine geçecek uygulama planıdır. Ürün kararı sabittir. Ağ erişimi, SDK davranışı veya hesap erişimi beklenenden farklı çıkarsa aşağıdaki önceden belirlenmiş karar kuralları uygulanır. Henüz denenmemiş altyapı için “hiçbir teknik düzeltme gerekmeyecek” garantisi verilemez; yeniden fikir aramaya veya özellik pazarlığına ihtiyaç bırakmamak hedeflenmiştir.

## 1. Yapacağımız ürün

**Türkçe değer önerisi:** Ajanına belirli bir iş için izin ver. O işi durdur; diğer işleri devam etsin.

**İngilizce ana cümle:** “Revoke the task. Keep the agent working.”

**İlk kullanıcı:** Birden fazla araçla çalışan küçük yazılım ekibindeki geliştirici. Ajanına bir müşteri projesinde içerik düzenleme işi verirken başka projelere veya işlemlere erişim vermek istemiyor.

**İlk iş:** Atlas adlı sentetik projenin tanıtım içeriğini oku, metni kısalt ve yalnızca önizlemesini güncelle.

**İkinci görev:** Boreal adlı başka bir sentetik projenin aynı türdeki işi. Aynı ajan kimliği kullanılır; izin kaydı farklıdır.

**İki araç servisi:**

1. **Content Service:** İzin verilmiş projenin sentetik kaynak metnini döndürür.
2. **Preview Service:** İzin verilmiş projenin önizleme metnini gerçekten değiştirir.

İki servis kendi Arkiv istemcisini çalıştırır. Her ikisi de izin kararını kendi sürecinde verir. Ortak doğrulayıcı paketini kullanabilirler; ortak bir çevrimiçi yetkilendirme API'sine bağlanmazlar.

**Demonun ana anı:** Atlas izni iptal edildikten sonra aynı ajan Atlas için iki servisten de ret alır; Boreal işi başarılı olur. Böylece hem iptal hem de başka geçerli işlerin bozulmadığı gösterilir.

Bu sürüm, genel amaçlı kurumsal kimlik platformu değildir. Sentetik kaynaklarla, belirli güvenlik davranışlarının uçtan uca çalıştığını gösteren bir ürün ve yeniden kullanılabilir doğrulayıcıdır.

## 2. Sabit kapsam: yapılacaklar ve yapılmayacaklar

### 2.1 Teslimde bulunması gereken çekirdek

| Parça | Kesin kapsam | Bitti sayılma koşulu |
|---|---|---|
| Gerçek Arkiv entegrasyonu | Tiramisu üzerinde izin oluşturma, okuma, silme ve süre dolması | İşlem/entity bağlantılarıyla tekrar gösterilebilir |
| Kimlikler | Bir kaynak sahibi test kimliği, bir ajan kimliği, bir saldırgan test kimliği | Creator taklidi ile gerçek creator ayrılır |
| Görevler | Atlas ve Boreal; aynı ajan için ayrı grant | Birinin iptali diğerini etkilemez |
| Araçlar | İki ayrı HTTP servisi | İkisi de doğrudan Arkiv kontrolü yapar |
| Gerçek sonuç | Başlık ve paragraftan oluşan önizleme | Başarılı istekte değişir; reddedilende değişmez |
| Güvenlik | İmza, scope, gerçek creator, owner, yaşam süresi, nonce, güncellik ve hata kontrolü | Bölüm 12'deki zorunlu testler geçer |
| Arayüz | Tek sayfa, iki görev kartı, önizleme, iki servis sonucu, kanıt bölümü | Jüri akışı açıklama istemeden deneyebilir |
| Tekrar üretim | Bağımsız CLI ve entegrasyon örneği | Yönetim servisi kapalıyken kontrol yapılabilir |
| Belgeler | README, schema, friction, threat model, demo yönergesi | Temiz kurulumdan takip edilebilir |
| Teslim | Public URL, MIT repo, video ve form | Erişim istemeden açılabilir |

### 2.2 Canlı model kararı

Canlı model **hedef teslimin parçasıdır**, ancak güvenlik çekirdeğinin çalışması ona bağlı değildir. Model entegrasyonunun geliştirme bütçesi 45 dakikadır; bunun için erişilebilir API anahtarı ve uygun model gerekir.

- Normal akış: içerik servisini çağır → metni modele düzenlet → doğrulanmış çıktıyı önizleme servisine gönder.
- Model bir metin üreticisidir. İzin verme, izin seçme, kaynak sahipliği ve imza doğrulama kararlarını vermez.
- Sonsuz ajan döngüsü, çoklu model veya agent framework kurulmaz.
- Güvenlik senaryoları ayrı ve deterministiktir; modelin tesadüfen kötü istek üretmesi beklenmez.
- API erişimi kurulamazsa veya 45 dakikalık sınır aşılırsa canlı model düğmesi kapatılır. Aynı ajan kimliğiyle çalışan **“Deterministic test run”** açıkça etiketlenerek kullanılır. Bu bir kapsam kurtarma kuralıdır; canlı AI çalışmış gibi sunulmaz.

### 2.3 Bu yarışma tesliminde yapılmayacaklar

- Alt ajan ve yetki zinciri. Kalan 3 saatlik tampon bile buna harcanmaz.
- Genel izin dili, sürükle-bırak politika editörü, wildcard kapsamlar.
- Gerçek GitHub/Vercel hesap bağlantıları, OAuth onboarding veya marketplace.
- MCP/A2A uyumluluğu ve evrensel araç desteği iddiası.
- Kullanıcı hesabı, kuruluş yönetimi, ekip üyeliği ve ödeme.
- Production deploy, dosya silme, shell çalıştırma veya para transferi.
- İçerik hash'ine ayrıca insan onayı, çok imzalı onay veya teklif/onay durum makinesi.
- Zincire her araç çağrısını yazan audit sistemi.
- Kalıcı anonimlik, özel metadata veya güvenli veri silme iddiası.
- Global “yalnızca bir kez kullanılabilir izin” ve servisler arası atomik işlem garantisi.
- WebSocket, batch, ownership transfer veya lifetime extension'ı yalnızca özellik sayısı artsın diye eklemek.
- Çoklu servis replikası, dağıtık nonce deposu, Kubernetes ve ayrı PostgreSQL/Redis kurulumu.

**Neden alt ajan kesin çıkarıldı?** Tek seviyeli devir yapılabilir; ancak parent/child scope, creator, süre ve iptal kesişiminin doğru test edilmesi bu bütçede asıl kanıtları sıkıştırır. Önceki Airlock fikriyle en fazla örtüşen bölüm de budur. Bu teslimin ayırt edici davranışı seçici iptal ve bağımsız servis uygulamasıdır.

## 3. Jürinin yaşayacağı baştan sona akış

1. Jüri public URL'yi açar. Ürünün sentetik, paylaşımlı test ortamı olduğu görünür.
2. **Start demo** ile yeni bir demo oturumu başlatır. Cüzdan kurması veya erişim istemesi gerekmez.
3. Atlas ve Boreal için ayrı izin kartlarını görür. Henüz izin yokken işlemler çalışmaz.
4. **Grant access** ile iki kısa ömürlü izin Tiramisu'ya yazılır. İşlem tamamlanmadan kart “Active” olmaz.
5. **Run Atlas**: ajan kaynak metni okur, varsa canlı modelle kısaltır ve önizlemeyi günceller.
6. Ekranda önce/sonra metni, iki servisin kararı, kullanılan izin ve okunan blok görünür.
7. **Try wrong project**: Atlas izniyle Boreal'a yazma isteği yapılır. Ret alınır; Boreal içeriği değişmez.
8. **Try forged grant**: aynı alanları taklit eden saldırgan kaydı kullanılır. Gerçek creator uyuşmadığı için ret alınır.
9. **Revoke Atlas**: iptal işlemi gönderilir. Önce “Revocation pending” gösterilir.
10. Her servis iptali içeren yeterince güncel durumu okuyup yeni Atlas isteğini reddettiğinde sonucu ayrı ayrı görünür.
11. **Run Boreal** başarılı olur. Aynı ajan kimliğinin tamamen kapatılmadığı gösterilir.
12. Kanıt bölümü açılır: entity/işlem bağlantıları, public creator adresleri ve bağımsız tekrar komutları görülür.

Süre dolması, kısa ömürlü ayrı bir test grant'iyle ayrıca denenir. Üç dakikalık ana demoda bütün testler tek tek oynatılmaz.

**Önemli davranış:** İptal, daha önce okunmuş metni geri almaz; önceden tamamlanmış önizleme değişikliğini geri çevirmez. Gösterilen güvence, iptal durumunu gören kontrol noktasından sonraki yeni işlemlerdir.

## 4. Teknoloji ve uygulama yapısı

### 4.1 Seçilen yığın

- **Dil:** TypeScript, strict mod.
- **Frontend:** React + Vite; sade CSS. Mevcut olmayan büyük bir tasarım sistemi kurulmaz.
- **Backend:** Node.js 22 + Express; küçük HTTP servisleri.
- **Arkiv:** Resmî `@arkiv-network/sdk`, Tiramisu. Yarışmanın belirttiği 0.8.x hattından çalışan kesin sürüm ilk deneyde sabitlenir; lockfile commit edilir.
- **İmzalar:** viem ile EIP-712 typed data; yalnızca EOA test anahtarları. Smart-contract wallet imzaları ve özel kriptografi bu sürümde yoktur. [Viem doğrulama belgeleri](https://viem.sh/docs/utilities/verifyTypedData)
- **Şema doğrulama:** Zod.
- **Test:** Vitest; HTTP testleri için Node fetch ve küçük test yardımcıları.
- **Model:** OpenAI Responses API üzerinden tek structured output çağrısı. Model ID'si `BOUND_MODEL` ortam değişkenidir; erişimi ilk kurulumda doğrulanan, structured output destekli model sabitlenir. Model seçimi ürün mimarisini değiştirmez.
- **Çalıştırma:** npm workspaces; tek lockfile.
- **Hosting biçimi:** Bir Docker Compose kurulumunda ayrı süreçler ve HTTPS reverse proxy. Her uygulama servisi tek replika çalışır.

Paket imzaları bu planın örneklerinden tahmin edilmez; kurulu SDK tipleriyle kontrol edilir. Plan yalnızca dokümanda doğrulanan davranışlara dayanır, derlenmiş uygulama kodu değildir.

### 4.2 Dört küçük süreç

| Süreç | Sorumluluk | Sahip olduğu gizli bilgi | Sahip olmadığı şey |
|---|---|---|---|
| `control` | Demo oturumu; owner adına izin oluşturma/iptal | Yalnızca demo owner ve saldırgan test anahtarları; demo oturum anahtarı | Ajan özel anahtarı, model anahtarı |
| `runner` | Ajan akışı; istek imzalama; sınırlı model çağrısı | Ajan özel anahtarı, model API anahtarı; demo oturum anahtarı | Owner özel anahtarı |
| `content` | Sentetik kaynak metnini döndürme ve yetki uygulama | Gerekirse kendi RPC access key'i | Owner/ajan özel anahtarları |
| `preview` | Önizleme değişikliği ve yetki uygulama | Gerekirse kendi RPC access key'i | Owner/ajan özel anahtarları |

Statik frontend reverse proxy tarafından servis edilir; `control` durduğunda frontend dosyalarının da kaybolması zorunlu değildir. Public yollar `/api/control`, `/api/runner`, `/api/content`, `/api/preview` olarak ayrılır.

`content` ve `preview` aynı kod paketini kullanabilir. **Bağımsız doğrulama, farklı kod tabanı değil; karar verirken control API'sine ihtiyaç duymamalarıdır.** İki ayrı şirkete ait oldukları veya tek sunucu arızasına dayanıklı oldukları söylenmez.

### 4.3 Basit mimari

```text
Tarayıcı ── grant/revoke ──> Control ── owner işlemi ──> Arkiv
    │
    └── run/test ──> Runner ── imzalı çağrı ──> Content ── kendi RPC ──> Arkiv
                       │
                       ├── tek metin düzenleme çağrısı ──> Model API
                       │
                       └── imzalı çağrı ──> Preview ── kendi RPC ──> Arkiv

Bağımsız CLI ── kendi RPC ──> Arkiv
Bağımsız CLI ── imzalı test çağrısı ──> Content / Preview
```

### 4.4 Arkiv'de ve dışında tutulanlar

**Arkiv:** Yetki kayıtları, gerçek creator/owner bilgisi, sorgu attribute'ları, değişmez scope ve geçerlilik üst sınırı.

**Arkiv dışında:** Metin dosyaları, önizleme içerikleri, model çağrısı, özel anahtarlar, nonce'lar, demo oturumları ve yerel test sonuçları.

Önizleme durumu servis belleğinde tutulur. Bu gerçekten değişen uygulama durumudur; yalnızca frontend animasyonu değildir. Servis yeniden başlarsa önizleme sıfırlanır ve bu açıkça belirtilir. Üretim dosya saklama ürünü yapılmadığı için bu sürümde kalıcı uygulama veritabanı kurulmaz.

## 5. Public demo, sahiplik ve anahtarlar

### 5.1 Demo sahipliği dürüst biçimde sunulacak

Public demoda ziyaretçi gerçek müşterinin hesabını bağlamaz. Uygulamanın işlettiği **demo owner** üzerinden yalnızca sentetik kaynaklar için izin verir. Ekranda “Demo owner — synthetic resources” yazılır.

Bu, ziyaretçinin kendi cüzdanından imza attığı veya custody probleminin çözüldüğü şeklinde sunulmaz. Üretimde kaynak sahibinin kendi kimliğini bağlaması gerekir; o onboarding bu teslimin kapsamı dışındadır.

Yerel tekrar örneğinde geliştirici kendi test owner ve agent anahtarlarını ortam değişkeninden kullanabilir. Public repoda hiçbir özel anahtar bulunmaz.

### 5.2 Kaynak sahipliği nasıl belirlenir?

Her araç servisi, kendi güvenilir konfigürasyonunda şu demo kaynak deseninin sahibini bilir:

```text
demo://bound/<run_id>/atlas  -> DEMO_OWNER_ADDRESS
demo://bound/<run_id>/boreal -> DEMO_OWNER_ADDRESS
```

- `run_id` sunucunun ürettiği rastgele demo kimliğidir; gerçek kişi bilgisi içermez.
- Yalnızca bu tam biçim ve iki proje kabul edilir. Dosya yolu veya kullanıcıdan gelen URL çalıştırılmaz.
- Birinin Arkiv'e `project=atlas` yazması sahiplik sağlamaz.
- Verifier'ın beklediği owner, gelen grant payload'ından veya istekteki `owner` alanından alınmaz.
- Kaynak, servis ve işlem için wildcard kabul edilmez.

### 5.3 Oturum izolasyonu ve maliyet

- Tarayıcıya kısa ömürlü, HttpOnly/Secure/SameSite oturum cookie'si verilir. Oturum mekanizması hazır bir kütüphaneyle uygulanır.
- Control ve Runner oturumu kendi paylaştıkları demo session secret ile çevrimdışı doğrular. Runner her araç çağrısında Control'a sormaz.
- UI isteklerinde `run_id` cookie'den türetilir; başka oturumun `run_id` değeriyle grant oluşturma/iptal kabul edilmez.
- Content/Preview yetki kararında demo cookie'sine güvenmez; imzalı istek ve Arkiv grant'ini denetler.
- Aynı public ortamda tek aktif demo oturumu çalışır. Başka ziyaretçi izleyebilir ve en geç 5 dakika sonra yeniden deneyebilir. Bu açıkça “Shared demo is busy” olarak gösterilir; özel erişim talebi gerekmez.
- Oturum başına en fazla 2 normal grant, 1 saldırgan grant ve 1 expiry grant üretilir; create/revoke istekleri idempotent tutulur.
- Oturum başına en fazla 2 model çağrısı; global model bütçesi ayrıca sunucuda sınırlanır. Bütçe dolarsa yalnızca model modu kapanır, deterministik demo devam eder.
- Aynı signer'ın paralel zincir yazımları Control'da sıraya alınır; transaction nonce çakışması önlenir.
- Demo cookie kontrolü, uygulamanın public test ortamını korur; ürünün Arkiv üzerindeki yetkilendirme kanıtının yerine geçmez.

## 6. Arkiv veri modeli

### 6.1 Tek entity türü: `grant`

Bu sürümde ayrı revocation registry, receipt entity veya agent registry yoktur. İptal, grant'in owner tarafından silinmesidir. Alt devir alanları da eklenmez; yalnızca `delegation: false` kabul edilir.

| Alan | Yer | Amaç |
|---|---|---|
| `app = bound_v1` | String attribute | Uygulama verisini bulmak |
| `kind = grant` | String attribute | Tür ayrımı |
| `run_id` | String attribute | Sentetik demo oturumu |
| `resource` | String attribute | Tam kaynak kimliği |
| `agent` | Address attribute | İzin verilen ajanı sorgulamak |
| `version = 1` | Sayısal attribute | Şema sürümü |
| `schemaVersion` | Payload | Payload sürüm doğrulaması |
| `chainId` | Payload | Tiramisu bağlamı |
| `deploymentId` | Payload | Farklı BOUND kurulumlarının ayrılması |
| `resource`, `agent` | Payload | Karar için bağlayıcı alanlar; attribute ile aynı olmalı |
| `permissions` | Payload | Tam servis/işlem çiftleri |
| `notAfterUnix` | Payload | Değişmez duvar saati üst sınırı; saniye |
| `delegation = false` | Payload | Alt devir desteklenmediğini açıklar |
| `creator`, `owner`, `expiresAt`, flags | Arkiv sistem alanları | Kaynak, kontrol ve yaşam döngüsü |

Kavramsal payload; çalışan SDK çağrısı değildir:

```json
{
  "schemaVersion": 1,
  "chainId": 7738577,
  "deploymentId": "<bu-kurulumun-sabit-kimligi>",
  "resource": "demo://bound/<run_id>/atlas",
  "agent": "<ajan-adresi>",
  "permissions": [
    { "service": "bound.content.v1", "action": "content.read" },
    { "service": "bound.preview.v1", "action": "preview.update" }
  ],
  "notAfterUnix": 0,
  "delegation": false
}
```

`notAfterUnix` örnekte yalnızca yer tutucudur; gerçek kayıtta oluşturma anına göre geçerli zaman yazılır. Sürüm 1'de bilinmeyen işlem, farklı alan tipi veya çelişen attribute/payload reddedilir.

### 6.2 Yaşam süresi

- Normal demo izinleri: oluşturulduklarında yaklaşık 15 dakikalık Arkiv ömrü; payload'da oluşturma anından 15 dakika sonrası için kesin üst sınır.
- Ayrı expiry testi: yaklaşık 60 saniyelik Arkiv ömrü; payload üst sınırı 5 dakika. Böylece ilk ret nedeninin yalnızca yerel sayaç değil, zincirde grant'in aktif durumdan çıkması olduğu gözlenebilir.
- Bağımsızlık kanıtı oturumu: test sırasında geçerli 15 dakikalık grant; video çekimi öncesi yeniden oluşturulur.
- Normal izinlerde `readonly: true`, `permissionlessExtension: false` kullanılır. Sahiplik owner'da kalır.
- Owner sonradan entity ömrünü uzatsa bile verifier `notAfterUnix` sınırını aşan yetki vermez.
- Yeniden yetki gerekiyorsa yeni grant ve yeni entity anahtarı oluşturulur. Eski anahtar yeni izne kendiliğinden geçmez.

Dokümanda `readonly` içerik/attribute değişikliğini durdurur; silme, devir ve uzatmayı engellemez. Owner uzatma yapabilir. Tasarımın ek üst sınırı bu davranışı dikkate alır. [Arkiv mutasyon belgeleri](https://docs.arkiv.network/typescript-sdk/mutating-data/)

### 6.3 Gerçek sorguların cevaplayacağı sorular

1. Bu demo oturumunda beklenen owner tarafından oluşturulmuş hangi izinler var?
2. Bu ajan ve tam kaynak için hangi izin kayıtları bulunuyor?
3. Bu istekte açıkça belirtilen grant anahtarı, servis tarafından seçilen blokta mevcut ve uygun mu?
4. Saldırganın aynı namespace ile oluşturduğu kayıt hangi creator'dan geliyor?

Listeleme: app + kind + run_id + gerektiğinde resource/agent filtreleri ve gerçek creator filtresi. Bütün sayfalar okunur. Yürütme: istekteki **tek tam grant anahtarı** doğrulanır; “ajanın herhangi bir geçerli izni var mı?” diye geniş arama yapılmaz.

Listeleme ekranında saldırgan kaydı göstermek için ayrı, açıkça etiketlenmiş sorgu kullanılır. Bu kayıt yetkili grant listesine karıştırılmaz.

`schema.md` geliştirme sırasında gerçek SDK'dan üretilmiş sorgu metinlerini, seçilen alanları, tipleri ve örnek çıktıları taşımalıdır. Bu planda uydurma çalışır sorgu sözdizimi kullanılmaz. Creator, key ve expiry gibi sistem alanlarıyla sorgulama ve blok sabitleme resmî SDK'da belgelenmiştir. [Sorgu belgeleri](https://docs.arkiv.network/typescript-sdk/querying-data/)

## 7. İstek imzası ve tekrar kullanım kontrolü

### 7.1 İmzanın bağlayacağı bilgiler

EIP-712 domain: `name=BOUND`, `version=1`, `chainId=7738577`, kurulum kimliğinden türetilen sabit domain salt. Uygulamaya özel contract varmış gibi rastgele `verifyingContract` kullanılmaz.

İmzalı mesaj şunları kapsar:

```text
serviceId
resource
action
grantKey
bodyHash
nonce
requestExpiresAtUnix
```

- `bodyHash`, gönderilecek tam HTTP body byte'larının `keccak256` hash'idir. İmza sonrasında body yeniden serialize edilmez. İmzalı zarf/signature ayrı HTTP header'larında taşınır; hash alınan body kendi imzasını içermez.
- Servis aldığı ham body byte'larından aynı hash'i hesaplar, sonra JSON'u parse eder.
- GET body'si gibi belirsizlik yaratmamak için iki araç çağrısı da POST olur.
- Servis, action ve resource imzalı zarfla body/route arasında eşleşmelidir.
- İmzayı atan adres grant'teki agent ile aynı olmalıdır.
- Hazır viem signing/verification kullanılır; elle imza recovery veya yeni imza algoritması yazılmaz.

### 7.2 Nonce: sunucunun verdiği tek kullanımlık challenge

Her araç servisinin kendi `/challenge` endpoint'i olur:

1. Runner ilgili servisten rastgele challenge alır.
2. Servis bunu kendi belleğinde 30 saniyelik süreyle saklar; ajan adresi ve kendi servis bağlamıyla ilişkilendirir.
3. Runner bu nonce ve en fazla 30 saniyelik istek süresiyle imza atar.
4. Doğrulamalar tamamlandığında servis challenge'ın ajanını, challenge süresini ve imzalı istek süresini yeniden kontrol ederek nonce'ı **atomik olarak tüketir**, ardından işlemi uygular. İstek süresi challenge süresini aşamaz.

Tek Node sürecinde nonce'ın kontrol edilip silindiği kritik bölümde `await` bulunmaz. Aynı imzalı isteğin iki eşzamanlı kopyasından en fazla biri işleme geçebilir.

Servis yeniden başlarsa challenge tablosu boşalır; eski istekler bilinmeyen nonce nedeniyle reddedilir. Kabul, “daha önce kullanılmışlar listesinde yok” kontrolüne değil, **hâlen verilmiş ve tüketilmemiş challenge'ın varlığına** dayanır.

Challenge tablosu boyutu ve endpoint istek hızı sınırlandırılır. Bu plan tek replika içindir; replikasyon eklenirse atomik ortak nonce deposu gerekir. Bir grant birden fazla meşru çağrıya izin verebilir; nonce, grant'i tek kullanımlık yapmaz.

## 8. Verifier'ın kesin karar sırası

İki araç servisi aynı `@bound/core` paketindeki doğrulayıcıyı kullanır. İşlem handler'ına geçmeden önce aşağıdaki sıra uygulanır:

1. Body boyutu, JSON yapısı, istek süre sınırı ve desteklenen action doğrulanır.
2. Servis ID'si, kurulum domain'i, kaynak ve body hash eşleşmesi kontrol edilir.
3. Ajan imzası doğrulanır; challenge'ın varlığı ve süresi kontrol edilir.
4. Servis kendi güvenilir RPC'sinden güncel başlık/blok bilgisini alır; veriyi yeterince güncel kabul edemiyorsa işlemi durdurur.
5. İstekteki grant anahtarı, seçilen blok görünümünde sorgulanır. Eski olumlu izin önbelleği kullanılmaz.
6. Gerçek creator kaynak sahibine eşit olmalıdır. Bu sürümde owner da aynı kalmalıdır; beklenmedik ownership transfer reddedilir.
7. `readonly=true`, `permissionlessExtension=false`, sürüm/chain/deployment ve `delegation=false` doğrulanır.
8. İstek imzalayan ajan, kaynak, servis ve işlem grant ile tam eşleşmelidir. Attribute/payload çelişkisi reddedilir.
9. Zincirdeki aktiflik ve `notAfterUnix` birlikte kontrol edilir. Herhangi biri geçersizse yetki yoktur.
10. Kontrol sırasında head ilerlediyse yeni head üzerinde en fazla bir kez yeniden doğrulama yapılır. Hâlâ kararlı ve yeterince güncel karar verilemiyorsa işlem yapılmaz; kullanıcı tekrar deneyebilir.
11. Nonce tüketilmeden hemen önce istek/challenge zamanı ve grant'in `notAfterUnix` sınırı tekrar kontrol edilir; ağ beklenirken dolmuş süreyle işlem yapılmaz. Nonce atomik tüketilir. Handler yalnızca doğrulanmış, normalize edilmiş parametrelerle çağrılır.
12. Preview güncellemesi bu sürümde bellekte senkron uygulanır; ret halinde içerik ve revizyon numarası değişmez.

### 8.1 Güncellik ve iptal semantiği

- İlk teknik deneyde SDK/RPC üzerinden blok yüksekliği ve blok timestamp erişimi kontrol edilir.
- Varsayılan demo politikası: okunan head'in timestamp'i sunucu saatinden en fazla 15 saniye eski olabilir; 5 saniyeden fazla gelecekteyse saat/RPC hatası kabul edilir. Sunucu saati senkron olmalıdır.
- Servis gördüğü en yüksek blok numarasını tutar; geriye giden cevapla olumlu karar vermez.
- Her yetki kontrolünde yeni sorgu yapılır. WebSocket bildirimi veya UI'daki yeşil kart yetki kanıtı değildir.
- Zaman aşımı, RPC hatası, retention dışı blok veya eksik alanlar `UNAVAILABLE` üretir ve işlem yapılmaz.
- Güncellik eşiği ağ üzerinde ölçülecek bir tasarım parametresidir. Ağ düzenli olarak eşiği aşarsa raporlanır; güvenlik testini geçirmek için sessizce kaldırılmaz. İlk deney bu bağımlılığı doğrulamalıdır.
- RPC yanıtlarının doğruluğuna ve zincirin uzlaşmasına güvenilir. Bu uygulama light client veya Byzantine RPC doğrulaması yapmaz. “Yeni başlık aldım” tek başına kötü niyetli RPC'ye karşı kanıt değildir.

İptal, silme işleminin dahil edildiği blok ve sonrasındaki görünümü okuyan servis için etkili olur. İki servis aynı duvar saati anında aynı duruma ulaşmak zorunda değildir. UI iki ayrı sonucu gösterir; ilk ret gelince ikisini de iptal edilmiş boyamaz.

Kontrol ile yan etki arasında sıfır zaman aralığı garanti edilmez. Başlamış iş geri alınmaz. Ölçülen iptal görünürlüğü, belli RPC ve ağ koşullarındaki gözlemdir; evrensel gecikme garantisi değildir.

### 8.2 Sonuç biçimi

```text
decision: ALLOW | DENY | UNAVAILABLE
reasonCode
serviceId
grantKey
checkedBlock
checkedAt
observedCreator        // zincirden okunabildiyse
requestId
```

Örnek reason code'lar: `BAD_SIGNATURE`, `WRONG_SCOPE`, `UNTRUSTED_CREATOR`, `OWNER_CHANGED`, `UNSAFE_FLAGS`, `GRANT_NOT_ACTIVE`, `POLICY_EXPIRED`, `NONCE_INVALID`, `RPC_UNAVAILABLE`, `STALE_STATE`, `INVALID_PAYLOAD`.

Grant bulunmadığında otomatik olarak “insan iptal etti” denmez; silinmiş, süresi dolmuş veya yanlış anahtar olabilir. UI ancak kendi doğrulanmış silme işlemiyle ilişkilendirebildiğinde “revoked” gösterir. Geri kalan durum “grant is not active” olur.

## 9. Canlı LLM akışı

1. Kullanıcı yalnızca sabit görevi çalıştırır: “Bu tanıtım metnini daha kısa ve anlaşılır hâle getir.”
2. Runner, Content Service'e geçerli imzalı `content.read` isteği gönderir.
3. Okuma reddedilirse model çağrısı yapılmaz.
4. Kaynak metin, tek Responses API çağrısıyla `title` ve `body` alanlarına dönüştürülür.
5. Çıktı Zod ile doğrulanır: yalnızca metin, başlık en fazla 80 karakter, gövde en fazla 600 karakter. HTML/JavaScript render edilmez.
6. Runner yeni challenge alır ve **aynı görevin aynı grant anahtarını kullanarak** Preview Service'e `preview.update` gönderir. Challenge model çağrısından önce alınmaz; uzun model yanıtı istek penceresini tüketmez.
7. Preview Service izni tekrar okur. Model çalışırken izin iptal olmuşsa güncelleme reddedilir.
8. Başarılıysa önce/sonra farkı gösterilir. Başarısızsa eski önizleme korunur.

Model çağrısı için 20 saniye uygulama zaman aşımı ve bir çağrı sınırı vardır; otomatik sonsuz retry yoktur. Refusal, eksik çıktı ve şema hatası ayrı gösterilir. Modelin döndürdüğü metin imzalanmadan önce boyut/şema kontrolünden geçer; JSON içinde yeni araç, grant veya kaynak seçmesine izin verilmez.

Public UI'da iki düğme net ayrılır:

- **Run with AI:** Gerçek model çağrısı; kullanılan model adı ve sonuç durumu gösterilir.
- **Run deterministic test:** Sabit test metniyle gerçek imza, gerçek Arkiv okuması ve gerçek servis işlemi.

Bu sınırları olan bir LLM destekli ajan akışıdır; otonom araştırma veya kendi araçlarını keşfeden bir ajan olduğu iddia edilmez. Model sağlayıcısı veya API erişimi yoksa aynı işin deterministik sürümü kullanılabilir. API anahtarı browser'a veya zincire gönderilmez.

Responses API structured output desteği resmî dokümanda açıklanır; schema uygunluğu içerik doğruluğu veya yetki güvenliği garantisi değildir. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

## 10. Arayüz: tek ekran, tek hikâye

Ürün arayüzü ve video İngilizce hazırlanır. Türkçe uygulama notları repo dışında bu planda kalabilir.

### Üst bölüm

- BOUND adı ve kısa değer önerisi.
- “Tiramisu testnet · Synthetic demo” etiketi.
- Demo oturumu, RPC erişimi ve canlı AI kullanılabilirliği.

### Sol bölüm: görev kartları

- Atlas ve Boreal.
- Ajan adresinin kısaltılmış hâli.
- İzin verilen iki işlem.
- Durum: `Not granted`, `Creating`, `Active`, `Revocation pending`, `Not active`, `Unable to verify`.
- Yaklaşık zincir ömrü ile politika üst sınırı birbirine karıştırılmaz.
- Grant / Run / Revoke düğmeleri.

### Orta bölüm: yapılan iş

- Kaynak metin.
- Önce/sonra önizleme.
- Son başarılı revizyon numarası.
- Model modu veya deterministik mod etiketi.

### Sağ bölüm: servis kararları

- Content ve Preview için ayrı sonuç kartları.
- Son kontrol zamanı ve kısa neden.
- Kanıt ayrıntısı açıldığında grant anahtarı, creator ve okunan blok.
- Renk yanında metin/ikon bulunur; yalnızca renkle anlam verilmez.

### Alt bölüm: test ve kanıt

- Wrong project, forged grant, replay ve expiry testleri.
- Bağımsız CLI yönergesi.
- Explorer ve repo bağlantıları.
- Kısa “What this demo guarantees / limits” açıklaması.

Polish bütçesi: boşluklar, okunaklı metin, tutarlı buton durumları ve gerçek sonuçlara bağlı kısa geçişler. Animasyonlu ajan grafiği, 3D, logo üretimi, çok sayfalı dashboard ve kapsamlı mobil tasarım yoktur. Dar ekranda bölümler alt alta gelir.

## 11. Bağımsız doğrulama ve Open Source teslimi

`@bound/core` bir workspace paketidir; npm'e yayınlama zorunluluğu yoktur. İçinde şunlar bulunur:

- Grant/request şemaları ve sürüm.
- EIP-712 domain/message tanımı.
- Grant değerlendiren saf fonksiyon.
- Arkiv okuma adapter'ı.
- İmzalı istek doğrulama yardımcısı.
- Karar/ret kodları.

Bir örnek endpoint, verifier başarılı olunca handler'a geçer. Bir middleware dosyası ve örnek test, başka geliştiricinin entegrasyon için başlangıç noktası olur. “Bütün API'lere tek satırda güvenlik” iddiası kullanılmaz.

Geliştirmede oluşturulacak komut sözleşmesi:

```text
npm ci
npm run dev
npm run test
npm run test:live
npm run build
npm run verify -- --grant <entityKey> --resource <resource>
npm run demo:independent -- --manifest <local-manifest-file>
npm run evidence:export
```

Bu komutlar planlanan arayüzdür; henüz var oldukları varsayılmaz. README gerçek script isimleriyle eşleşmelidir.

`verify`, kendi RPC bağlantısından kaydı okuyup kaynak sahibinin **yerel güvenilir konfigürasyonu** altında uygunluğunu kontrol eder. Grant'in söylediği owner'ı kendiliğinden güvenilir kabul etmez. Salt okuma için özel anahtar gerektirmez.

`demo:independent`, yerel ortam değişkenindeki test ajan anahtarıyla iki servise imzalı çağrı yapar. Anahtarı komut satırı argümanına, dosya manifestine veya loga koymaz.

### Yönetim servisi kapalıyken kanıt

1. Atlas ve Boreal grant'lerini oluştur ve başlangıç başarılarını kaydet.
2. Atlas'ı iptal et; ilgili işlem ve blok bilgisini kaydet.
3. Control sürecini yerel/izole demo kurulumunda gerçekten durdur.
4. CLI ile yeni istekler gönder: Atlas reddedilmeli; Boreal iki serviste çalışmalı.
5. Content/Preview loglarında doğrudan Arkiv sorguları ve sonuçları göster.
6. Control'u geri başlat.

Public sitedeki ziyaretçiye ortak sunucuyu kapatan bir düğme verilmez. Bu deney videoda ve tekrar komutunda gösterilir. Tarayıcı sekmesi kapatma veya sahte offline simgesi bağımsızlık kanıtı sayılmaz.

## 12. Zorunlu testler ve kanıtlar

Her başarısız güncelleme testinde **HTTP sonucu yanında önizleme içeriğinin ve revizyonunun değişmediği** de kontrol edilir. Yalnızca “403 aldık” yeterli değildir.

| No | Senaryo | Beklenen davranış | Katman |
|---|---|---|---|
| T01 | Geçerli grant ile read + update | İki servis izin verir, önizleme değişir | Yerel + canlı |
| T02 | Atlas grant'iyle Boreal isteği | `WRONG_SCOPE`; içerik değişmez | Yerel + canlı |
| T03 | Saldırgan aynı payload/attribute'ları yazar | Gerçek creator farklı; ret | Yerel + canlı |
| T04 | Farklı ajan imzası | Ret | Yerel |
| T05 | İmza sonrası body/resource/action değişir | Ret | Yerel |
| T06 | Aynı imzalı istek iki kez gelir | Bir kez işlenir | Yerel + canlı örnek |
| T07 | Aynı istek eşzamanlı iki kez gelir | En fazla bir yan etki | Yerel HTTP |
| T08 | Servis yeniden başlatıldıktan sonra eski nonce | Ret | Yerel HTTP |
| T09 | Atlas iptal edildi | Yeni görünümde iki servis de ret verir | Canlı |
| T10 | Atlas iptal edildi, Boreal geçerli | Aynı ajan Boreal işini yapar | Canlı |
| T11 | Kısa grant zincirde expire olur | Aktif kayıttan çıkar, yeni işlem reddedilir | Canlı |
| T12 | Entity uzatılır ama payload üst sınırı geçer | Yetki uzamaz | Yerel; bir canlı doğrulama zamanı varsa |
| T13 | RPC hata/zaman aşımı/eski blok döner | `UNAVAILABLE`; yan etki yok | Yerel hata enjeksiyonu |
| T14 | Owner transferi veya uygunsuz flags | Ret | Yerel |
| T15 | İzin model çağrısı sırasında iptal olur | Sonraki preview isteği ret; eski içerik korunur | Kontrollü yerel bekletme + canlı grant |
| T16 | Başka servis/deployment için imzalı istek | Ret | Yerel |
| T17 | Bozuk payload, bilinmeyen sürüm, attribute çelişkisi | Ret | Yerel |
| T18 | Control kapalı | CLI Atlas ret/Boreal başarı üretir | İzole uçtan uca |
| T19 | Başka oturum için control/runner isteği | Oturum sınırı korunur | Yerel HTTP |
| T20 | Temiz tarayıcı/public URL | Demo yeniden çalışır; secret sızmaz | Manuel |

Saf doğrulayıcı testleri tablo güdümlü tutulur; 20 ayrı büyük test altyapısı kurulmaz. Birim testleri gerçek zincir deneyi yerine sunulmaz. Sonuç raporunda **unit / local HTTP / live Tiramisu / manual** ayrılır.

T15 için modelin gerçekten yavaşlaması beklenmez: test akışında read ile update arasına kontrollü bir bekleme konur. Public AI davranışı gibi sunulmaz.

### Geliştirme sırasında ölçülecekler

- İlk başarılı Arkiv yazımına kadar geçen süre.
- İzin oluşturma işleminin iki serviste görünmesi.
- İptal işleminin iki serviste yeni çağrıyı durdurması.
- Okuma/doğrulama çağrısının gözlenen süresi.
- Public RPC hata/kota davranışı.

En az üç tekrar, tek tek örnekler ve ortam bilgisi kaydedilir. Üç örnekten p95/SLA veya üretim performans garantisi çıkarılmaz. Veri yokken rapora sayı yazılmaz.

## 13. On sekiz saatlik adım adım çalışma planı

Saatler **odaklı çalışma bütçesidir**; uzun ağ beklemeleri veya erişim sorunları tahminleri bozabilir. Üç günün her birinde 6 saat planlı iş ve en fazla 1 saat tampon vardır. Bu bütçe, AI destekli kod üretimi ve temel TypeScript/Node geliştirme rahatlığı varsayar. Bu teknolojileri ilk kez öğrenme zamanı dahil değildir.

### Gün 1 — 16 Ekim: Yetki gerçekten işlem durduruyor mu? · 6 saat

#### Adım 1 — Ön koşulları kontrol et · 30 dakika

1. Devfolio kayıt durumunu kontrol et.
2. Node/npm/Git ve çalıştırılacak Docker ortamını doğrula.
3. Tiramisu RPC ve faucet erişimini dene; owner ve saldırgan test cüzdanlarını fonla. Ajan yalnızca off-chain istek imzaladığı için bu sürümde gas gerekmez.
4. Public HTTPS deployment yapılabilecek mevcut hesabı/ortamı belirle.
5. Model API anahtarı erişimini kontrol et; anahtar ve model ID'sini yerel secret olarak ayarla.
6. Araştırmaya dönme. Erişim sorunu varsa not et ve bölüm 14'teki kuralı uygula.

**Çıktı:** Kullanılabilir araçlar ve erişimler listesi; secrets git dışında; boş friction dosyasında zaman kaydı.

#### Adım 2 — Repo ve servis iskeleti · 45 dakika

1. npm workspace, TypeScript config, MIT licence ve `.env.example` oluştur.
2. Dört servise basit `/health` endpoint'i ekle.
3. React tek sayfa iskeletini oluştur.
4. Docker Compose ve reverse proxy yollarını hazırlayıp boş public health endpoint'ini doğrula.
5. Paket sürümlerini sabitle ve ilk commit'i al.

**Çıktı:** Tek komutla açılan yerel iskelet; erken deployment yolunun çalıştığı görülmüş.

#### Adım 3 — Küçük Arkiv deneyi · 75 dakika

1. Owner cüzdanıyla bir readonly grant oluştur.
2. Bağımsız public client ile oku; creator/owner/flags/expiry alanlarını kaydet.
3. Anahtara göre blok sabitli sorgu ve head timestamp erişimini doğrula.
4. Owner ile sil; yeni görünümde bulunmadığını göster.
5. Kısa expiry kaydı oluştur; beklerken şema adapter'ını yaz, ardından aktif sorgudan çıkışını kaydet.
6. Saldırgan cüzdanından taklit kayıt yaz; farklı gerçek creator'ı göster.
7. İşlem linkleri, sürümler ve beklenen/gerçekleşen sonuçları friction'a ekle.

**Çıktı:** Arkiv lifecycle ve kimlik varsayımları çalışıyor. Bu adım başarısızsa görsel tasarıma geçilmez.

#### Adım 4 — İmza ve verifier · 120 dakika

1. Grant, request ve result tiplerini tanımla.
2. Typed data signing ve ham body hash akışını kur.
3. Challenge oluşturma, süre ve atomik tüketimi uygula.
4. Creator/owner/scope/flags/süre/güncellik kontrollerini sırayla yaz.
5. Saf fonksiyon testlerini parametreli test tablosuyla ekle.
6. Hata durumlarını `DENY` ve `UNAVAILABLE` olarak ayır.

**Çıktı:** Verifier'ın olumlu ve olumsuz yolları yerel testte çalışıyor; olumlu grant cache'i yok.

#### Adım 5 — İki servis ve deterministik ajan · 60 dakika

1. Content endpoint'ine verifier ekle; yalnızca fixture metnini döndür.
2. Preview endpoint'ine verifier ekle; başlık/paragraf ve revizyonu değiştir.
3. Runner'dan read/update için imzalı çağrı yap.
4. Atlas grant'ini sil ve iki servisten ret al.

**Çıktı:** UI olmadan gerçek ağ üzerinde çalışan uçtan uca değer.

#### Adım 6 — Gün sonu geçiş kontrolü · 30 dakika

- Geçerli iş başarılı mı?
- Yanlış proje ve sahte creator reddediliyor mu?
- İptal sonrası yeni istek reddediliyor mu?
- İki servis gerçekten Control API'sine sormadan Arkiv okuyor mu?
- Friction ve işlem linkleri kaydedildi mi?

**Geçiş kuralı:** Bu çekirdek çalışmıyorsa ilk tampon saati buraya gider. Canlı model ve UI polish sıraya alınmaz.

### Gün 2 — 17 Ekim: Kullanılabilir ürün ve public demo · 6 saat

#### Adım 7 — Demo oturumu ve iki görev · 60 dakika

1. Oturum cookie'si ve sunucu kaynaklı `run_id` ekle.
2. Atlas/Boreal grant'lerini oluşturma ve iptal endpoint'lerini tamamla.
3. Tek aktif demo ve idempotent işlemleri ekle.
4. Atlas iptal/Boreal devam akışını çalıştır.

**Çıktı:** Ziyaretçiler birbirinin grant'ini yanlışlıkla iptal etmiyor; kontrol örneği çalışıyor.

#### Adım 8 — Güvenlik sertleştirmesi · 75 dakika

1. Replay, concurrent replay, wrong agent, body tampering testlerini çalıştır.
2. RPC hata/eski durum ve yanlış flags/owner testlerini tamamla.
3. İzin read sonrasında iptal edilince update'in reddini dene.
4. Reddedilen yazılarda preview içeriğinin değişmediğini doğrula.

**Çıktı:** Kritik ret yolları doğru; testte kırmızı olan güvenlik davranışı UI'da gizlenmiyor.

#### Adım 9 — Canlı model · 45 dakika

1. Tek model adapter'ını ekle.
2. `title/body` çıktısını doğrula ve gerçek preview çağrısına bağla.
3. Timeout/refusal/invalid output durumunu göster.
4. Canlı ve deterministik modu ayır.

**Çıktı:** Gerçek bir model çağrısıyla örnek iş veya süre sınırı gereği açıkça kapatılmış model modu. Bu adıma ikinci geliştirme oturumu ayrılmaz.

#### Adım 10 — Tek ekranı tamamla · 90 dakika

1. İki görev kartı, önizleme ve servis sonuçlarını bağla.
2. Grant/revoke pending durumlarını gerçek işlemlerden üret.
3. Yanlış proje ve sahte creator test düğmelerini ekle.
4. Kanıt detaylarını açılır bölümde göster.
5. Loading/error/disabled durumlarını düzelt; görsel düzeni sadeleştir.

**Çıktı:** Ana kullanıcı akışı tarayıcıdan baştan sona çalışıyor.

#### Adım 11 — Public deployment ve temiz tarayıcı · 60 dakika

1. Dört süreci HTTPS arkasında çalıştır.
2. Secret'ların doğru serviste olduğunu kontrol et.
3. CORS/origin, session cookie ve reverse proxy yollarını doğrula.
4. Temiz tarayıcıdan demo başlat; gerçek zincir işlemini ve önizleme değişimini izle.
5. Restart sonrası “oturum/önizleme sıfırlandı” davranışını kontrol et.

**Çıktı:** Public URL ile kullanılabilir ürün. Localhost başarısı public deployment yerine sayılmaz.

#### Adım 12 — Bağımsız CLI · 30 dakika

1. Grant okuyucu ve imzalı test runner komutlarını paketle.
2. `Control` kapalı deneyini çalıştır.
3. Beklenen ALLOW/DENY çıktıları ve sorgu izlerini sakla.

**Çıktı:** Why Arkiv ve Open Source için çalışır tekrar yolu.

### Gün 3 — 18 Ekim: Kanıt, belge ve teslim · 6 saat

#### Adım 13 — Son uçtan uca doğrulama · 75 dakika

1. T01–T20 tablosunda eksik kalan zorunlu kontrolleri bitir.
2. Canlı iptal ve süre testini tekrar et.
3. Public demo ve CLI çıktılarının çelişmediğini kontrol et.
4. Üç ölçüm örneğini kaydet; ortama özel sonuç olarak etiketle.

#### Adım 14 — Repo belgeleri · 90 dakika

1. README'yi temiz kurulum sırasıyla yaz.
2. `arkiv/schema.md` içine gerçek sorgu, alan tipi ve TTL kararlarını koy.
3. `arkiv/friction.md` kayıtlarını tekrar adımlarıyla tamamla.
4. `docs/threat-model.md` ve `docs/demo.md` dosyalarını kısa ve somut tut.
5. Bağımlılık/ilham açıklamasını ekle; eski fikirleri benzersizlik iddiasına dönüştürme.

#### Adım 15 — Kanıt paketi · 30 dakika

1. Public adresler ve rolleri.
2. Grant/entity/işlem anahtarları, ağ, commit SHA ve denenen komutlar.
3. Kısa ömürlü kayıtların creation/deletion işlemleri ve expiry öncesi/sonrası çıktıları.
4. Özel anahtar, session token, nonce secret veya credential içermeyen JSON/Markdown dışa aktarımı.

#### Adım 16 — Video · 60 dakika

1. Bölüm 17'deki akışla prova yap.
2. En fazla üç dakikalık ekran kaydını çek.
3. Bekleme süreleri kesildiyse görünür biçimde belirt; sahte ağ cevabı üretme.
4. Videoyu public erişilebilir yükle ve başka oturumdan aç.

#### Adım 17 — Başvuru · 45 dakika

1. Security ve Open Source track'lerini seç.
2. Bölüm 16'daki taslakları gerçekten yapılan özelliklere göre tamamla.
3. URL, repo, video, schema/friction linkleri, creator adresleri ve yeniden kullanım beyanını ekle.
4. İlk yazım süresi ve kullanılan LLM'leri gerçek geliştirme kaydından doldur.

#### Adım 18 — Son erişim kontrolü · 30 dakika

1. Temiz tarayıcıdan bütün linkleri aç.
2. Repo MIT licence ve lockfile'ı kontrol et.
3. Formdaki hiçbir iddianın eksik özelliğe dayanmadığını kontrol et.
4. Teslimin tamamlandığını ve son commit'i kaydet.

#### Adım 19 — Gün içi düzeltme payı · 30 dakika

Yalnızca yukarıdaki işlerden kalan küçük hata veya teslim sorunu için. Yeni özellik eklenmez.

**Plan toplamı:** Gün 1: 360 dakika + Gün 2: 360 dakika + Gün 3: 360 dakika = **18 saat**.

**Tampon:** Her gün en fazla 60 dakika, toplam **3 saat**. Toplam üst sınır **21 saat**. Tampon; deployment, ağ, test veya teslim sorunları içindir.

## 14. Gecikme ve başarısızlık için önceden verilmiş kararlar

| Durum | Uygulanacak karar |
|---|---|
| API anahtarı/model erişimi hazır değil | İlk gün erişim kontrolü yapılır; ikinci gün 45 dakikalık entegrasyon sınırı aşılırsa canlı model çıkar. Deterministik mod dürüstçe gösterilir. |
| Public hosting erişimi yok | İlk gün iskelet deploy adımında çözülür. Kullanılabilir hesap/ortam sağlanmadan 18 saatlik teslim tahmini geçerli kabul edilmez. Sadece video teslimi public ürünün yerine geçmez. |
| Tiramisu yazma/okuma çalışmıyor | İlk gün tamponu kullanılır; RPC/faucet/SDK kaynaklı sorun ayrılır. Fake zincir veya yerel JSON ile çalışıyor gibi gösterilmez. |
| İlk gün sonunda çekirdek güvenlik eksik | Model ve görsel polish zamanı çekirdeğe aktarılır. İki servis, creator doğrulaması ve iptal çıkarılmaz. |
| İkinci gün UI yetişmiyor | Kanıt paneli açılır metin/tablo olur; animasyonlar ve ayrıntılı görsel fark kaldırılır. Akış ve gerçek sonuç korunur. |
| RPC güncellik/erişim sorunu sürüyor | Kullanıcıya doğrulanamadı gösterilir; eski olumlu grant ile işlem yapılmaz. Bu çekirdek güvence çözülemiyorsa güvenli tamamlandı denmez. |
| Son gün süre sıkıştı | Yeni özellik tamamen durur; mevcut kırmızı test, deployment ve teslim belgeleri öncelik alır. |
| Bütün işler erken bitti | Daha temiz demo, bağımsız kurulum provası ve okunaklı belgeler iyileştirilir. Alt ajan açılmaz. |

**Asla kesilmeyecekler:** Gerçek Arkiv kullanımı, iki servis, imza/creator/scope/nonce kontrolü, iptal, hata durumunda işlem yapmama, seçici iptal kanıtı, public erişim, gerekli belgeler ve video.

Bu planın dürüst sınırı: Ağ erişimi, hosting veya güvenlik çekirdeği çözülemezse üç günde kazanabilecek ürün vaadi verilemez. Kapsamı sessizce zayıflatmak yerine hangi tamamlanma ölçütünün sağlanmadığı açıkça kaydedilir.

## 15. Friction raporu nasıl tutulacak?

Rapor son gün sıfırdan yazılmaz. Her teknik adım bittikten sonra 3–5 dakikalık kısa kayıt girilir; bu süre ilgili adımların bütçesine dahildir.

```text
Başlık / tarih:
Kullanılan Arkiv yüzeyi:
Node / SDK / ilgili paket sürümleri:
Ağ ve credential içermeyen endpoint tanımı:
Beklenen davranış:
Gerçekleşen davranış:
En küçük tekrar adımları:
Tam sorgu / sentetik payload / komut:
Entity anahtarı / işlem hash'i / okunan blok:
Kullanıcıya etkisi:
Geçici çözüm:
Önerilen doküman veya SDK iyileştirmesi:
Tekrar sonucu:
```

Hedeflenen deney başlıkları: ilk write/read, creator taklidi, readonly/expiry davranışı, iptalin görünmesi, sorgu snapshot'ı, RPC hatası ve public deployment. Bunların sorun çıkarması beklenmez; başarılı davranış da aynı titizlikle belgelenir. Başka projelerin raporları kendi deneyimimiz olarak kullanılmaz.

## 16. Dört ölçüt için başvuru metni ve kanıt eşlemesi

Resmî değerlendirmede kategori gerekçesi, Why Arkiv, How Arkiv ve friction başlıkları 25'er puandır. Fikir için puan tahmini yapılmaz. Aşağıdaki metinler uygulama tamamlandıktan sonra gerçek sonuçlarla desteklenecek taslaklardır. [Resmî rubrik](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/scoring-rubric.md)

### Security gerekçesi

> Small teams need to let an AI-assisted worker update one project without giving it authority over unrelated work. BOUND checks the current grant before each supported operation. Our demo shows legitimate work, a forged issuer, a cross-project request, and task-specific revocation while an independent task continues.

**Kanıt:** Gerçek creator alanı, ret nedeni, değişmeyen hedef içerik, T01/T02/T03/T09/T10 sonuçları. Sahte kayıt namespace'e yazılabilir; karar hesabına giremez.

### Open Source gerekçesi

> BOUND includes a documented grant format, a verifier package, two example service integrations and an independent CLI. Another developer can read the same grants and enforce the same limited policy without using our control service.

**Kanıt:** Paket kodu, veri sözleşmesi, endpoint örneği, test vektörleri ve temiz kurulum provası. GitHub'da public repo bulunması tek başına hikâyenin tamamı değildir.

### Why Arkiv

> BOUND uses Arkiv as the shared source of current task authority. Each executor reads the user's grant directly, checks its on-chain creator and scope, and rejects an inactive grant. The control service is not the online authority every executor must call. Model execution, source text, previews, secrets and replay protection deliberately stay off Arkiv.

**Kanıt:** Control kapalıyken taze isteklerle Atlas ret/Boreal başarı; doğrudan RPC izleri; bağımsız CLI.

Adil alternatif karşılaştırması:

- Postgres + API aynı izin kurallarını uygulayabilir; ortak API operatörü ve dağıtım sorumluluğu getirir.
- Süreli imzalı token yerel doğrulanabilir; kısa ömür ve iptal durumunun paylaşımı ayrı tasarım gerektirir.
- IPFS içerik adresli veriyi dağıtabilir; değişen güncel yetki durumu ve sorgulanabilir izin kümesi için ek mekanizma gerekir.
- Başka bir blockchain ile benzer sistem yapılabilir. Arkiv'in tek mümkün altyapı olduğu söylenmez.

### How Arkiv

**Bu projedeki karşılıklar:** Typed attributes görev/ajan bazlı listelemeyi; payload tam kapsamı; creator kontrolü kaynak ayrımını; readonly kapsamın sabit kalmasını; expiration işin bitmesini; delete erken iptali; blok bilgisi kararın hangi durumda verildiğini sağlar.

Her iddia kod bağlantısı ve bir kullanıcı davranışıyla eşleştirilir. Kullanılmayan özellikler başvuruya yazılmaz.

### Friction

**Bu projedeki karşılık:** Sorun veya başarılı deney, tekrar adımı ve gerçek çıktı ile anlatılır. En önemli öneri yalnızca geliştirme sırasında gözlenen en etkili sürtünmeden seçilir; önceden uydurulmaz.

## 17. Üç dakikalık final demo

| Süre | Görüntü | Söylenecek ana fikir |
|---|---|---|
| 0:00–0:15 | Atlas/Boreal ve tek ajan | “Let the agent work. Keep each task under your control.” |
| 0:15–0:40 | Gerçek grant oluşturma ve işlem bağlantısı | İzin belirli projeye, ajana ve işlemlere bağlı |
| 0:40–1:05 | Atlas read + AI/deterministik update; değişen önizleme | İzinli iş gerçekten yapılıyor |
| 1:05–1:25 | Yanlış proje ve sahte creator | Başarısız denemeler gerçek servislerde reddediliyor |
| 1:25–1:55 | Atlas iptali; iki servisten ayrı ret; Boreal başarı | Aynı ajanın yalnızca iptal edilen işi duruyor |
| 1:55–2:25 | Control durdurulmuş, CLI ile yeni kontroller | Yürütücüler özel kontrol API'sine bağlı değil |
| 2:25–2:45 | Kısa expiry deneyinden gerçek kayıt/sonuç | Süre ve kaynak zincir durumundan geliyor |
| 2:45–3:00 | Repo, verifier ve tekrar yolu | Sınanabilir açık kaynak teslim |

Uzun transaction beklemeleri kısaltılabilir; kesinti görünür biçimde “waiting for confirmation” olarak belirtilir. Ayrı deneyler kullanıldıysa bunların farklı run/grant'ler olduğu gizlenmez. Canlı LLM yoksa AI etiketi ve anlatımı kullanılmaz.

## 18. Repo yapısı ve teslim dosyaları

Aşağıdaki yollar kurulacak repo içindeki hedef yapıdır; mevcut dosyalar oldukları varsayılmaz.

```text
bound/
  apps/
    web/
    control/
    runner/
    content/
    preview/
  packages/
    core/
  scripts/
    verify.ts
    independent-demo.ts
    export-evidence.ts
  tests/
    policy.test.ts
    request.test.ts
    service.test.ts
    live.test.ts
  fixtures/
    atlas.json
    boreal.json
  arkiv/
    schema.md
    friction.md
  docs/
    threat-model.md
    demo.md
    evidence.json
    prior-art.md
  README.md
  LICENSE
  .env.example
  .gitignore
  compose.yaml
  package.json
  package-lock.json
```

Önemli ortam değişkenleri: `ARKIV_RPC_URL`, gerekirse ayrı RPC access key'leri, `DEMO_OWNER_PRIVATE_KEY`, `ATTACKER_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`, `DEMO_OWNER_ADDRESS`, `DEPLOYMENT_ID`, `DEMO_SESSION_SECRET`, `OPENAI_API_KEY`, `BOUND_MODEL`.

Özel anahtarlar yalnızca ilgili servise verilir. Örnek env dosyası sadece alan adları ve açıklamalar taşır. Private key'ler ve credential içeren RPC URL'leri hiçbir log, video veya evidence dosyasına girmez.

## 19. Teslim öncesi tamamlanma kontrolü

- [ ] Public HTTPS uygulaması temiz tarayıcıda açılıyor.
- [ ] İki serviste gerçek Arkiv grant kontrolü var.
- [ ] Önizleme gerçekten değişiyor; ret halinde değişmiyor.
- [ ] Atlas iptal/Boreal devam senaryosu çalışıyor.
- [ ] İmza, creator, scope, nonce ve hata davranışı testleri geçiyor.
- [ ] Süre dolması gerçek Tiramisu kaydıyla gözlendi.
- [ ] Control kapalı bağımsız deney ve tekrar komutu var.
- [ ] Canlı model varsa gerçekten çağrıldı; yoksa etiketler dürüst.
- [ ] Public MIT repo, kurulum ve lockfile hazır.
- [ ] `arkiv/schema.md` ve `arkiv/friction.md` gerçek uygulamayla uyumlu.
- [ ] Creator adresleri, rolleri ve sorgular belgeli.
- [ ] Kısa ömürlü kayıtlar için transaction/video kanıtı korundu.
- [ ] Video en fazla üç dakika ve public erişilebilir.
- [ ] Başvuru soruları, yeniden kullanım ve LLM beyanları tamamlandı.
- [ ] Deployment 23 Ekim'e kadar çalışacak; public demo yeni kısa grant oluşturabiliyor.
- [ ] Teslim commit SHA'sı kaydedildi; deadline sonrası geçmiş yeniden yazılmıyor.

Bu teslimler organizatörün kontrol listesi ve kurallarıyla karşılaştırılmalıdır. Resmî kapanış **18 Ekim 2026 23:59 Londra / 19 Ekim 2026 01:59 Türkiye**. İç hedef **18 Ekim 20:00 Türkiye**; son saatler yeni özellik için kullanılmaz. [Teslim kontrol listesi](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/docs/submission-checklist.md) · [Resmî kurallar](https://github.com/Arkiv-Network/global-tour-stop-pre-devcon/blob/main/RULES.md)

## 20. Dürüstlük, özgünlük ve güven sınırı

- Airlock, Agent Leasebook ve Agent Action Warrants yakın fikirlerdir. BOUND “ilk süreli ajan yetkisi” olarak sunulmaz. Katkı, burada belirlenen dar iş akışının uygulanması ve tekrar üretilebilir kanıtıdır. [Önceki Arkiv fikirleri](https://github.com/Arkiv-Network/arkiv-ideathon/blob/main/SHOWCASE.md)
- Arkiv izin kaydını saklar; kaynak üzerindeki işlemi araç servisi durdurur. Veritabanı kendi başına tüm ajan faaliyetini engellemez.
- Servis operatörünün kötü niyeti veya owner anahtarının ele geçirilmesi bu prototiple çözülmez.
- Ajanın doğrudan başka bir sağlayıcı anahtarına erişmesiyle kontrol yolunu atlaması kapsam dışıdır. Demo ajanına böyle bir yol verilmez.
- Public grant metadata'sı gizli değildir. Sadece sentetik veri ve kimlikler kullanılır.
- Karar logları uygulama çıktılarıdır; zincirde değişmez audit kaydı diye sunulmaz.
- Bir izin silinince geçmişteki veri fiziksel olarak yok olmaz.
- “Prompt injection çözüldü”, “anında global revoke”, “production-ready” ve “denetlenmiş güvenlik” iddiaları kullanılmaz.
- Yarışma kazanma olasılığı veya alınacak puan için sayı uydurulmaz.

**Bu planın başarı ölçütü:** Başka bir kişi, public uygulama ve repo üzerinden izinli işin yapıldığını, sahte veya kapsam dışı yetkinin reddedildiğini, Atlas iptalinin Boreal'ı bozmadığını ve iki yürütücünün Control olmadan Arkiv'den karar verebildiğini yeniden gösterebiliyor.

## 21. İlk yapılacak iş

Yeni fikir araştırması veya arayüz tasarımıyla başlanmaz. **Gün 1, Adım 1** uygulanır; ardından ilk gerçek grant oluşturulur, okunur ve silinir. Bu küçük dikey akış çalışmadan planın sonraki adımlarına geçilmez.

Belge kapsamı sabitler; prototipin çalıştığına ilişkin kanıt üretmez. Kod, ağ deneyleri ve test sonuçları uygulama sırasında ayrı kaydedilecektir.
