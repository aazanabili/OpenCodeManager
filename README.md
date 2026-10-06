# OpenCode Manager

**لوحة تحكم محلية لإعدادات [OpenCode](https://opencode.ai) V2 — تعمل في المتصفح بدون سيرفر.**

Arabic-first UI (RTL). Reads and writes your OpenCode configuration files **directly on your own machine**.
No backend, no build step, no npm install, no telemetry, no network calls.

---

## ما الذي تفعله هذه الأداة؟

تغطي **كل** خصائص OpenCode V2 الموثّقة في <https://opencode.ai/v2/docs>:

| القسم | ما يمكن التحكم به |
|---|---|
| **عام** | `model` · `default_agent` · `shell` · `username` · `update` · `share` · `snapshots` · `watcher.ignore` · `tool_output` · `media.image` · `websearch` · `compaction` · `warming` · `worktree` · `experimental.portable_shell_scanner` |
| **الوكلاء** | CRUD كامل · `mode` (primary/subagent/all) · البرومبت · النموذج و`#variant` · `steps` · `color` · `hidden` · `disabled` · `request.headers/body` · تجاوز الوكلاء المدمجين · استيراد/تصدير كـ `.md` |
| **صلاحيات الوكيل** | جدول قواعد مرتّب مع شرح **أي الوكلاء الفرعية يستطيع إطلاقها** لكل وكيل |
| **الصلاحيات العامة** | `permissions[]` مرتّبة · قوالب جاهزة · شرح دلالات `*` و `?` · الماسح المحمول |
| **السياسات** | `experimental.policies[]` مع جدول أولوية التطابق الكامل |
| **خوادم MCP** | محلي (stdio) وبعيد (Streamable HTTP) · `command` · `cwd` · `environment` · `url` · `headers` · OAuth snake_case · `codemode` · `protocol` · `disabled` · تجاوز المهلات |
| **المزوّدون والنماذج** | `name` · `env` · `package` · `canonical` · `settings` · `headers` · `body` · `models` مع `modelID` · `limit` · `cost` · `capabilities` · `compatibility` · `variants` |
| **المهارات** | مصادر إضافية (مسارات و روابط) · إنشاء وتحرير ملفات `SKILL.md` |
| **الأوامر** | `template` · `$ARGUMENTS` · `$1 $2` · `agent` · `model` · `subagent` · ملفات `.md` |
| **الإضافات** | `plugins[]` مع تفعيل/تعطيل عبر `-` و `*` و `.*` · خيارات الكائن · إضافات الطرفية |
| **المُنسِّقات** | تفعيل المدمج · تعطيل أي منسّق · تخصيص `command` و `extensions` و `environment` · منسّقات مخصّصة |
| **الثيمات** | اختيار الثيم المدمج · `theme.mode` · تحرير ثيمات مخصّصة |
| **المراجع** | مسارات محلية ومستودعات Git مع `branch` و `commit` و `visibility` |
| **التعليمات** | `AGENTS.md` بمعاينة · حقل `instructions` |
| **cli.json** | المظهر · الإدخال · الجلسات · التبويبات · الفروق · التنبيهات · الطرفية · mini · اختصارات المفاتيح · التشخيص والتجارب |
| **محرر JSON** | تحرير كامل لأي حقل غير معروض · تحقق بالأسطر · تنسيق · نسخ احتياطي |

---

## التشغيل

### الطريقة الأسرع

انقر نقراً مزدوجاً على `index.html`. هذا كل شيء.

الملفات تُحمَّل كسكربتات كلاسيكية (وليست ES modules) تحديداً حتى يعمل التطبيق من
بروتوكول `file://` دون أي سيرفر.

### المجلدات التي يمكنك فتحها

| الغرض | المسار |
|---|---|
| الإعدادات العامة | `~/.config/opencode/` |
| جذر مشروع | مجلد المشروع (يقرأ `opencode.json(c)` و `.opencode/`) |

عند الربط، تكتشف الأداة تلقائياً:

```
opencode.jsonc · opencode.json · .opencode/opencode.json(c) · cli.json
agents/ · skills/ · commands/ · themes/ · plugins/ · AGENTS.md
```

وتحفظ إلى المسار الأصلي الذي قرأت منه. كل حفظ ينشئ نسخة `‎.backup` بجانب الملف.

### المتصفحات

| المتصفح | قراءة/كتابة مباشرة على القرص | ملاحظات |
|---|---|---|
| Chrome / Edge / Opera | ✅ | `File System Access API` متاح من `file://` |
| Firefox / Safari | ⚠️ | استخدم **استيراد** و **تصدير** |

بلا ربط: اضغط **استيراد** لاختيار ملف، عدّل، ثم **تصدير** لتنزيله.

---

## اختصارات

| الاختصار | الوظيفة |
|---|---|
| `Ctrl + S` | حفظ |
| `Ctrl + Z` | تراجع |
| `Ctrl + Shift + Z` / `Ctrl + Y` | إعادة |
| `Esc` | إغلاق النافذة المنبثقة |

---

## بنية المشروع

```
index.html                 الهيكل والتبويبات
assets/styles.css          نظام التصميم (RTL، وضع داكن)
js/
  util.js                  مساعدات DOM + get/set/ensure على الكائنات
  jsonc.js                 محرك JSONC + front-matter (YAML مبسّط)
  store.js                 الحالة + كتالوج ثوابت التوثيق + undo/redo
  fs.js                    طبقة نظام الملفات (File System Access API)
  form.js                  مكوّنات النماذج المشتركة
  views-core.js            عام · الوكلاء · الصلاحيات · السياسات
  views-content.js         المهارات · الأوامر · الإضافات · المنسّقات · الثيمات · المراجع · التعليمات
  views-infra.js           MCP · المزوّدون · محرر JSON
  views-cli.js             كل أقسام cli.json
  main.js                  التوجيه والتنقل والربط والحفظ
examples/                  ملفات نموذجية
tools/test-jsonc.js        39 اختباراً لمحرك JSONC
```

لا توجد أي تبعيات وقت التشغيل. Scripts كلاسيكية داخل مساحة `window.OCM`.

---

## اختبارات

```bash
node tools/test-jsonc.js
```

يغطي: القواعد والتعليقات والفواصل النهائية، وإرجاع التعليقات إلى مواقعها الأصلية،
وثبات المخرجات عند التكرار (idempotence)، و front-matter متداخل القوائم، وأرقام أسطر الأخطاء.

---

## قرارات تصميم تستحق الذكر

1. **التعليقات لا تُفقد.** المحرك يتتبع موضع كل تعليق (قبل مفتاح، أو في نهاية سطر قيمة).
   عند الحفظ يعود كل تعليق إلى موضعه، والتعليقات التي يفقد مرساها عند تحرير البنية تُلحق
   في نهاية الملف بدل أن تضيع.
2. **`formatters: true` مقابل كائن.** `true` يعيد المدمج للحالة الأصلية؛ `{}` يرث ما هو موروث.
   الأداة تحترم هذا الفرق بدل معاملتهما كشيء واحد.
3. **ترتيب الصلاحيات محسوب لا مفترض.** تعرض الأداة لكل وكيل جملة صريحة
   («يُسمح له بكل الوكلاء الفرعيين ما عدا: general») محسوبة بقواعد OpenCode نفسها،
   بما فيها أن النمط المنتهي بـ `" *"` يطابق الأمر بلا وسائط.
4. **مخطط JSON المنشور يتأخر عن توثيق V2.** `opencode.ai/config.json` المنشور ما زال يصف
   حقول V1 (`permission`, `maxSteps`, `agent`). الأداة تتبع **التوثيق**، ومحرر JSON الخام
   يغطي أي فارق.

---

## تنبيهات

- ⚠️ `shell` ينفَّذ بصلاحيات نظامك كاملة. استخدم قائمة سماح ضيّقة بدلاً من أنماط تحاول التعرّف
  على كل أمر خطر.
- ⚠️ `session.permissions: "autoaccept"` في `cli.json` يقبل كل طلبات الصلاحية تلقائياً.
- ⚠️ راجع قواعد `shell` و `edit` قبل وضع `deny` أو `allow` على نطاق واسع — الترتيب مهم:
  **آخر قاعدة مطابقة تفوز**.
- الأداة لا تتصل بالإنترنت، لكنها تعرض روابط التوثيق؛ الضغط عليها يفتح الموقع.

---

## الترخيص

MIT