/**
 * GAZİANTEP İYİLİK HAREKETİ - MERKEZİ AİLE TAKİP OTOMASYONU
 *
 * Bu dosya Apps Script sunucu katmanıdır.
 * Arayüz: Index.html
 */

const GIH = {
  DB_SPREADSHEET_ID: '', // setupGIH() ilk çalıştırmada ayrı İYİBİS Sistem Veritabanı oluşturur.
  USERS: ['onur', 'emel', 'kadir', 'hasan', 'aslihan', 'buket', 'yasin'],
  INITIAL_PASSWORD: 'Gih20Aile26!',
  SESSION_SECONDS: 4 * 60 * 60,
  MAX_LOGIN_FAILURES: 5,
  LOGIN_LOCK_SECONDS: 15 * 60,

  // Ayni yardım teslim tutanaklarının PDF hedef klasörü.
  AYNI_YARDIM_FOLDER_ID: '1hUbCqwdZW8LJSJSBvGTdqShKiysaFik7',

  SHEETS: {
    ACTIVE: 'TOPLAM MEVCUT',
    RED: 'RED ALANLAR',
    WEB: 'Web Yeni Başvurular',
    ASSISTANCE: 'YARDIM KAYITLARI',
    DOCUMENTS: 'BELGELER',
    LOG: 'İŞLEM LOGU',
    FIELD_QUEUE: 'SAHA ZİYARETİ',
    HISTORY: 'BAŞVURU GEÇMİŞİ'
  }
};

