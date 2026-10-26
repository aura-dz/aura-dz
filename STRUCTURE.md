# هيكل المشروع | robes-store

```
robes-store/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                      # بيانات أولية: 58 ولاية، البلديات، الإعدادات، مدير
│   └── data/
│       ├── wilayas.json
│       ├── communes.json
│       └── provider-codes/          # ترميز الولايات/البلديات لكل شركة توصيل
│
├── src/
│   ├── app/
│   │   ├── [locale]/                # ar | fr  (next-intl)
│   │   │   ├── layout.tsx           # dir=rtl للعربية + Pixel
│   │   │   ├── page.tsx             # الرئيسية
│   │   │   ├── shop/page.tsx        # الكتالوج + الفلاتر
│   │   │   ├── category/[slug]/page.tsx
│   │   │   ├── product/[slug]/page.tsx   # صفحة المنتج + نموذج الطلب
│   │   │   ├── cart/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── order/[token]/page.tsx    # تأكيد الطلب من الموقع / تتبع
│   │   │   ├── thank-you/page.tsx
│   │   │   └── (pages)/{about,contact,returns,privacy,terms}/page.tsx
│   │   │
│   │   ├── admin/                   # لوحة التحكم (محمية)
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx             # الإحصائيات
│   │   │   ├── orders/page.tsx
│   │   │   ├── orders/[id]/page.tsx
│   │   │   ├── products/...         # إضافة/تعديل منتجات ومتغيرات
│   │   │   ├── inventory/page.tsx
│   │   │   ├── shipments/page.tsx
│   │   │   ├── customers/page.tsx   # + القائمة السوداء
│   │   │   ├── delivery-rates/page.tsx
│   │   │   ├── messages/page.tsx    # سجل واتساب
│   │   │   └── settings/page.tsx
│   │   │
│   │   └── api/
│   │       ├── orders/route.ts                  # إنشاء طلب
│   │       ├── orders/confirm/route.ts          # تأكيد من الموقع (token/OTP)
│   │       ├── delivery/rates/route.ts
│   │       ├── locations/{wilayas,communes}/route.ts
│   │       ├── feeds/facebook/route.ts          # feed كتالوج Facebook (XML/CSV)
│   │       ├── webhooks/
│   │       │   ├── whatsapp/route.ts            # استقبال الردود وحالات الرسائل
│   │       │   ├── meta/route.ts                # Messenger/Instagram (لاحقاً)
│   │       │   └── delivery/[provider]/route.ts # تحديثات الشحن
│   │       └── cron/
│   │           ├── sync-shipments/route.ts      # كل 30 دقيقة
│   │           └── order-reminders/route.ts     # تذكير غير المؤكدين
│   │
│   ├── components/
│   │   ├── ui/                      # أزرار، حقول، نوافذ
│   │   ├── layout/                  # Header, Footer, LangSwitcher, TrustBar
│   │   ├── product/                 # Gallery, SizeGuide, VariantPicker, StickyOrderBar
│   │   ├── checkout/                # OrderForm, WilayaCommuneSelect
│   │   └── admin/
│   │
│   ├── lib/
│   │   ├── db.ts                    # Prisma client
│   │   ├── env.ts                   # التحقق من المتغيرات (zod)
│   │   ├── auth.ts                  # جلسات الإدارة
│   │   ├── phone.ts                 # توحيد أرقام الهاتف الجزائرية → +213
│   │   ├── order-number.ts
│   │   ├── rate-limit.ts
│   │   │
│   │   ├── services/
│   │   │   ├── order.service.ts     # إنشاء الطلب، حجز المخزون، تغيير الحالة
│   │   │   ├── confirmation.service.ts
│   │   │   ├── shipping.service.ts  # اختيار الشركة وإنشاء الشحنة
│   │   │   ├── inventory.service.ts
│   │   │   └── blacklist.service.ts
│   │   │
│   │   ├── delivery/                # طبقة المحوّلات (Adapters)
│   │   │   ├── types.ts             # interface DeliveryProvider
│   │   │   ├── registry.ts
│   │   │   ├── yalidine.ts
│   │   │   ├── zr-express.ts
│   │   │   ├── maystro.ts
│   │   │   └── ecotrack.ts
│   │   │
│   │   ├── whatsapp/
│   │   │   ├── client.ts            # WhatsApp Cloud API
│   │   │   ├── templates.ts         # order_confirmation, reminder, shipped, out_for_delivery
│   │   │   └── verify-signature.ts
│   │   │
│   │   ├── meta/
│   │   │   ├── pixel.ts             # أحداث المتصفح
│   │   │   ├── capi.ts              # Conversions API (SHA-256 للبيانات)
│   │   │   └── catalog-feed.ts
│   │   │
│   │   └── queue/
│   │       ├── queues.ts            # BullMQ + Redis
│   │       └── workers/{whatsapp,shipment,meta-event}.worker.ts
│   │
│   ├── messages/{ar,fr}.json        # الترجمات
│   ├── styles/globals.css
│   └── middleware.ts                # اللغة + حماية /admin
│
├── tests/
│   ├── order-flow.test.ts
│   ├── phone.test.ts
│   ├── delivery-adapters.test.ts    # باستعمال mocks
│   └── webhook-signature.test.ts
│
├── docker-compose.yml               # postgres + redis
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## متغيرات البيئة (`.env.example`)

```
DATABASE_URL=
REDIS_URL=
NEXT_PUBLIC_SITE_URL=
ADMIN_SESSION_SECRET=

# Meta
NEXT_PUBLIC_META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_APP_SECRET=
META_TEST_EVENT_CODE=

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=

# Delivery
YALIDINE_API_ID=
YALIDINE_API_TOKEN=
ZR_EXPRESS_TOKEN=
ZR_EXPRESS_KEY=
MAYSTRO_API_KEY=
ECOTRACK_API_TOKEN=

CRON_SECRET=
```

## ملاحظات تصميمية مهمة

1. **المبالغ بالدينار كأعداد صحيحة (Int)** لتفادي أخطاء الفاصلة العشرية.
2. **OrderItem يحفظ نسخة ثابتة** من الاسم والسعر والتكلفة، فتعديل المنتج لاحقاً لا يغيّر الطلبات القديمة.
3. **حجز المخزون (`reserved`)** عند الطلب، ثم خصم نهائي عند التسليم، وتحرير عند الإلغاء. وكل حركة مسجلة في `StockMovement`.
4. **`confirmToken`** يسمح بتأكيد الطلب من رابط الموقع في رسالة واتساب دون حساب.
5. **حقول `fbp` و`fbc` وعنوان IP وUserAgent** تُحفظ مع الطلب لإرسال حدث `Purchase` الدقيق إلى CAPI لاحقاً عند التسليم.
6. **ترميز الولايات/البلديات** منفصل لكل شركة (`ProviderWilayaCode`)، لأن رموزها تختلف.
7. **`ProviderAccount.credentials`** يجب تشفيرها، أو إبقاء المفاتيح في متغيرات البيئة فقط.
8. **قائمة الولايات والبلديات** (58 ولاية) تُحمَّل من ملفات JSON في `seed.ts`. تأكد من حداثة القائمة الرسمية، فقد تغيّر عدد الولايات في السنوات الأخيرة.

## الأوامر الأولى

```bash
npx create-next-app@latest robes-store --typescript --tailwind --app
cd robes-store
npm i prisma @prisma/client zod next-intl bullmq ioredis
npx prisma init
# انسخ schema.prisma إلى prisma/ ثم:
npx prisma migrate dev --name init
npx prisma db seed
```
