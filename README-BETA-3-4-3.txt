İYİBİS WEB FRONTEND BETA 3.4.3

API hattı bağımsız test ile doğrulandı:
HTTP 200
service: IYIBIS-WEB-API
version: BETA 3.4.2

Bu paket yalnız frontend temizliğidir.
Apps Script ve Cloudflare Worker DEĞİŞTİRİLMEZ.

Özellikler:
- bridge-client.js yok.
- Eski "backend köprüsüne bağlanılamadı" kodu yok.
- config-v343.js kullanılır.
- api-client-v343.js kullanılır.
- Tüm local sayfa linklerinde ?v=343 cache bust bulunur.
- Worker URL:
  https://iyibis-api.gaziantepiyilikhareketi6.workers.dev/

GITHUB:
1. Repo kökündeki eski frontend dosyalarını temizleyin:
   bridge-client.js
   api-client.js
   api-client-v33.js
   config.js
   config-v33.js
   app.js
2. Bu paketin tüm içeriğini repo köküne yükleyin.
3. Commit edin ve Pages deployment'ın tamamlanmasını bekleyin.
4. Aile Paneli:
   https://onurtrklmz.github.io/iyibis/aile.html?v=343
5. Saha:
   https://onurtrklmz.github.io/iyibis/saha.html?v=343

Apps Script BETA 3.4.2 ve Worker BETA 3.4.1 olduğu gibi kalır.