function doGet(e) {
  const app = e && e.parameter ? clean_(e.parameter.app) : '';

  // AilePanel büyük ve yoğun JavaScript içeriyor; template motorundan geçirilmez.
  // Bu sayfa herhangi bir Apps Script scriptlet'i kullanmadığı için doğrudan servis edilir.
  if (app === 'aile') {
    return HtmlService.createHtmlOutputFromFile('AilePanel')
      .setTitle('Gaziantep İyilik Hareketi Aile Takip Otomasyonu')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  const routes = {
    'portal': ['Portal', 'İYİBİS - İyilik Bilgi Yönetim Sistemi'],
    'saha': ['SahaMenu', 'İYİBİS - Saha Otomasyonu'],
    'saha-tespit': ['SahaTespit', 'Saha Tespit Formu'],
    'ayni-yardim': ['AyniYardim', 'Ayni Yardım Teslim Belgesi'],
    'yayin-izni': ['YayinIzni', 'Video ve Fotoğraf Yayın İzni']
  };
  const selected = routes[app] || routes['portal'];
  const template = HtmlService.createTemplateFromFile(selected[0]);
  template.baseUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle(selected[1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


/**
 * HtmlService iframe içinden ana web uygulamasına güvenli dönüş adresi.
 * Relative URL kullanılmaz; googleusercontent iframe adresine yönlenmeyi önler.
 */
function getIyibisBaseUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * İLK KURULUMDA BİR KEZ ÇALIŞTIRIN.
 * Script Properties oluşturur ve yardımcı sekmeleri hazırlar.
 */
function setupGIH() {
  const props = PropertiesService.getScriptProperties();

  // Beş operasyonel tablodan bağımsız, yalnız sistemin kullandığı özel veri deposu.
  let systemDbId = props.getProperty('DB_SPREADSHEET_ID') || '';
  if (!systemDbId) {
    const systemDb = SpreadsheetApp.create('İYİBİS Sistem Veritabanı');
    systemDbId = systemDb.getId();
  }

  props.setProperties({
    DB_SPREADSHEET_ID: systemDbId,
    USERS_JSON: JSON.stringify(GIH.USERS),
    PASSWORD_HASH: props.getProperty('PASSWORD_HASH') || sha256_(GIH.INITIAL_PASSWORD),
    ACTIVE_SPREADSHEET_ID: '1BGATdg2ytQGMtdsRS2UwA0GcIWeLfHxnreeyINOkmjs',
    ACTIVE_SHEET_NAME: '',
    RED_SPREADSHEET_ID: '1OyFi-SIxBiC9r3NjKI8N2D6dqAv14MERq97NhZM8s4U',
    RED_SHEET_NAME: '',
    WEB_SPREADSHEET_ID: '1w69GJhzhOB3fddCaupFGc3q12Sv8vwUvIX2l3IM-IKo',
    WEB_SHEET_NAME: '',
    FIELD_SPREADSHEET_ID: '1unpNuCWesYVukQEvt2tDlMtcDLtiNcaVRikqgJunqXY',
    FIELD_SHEET_NAME: '',
    ASSISTANCE_SPREADSHEET_ID: '1iBNgR29daR7F7xBNAROnbWEo96914oX1LVyx5LY2_yE',
    ASSISTANCE_SHEET_NAME: '',
    AYNI_YARDIM_FOLDER_ID: GIH.AYNI_YARDIM_FOLDER_ID,
    HELP_FOLDER_ID: props.getProperty('HELP_FOLDER_ID') || '',
    ASSESSMENT_FOLDER_ID: '1nP-gqZFAYziXGemD1E3x0pfaAQQ_1hy6',
    MEDIA_FOLDER_ID: '12Bu9J_fEVmvq9ttYVHWPDOG8SyhJ_yge',
    APPLICATION_COUNTER: props.getProperty('APPLICATION_COUNTER') || '0',
    FIELD_API_KEY: props.getProperty('FIELD_API_KEY') || Utilities.getUuid() + Utilities.getUuid()
  }, false);

  ensureSystemSheets_();
  ensureAssistanceLedger_();
  ensureFieldOperationalHeaders_();
  const db = getDb_();
  return 'İYİBİS BETA 2.49 kurulumu tamamlandı. Sistem DB: ' + db.getUrl();
}


/**
 * Harici Saha Paneli için API anahtarını Apps Script editöründen çalıştırarak alın.
 * Anahtarı HTML içine veya Google Sheet hücrelerine yazmayın.
 */
function getFieldApiKeyForSetup() {
  const p = PropertiesService.getScriptProperties();
  let key = p.getProperty('FIELD_API_KEY');
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('FIELD_API_KEY', key);
  }
  return key;
}

/** Gerektiğinde mevcut harici panel anahtarını geçersiz kılar. */
function rotateFieldApiKey() {
  const key = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('FIELD_API_KEY', key);
  return key;
}

function requireFieldApiKey_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('FIELD_API_KEY') || '';
  if (!expected || !provided || String(provided) !== expected) {
    throw new Error('API_YETKISIZ');
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Harici Saha Paneli entegrasyon kapısı.
 *
 * POST JSON:
 * {
 *   "apiKey": "...",
 *   "action": "field.health" | "field.getQueue" | "field.submitReport",
 *   "payload": {...}
 * }
 */
function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const body = raw ? JSON.parse(raw) : {};
    if (body.form_tipi === 'saha_tespit') return jsonOutput_(submitSahaTespitForm(body));
    if (body.form_tipi === 'ayni_yardim') return jsonOutput_(submitAyniYardimForm(body));
    if (body.form_tipi === 'yayin_izni') return jsonOutput_(submitYayinIzniForm(body));
    requireFieldApiKey_(body.apiKey);

    const action = clean_(body.action);
    const payload = body.payload || {};

    if (action === 'field.health') {
      return jsonOutput_({
        ok: true,
        service: 'GIH-CENTRAL-BACKEND',
        version: 'BETA 2.1',
        time: new Date().toISOString()
      });
    }

    if (action === 'field.getQueue') {
      syncExternalFieldReports_('EXTERNAL_API');
      const queue = parseFieldQueue_(getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE))
        .filter(x => x.asama === 'SAHA YAPILACAK');
      return jsonOutput_({ ok: true, saha: queue });
    }

    if (action === 'field.submitReport') {
      const result = fieldApiSubmitReport_(payload);
      return jsonOutput_({ ok: true, result: result });
    }

    throw new Error('BILINMEYEN_API_ISLEMI');
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}


// -------------------- AUTH --------------------

function serverLogin(username, password) {
  username = normalizeUsername_(username);

  const cache = CacheService.getScriptCache();
  const failKey = 'loginfail:' + username;
  const failCount = Number(cache.get(failKey) || '0');

  if (failCount >= GIH.MAX_LOGIN_FAILURES) {
    return { ok: false, error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' };
  }

  const props = PropertiesService.getScriptProperties();
  const users = JSON.parse(props.getProperty('USERS_JSON') || '[]');
  const expectedHash = props.getProperty('PASSWORD_HASH') || '';

  if (!users.includes(username) || sha256_(String(password || '')) !== expectedHash) {
    cache.put(failKey, String(failCount + 1), GIH.LOGIN_LOCK_SECONDS);
    return { ok: false, error: 'Kullanıcı adı veya şifre hatalı.' };
  }

  cache.remove(failKey);
  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  const sessionData = {
    user: username,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + (GIH.SESSION_SECONDS * 1000)
  };
  const sessionJson = JSON.stringify(sessionData);

  // Hız için CacheService, güvenilirlik için Script Properties yedeği.
  cache.put('session:' + token, sessionJson, GIH.SESSION_SECONDS);
  PropertiesService.getScriptProperties().setProperty('SESSION_' + token, sessionJson);

  logAction_(username, 'LOGIN', '', '', 'Oturum açıldı');
  return { ok: true, token: token, user: username };
}

function serverLogout(token) {
  const session = requireSession_(token);
  CacheService.getScriptCache().remove('session:' + token);
  PropertiesService.getScriptProperties().deleteProperty('SESSION_' + token);
  logAction_(session.user, 'LOGOUT', '', '', 'Oturum kapatıldı');
  return { ok: true };
}

function requireSession_(token) {
  if (!token) throw new Error('OTURUM_GEREKLI');

  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const key = 'SESSION_' + token;

  let raw = cache.get('session:' + token);
  if (!raw) raw = props.getProperty(key);
  if (!raw) throw new Error('OTURUM_SURESI_DOLDU');

  let session;
  try { session = JSON.parse(raw); }
  catch (_) {
    props.deleteProperty(key);
    throw new Error('OTURUM_GECERSIZ');
  }

  if (!session.expiresAt || Date.now() > Number(session.expiresAt)) {
    cache.remove('session:' + token);
    props.deleteProperty(key);
    throw new Error('OTURUM_SURESI_DOLDU');
  }

  // Aktif kullanımda oturumu hem cache hem property tarafında uzat.
  session.expiresAt = Date.now() + (GIH.SESSION_SECONDS * 1000);
  raw = JSON.stringify(session);
  cache.put('session:' + token, raw, GIH.SESSION_SECONDS);
  props.setProperty(key, raw);

  return session;
}

function requireAdmin_(session) {
  if (!session || session.user !== 'onur') {
    throw new Error('Bu ayarı yalnızca onur kullanıcısı değiştirebilir.');
  }
}


function diagnoseIYIBIS() {
  const result = {
    ok: true,
    version: 'BETA 2.49',
    checks: {}
  };

  function check(name, fn) {
    try {
      const value = fn();
      result.checks[name] = { ok: true, value: value };
    } catch (e) {
      result.ok = false;
      result.checks[name] = { ok: false, error: e && e.message ? e.message : String(e) };
    }
  }

  check('systemDb', function() { return getDb_().getUrl(); });
  check('active', function() { return getConfiguredActiveFamilies_().length; });
  check('red', function() { return getConfiguredRedFamilies_().length; });
  check('web', function() { return getConfiguredWebApplications_().length; });
  check('sahaQueue', function() { return parseFieldQueue_(getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE)).length; });
  check('assistance', function() { return parseAssistance_(getConfiguredAssistanceLedgerSheet_()).length; });

  console.log(JSON.stringify(result, null, 2));
  return result;
}


function migrateAssistanceSpreadsheetProperty() {
  const props = PropertiesService.getScriptProperties();
  const before = extractId_(props.getProperty('ASSISTANCE_SPREADSHEET_ID') || '');
  const after = getAssistanceSpreadsheetId_();
  return { before: before, after: after, changed: before !== after };
}

// -------------------- CENTRAL READ --------------------

function getCentralData(token) {
  const session = requireSession_(token);

  // Aile paneli her açıldığında Saha Tespit Form Listesi ile saha kuyruğunu eşitle.
  // Böylece saha formu Google Sheet'e düştüyse panelde de anında görünür.
  return withWriteLock_(function() {
    syncExternalFieldReports_(session.user);
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}

function buildCentralData_(user) {
  ensureSystemSheets_();
  const ss = getDb_();

  return {
    ok: true,
    user: user || '',
    mevcut: getConfiguredActiveFamilies_(),
    red: getConfiguredRedFamilies_(),
    web: getConfiguredWebApplications_(),
    saha: parseFieldQueue_(ss.getSheetByName(GIH.SHEETS.FIELD_QUEUE)),
    assistance: parseAssistance_(getConfiguredAssistanceLedgerSheet_()),
    documents: parseDocuments_(ss.getSheetByName(GIH.SHEETS.DOCUMENTS)),
    history: parseApplicationHistory_(ss.getSheetByName(GIH.SHEETS.HISTORY))
  };
}



function getConfiguredActiveSheet_() {
  const p = PropertiesService.getScriptProperties();
  const id = extractId_(p.getProperty('ACTIVE_SPREADSHEET_ID') || '');
  const name = clean_(p.getProperty('ACTIVE_SHEET_NAME'));
  if (!id) return getDb_().getSheetByName(GIH.SHEETS.ACTIVE);
  const ss = SpreadsheetApp.openById(id);
  const sh = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if (!sh) throw new Error('Aktif Aileler sekmesi bulunamadı.');
  return sh;
}
function getConfiguredRedSheet_() {
  const p = PropertiesService.getScriptProperties();
  const id = extractId_(p.getProperty('RED_SPREADSHEET_ID') || '');
  const name = clean_(p.getProperty('RED_SHEET_NAME'));
  if (!id) return getDb_().getSheetByName(GIH.SHEETS.RED);
  const ss = SpreadsheetApp.openById(id);
  const sh = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if (!sh) throw new Error('Ret Alanlar sekmesi bulunamadı.');
  return sh;
}
function getConfiguredActiveFamilies_() { return parseActive_(getConfiguredActiveSheet_()); }
function getConfiguredRedFamilies_() { return parseRed_(getConfiguredRedSheet_()); }

function getExternalActiveFamilies(token) {
  requireSession_(token);
  return { ok: true, mevcut: getConfiguredActiveFamilies_() };
}
function getExternalRedFamilies(token) {
  requireSession_(token);
  return { ok: true, red: getConfiguredRedFamilies_() };
}
function refreshAllSourcesServer(token) {
  const session = requireSession_(token);

  // Aktif / Ret / Web kaynakları buildCentralData_ sırasında doğrudan okunur.
  // Yapılan Yardımlar kaynağındaki yeni kayıtlar ise merkezi YARDIM KAYITLARI
  // sekmesine mükerrer oluşturmadan senkronize edilir.
  syncExternalAssistance_(session.user);
  syncExternalFieldReports_(session.user);

  return buildCentralData_(session.user);
}

function syncExternalAssistance_(user) {
  const props = PropertiesService.getScriptProperties();
  const sourceId = getAssistanceSpreadsheetId_();
  const sourceSheetName = clean_(props.getProperty('ASSISTANCE_SHEET_NAME'));
  if (!sourceId) return { skipped: true, added: 0 };

  const src = SpreadsheetApp.openById(sourceId);
  const sourceSheet = sourceSheetName ? src.getSheetByName(sourceSheetName) : src.getSheets()[0];
  if (!sourceSheet) throw new Error('Yardım tablosu sekmesi bulunamadı.');

  const parsed = parseExternalAssistance_(sourceSheet.getDataRange().getDisplayValues());

  ensureSystemSheets_();
  const dest = getConfiguredAssistanceLedgerSheet_();
  const existing = parseAssistance_(dest);
  const existingSig = {};
  existing.forEach(function(x) {
    existingSig[assistanceSignature_(x.tc, x.yardim_tarihi, x.yardim_icerigi, x.rayic_bedel, x.tutanak_url)] = true;
  });

  const activePeople = getConfiguredActiveFamilies_();
  let matched = 0, unmatched = 0, added = 0;

  parsed.forEach(function(e) {
    let family = activePeople.find(f => normalizeTc_(f.tc) && normalizeTc_(f.tc) === normalizeTc_(e.tc));
    if (!family && e.name) family = activePeople.find(f => normalizeText_(f.ad_soyad) === normalizeText_(e.name));
    if (!family) { unmatched++; return; }
    matched++;

    const sig = assistanceSignature_(family.tc, e.date, e.content, e.marketValue, e.pdfUrl);
    if (existingSig[sig]) return;

    dest.appendRow([
      Utilities.getUuid(), new Date(), family.tc, family.ad_soyad,
      e.date, e.content || 'Yardım', e.marketValue, e.pdfUrl, '',
      user || 'AUTO', 'Toplu Yardım Tablosu'
    ]);
    existingSig[sig] = true;
    added++;
  });

  if (added || unmatched) {
    logAction_(user || 'AUTO', 'YARDIM_AUTO_SYNC', '', '',
      'Okunan: ' + parsed.length + ', Eşleşen: ' + matched + ', Eklenen: ' + added + ', Eşleşmeyen: ' + unmatched);
  }
  return { skipped: false, added: added, matched: matched, unmatched: unmatched };
}

function getConfiguredWebSheet_() {
  const p = PropertiesService.getScriptProperties();
  const externalId = extractId_(p.getProperty('WEB_SPREADSHEET_ID') || '');
  const externalName = clean_(p.getProperty('WEB_SHEET_NAME'));

  if (!externalId) {
    return getDb_().getSheetByName(GIH.SHEETS.WEB);
  }

  const ss = SpreadsheetApp.openById(externalId);
  const sheet = externalName ? ss.getSheetByName(externalName) : ss.getSheets()[0];
  if (!sheet) throw new Error('Web başvuruları için tanımlanan sekme bulunamadı.');
  return sheet;
}


function getAssistanceSpreadsheetId_() {
  const props = PropertiesService.getScriptProperties();
  const canonicalId = '1iBNgR29daR7F7xBNAROnbWEo96914oX1LVyx5LY2_yE';
  const currentId = extractId_(props.getProperty('ASSISTANCE_SPREADSHEET_ID') || '');

  // BETA 2.49: eski yardım Spreadsheet property değerini otomatik olarak yeni dosyaya taşı.
  // setupGIH() tekrar çalıştırılmasına gerek yoktur.
  if (currentId !== canonicalId) {
    props.setProperty('ASSISTANCE_SPREADSHEET_ID', canonicalId);
  }
  return canonicalId;
}

function getConfiguredAssistanceLedgerSheet_() {
  const id = getAssistanceSpreadsheetId_();
  const ss = SpreadsheetApp.openById(id);
  return ensureSheet_(ss, GIH.SHEETS.ASSISTANCE, [
    'ID', 'Kayıt Zamanı', 'TC', 'Ad Soyad', 'Yardım Tarihi', 'Yardım İçeriği',
    'Rayiç Bedel', 'Tutanak URL', 'Tutanak Dosya Adı', 'Kullanıcı', 'Kaynak'
  ]);
}
function ensureAssistanceLedger_() { return getConfiguredAssistanceLedgerSheet_(); }

function getConfiguredFieldOperationalSheet_() {
  const p = PropertiesService.getScriptProperties();
  const id = extractId_(p.getProperty('FIELD_SPREADSHEET_ID') || '');
  if (!id) throw new Error('Saha Tespit Formu E-Tablo ID bilgisi yok.');
  const ss = SpreadsheetApp.openById(id);
  const name = clean_(p.getProperty('FIELD_SHEET_NAME'));
  return name ? (ss.getSheetByName(name) || ss.getSheets()[0]) : ss.getSheets()[0];
}

function getConfiguredWebApplications_() {
  return parseWeb_(getConfiguredWebSheet_());
}

function getExternalWebApplications(token) {
  requireSession_(token);
  return { ok: true, web: getConfiguredWebApplications_() };
}

// Dahili sistem deposu: işlem logu, belge metadata kayıtları ve saha kuyruğu gibi
// kullanıcıya doğrudan gösterilmeyen sistem tabloları için kullanılır.
// Beş operasyonel Google E-Tablo kaynağından bağımsızdır.
function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID') || GIH.DB_SPREADSHEET_ID;
  if (!clean_(id)) throw new Error('İYİBİS Sistem Veritabanı henüz oluşturulmadı. Önce setupGIH() çalıştırın.');
  return SpreadsheetApp.openById(extractId_(id));
}

function clean_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function findHeaderRow_(values, predicates, maxRows) {
  const limit = Math.min(maxRows || 10, values.length);
  for (let r = 0; r < limit; r++) {
    const row = (values[r] || []).map(v => clean_(v).toUpperCase());
    if (predicates.every(p => row.some(cell => cell.includes(p)))) return r;
  }
  return -1;
}

function parseActive_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const header = findHeaderRow_(values, ['AD-SOYAD'], 5);
  if (header < 0) return [];

  const out = [];
  for (let r = header + 1; r < values.length; r++) {
    const a = values[r] || [];
    const name = clean_(a[0]);
    if (!name || name.toUpperCase() === 'AD-SOYAD') continue;

    out.push({
      id: 'MEV-' + (r + 1),
      ad_soyad: name,
      tc: clean_(a[1]),
      iletisim: clean_(a[2]),
      metrik_puani: clean_(a[3]),
      durumu: clean_(a[4]),
      ev: clean_(a[5]),
      gelir: clean_(a[6]),
      gider: clean_(a[7]),
      es_durumu: clean_(a[8]),
      talep: clean_(a[9]),
      ozel_durum: clean_(a[10]),
      ziyaret_edenler: clean_(a[11]),
      cocuk_sayisi: clean_(a[12]),
      cocuk_kiz: clean_(a[13]),
      cocuk_erkek: clean_(a[14]),
      haziran_fatura: clean_(a[15]),
      kurban_2026: clean_(a[16]),
      et_dagitimi_nisan: clean_(a[17]),
      kahvalti_paketi_haziran: clean_(a[18]),
      et_sut_yumurta_agustos: clean_(a[19]),
      teslim_edilen: clean_(a[20]),
      bolge: clean_(a[21]),
      adres: clean_(a[22]),
      dogum_gunleri: {
        ocak: clean_(a[23]), subat: clean_(a[24]), mart: clean_(a[25]), nisan: clean_(a[26]),
        mayis: clean_(a[27]), haziran: clean_(a[28]), temmuz: clean_(a[29]), agustos: clean_(a[30]),
        eylul: clean_(a[31]), ekim: clean_(a[32]), kasim: clean_(a[33]), aralik: clean_(a[34])
      }
    });
  }
  return out;
}

function parseRed_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const header = findHeaderRow_(values, ['AD-SOYAD', 'TC'], 5);
  if (header < 0) return [];

  const out = [];
  for (let r = header + 1; r < values.length; r++) {
    const a = values[r] || [];
    const name = clean_(a[0]);
    if (!name || name.toUpperCase() === 'AD-SOYAD') continue;

    out.push({
      id: 'RED-' + (r + 1),
      ad_soyad: name,
      tc: clean_(a[1]),
      iletisim: clean_(a[2]),
      bolge: clean_(a[3]),
      adres: clean_(a[4]),
      ev: clean_(a[5]),
      gelir: clean_(a[6]),
      gider: clean_(a[7]),
      cocuk_sayisi: clean_(a[8]),
      es_durumu: clean_(a[9]),
      talep: clean_(a[10]),
      ozel_durum: clean_(a[11]),
      ziyaret_edenler: clean_(a[12]),
      teslim_edilen: clean_(a[13]),
      cocuk_detay: clean_(a[14])
    });
  }
  return out;
}

function webRecordKey_(item) {
  const tc = normalizeTc_(item && item.tc);
  if (tc) return 'TC:' + tc;

  const name = normalizeText_(item && item.ad_soyad);
  const phone = clean_(item && item.telefon).replace(/\D/g, '');
  if (name || phone) return 'NP:' + name + '|' + phone;

  return 'ROW:' + clean_(item && item.source_row);
}

function parseWeb_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const header = findHeaderRow_(values, ['ID', 'AD SOYAD'], 15);
  if (header < 0) return [];

  const out = [];
  const seen = {};

  for (let r = header + 1; r < values.length; r++) {
    const a = values[r] || [];
    if (!clean_(a[0]) && !clean_(a[2]) && !clean_(a[3])) continue;

    const item = {
      id: clean_(a[0]) || ('WEBROW-' + (r + 1)),
      source_row: r + 1,
      tarih: clean_(a[1]),
      ad_soyad: clean_(a[2]),
      tc: clean_(a[3]),
      telefon: clean_(a[4]),
      ilce: clean_(a[5]),
      adres: clean_(a[6]),
      evde_kisi: clean_(a[7]),
      ev_bilgisi: clean_(a[8]),
      aylik_gelir: clean_(a[9]),
      devlet_destegi: clean_(a[10]),
      diger_stk: clean_(a[11]),
      talep: clean_(a[12]),
      aciklama: clean_(a[13]),
      durum: clean_(a[14]) || 'Beklemede'
    };

    const key = webRecordKey_(item);

    // Aynı TC (veya TC yoksa aynı ad+telefon) panelde yalnız bir kez görünür.
    // En yeni/aşağıdaki satırı esas al.
    if (seen[key] !== undefined) {
      out[seen[key]] = item;
    } else {
      seen[key] = out.length;
      out.push(item);
    }
  }
  return out;
}

