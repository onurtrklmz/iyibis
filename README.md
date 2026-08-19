# İYİBİS GitHub Online BETA 2.51

## Neden önceki sürümde Aile/Saha açılmadı?

GitHub Pages statik hostingdir. `google.script.run` çalıştıramaz.
Bu nedenle AilePanel.html ve SahaMenu.html GitHub'dan doğrudan çalıştırılmaz.

## Doğru çalışma modeli

GitHub Pages:
- index.html
- style.css
- config.js
- app.js

Google Apps Script:
- Aile Otomasyonu
- Saha Otomasyonu
- Saha Tespit
- Ayni Yardım
- Yayın İzni
- Google Sheets / Drive backend

## Zorunlu ayar

`config.js` dosyasını açın:

    APPS_SCRIPT_EXEC_URL: ""

yerine Google Apps Script üretim `/exec` adresinizi yazın.

Örnek:

    APPS_SCRIPT_EXEC_URL: "https://script.google.com/macros/s/AKfycb.../exec"

Sonra GitHub'a commit edin.

## Linkler

- Aile -> `/exec?app=aile`
- Saha -> `/exec?app=saha`
- Saha Tespit -> `/exec?app=saha-tespit`
- Ayni Yardım -> `/exec?app=ayni-yardim`
- Yayın İzni -> `/exec?app=yayin-izni`

İYİBİS ana sayfa -> GitHub `index.html`

## Önemli

`Code.gs` ve diğer uygulama HTML'leri kaynak arşivi olarak repoda durabilir, fakat
GitHub Pages bunları uygulama olarak çalıştırmaz.

Repo PRIVATE ise GitHub Pages planınıza göre yayın erişimi kısıtlı olabilir.
