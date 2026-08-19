# İYİBİS — GitHub Repository

Bu depo İYİBİS kaynak kodlarının GitHub sürümüdür.

## Ana giriş dosyası

GitHub / standart web sunucusu kök giriş dosyası:

`index.html`

Eski `Portal.html` adı kullanılmaz.

Projede İYİBİS ana sayfasına dönen bağlantılar `index.html` hedefler.

## Dosyalar

- `index.html` — İYİBİS ana portal
- `AilePanel.html` — Aile Otomasyonu
- `SahaMenu.html` — Saha Otomasyonu ana menüsü
- `SahaTespit.html` — Saha Tespit Formu
- `AyniYardim.html` — Ayni Yardım Formu
- `YayinIzni.html` — Video / Fotoğraf Yayın İzni
- `Code.gs` — Google Apps Script backend kaynağı
- `appsscript.json` — Apps Script manifest

## Mimari not

Formlar ve paneller halen `google.script.run` / Google Apps Script backend işlevlerine
bağlıdır. Bu repository kaynak kod ve geçiş sürümü olarak tutulmalıdır.

`index.html` GitHub Pages veya standart hosting için ana giriş dosyasıdır.

## Güvenlik

Repository PRIVATE tutulmalıdır. `Code.gs` Google Sheets/Drive kimlikleri ve uygulama
yapılandırmaları içerir.

Google Sheets ve Drive dosyaları public paylaşılmamalıdır.

## Sürüm

GitHub paket: BETA 2.50
Backend snapshot: BETA 2.49