function parseAssistance_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const v = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getDisplayValues();
  return v.filter(r => clean_(r[0]) || clean_(r[3])).map(r => ({
    id: clean_(r[0]),
    kayit_zamani: clean_(r[1]),
    tc: clean_(r[2]),
    ad_soyad: clean_(r[3]),
    yardim_tarihi: clean_(r[4]),
    yardim_icerigi: clean_(r[5]),
    rayic_bedel: clean_(r[6]),
    tutanak_url: clean_(r[7]),
    tutanak_adi: clean_(r[8]),
    kullanici: clean_(r[9]),
    kaynak: clean_(r[10])
  }));
}

function parseDocuments_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const v = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getDisplayValues();
  return v.filter(r => clean_(r[0]) || clean_(r[2])).map(r => ({
    id: clean_(r[0]),
    yukleme_zamani: clean_(r[1]),
    tc: clean_(r[2]),
    ad_soyad: clean_(r[3]),
    belge_turu: clean_(r[4]),
    dosya_adi: clean_(r[5]),
    drive_url: clean_(r[6]),
    drive_file_id: clean_(r[7]),
    kullanici: clean_(r[8])
  }));
}


// -------------------- BETA 2 SHARED TRANSACTION CORE --------------------

function nextApplicationId_() {
  // Bu fonksiyon withApplicationTransaction_ içinden çağrılmalıdır.
  // Ayrı bir ScriptLock almaması kasıtlıdır; aksi halde aynı işlem içinde
  // iç içe kilit beklemesi oluşabilir.
  const p = PropertiesService.getScriptProperties();
  const next = Number(p.getProperty('APPLICATION_COUNTER') || '0') + 1;
  p.setProperty('APPLICATION_COUNTER', String(next));
  const year = Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy');
  return 'APP-' + year + '-' + String(next).padStart(6, '0');
}

function ensureApplicationId_(existing) {
  const v = clean_(existing);
  return /^APP-\d{4}-\d{6}$/.test(v) ? v : nextApplicationId_();
}

function recordApplicationTransition_(user, applicationId, sourceApplicationId, tc, name, fromStage, toStage, panel, detail) {
  ensureSystemSheets_();
  getDb_().getSheetByName(GIH.SHEETS.HISTORY).appendRow([
    new Date(), clean_(applicationId), clean_(sourceApplicationId),
    clean_(tc), clean_(name), clean_(fromStage), clean_(toStage),
    clean_(panel), clean_(user), clean_(detail)
  ]);
}

function parseApplicationHistory_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getDisplayValues()
    .filter(r => clean_(r[1]))
    .map(r => ({
      zaman: clean_(r[0]), application_id: clean_(r[1]), basvuru_id: clean_(r[2]),
      tc: clean_(r[3]), ad_soyad: clean_(r[4]), eski_asama: clean_(r[5]),
      yeni_asama: clean_(r[6]), kaynak_panel: clean_(r[7]), kullanici: clean_(r[8]),
      aciklama: clean_(r[9])
    }));
}

function findHistoryByTc_(tc) {
  const key = normalizeTc_(tc);
  if (!key) return [];
  return parseApplicationHistory_(getDb_().getSheetByName(GIH.SHEETS.HISTORY))
    .filter(x => normalizeTc_(x.tc) === key);
}

/**
 * Tek transaction kapısı.
 * Bütün yazma işlemleri bu merkezi Apps Script projesindeki transaction fonksiyonlarından geçmelidir.
 * Harici paneller HTTP API'yi çağırır; böylece ScriptLock bütün yazma işlemlerini bu backend üzerinde sıraya sokar.
 */
function withApplicationTransaction_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}



function findActualWebSourceRow_(sheet, sourceRow, webId, tc, name) {
  const lastRow = sheet.getLastRow();
  const tcKey = normalizeTc_(tc);
  const nameKey = normalizeText_(name);
  const idKey = clean_(webId);

  function rowMatches_(rowNum) {
    if (!rowNum || rowNum < 1 || rowNum > lastRow) return false;
    const a = sheet.getRange(rowNum, 1, 1, 15).getDisplayValues()[0];
    const rowId = clean_(a[0]);
    const rowName = normalizeText_(a[2]);
    const rowTc = normalizeTc_(a[3]);

    // TC varsa en güçlü doğrulama TC'dir.
    if (tcKey && rowTc === tcKey) return true;

    // TC yoksa isim + ID doğrulamasına düş.
    if (!tcKey && nameKey && rowName === nameKey) {
      if (!idKey || idKey.indexOf('WEBROW-') === 0 || rowId === idKey) return true;
    }
    return false;
  }

  const requested = Number(sourceRow || 0);
  if (rowMatches_(requested)) return requested;

  // Satır numarası başka bir kullanıcı işlemiyle kaymış olabilir; TC/isimle yeniden tara.
  const values = sheet.getDataRange().getDisplayValues();
  for (let r = 1; r < values.length; r++) {
    const a = values[r] || [];
    const rowId = clean_(a[0]);
    const rowName = normalizeText_(a[2]);
    const rowTc = normalizeTc_(a[3]);

    if (tcKey && rowTc === tcKey) return r + 1;
    if (!tcKey && nameKey && rowName === nameKey) {
      if (!idKey || idKey.indexOf('WEBROW-') === 0 || rowId === idKey) return r + 1;
    }
  }

  return 0;
}

// -------------------- MUTATIONS --------------------

function processWebApplicationServer(token, webId, sourceRow, tcHint, nameHint, destination, sydvOpinion) {
  const session = requireSession_(token);
  if (!['active','field','red'].includes(destination)) throw new Error('Geçersiz hedef.');

  sydvOpinion = clean_(sydvOpinion).toUpperCase();
  if (!['ONAY','RET','GORUS_ALINAMADI'].includes(sydvOpinion)) {
    throw new Error('SYDV Görüşü seçilmelidir: Onay, Ret veya Görüş Alınamadı.');
  }

  return withApplicationTransaction_(function() {
    ensureSystemSheets_();

    const webSheet = getConfiguredWebSheet_();
    const row = findActualWebSourceRow_(webSheet, sourceRow, webId, tcHint, nameHint);

    if (!row) {
      throw new Error('Web Başvuruları Google Sheet içinde gerçek kaynak satır bulunamadı. İşlem yapılmadı.');
    }

    const data = webSheet.getRange(row, 1, 1, 15).getDisplayValues()[0];
    const sourceWebId = clean_(data[0]);
    const name = clean_(data[2]);
    const tc = clean_(data[3]);
    const applicationId = ensureApplicationId_('');

    if (destination === 'active') {
      const activeSheet = getConfiguredActiveSheet_();
      const alreadyActive = personExistsInSheet_(activeSheet, tc, name, 1, 2, 5);

      if (!alreadyActive) {
        appendWebToActive_(activeSheet, data);
        SpreadsheetApp.flush();
      }

      const activeConfirmed = personExistsInSheet_(activeSheet, tc, name, 1, 2, 5);
      if (!activeConfirmed) {
        throw new Error('Aktif Aileler tablosuna hedef kayıt doğrulanamadı; Web Başvurusu silinmedi.');
      }

      recordApplicationTransition_(
        session.user, applicationId, sourceWebId, tc, name,
        'BAŞVURU', 'AKTİF / TAKİP', 'AİLE PANELİ / WEB BAŞVURU',
        'Web başvurusu doğrudan Aktif Aileler listesine taşındı | SYDV Görüşü: ' + sydvOpinion
      );
      logAction_(session.user, 'WEB_AKTIF', tc, name,
        applicationId + ' web başvurusundan doğrudan Aktif Aileler listesine taşındı | SYDV Görüşü: ' + sydvOpinion);

    } else if (destination === 'field') {
      const queue = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
      if (!queue) throw new Error('Saha Ziyareti kuyruğu bulunamadı.');

      const queueVals = queue.getLastRow() >= 2
        ? queue.getRange(2,1,queue.getLastRow()-1,21).getDisplayValues()
        : [];

      let queueRow = 0;
      for (let qi = 0; qi < queueVals.length; qi++) {
        const qr = queueVals[qi];
        if ((tc && normalizeTc_(qr[4]) === normalizeTc_(tc)) ||
            (clean_(qr[19]) && clean_(qr[19]) === applicationId)) {
          queueRow = qi + 2;
          break;
        }
      }

      if (!queueRow) {
        queue.appendRow([
          Utilities.getUuid(), sourceWebId, clean_(data[1]), name, tc,
          clean_(data[4]), clean_(data[5]), clean_(data[6]), clean_(data[7]),
          clean_(data[8]), clean_(data[9]), clean_(data[10]), clean_(data[11]),
          clean_(data[12]), clean_(data[13]), 'SAHA YAPILACAK', '', '',
          session.user, applicationId, sydvOpinion
        ]);
      } else {
        queue.getRange(queueRow,16).setValue('SAHA YAPILACAK');
        queue.getRange(queueRow,19).setValue(session.user);
        queue.getRange(queueRow,20).setValue(applicationId);
        queue.getRange(queueRow,21).setValue(sydvOpinion);
      }
      SpreadsheetApp.flush();

      const fieldConfirmed = parseFieldQueue_(queue).some(function(x) {
        return (tc && normalizeTc_(x.tc) === normalizeTc_(tc)) ||
               (clean_(x.application_id) === applicationId);
      });
      if (!fieldConfirmed) {
        throw new Error('Saha Ziyareti kuyruğuna hedef kayıt doğrulanamadı; Web Başvurusu silinmedi.');
      }

      recordApplicationTransition_(
        session.user, applicationId, sourceWebId, tc, name,
        'BAŞVURU', 'SAHA YAPILACAK', 'AİLE PANELİ / WEB BAŞVURU',
        'Web başvurusu Saha Ziyareti kuyruğuna taşındı | SYDV Görüşü: ' + sydvOpinion
      );
      logAction_(session.user, 'WEB_SAHA', tc, name,
        applicationId + ' web başvurusundan saha ziyareti sürecine taşındı | SYDV Görüşü: ' + sydvOpinion);

    } else {
      const redSheet = getConfiguredRedSheet_();
      const alreadyRed = personExistsInSheet_(redSheet, tc, name, 1, 2, 5);

      if (!alreadyRed) {
        appendWebToRed_(redSheet, data);
        SpreadsheetApp.flush();
      }

      const redConfirmed = personExistsInSheet_(redSheet, tc, name, 1, 2, 5);
      if (!redConfirmed) {
        throw new Error('Ret Listesine hedef kayıt doğrulanamadı; Web Başvurusu silinmedi.');
      }

      recordApplicationTransition_(
        session.user, applicationId, sourceWebId, tc, name,
        'BAŞVURU', 'REDDEDİLDİ', 'AİLE PANELİ / WEB BAŞVURU',
        'Web başvurusu Ret Listesine taşındı | SYDV Görüşü: ' + sydvOpinion
      );
      logAction_(session.user, 'WEB_RET', tc, name,
        applicationId + ' web başvurusundan Ret Listesine taşındı | SYDV Görüşü: ' + sydvOpinion);
    }

    // Kaynak yalnız hedef kayıt başarıyla oluşturulup doğrulandıktan sonra silinir.
    webSheet.deleteRow(row);
    SpreadsheetApp.flush();

    // Kaynağın gerçekten kalktığını doğrula.
    // Aynı TC'ye ait birden fazla mükerrer web satırı varsa hepsini temizle:
    // karar kişi bazlıdır, aynı kişinin ikinci başvuru kopyası kuyrukta bırakılmaz.
    const tcKeyAfter = normalizeTc_(tc);
    if (tcKeyAfter) {
      const valuesAfter = webSheet.getDataRange().getDisplayValues();
      const duplicateRows = [];
      for (let rr = 1; rr < valuesAfter.length; rr++) {
        if (normalizeTc_(valuesAfter[rr][3]) === tcKeyAfter) duplicateRows.push(rr + 1);
      }
      duplicateRows.sort(function(a,b){ return b-a; }).forEach(function(rowNum){
        webSheet.deleteRow(rowNum);
      });
      SpreadsheetApp.flush();
    }

    const remaining = parseWeb_(webSheet).some(function(x) {
      return tcKeyAfter
        ? normalizeTc_(x.tc) === tcKeyAfter
        : (normalizeText_(x.ad_soyad) === normalizeText_(name) && clean_(x.telefon) === clean_(data[4]));
    });
    if (remaining) {
      throw new Error('Hedef kayıt oluşturuldu ancak Web Başvuruları kaynağı tamamen temizlenemedi.');
    }

    logAction_(
      session.user,
      'WEB_KAYNAK_SIL',
      tc,
      name,
      destination === 'active'
        ? 'Web başvurusu Aktif Ailelere taşındı ve kaynak başvuru satırı silindi'
        : (destination === 'field'
            ? 'Web başvurusu Saha Ziyareti kuyruğuna taşındı ve kaynak başvuru satırı silindi'
            : 'Web başvurusu Ret Listesine taşındı ve kaynak başvuru satırı silindi')
    );

    return buildCentralData_(session.user);
  });
}

function moveRedToActiveServer(token, tc, name) {
  const session = requireSession_(token);

  return withWriteLock_(function() {
    const ss = getDb_();
    const redSheet = getConfiguredRedSheet_();
    const row = findPersonRow_(redSheet, tc, name, 1, 2, 5);
    if (!row) throw new Error('Ret listesindeki aile bulunamadı veya başka bir kullanıcı tarafından taşınmış.');

    const data = redSheet.getRange(row, 1, 1, 15).getDisplayValues()[0];
    appendRedToActive_(getConfiguredActiveSheet_(), data);
    redSheet.deleteRow(row);

    recordApplicationTransition_(
      session.user, '', '', clean_(data[1]), clean_(data[0]),
      'REDDEDİLDİ', 'AKTİF / TAKİP', 'AİLE PANELİ',
      'Ret Listesinden Aktif Aileler tablosuna fiziksel olarak taşındı'
    );
    logAction_(session.user, 'RET_AKTIF', clean_(data[1]), clean_(data[0]), 'Ret listesinden aktif listeye taşındı');
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}


function moveActiveToRedServer(token, tc, name) {
  const session = requireSession_(token);

  return withApplicationTransaction_(function() {
    const activeSheet = getConfiguredActiveSheet_();
    const redSheet = getConfiguredRedSheet_();

    const activeRow = findPersonRow_(activeSheet, tc, name, 1, 2, 5);
    if (!activeRow) {
      throw new Error('Aktif aile kaydı bulunamadı veya başka bir kullanıcı tarafından daha önce taşındı.');
    }

    const data = activeSheet.getRange(activeRow, 1, 1, 35).getDisplayValues()[0];

    // Önce hedefte aynı kişi var mı kontrol et. Önceki yarım işlem varsa ikinci kopyayı oluşturma.
    const alreadyInRed = personExistsInSheet_(redSheet, clean_(data[1]), clean_(data[0]), 1, 2, 5);
    if (!alreadyInRed) {
      appendActiveToRed_(redSheet, data);
      SpreadsheetApp.flush();
    }

    // Hedef kayıt mevcut/oluşturulduktan sonra kaynağı fiziksel olarak sil.
    activeSheet.deleteRow(activeRow);

    recordApplicationTransition_(
      session.user,
      '',
      '',
      clean_(data[1]),
      clean_(data[0]),
      'AKTİF',
      'REDDEDİLDİ',
      'AİLE PANELİ',
      'Aktif aile Ret Listesine fiziksel olarak taşındı'
    );

    logAction_(
      session.user,
      'AKTIF_RET',
      clean_(data[1]),
      clean_(data[0]),
      'Aktif Aileler tablosundan Ret Listesine taşındı'
    );

    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}


function setFamilyStatusServer(token, tc, name, status) {
  const session = requireSession_(token);
  if (!['DELİST', 'TAKİP'].includes(status)) throw new Error('Geçersiz aile durumu.');

  return withWriteLock_(function() {
    const sheet = getConfiguredActiveSheet_();
    const row = findPersonRow_(sheet, tc, name, 1, 2, 5);
    if (!row) throw new Error('Aktif aile kaydı bulunamadı.');

    sheet.getRange(row, 5).setValue(status);
    logAction_(session.user, status === 'DELİST' ? 'LISTE_DISI' : 'YENIDEN_AKTIF', tc, name, 'Durum: ' + status);
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}



function createActiveFamilyServer(token, familyData) {
  const session = requireSession_(token);
  familyData = familyData || {};

  const name = clean_(familyData.name);
  const tc = normalizeTc_(familyData.tc);
  const status = clean_(familyData.status).toUpperCase() || 'TAKİP';
  const metric = clean_(familyData.metric);

  if (!name) throw new Error('Ad Soyad zorunludur.');
  if (!/^\d{11}$/.test(tc)) throw new Error('TC Kimlik No 11 haneli olmalıdır.');
  if (!['KRİTİK','TAKİP','STABİL'].includes(status)) {
    throw new Error('İhtiyaç durumu yalnızca KRİTİK, TAKİP veya STABİL olabilir.');
  }

  const metricNumeric = metric === '' ? null : Number(metric.replace(',', '.'));
  if (metric !== '' && (isNaN(metricNumeric) || metricNumeric < 0)) {
    throw new Error('Metrik puanı 0 veya daha büyük bir sayı olmalıdır.');
  }

  return withWriteLock_(function() {
    const sheet = getConfiguredActiveSheet_();

    // TC kişi için tekil anahtar kabul edilir.
    const existing = findPersonRow_(sheet, tc, name, 1, 2, 5);
    if (existing) {
      const rowData = sheet.getRange(existing, 1, 1, Math.max(sheet.getLastColumn(), 23)).getDisplayValues()[0];
      if (normalizeTc_(rowData[1]) === tc) {
        throw new Error('Bu TC Kimlik No ile Aktif Aileler listesinde zaten kayıt bulunuyor.');
      }
    }

    // Aktif Aileler mevcut şeması A:AI (35 sütun).
    // Yeni kayıt için yalnız Aile Bilgileri düzenleme panelinde kullanılan alanlar doldurulur;
    // diğer geçmiş/yardım/çocuk-doğum günü alanları boş bırakılır.
    const row = new Array(35).fill('');
    row[0] = name;                              // A  Ad-Soyad
    row[1] = tc;                                // B  TC
    row[2] = clean_(familyData.phone);          // C  Telefon
    row[3] = metric;                            // D  Metrik
    row[4] = status;                            // E  Durum
    row[5] = clean_(familyData.house);          // F  Konut/Ev
    row[6] = clean_(familyData.income);         // G  Gelir
    row[7] = clean_(familyData.expense);        // H  Gider/Kira
    row[8] = clean_(familyData.spouseStatus);   // I  Eş Durumu
    row[21] = clean_(familyData.region);        // V  Bölge/İlçe
    row[22] = clean_(familyData.address);       // W  Adres

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    // Fiziksel yazımı doğrula.
    const writtenRow = findPersonRow_(sheet, tc, name, 1, 2, 5);
    if (!writtenRow) {
      throw new Error('Aile Google E-Tabloya yazıldıktan sonra doğrulanamadı.');
    }

    const check = sheet.getRange(writtenRow, 1, 1, 23).getDisplayValues()[0];
    if (normalizeTc_(check[1]) !== tc || normalizeText_(check[0]) !== normalizeText_(name)) {
      throw new Error('Yeni aile kaydı doğrulanamadı.');
    }

    logAction_(
      session.user,
      'AILE_ELLE_EKLE',
      tc,
      name,
      'Aktif Aileler listesine elle eklendi | Durum: ' + status + ', Metrik: ' + metric
    );

    return buildCentralData_(session.user);
  });
}

function updateFamilyDetailsServer(token, tc, name, changes) {
  const session = requireSession_(token);
  changes = changes || {};

  const status = clean_(changes.status).toUpperCase();
  if (!['KRİTİK', 'TAKİP', 'STABİL'].includes(status)) {
    throw new Error('İhtiyaç durumu yalnızca KRİTİK, TAKİP veya STABİL olabilir.');
  }

  const metric = clean_(changes.metric);
  const metricNumeric = metric === '' ? null : Number(metric.replace(',', '.'));
  if (metric !== '' && (isNaN(metricNumeric) || metricNumeric < 0)) {
    throw new Error('Metrik puanı 0 veya daha büyük bir sayı olmalıdır.');
  }

  return withWriteLock_(function() {
    const sheet = getConfiguredActiveSheet_();
    const row = findPersonRow_(sheet, tc, name, 1, 2, 5);
    if (!row) throw new Error('Aktif aile kaydı bulunamadı.');

    // Aktif Aileler şeması:
    // C=telefon, D=metrik, E=durum, F=konut/ev, G=gelir, H=gider/kira,
    // I=eş durumu, V=bölge/ilçe, W=adres.
    sheet.getRange(row, 3).setValue(clean_(changes.phone));
    sheet.getRange(row, 4).setValue(metric);
    sheet.getRange(row, 5).setValue(status);
    sheet.getRange(row, 6).setValue(clean_(changes.house));
    sheet.getRange(row, 7).setValue(clean_(changes.income));
    sheet.getRange(row, 8).setValue(clean_(changes.expense));
    sheet.getRange(row, 9).setValue(clean_(changes.spouseStatus));
    sheet.getRange(row, 22).setValue(clean_(changes.region));
    sheet.getRange(row, 23).setValue(clean_(changes.address));

    logAction_(session.user, 'AILE_BILGI_GUNCELLE', tc, name,
      'Telefon/Konut/Gelir/Gider/Eş Durumu/Bölge/Adres güncellendi; Durum: ' + status + ', Metrik: ' + metric);
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}

function saveAssistanceServer(token, tc, name, entries) {
  const session = requireSession_(token);
  if (!Array.isArray(entries) || !entries.length) throw new Error('Kaydedilecek yardım bulunamadı.');

  return withWriteLock_(function() {
    ensureSystemSheets_();
    const sheet = getConfiguredAssistanceLedgerSheet_();
    const props = PropertiesService.getScriptProperties();
    const folderId = extractId_(props.getProperty('HELP_FOLDER_ID') || '');

    entries.forEach(function(e) {
      if (!clean_(e.date) || !clean_(e.content)) throw new Error('Yardım tarihi ve yardım içeriği zorunludur.');

      let fileUrl = '';
      let fileName = '';

      if (e.file && e.file.base64) {
        if (!folderId) throw new Error('Yardım tutanakları Drive klasörü henüz ayarlanmadı.');
        const file = savePdf_(folderId, e.file, tc, name, 'yardim-tutanagi', session.user);
        fileUrl = file.getUrl();
        fileName = file.getName();
      }

      sheet.appendRow([
        Utilities.getUuid(),
        new Date(),
        clean_(tc),
        clean_(name),
        clean_(e.date),
        clean_(e.content),
        clean_(e.marketValue),
        fileUrl,
        fileName,
        session.user,
        'Panel'
      ]);
    });

    logAction_(session.user, 'YARDIM_EKLE', tc, name, entries.length + ' yardım kaydı eklendi');
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}

function uploadFamilyDocumentServer(token, tc, name, type, fileObj) {
  const session = requireSession_(token);
  if (!['assessment', 'media'].includes(type)) throw new Error('Geçersiz belge türü.');
  if (!fileObj || !fileObj.base64) throw new Error('PDF dosyası bulunamadı.');

  return withWriteLock_(function() {
    ensureSystemSheets_();
    const props = PropertiesService.getScriptProperties();
    const folderKey = type === 'assessment' ? 'ASSESSMENT_FOLDER_ID' : 'MEDIA_FOLDER_ID';
    const folderId = extractId_(props.getProperty(folderKey) || '');
    if (!folderId) throw new Error('Bu belge türü için Drive klasörü henüz ayarlanmadı.');

    const label = type === 'assessment' ? 'tespit-tutanagi' : 'video-fotograf-izin';
    const file = savePdf_(folderId, fileObj, tc, name, label, session.user);

    getDb_().getSheetByName(GIH.SHEETS.DOCUMENTS).appendRow([
      Utilities.getUuid(),
      new Date(),
      clean_(tc),
      clean_(name),
      type,
      file.getName(),
      file.getUrl(),
      file.getId(),
      session.user
    ]);

    logAction_(session.user, 'BELGE_YUKLE', tc, name, label + ': ' + file.getName());
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}

// -------------------- ASSISTANCE IMPORT --------------------

function importAssistanceServer(token) {
  const session = requireSession_(token);

  return withWriteLock_(function() {
    const props = PropertiesService.getScriptProperties();
    const sourceId = getAssistanceSpreadsheetId_();
    const sourceSheetName = clean_(props.getProperty('ASSISTANCE_SHEET_NAME'));

    if (!sourceId) throw new Error('Toplu yapılan yardımlar Google E-Tablo ID/URL bilgisi henüz ayarlanmadı.');

    const src = SpreadsheetApp.openById(sourceId);
    const sourceSheet = sourceSheetName ? src.getSheetByName(sourceSheetName) : src.getSheets()[0];
    if (!sourceSheet) throw new Error('Yardım tablosu sekmesi bulunamadı.');

    const rows = sourceSheet.getDataRange().getDisplayValues();
    const parsed = parseExternalAssistance_(rows);

    ensureSystemSheets_();
    const dest = getConfiguredAssistanceLedgerSheet_();
    const existing = parseAssistance_(dest);
    const existingSig = {};
    existing.forEach(function(x) {
      existingSig[assistanceSignature_(x.tc, x.yardim_tarihi, x.yardim_icerigi, x.rayic_bedel, x.tutanak_url)] = true;
    });

    const activePeople = getConfiguredActiveFamilies_();
    let matched = 0, unmatched = 0, added = 0;

    parsed.forEach(function(e) {
      let family = activePeople.find(f => normalizeTc_(f.tc) && normalizeTc_(f.tc) === normalizeTc_(e.tc));
      if (!family && e.name) family = activePeople.find(f => normalizeText_(f.ad_soyad) === normalizeText_(e.name));
      if (!family) { unmatched++; return; }
      matched++;

      const sig = assistanceSignature_(family.tc, e.date, e.content, e.marketValue, e.pdfUrl);
      if (existingSig[sig]) return;

      dest.appendRow([
        Utilities.getUuid(), new Date(), family.tc, family.ad_soyad,
        e.date, e.content || 'Yardım', e.marketValue, e.pdfUrl, '',
        session.user, 'Toplu Yardım Tablosu'
      ]);
      existingSig[sig] = true;
      added++;
    });

    logAction_(session.user, 'YARDIM_IMPORT', '', '', 'Okunan: ' + parsed.length + ', Eşleşen: ' + matched + ', Eklenen: ' + added + ', Eşleşmeyen: ' + unmatched);

    return {
      ok: true,
      message: parsed.length + ' yardım satırı okundu; ' + matched + ' eşleşti, ' + added + ' yeni kayıt eklendi, ' + unmatched + ' eşleşmedi.',
      data: buildCentralData_(session.user)
    };
  });
}


function parseFieldQueue_(sheet){
  if(!sheet||sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,21).getDisplayValues().filter(r=>clean_(r[0])).map(r=>({
    saha_id:clean_(r[0]),id:clean_(r[1]),tarih:clean_(r[2]),ad_soyad:clean_(r[3]),tc:clean_(r[4]),
    telefon:clean_(r[5]),ilce:clean_(r[6]),adres:clean_(r[7]),evde_kisi:clean_(r[8]),ev_bilgisi:clean_(r[9]),
    aylik_gelir:clean_(r[10]),devlet_destegi:clean_(r[11]),diger_stk:clean_(r[12]),talep:clean_(r[13]),
    aciklama:clean_(r[14]),asama:clean_(r[15]),saha_raporu:clean_(r[16]),saha_form_tarihi:clean_(r[17]),
    application_id:clean_(r[19]),sydv_gorusu:clean_(r[20])
  }));
}
function parseFieldReportRows_(rows){
  if(!rows || !rows.length) return [];

  let h = -1;
  for(let i = 0; i < Math.min(20, rows.length); i++){
    const n = (rows[i] || []).map(normalizeText_);
    const hasTc = n.some(function(x){
      return x.includes('TC') || x.includes('KIMLIK');
    });
    const hasPerson = n.some(function(x){
      return x.includes('ILETISIM KISISI') ||
             x.includes('AILE TEMSILCISI') ||
             x.includes('AD SOYAD') ||
             x === 'AD' ||
             x.includes('FAYDALANICI');
    });
    if(hasTc && hasPerson) { h = i; break; }
  }

  if(h < 0) {
    throw new Error('Saha Tespit Formu başlık satırı bulunamadı. T.C. Kimlik No ve İletişim Kişisi/Aile Temsilcisi başlıklarını kontrol edin.');
  }

  const headers = rows[h] || [];
  const hn = headers.map(normalizeText_);

  function findHeader_(tests){
    for(let i = 0; i < hn.length; i++){
      for(let j = 0; j < tests.length; j++){
        if(tests[j](hn[i])) return i;
      }
    }
    return -1;
  }

  const ni = findHeader_([
    function(x){ return x.includes('ILETISIM KISISI'); },
    function(x){ return x.includes('AILE TEMSILCISI'); },
    function(x){ return x.includes('AD SOYAD'); },
    function(x){ return x === 'AD'; }
  ]);
  const ti = findHeader_([
    function(x){ return x.includes('TC'); },
    function(x){ return x.includes('KIMLIK'); }
  ]);
  const di = findHeader_([
    function(x){ return x.includes('TARIH / SAAT'); },
    function(x){ return x.includes('ZIYARET TARIHI'); },
    function(x){ return x.includes('TARIH'); },
    function(x){ return x.includes('ZAMAN'); }
  ]);
  const phoneI = findHeader_([function(x){ return x === 'TELEFON' || x.includes('TELEFON'); }]);
  const districtI = findHeader_([function(x){ return x === 'ILCE' || x.includes('ILCE'); }]);
  const addressI = findHeader_([function(x){ return x.includes('ACIK ADRES') || x === 'ADRES'; }]);
  const appI = findHeader_([function(x){ return x.includes('APPLICATION_ID'); }]);

  const out = [];
  for(let r = h + 1; r < rows.length; r++){
    const row = rows[r] || [];
    const name = ni >= 0 ? clean_(row[ni]) : '';
    const tc = ti >= 0 ? clean_(row[ti]) : '';
    if(!name && !tc) continue;

    const details = [];
    headers.forEach(function(head, j){
      const val = clean_(row[j]);
      if(val && j !== ni && j !== ti){
        details.push((clean_(head) || 'Alan') + ': ' + val);
      }
    });

    out.push({
      rowNumber: r + 1,
      name: name,
      tc: tc,
      date: di >= 0 ? clean_(row[di]) : '',
      phone: phoneI >= 0 ? clean_(row[phoneI]) : '',
      ilce: districtI >= 0 ? clean_(row[districtI]) : '',
      address: addressI >= 0 ? clean_(row[addressI]) : '',
      applicationId: appI >= 0 ? clean_(row[appI]) : '',
      summary: details.join('\n')
    });
  }
  return out;
}
function syncExternalFieldReports_(user){
  const p = PropertiesService.getScriptProperties();
  const id = extractId_(p.getProperty('FIELD_SPREADSHEET_ID') || '');
  if(!id) return {skipped:true, matched:0, created:0};

  const ss = SpreadsheetApp.openById(id);
  const name = clean_(p.getProperty('FIELD_SHEET_NAME'));
  const sh = name ? ss.getSheetByName(name) : ss.getSheets()[0];
  if(!sh) throw new Error('Saha Tespit Formu sekmesi bulunamadı.');

  const reports = parseFieldReportRows_(sh.getDataRange().getDisplayValues());
  const q = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
  if(!q) throw new Error('Saha kuyruğu sistem tablosu bulunamadı.');

  const vals = q.getLastRow() >= 2
    ? q.getRange(2,1,q.getLastRow()-1,20).getDisplayValues()
    : [];

  let matched = 0;
  let created = 0;

  // Kuyruktaki mevcut kayıtları TC / Application ID ile saha raporlarıyla eşleştir.
  vals.forEach(function(r, i){
    if(clean_(r[15]) === 'DEĞERLENDİRMEDE') return;

    const tc = normalizeTc_(r[4]);
    const appId = clean_(r[19]);
    const nm = normalizeText_(r[3]);

    const rep = reports.find(function(x){
      if(appId && x.applicationId && clean_(x.applicationId) === appId) return true;
      if(tc && normalizeTc_(x.tc) === tc) return true;
      return !tc && nm && normalizeText_(x.name) === nm;
    });

    if(rep){
      const resolvedAppId = ensureApplicationId_(appId || rep.applicationId);
      q.getRange(i+2,16).setValue('DEĞERLENDİRMEDE');
      q.getRange(i+2,17).setValue(rep.summary);
      q.getRange(i+2,18).setValue(rep.date || new Date());
      q.getRange(i+2,19).setValue(user || 'AUTO');
      q.getRange(i+2,20).setValue(resolvedAppId);
      matched++;
    }
  });

  // Form tablosunda olup kuyrukta hiç bulunmayan kayıtları da panele ekle.
  // Böylece Saha Tespit Formu, Aile Panelinin saha sekmesi için gerçek ikinci kaynak olur.
  const refreshed = q.getLastRow() >= 2
    ? q.getRange(2,1,q.getLastRow()-1,20).getDisplayValues()
    : [];

  reports.forEach(function(rep){
    const repTc = normalizeTc_(rep.tc);
    const repApp = clean_(rep.applicationId);
    const repName = normalizeText_(rep.name);

    const exists = refreshed.some(function(r){
      if(repApp && clean_(r[19]) === repApp) return true;
      if(repTc && normalizeTc_(r[4]) === repTc) return true;
      return !repTc && repName && normalizeText_(r[3]) === repName;
    });

    if(exists) return;

    const applicationId = ensureApplicationId_(repApp);
    q.appendRow([
      Utilities.getUuid(),      // Saha ID
      '',                       // Başvuru ID
      rep.date || new Date(),   // Başvuru/Saha tarihi
      rep.name,                 // Ad Soyad
      rep.tc,                   // TC
      rep.phone,                // Telefon
      rep.ilce,                 // İlçe
      rep.address,              // Adres
      '', '', '', '', '',       // hane/ev/gelir/destek alanları
      'Saha Tespit Formundan aktarıldı',
      '',
      'DEĞERLENDİRMEDE',
      rep.summary,
      rep.date || new Date(),
      user || 'AUTO',
      applicationId
    ]);

    recordApplicationTransition_(
      user || 'AUTO',
      applicationId,
      '',
      rep.tc,
      rep.name,
      'SAHA FORMU',
      'DEĞERLENDİRMEDE',
      'SAHA TESPİT TABLOSU',
      'Saha formu tablosunda bulundu ve aile paneli saha kuyruğuna aktarıldı'
    );
    created++;
  });

  if(matched || created){
    logAction_(
      user || 'AUTO',
      'SAHA_FORM_ESLESTIR',
      '',
      '',
      matched + ' saha formu mevcut kayıtla eşleşti; ' + created + ' yeni saha kaydı kuyruğa eklendi'
    );
  }

  return {matched:matched, created:created, reports:reports.length};
}
function syncFieldReportsServer(token){
  const s=requireSession_(token);
  return withWriteLock_(function(){syncExternalFieldReports_(s.user); SpreadsheetApp.flush(); return buildCentralData_(s.user);});
}
function appendFieldToActive_(sheet,r,status){
  const row=new Array(35).fill('');
  row[0]=clean_(r[3]); row[1]=clean_(r[4]); row[2]=clean_(r[5]); row[4]=status;
  row[5]=clean_(r[9]); row[6]=clean_(r[10]); row[9]=clean_(r[13]); row[10]=clean_(r[14]);
  row[21]=clean_(r[6]); row[22]=clean_(r[7]); appendDataRow_(sheet,row,2);
}
function appendFieldToRed_(sheet,r){
  const row=new Array(15).fill('');
  row[0]=clean_(r[3]); row[1]=clean_(r[4]); row[2]=clean_(r[5]); row[3]=clean_(r[6]); row[4]=clean_(r[7]);
  row[5]=clean_(r[9]); row[6]=clean_(r[10]); row[10]=clean_(r[13]); row[11]=clean_(r[14])+(r[16]?' | Saha: '+clean_(r[16]):'');
  appendDataRow_(sheet,row,1);
}

function updateFieldSydvOpinionServer(token, sahaId, sydvOpinion) {
  const session = requireSession_(token);
  sydvOpinion = clean_(sydvOpinion).toUpperCase();
  if (!['ONAY','RET','GORUS_ALINAMADI',''].includes(sydvOpinion)) {
    throw new Error('Geçersiz SYDV Görüşü.');
  }

  return withApplicationTransaction_(function() {
    const q = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
    const row = findRowByValue_(q, 1, String(sahaId), 2);
    if (!row) throw new Error('Saha kaydı bulunamadı.');
    q.getRange(row,21).setValue(sydvOpinion);
    const r = q.getRange(row,1,1,21).getDisplayValues()[0];
    logAction_(session.user,'SAHA_SYDV_GUNCELLE',clean_(r[4]),clean_(r[3]),'SYDV Görüşü: ' + (sydvOpinion || 'Boş'));
    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}

function finalizeFieldDecisionServer(token, sahaId, destination, status, sydvOpinion) {
  const session = requireSession_(token);
  if (!['active','red'].includes(destination)) throw new Error('Geçersiz karar.');

  sydvOpinion = clean_(sydvOpinion).toUpperCase();
  if (sydvOpinion && !['ONAY','RET','GORUS_ALINAMADI'].includes(sydvOpinion)) {
    throw new Error('Geçersiz SYDV Görüşü.');
  }
  const finalStatus = clean_(status).toUpperCase();
  if (destination === 'active' && !['KRİTİK','TAKİP','STABİL'].includes(finalStatus)) {
    throw new Error('Aktif aile için ihtiyaç kategorisi seçilmelidir.');
  }

  return withApplicationTransaction_(function() {
    const q = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
    const row = findRowByValue_(q, 1, String(sahaId), 2);
    if (!row) throw new Error('Bu saha kaydı başka bir kullanıcı tarafından daha önce işlenmiş.');

    const r = q.getRange(row, 1, 1, 21).getDisplayValues()[0];
    const currentStage = clean_(r[15]);
    if (!['DEĞERLENDİRMEDE','SAHA YAPILACAK'].includes(currentStage)) {
      throw new Error('Kayıt değerlendirme işlemine uygun bir aşamada değil; işlem iptal edildi.');
    }

    const applicationId = ensureApplicationId_(r[19]);
    const tc = clean_(r[4]), name = clean_(r[3]);

    if (sydvOpinion) {
      q.getRange(row, 21).setValue(sydvOpinion);
      r[20] = sydvOpinion;
      SpreadsheetApp.flush();
    }

    if (destination === 'active') {
      const activeSheet = getConfiguredActiveSheet_();
      const alreadyActive = personExistsInSheet_(activeSheet, tc, name, 1, 2, 5);
      if (!alreadyActive) {
        appendFieldToActive_(activeSheet, r, finalStatus);
        SpreadsheetApp.flush();
      }

      recordApplicationTransition_(session.user, applicationId, clean_(r[1]), tc, name,
        currentStage, 'ONAYLANDI / ' + finalStatus, 'AİLE PANELİ',
        'Saha değerlendirmesi sonucu aktif aileye alındı' + (sydvOpinion ? ' | SYDV Görüşü: ' + sydvOpinion : ''));
      logAction_(session.user, 'SAHA_ONAY', tc, name, applicationId + ' aktif aileye alındı: ' + finalStatus);
    } else {
      const redSheet = getConfiguredRedSheet_();
      const alreadyRed = personExistsInSheet_(redSheet, tc, name, 1, 2, 5);
      if (!alreadyRed) {
        appendFieldToRed_(redSheet, r);
        SpreadsheetApp.flush();
      }

      recordApplicationTransition_(session.user, applicationId, clean_(r[1]), tc, name,
        currentStage, 'REDDEDİLDİ', 'AİLE PANELİ',
        'Saha değerlendirmesi sonucu reddedildi' + (sydvOpinion ? ' | SYDV Görüşü: ' + sydvOpinion : ''));
      logAction_(session.user, 'SAHA_RET', tc, name, applicationId + ' saha sonucu reddedildi');
    }

    // Hedef yazımı tamamlandıktan sonra hem gerçek Saha Tespit Sheet satırını
    // hem dahili saha kuyruğu satırını kaldır.
    const fieldDeleted = deleteFieldOperationalReport_(applicationId, tc, name);
    q.deleteRow(row);

    logAction_(
      session.user,
      'SAHA_KAYNAK_SIL',
      tc,
      name,
      fieldDeleted
        ? 'Varsa Saha Tespit Form Listesi satırı hedef tabloya taşındıktan sonra silindi'
        : 'Saha Tespit Formu yoktu/zorunlu değildi; dahili saha kaydı hedef tabloya taşındı ve temizlendi'
    );

    SpreadsheetApp.flush();
    return buildCentralData_(session.user);
  });
}




/**
 * Harici Saha Panelinden gelen raporu merkezi transaction içinde işler.
 * Harici panel Google Sheet'e doğrudan yazmamalıdır.
 */
function fieldApiSubmitReport_(payload) {
  payload = payload || {};
  const sahaId = clean_(payload.sahaId);
  const applicationId = clean_(payload.applicationId);
  const reportData = payload.report || {};

  if (!sahaId && !applicationId) {
    throw new Error('SAHA_ID_VEYA_APPLICATION_ID_GEREKLI');
  }

  return withApplicationTransaction_(function() {
    const q = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
    if (!q || q.getLastRow() < 2) throw new Error('SAHA_KUYRUGU_BOS');

    let row = 0;
    if (sahaId) row = findRowByValue_(q, 1, sahaId, 2);

    if (!row && applicationId) {
      row = findRowByValue_(q, 20, applicationId, 2);
    }

    if (!row) throw new Error('SAHA_KAYDI_BULUNAMADI');

    const current = q.getRange(row, 1, 1, 20).getDisplayValues()[0];
    if (clean_(current[15]) !== 'SAHA YAPILACAK') {
      throw new Error('KAYIT_ARTIK_SAHA_ASAMASINDA_DEGIL');
    }

    const summary = [
      reportData.house ? 'Konut: ' + clean_(reportData.house) : '',
      reportData.income ? 'Gelir: ' + clean_(reportData.income) : '',
      reportData.expense ? 'Gider: ' + clean_(reportData.expense) : '',
      reportData.spouseStatus ? 'Eş Durumu: ' + clean_(reportData.spouseStatus) : '',
      reportData.region ? 'Bölge/İlçe: ' + clean_(reportData.region) : '',
      reportData.address ? 'Adres: ' + clean_(reportData.address) : '',
      reportData.notes ? 'Saha Notu: ' + clean_(reportData.notes) : ''
    ].filter(Boolean).join('\n');

    const appId = ensureApplicationId_(current[19]);

    q.getRange(row, 16).setValue('DEĞERLENDİRMEDE');
    q.getRange(row, 17).setValue(summary);
    q.getRange(row, 18).setValue(new Date());
    q.getRange(row, 19).setValue(clean_(payload.actor) || 'EXTERNAL_API');
    if (!clean_(current[19])) q.getRange(row, 20).setValue(appId);

    recordApplicationTransition_(
      clean_(payload.actor) || 'EXTERNAL_API',
      appId,
      clean_(current[1]),
      clean_(current[4]),
      clean_(current[3]),
      'SAHA YAPILACAK',
      'DEĞERLENDİRMEDE',
      'HARİCİ SAHA PANELİ',
      'Saha raporu merkezi API üzerinden kaydedildi'
    );

    logAction_(
      clean_(payload.actor) || 'EXTERNAL_API',
      'SAHA_API_RAPOR',
      clean_(current[4]),
      clean_(current[3]),
      appId + ' saha raporu kaydedildi'
    );

    return {
      saha_id: clean_(current[0]),
      application_id: appId,
      asama: 'DEĞERLENDİRMEDE'
    };
  });
}


// -------------------- SAHA PANEL API --------------------



/**
 * Saha paneli saha tespit formunu doğrudan ortak backend'e kaydedebilir.
 * Harici Google Form/Sheet kullanılacaksa syncExternalFieldReports_ aynı kuyruğu günceller.
 */


function getApplicationHistoryServer(token, tc) {
  requireSession_(token);
  return { ok: true, history: findHistoryByTc_(tc) };
}



// -------------------- SAHA OTOMASYONU FORM SERVİSLERİ --------------------
function submitSahaTespitForm(data) {
  data = data || {};
  return withWriteLock_(function() {
    const pdfFile = saveFormPdfIfPresent_(data,
      PropertiesService.getScriptProperties().getProperty('ASSESSMENT_FOLDER_ID'),
      'saha-tespit');

    const sheet = getConfiguredFieldOperationalSheet_();
    ensureFieldOperationalHeaders_();
    const rowData = {
      'Tarih / Saat': Utilities.formatDate(new Date(), 'Europe/Istanbul', 'dd.MM.yyyy HH:mm:ss'),
      'Ziyaret Tarihi': clean_(data.ziyaret_tarihi),
      'İlçe': clean_(data.ilce),
      'Mahalle': clean_(data.mahalle),
      'Açık Adres': clean_(data.acik_adres),
      'GPS Koordinat': clean_(data.gps_koordinat),
      'Harita Linki': clean_(data.gps_link),
      'İletişim Kişisi': clean_(data.iletisim_kisi),
      'T.C. Kimlik No': clean_(data.tc_kimlik),
      'Yaş': clean_(data.iletisim_kisi_yas),
      'Telefon': clean_(data.telefon),
      'Hane Kişi Sayısı': clean_(data.kisi_sayisi),
      'Anne Durumu': clean_(data.anne_durum),
      'Baba Durumu': clean_(data.baba_durum),
      'Evdeki Diğer Bireyler': buildOtherResidents_(data),
      'Büyükanne Yaşı': clean_(data.buyukanne_yas),
      'Büyükbaba Yaşı': clean_(data.buyukbaba_yas),
      'Çocuk Detayları': clean_(data.cocuk_listesi),
      'Mülkiyet Durumu': clean_(data.mulkiyet),
      'Kira Bedeli (TL)': clean_(data.kira_bedeli),
      'Ödenmemiş Fatura': clean_(data.fatura_durumu),
      'Fatura Detayı': clean_(data.fatura_detay),
      'Diğer Kurum Destekleri': clean_(data.destek_durumu),
      'Destek Detayı': clean_(data.destek_detay),
      'Saha Gözlem Notları': clean_(data.notlar),
      'Teslim Edilen Destekler': clean_(data.ziyarette_verilenler),
      'Aile Temsilcisi': clean_(data.aile_ad_soyad),
      'GİH Saha Görevlisi': clean_(data.gih_ad_soyad),
      'Drive PDF Linki': pdfFile ? pdfFile.getUrl() : '',
      'APPLICATION_ID': clean_(data.application_id)
    };
    const row = appendByHeaders_(sheet, rowData);

    const q = getDb_().getSheetByName(GIH.SHEETS.FIELD_QUEUE);
    if (q) {
      const tc = normalizeTc_(data.tc_kimlik);
      const vals = q.getLastRow() >= 2
        ? q.getRange(2,1,q.getLastRow()-1,20).getDisplayValues()
        : [];

      let found = false;
      for (let i=0;i<vals.length;i++) {
        const r=vals[i];
        if (tc && normalizeTc_(r[4]) === tc) {
          const applicationId = ensureApplicationId_(r[19] || data.application_id);
          q.getRange(i+2,16).setValue('DEĞERLENDİRMEDE');
          q.getRange(i+2,17).setValue(buildFieldSummaryFromPayload_(data));
          q.getRange(i+2,18).setValue(new Date());
          q.getRange(i+2,19).setValue(clean_(data.gih_ad_soyad) || 'SAHA PANELİ');
          q.getRange(i+2,20).setValue(applicationId);
          recordApplicationTransition_(
            clean_(data.gih_ad_soyad) || 'SAHA PANELİ',
            applicationId, clean_(r[1]), clean_(r[4]), clean_(r[3]),
            clean_(r[15]) || 'SAHA YAPILACAK',
            'DEĞERLENDİRMEDE',
            'SAHA OTOMASYONU',
            'Saha tespit formu kaydedildi'
          );
          found = true;
          break;
        }
      }

      // Web başvuru kuyruğunda kayıt yoksa formun kendisinden yeni değerlendirme kaydı oluştur.
      if (!found) {
        const applicationId = ensureApplicationId_(data.application_id);
        q.appendRow([
          Utilities.getUuid(),
          '',
          clean_(data.ziyaret_tarihi) || new Date(),
          clean_(data.iletisim_kisi) || clean_(data.aile_ad_soyad),
          clean_(data.tc_kimlik),
          clean_(data.telefon),
          clean_(data.ilce),
          clean_(data.acik_adres),
          clean_(data.kisi_sayisi),
          clean_(data.mulkiyet),
          '',
          '',
          '',
          'Saha Tespit Formundan aktarıldı',
          clean_(data.notlar),
          'DEĞERLENDİRMEDE',
          buildFieldSummaryFromPayload_(data),
          new Date(),
          clean_(data.gih_ad_soyad) || 'SAHA PANELİ',
          applicationId
        ]);
        recordApplicationTransition_(
          clean_(data.gih_ad_soyad) || 'SAHA PANELİ',
          applicationId,
          '',
          clean_(data.tc_kimlik),
          clean_(data.iletisim_kisi) || clean_(data.aile_ad_soyad),
          'SAHA FORMU',
          'DEĞERLENDİRMEDE',
          'SAHA OTOMASYONU',
          'Saha formu doğrudan değerlendirme kuyruğuna oluşturuldu'
        );
      }
    }
    logAction_(clean_(data.gih_ad_soyad) || 'SAHA PANELİ','SAHA_FORM_KAYIT',
      clean_(data.tc_kimlik),clean_(data.iletisim_kisi),'Satır '+row);
    return {status:'success',pdfUrl:pdfFile ? pdfFile.getUrl() : '',row:row};
  });
}

function submitYayinIzniForm(data) {
  data = data || {};
  return withWriteLock_(function() {
    const pdfFile = saveFormPdfIfPresent_(data,
      PropertiesService.getScriptProperties().getProperty('MEDIA_FOLDER_ID'),
      'video-fotograf-izin');
    ensureSystemSheets_();
    if (pdfFile) {
      getDb_().getSheetByName(GIH.SHEETS.DOCUMENTS).appendRow([
        Utilities.getUuid(),new Date(),clean_(data.yayin_tc),clean_(data.yayin_ad),
        'media',pdfFile.getName(),pdfFile.getUrl(),pdfFile.getId(),'SAHA PANELİ'
      ]);
    }
    logAction_('SAHA PANELİ','YAYIN_IZNI_KAYIT',clean_(data.yayin_tc),clean_(data.yayin_ad),
      pdfFile ? pdfFile.getUrl() : '');
    return {status:'success',pdfUrl:pdfFile ? pdfFile.getUrl() : ''};
  });
}

function submitAyniYardimForm(data) {
  data = data || {};

  return withWriteLock_(function() {
    const props = PropertiesService.getScriptProperties();
    const folderId = extractId_(
      props.getProperty('AYNI_YARDIM_FOLDER_ID') ||
      GIH.AYNI_YARDIM_FOLDER_ID ||
      ''
    );

    if (!folderId) {
      throw new Error('Ayni yardım PDF Drive klasörü tanımlı değil.');
    }

    // Form tarafından üretilen PDF'i Drive'a kaydet.
    const pdfFile = saveFormPdfIfPresent_(
      data,
      folderId,
      'ayni-yardim-tutanagi'
    );

    // Aile Paneli ile ortak kullanılan yapılandırılmış yardım kayıt tablosu.
    // Not: Bu, eski yatay tarih matrisi olan "Yardımlar" sekmesi değil,
    // sistemin kullandığı "YARDIM KAYITLARI" sekmesidir.
    const sheet = getConfiguredAssistanceLedgerSheet_();

    const row = [
      Utilities.getUuid(),
      new Date(),
      clean_(data.faydalanici_tc),
      clean_(data.faydalanici_ad),
      clean_(data.tarih),
      clean_(data.malzeme_listesi) || 'Ayni yardım teslimi',
      clean_(data.rayic_bedel),
      pdfFile ? pdfFile.getUrl() : '',
      pdfFile ? pdfFile.getName() : '',
      clean_(data.gorevli_ad) || 'SAHA PANELİ',
      'Ayni Yardım Formu'
    ];

    sheet.appendRow(row);
    SpreadsheetApp.flush();

    const writtenRow = sheet.getLastRow();
    const check = sheet.getRange(writtenRow, 1, 1, 11).getDisplayValues()[0];

    if (
      normalizeTc_(check[2]) !== normalizeTc_(data.faydalanici_tc) ||
      normalizeText_(check[3]) !== normalizeText_(data.faydalanici_ad)
    ) {
      throw new Error('Ayni yardım kaydı E-Tabloya yazıldıktan sonra doğrulanamadı.');
    }

    // Merkezi Sistem DB yardım görünümüne de anında yansıt.
    // Dış yardım tablosu bir sonraki senkronizasyonda da duplicate üretmez.
    ensureSystemSheets_();
    const systemAssistance = getDb_().getSheetByName(GIH.SHEETS.ASSISTANCE);
    const signature = assistanceSignature_(
      data.faydalanici_tc,
      data.tarih,
      clean_(data.malzeme_listesi) || 'Ayni yardım teslimi',
      clean_(data.rayic_bedel),
      pdfFile ? pdfFile.getUrl() : ''
    );

    const existing = systemAssistance.getLastRow() >= 2
      ? systemAssistance.getRange(2,1,systemAssistance.getLastRow()-1,13).getDisplayValues()
      : [];

    const duplicate = existing.some(function(r) {
      return assistanceSignature_(r[3], r[5], r[6], r[7], r[8]) === signature;
    });

    if (!duplicate) {
      systemAssistance.appendRow([
        Utilities.getUuid(),
        new Date(),
        '',
        clean_(data.faydalanici_tc),
        clean_(data.faydalanici_ad),
        clean_(data.tarih),
        clean_(data.malzeme_listesi) || 'Ayni yardım teslimi',
        clean_(data.rayic_bedel),
        pdfFile ? pdfFile.getUrl() : '',
        pdfFile ? pdfFile.getName() : '',
        clean_(data.gorevli_ad) || 'SAHA PANELİ',
        'Ayni Yardım Formu',
        signature
      ]);
    }

    logAction_(
      clean_(data.gorevli_ad) || 'SAHA PANELİ',
      'AYNI_YARDIM_KAYIT',
      clean_(data.faydalanici_tc),
      clean_(data.faydalanici_ad),
      (clean_(data.malzeme_listesi) || 'Ayni yardım teslimi') +
        (pdfFile ? ' | PDF: ' + pdfFile.getUrl() : '')
    );

    SpreadsheetApp.flush();

    return {
      status: 'success',
      sheetName: sheet.getName(),
      sheetRow: writtenRow,
      pdfUrl: pdfFile ? pdfFile.getUrl() : '',
      pdfName: pdfFile ? pdfFile.getName() : ''
    };
  });
}

function saveFormPdfIfPresent_(data, folderId, category) {
  if (!data.pdf_base64) return null;
  const id = extractId_(folderId || '');
  if (!id) throw new Error(category + ' PDF klasörü tanımlı değil.');
  const bytes = Utilities.base64Decode(String(data.pdf_base64));
  const filename = sanitizeFilename_(data.pdf_filename || ('GIH_' + category + '_' + Date.now() + '.pdf'));
  return DriveApp.getFolderById(id).createFile(Utilities.newBlob(bytes,'application/pdf',filename));
}

function buildOtherResidents_(data) {
  const x=[];
  if(data.birey_kiz_cocuk)x.push('Kız Çocuk');
  if(data.birey_erkek_cocuk)x.push('Erkek Çocuk');
  if(data.birey_buyukanne)x.push('Büyükanne');
  if(data.birey_buyukbaba)x.push('Büyükbaba');
  return x.join(', ');
}
function buildFieldSummaryFromPayload_(d) {
  return [
    d.mulkiyet ? 'Mülkiyet: '+clean_(d.mulkiyet) : '',
    d.kira_bedeli ? 'Kira: '+clean_(d.kira_bedeli) : '',
    d.anne_durum ? 'Anne: '+clean_(d.anne_durum) : '',
    d.baba_durum ? 'Baba: '+clean_(d.baba_durum) : '',
    d.notlar ? 'Saha Notu: '+clean_(d.notlar) : '',
    d.ziyarette_verilenler ? 'Ziyarette Verilen: '+clean_(d.ziyarette_verilenler) : ''
  ].filter(Boolean).join('\n');
}
function ensureFieldOperationalHeaders_() {
  const sh=getConfiguredFieldOperationalSheet_();
  ensureHeadersOnExistingSheet_(sh,[
    'Tarih / Saat','Ziyaret Tarihi','İlçe','Mahalle','Açık Adres','GPS Koordinat','Harita Linki',
    'İletişim Kişisi','T.C. Kimlik No','Yaş','Telefon','Hane Kişi Sayısı','Anne Durumu','Baba Durumu',
    'Evdeki Diğer Bireyler','Büyükanne Yaşı','Büyükbaba Yaşı','Çocuk Detayları','Mülkiyet Durumu',
    'Kira Bedeli (TL)','Ödenmemiş Fatura','Fatura Detayı','Diğer Kurum Destekleri','Destek Detayı',
    'Saha Gözlem Notları','Teslim Edilen Destekler','Aile Temsilcisi','GİH Saha Görevlisi',
    'Drive PDF Linki','APPLICATION_ID'
  ]);
  return sh;
}
function ensureHeadersOnExistingSheet_(sheet,required) {
  let headerRow=1;
  const maxScan=Math.min(Math.max(sheet.getLastRow(),1),10);
  const width=Math.max(sheet.getLastColumn(),1);
  const scan=sheet.getRange(1,1,maxScan,width).getDisplayValues();
  for(let r=0;r<scan.length;r++){
    const n=scan[r].map(normalizeText_);
    if(n.some(v=>v.includes('TARIH'))&&n.some(v=>v.includes('ILCE'))){headerRow=r+1;break;}
  }
  let headers=sheet.getRange(headerRow,1,1,Math.max(sheet.getLastColumn(),1)).getDisplayValues()[0];
  let norm=headers.map(normalizeText_);
  required.forEach(h=>{
    if(!norm.includes(normalizeText_(h))){
      const col=sheet.getLastColumn()+1;
      sheet.getRange(headerRow,col).setValue(h);
      headers.push(h);norm.push(normalizeText_(h));
    }
  });
}
function appendByHeaders_(sheet,rowData) {
  let headerRow=1;
  const maxScan=Math.min(Math.max(sheet.getLastRow(),1),10);
  const scan=sheet.getRange(1,1,maxScan,Math.max(sheet.getLastColumn(),1)).getDisplayValues();
  for(let r=0;r<scan.length;r++){
    const n=scan[r].map(normalizeText_);
    if(n.some(v=>v.includes('TARIH'))&&n.some(v=>v.includes('ILCE'))){headerRow=r+1;break;}
  }
  const headers=sheet.getRange(headerRow,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  const map={};headers.forEach((h,i)=>map[normalizeText_(h)]=i);
  const row=new Array(headers.length).fill('');
  Object.keys(rowData).forEach(k=>{const idx=map[normalizeText_(k)];if(idx!==undefined)row[idx]=rowData[k];});
  const target=Math.max(sheet.getLastRow()+1,headerRow+1);
  sheet.getRange(target,1,1,row.length).setValues([row]);
  return target;
}


// -------------------- CONFIG --------------------

function getCentralConfig(token) {
  const session = requireSession_(token);
  const p = PropertiesService.getScriptProperties();
  return {
    activeSpreadsheetId: '1BGATdg2ytQGMtdsRS2UwA0GcIWeLfHxnreeyINOkmjs',
    activeSheetName: p.getProperty('ACTIVE_SHEET_NAME') || '',
    redSpreadsheetId: '1OyFi-SIxBiC9r3NjKI8N2D6dqAv14MERq97NhZM8s4U',
    redSheetName: p.getProperty('RED_SHEET_NAME') || '',
    webSpreadsheetId: '1w69GJhzhOB3fddCaupFGc3q12Sv8vwUvIX2l3IM-IKo',
    webSheetName: p.getProperty('WEB_SHEET_NAME') || '',
    fieldSpreadsheetId: '1unpNuCWesYVukQEvt2tDlMtcDLtiNcaVRikqgJunqXY',
    fieldSheetName: p.getProperty('FIELD_SHEET_NAME') || '',
    assistanceSpreadsheetId: '1iBNgR29daR7F7xBNAROnbWEo96914oX1LVyx5LY2_yE',
    assistanceSheetName: p.getProperty('ASSISTANCE_SHEET_NAME') || '',
    helpFolderId: p.getProperty('HELP_FOLDER_ID') || '',
    ayniYardimFolderId: p.getProperty('AYNI_YARDIM_FOLDER_ID') || GIH.AYNI_YARDIM_FOLDER_ID,
    assessmentFolderId: '1nP-gqZFAYziXGemD1E3x0pfaAQQ_1hy6',
    mediaFolderId: '12Bu9J_fEVmvq9ttYVHWPDOG8SyhJ_yge',
    editable: session.user === 'onur' || session.user === 'kadir'
  };
}

function saveCentralConfig(token, cfg) {
  const session = requireSession_(token);
  requireAdmin_(session);
  PropertiesService.getScriptProperties().setProperties({
    ACTIVE_SPREADSHEET_ID: '1BGATdg2ytQGMtdsRS2UwA0GcIWeLfHxnreeyINOkmjs',
    ACTIVE_SHEET_NAME: clean_(cfg.activeSheetName),
    RED_SPREADSHEET_ID: '1OyFi-SIxBiC9r3NjKI8N2D6dqAv14MERq97NhZM8s4U',
    RED_SHEET_NAME: clean_(cfg.redSheetName),
    WEB_SPREADSHEET_ID: '1w69GJhzhOB3fddCaupFGc3q12Sv8vwUvIX2l3IM-IKo',
    WEB_SHEET_NAME: clean_(cfg.webSheetName),
    FIELD_SPREADSHEET_ID: '1unpNuCWesYVukQEvt2tDlMtcDLtiNcaVRikqgJunqXY',
    FIELD_SHEET_NAME: clean_(cfg.fieldSheetName),
    ASSISTANCE_SPREADSHEET_ID: '1iBNgR29daR7F7xBNAROnbWEo96914oX1LVyx5LY2_yE',
    ASSISTANCE_SHEET_NAME: clean_(cfg.assistanceSheetName),
    HELP_FOLDER_ID: extractId_(cfg.helpFolderId || ''),
    ASSESSMENT_FOLDER_ID: '1nP-gqZFAYziXGemD1E3x0pfaAQQ_1hy6',
    MEDIA_FOLDER_ID: '12Bu9J_fEVmvq9ttYVHWPDOG8SyhJ_yge'
  }, false);
  ensureSystemSheets_();
  ensureAssistanceLedger_();
  logAction_(session.user, 'CONFIG_UPDATE', '', '', 'İYİBİS entegrasyon ayarları güncellendi');
  return { ok: true };
}

// -------------------- SHEET SETUP --------------------

function ensureSystemSheets_() {
  const ss = getDb_();

  ensureSheet_(ss, GIH.SHEETS.ASSISTANCE, [
    'ID', 'Kayıt Zamanı', 'TC', 'Ad Soyad', 'Yardım Tarihi', 'Yardım İçeriği',
    'Rayiç Bedel', 'Tutanak URL', 'Tutanak Dosya Adı', 'Kullanıcı', 'Kaynak'
  ]);

  ensureSheet_(ss, GIH.SHEETS.DOCUMENTS, [
    'ID', 'Yükleme Zamanı', 'TC', 'Ad Soyad', 'Belge Türü',
    'Dosya Adı', 'Drive URL', 'Drive File ID', 'Kullanıcı'
  ]);

  ensureSheet_(ss, GIH.SHEETS.LOG, [
    'Zaman', 'Kullanıcı', 'İşlem', 'TC', 'Ad Soyad', 'Açıklama'
  ]);

  ensureSheet_(ss, GIH.SHEETS.HISTORY, [
    'Zaman','APPLICATION_ID','Başvuru ID','TC','Ad Soyad',
    'Eski Aşama','Yeni Aşama','Kaynak Panel','Kullanıcı','Açıklama'
  ]);

  ensureSheet_(ss, GIH.SHEETS.FIELD_QUEUE, [
    'Saha ID','Başvuru ID','Başvuru Tarihi','Ad Soyad','TC','Telefon','İlçe','Adres',
    'Evde Kişi','Ev Bilgisi','Aylık Gelir','Devlet Desteği','Diğer STK','Talep','Açıklama',
    'Aşama','Saha Raporu','Saha Form Tarihi','İşlemi Yapan','APPLICATION_ID','SYDV Görüşü'
  ]);

  const fieldQueue = ss.getSheetByName(GIH.SHEETS.FIELD_QUEUE);
  if (fieldQueue && fieldQueue.getMaxColumns() < 21) {
    fieldQueue.insertColumnsAfter(fieldQueue.getMaxColumns(), 21 - fieldQueue.getMaxColumns());
  }
  if (fieldQueue && clean_(fieldQueue.getRange(1,20).getValue()) !== 'APPLICATION_ID') {
    fieldQueue.getRange(1,20).setValue('APPLICATION_ID').setFontWeight('bold');
  }
  if (fieldQueue && clean_(fieldQueue.getRange(1,21).getValue()) !== 'SYDV Görüşü') {
    fieldQueue.getRange(1,21).setValue('SYDV Görüşü').setFontWeight('bold');
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}


// -------------------- GERÇEK TABLO TAŞIMA YARDIMCILARI --------------------

function personExistsInSheet_(sheet, tc, name, tcCol, nameCol, startRow) {
  return !!findPersonRow_(sheet, tc, name, tcCol, nameCol, startRow);
}

function appendActiveToRed_(sheet, a) {
  const row = new Array(15).fill('');
  row[0] = clean_(a[0]);   // ad-soyad
  row[1] = clean_(a[1]);   // tc
  row[2] = clean_(a[2]);   // iletişim
  row[3] = clean_(a[21]);  // bölge / ilçe
  row[4] = clean_(a[22]);  // adres
  row[5] = clean_(a[5]);   // ev
  row[6] = clean_(a[6]);   // gelir
  row[7] = clean_(a[7]);   // gider
  row[8] = clean_(a[12]);  // çocuk sayısı
  row[9] = clean_(a[8]);   // eş durumu
  row[10] = clean_(a[9]);  // talep
  row[11] = clean_(a[10]); // özel durum
  row[12] = clean_(a[11]); // ziyaret edenler
  row[13] = clean_(a[20]); // teslim edilen
  row[14] = [
    clean_(a[13]) ? 'Kız: ' + clean_(a[13]) : '',
    clean_(a[14]) ? 'Erkek: ' + clean_(a[14]) : ''
  ].filter(Boolean).join(' | ');
  appendDataRow_(sheet, row, 1);
}

function findFieldOperationalReportRow_(applicationId, tc, name) {
  const sheet = getConfiguredFieldOperationalSheet_();
  if (!sheet || sheet.getLastRow() < 1) return { sheet: sheet, row: 0 };

  const reports = parseFieldReportRows_(sheet.getDataRange().getDisplayValues());
  const appKey = clean_(applicationId);
  const tcKey = normalizeTc_(tc);
  const nameKey = normalizeText_(name);

  let match = null;

  if (appKey) {
    match = reports.find(function(r) {
      return clean_(r.applicationId) === appKey;
    });
  }

  if (!match && tcKey) {
    match = reports.find(function(r) {
      return normalizeTc_(r.tc) === tcKey;
    });
  }

  if (!match && nameKey) {
    match = reports.find(function(r) {
      return normalizeText_(r.name) === nameKey;
    });
  }

  return { sheet: sheet, row: match ? Number(match.rowNumber) : 0 };
}

function deleteFieldOperationalReport_(applicationId, tc, name) {
  const found = findFieldOperationalReportRow_(applicationId, tc, name);
  if (!found.sheet || !found.row) return false;
  found.sheet.deleteRow(found.row);
  return true;
}


// -------------------- ROW MAPPING --------------------

function appendWebToActive_(sheet, w) {
  const row = new Array(35).fill('');
  row[0] = clean_(w[2]);   // ad
  row[1] = clean_(w[3]);   // tc
  row[2] = clean_(w[4]);   // tel
  row[4] = 'TAKİP';
  row[5] = clean_(w[8]);   // ev bilgisi
  row[6] = clean_(w[9]);   // gelir
  row[9] = clean_(w[12]);  // talep
  row[10] = clean_(w[13]); // açıklama -> özel durum/not
  row[21] = clean_(w[5]);  // bölge
  row[22] = clean_(w[6]);  // adres
  appendDataRow_(sheet, row, 2);
}

function appendWebToRed_(sheet, w) {
  const row = new Array(15).fill('');
  row[0] = clean_(w[2]);
  row[1] = clean_(w[3]);
  row[2] = clean_(w[4]);
  row[3] = clean_(w[5]);
  row[4] = clean_(w[6]);
  row[5] = clean_(w[8]);
  row[6] = clean_(w[9]);
  row[10] = clean_(w[12]);
  row[11] = clean_(w[13]);
  appendDataRow_(sheet, row, 1);
}

function appendRedToActive_(sheet, r) {
  const row = new Array(35).fill('');
  row[0] = clean_(r[0]);
  row[1] = clean_(r[1]);
  row[2] = clean_(r[2]);
  row[4] = 'TAKİP';
  row[5] = clean_(r[5]);
  row[6] = clean_(r[6]);
  row[7] = clean_(r[7]);
  row[8] = clean_(r[9]);
  row[9] = clean_(r[10]);
  row[10] = clean_(r[11]);
  row[11] = clean_(r[12]);
  row[12] = clean_(r[8]);
  row[20] = clean_(r[13]);
  row[21] = clean_(r[3]);
  row[22] = clean_(r[4]);
  appendDataRow_(sheet, row, 2);
}

function appendDataRow_(sheet, row, headerRowNumber) {
  const target = Math.max(sheet.getLastRow() + 1, headerRowNumber + 1);
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
}

function findRowByValue_(sheet, column, wanted, startRow) {
  if (!sheet || !wanted) return 0;
  const last = sheet.getLastRow();
  if (last < startRow) return 0;
  const vals = sheet.getRange(startRow, column, last - startRow + 1, 1).getDisplayValues();
  for (let i = 0; i < vals.length; i++) {
    if (clean_(vals[i][0]) === clean_(wanted)) return startRow + i;
  }
  return 0;
}

function findPersonRow_(sheet, tc, name, nameCol, tcCol, startRow) {
  if (!sheet) return 0;
  const last = sheet.getLastRow();
  if (last < startRow) return 0;

  const width = Math.max(nameCol, tcCol);
  const vals = sheet.getRange(startRow, 1, last - startRow + 1, width).getDisplayValues();
  const tcN = normalizeTc_(tc);
  const nameN = normalizeText_(name);

  for (let i = 0; i < vals.length; i++) {
    if (tcN && normalizeTc_(vals[i][tcCol - 1]) === tcN) return startRow + i;
  }
  for (let i = 0; i < vals.length; i++) {
    if (nameN && normalizeText_(vals[i][nameCol - 1]) === nameN) return startRow + i;
  }
  return 0;
}

// -------------------- PDF / DRIVE --------------------

function savePdf_(folderId, fileObj, tc, name, category, user) {
  if (!fileObj || !fileObj.base64) throw new Error('PDF içeriği boş.');
  if (clean_(fileObj.mimeType) !== 'application/pdf') throw new Error('Yalnızca PDF dosyası kabul edilir.');

  const bytes = Utilities.base64Decode(fileObj.base64);
  if (!bytes.length) throw new Error('PDF içeriği boş.');

  // Sunucu tarafı uygulama sınırı: 8 MB
  if (bytes.length > 8 * 1024 * 1024) throw new Error('PDF 8 MB sınırını aşıyor.');

  const folder = DriveApp.getFolderById(folderId);
  const stamp = Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyyMMdd-HHmmss');
  const filename = sanitizeFilename_([
    category,
    normalizeTc_(tc),
    clean_(name),
    stamp,
    clean_(fileObj.name) || 'belge.pdf'
  ].filter(Boolean).join('_'));

  const blob = Utilities.newBlob(bytes, 'application/pdf', filename);
  const file = folder.createFile(blob);
  file.setDescription(
    'GIH Aile Takip Otomasyonu\n' +
    'Aile: ' + clean_(name) + '\n' +
    'TC: ' + clean_(tc) + '\n' +
    'Kategori: ' + category + '\n' +
    'Yükleyen: ' + clean_(user)
  );
  return file;
}

// -------------------- EXTERNAL ASSISTANCE PARSER --------------------

function parseExternalAssistance_(rows) {
  if (!rows || !rows.length) return [];

  let header = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const norm = (rows[i] || []).map(normalizeText_);
    if (norm.some(x => x.includes('TC')) && norm.some(x => x.includes('AD'))) {
      header = i;
      break;
    }
  }
  if (header < 0) throw new Error('Yardım tablosunda AD SOYAD ve TC başlıkları bulunamadı.');

  const h = (rows[header] || []).map(normalizeText_);
  const idx = function(patterns) {
    return h.findIndex(x => patterns.some(p => x.includes(p)));
  };

  const iName = idx(['AD SOYAD', 'AD-SOYAD', 'ISIM']);
  const iTc = idx(['TC KIMLIK', 'TCKN', 'TC NO', 'TC']);
  const iDate = idx(['YARDIM TARIH', 'TARIH']);
  const iContent = idx(['YARDIM ICER', 'YARDIM TUR', 'YARDIM', 'ICERIK']);
  const iValue = idx(['RAYIC', 'BEDEL', 'TUTAR']);
  const iPdf = idx(['TUTANAK', 'PDF', 'BELGE']);

  const out = [];
  for (let r = header + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = iName >= 0 ? clean_(row[iName]) : '';
    const tc = iTc >= 0 ? clean_(row[iTc]) : '';
    if (!name && !tc) continue;

    out.push({
      name: name,
      tc: tc,
      date: iDate >= 0 ? clean_(row[iDate]) : '',
      content: iContent >= 0 ? clean_(row[iContent]) : '',
      marketValue: iValue >= 0 ? clean_(row[iValue]) : '',
      pdfUrl: iPdf >= 0 ? clean_(row[iPdf]) : ''
    });
  }
  return out;
}

function assistanceSignature_(tc, date, content, value, url) {
  return [normalizeTc_(tc), clean_(date), normalizeText_(content), clean_(value), clean_(url)].join('|');
}

// -------------------- HELPERS --------------------

function withWriteLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function logAction_(user, action, tc, name, detail) {
  ensureSystemSheets_();
  getDb_().getSheetByName(GIH.SHEETS.LOG).appendRow([
    new Date(), clean_(user), clean_(action), clean_(tc), clean_(name), clean_(detail)
  ]);
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    const v = (b + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function normalizeUsername_(v) {
  return clean_(v).toLowerCase();
}

function normalizeTc_(v) {
  return clean_(v).replace(/\D/g, '');
}

function normalizeText_(v) {
  return clean_(v)
    .toLocaleUpperCase('tr-TR')
    .replace(/[ÇĞİÖŞÜ]/g, function(c) {
      return ({'Ç':'C','Ğ':'G','İ':'I','Ö':'O','Ş':'S','Ü':'U'})[c];
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function extractId_(value) {
  const s = clean_(value);
  if (!s) return '';
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) ||
            s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
            s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

function sanitizeFilename_(name) {
  let s = clean_(name).replace(/[\\/:*?"<>|#%{}~]/g, '_').replace(/\s+/g, ' ');
  if (!/\.pdf$/i.test(s)) s += '.pdf';
  return s.substring(0, 180);
}
