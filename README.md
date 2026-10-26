# Aurabelle

متجر فساتين جزائري مبني بـ Next.js App Router، مع واجهة عربية وفرنسية.

## التشغيل المحلي

1. ثبّت الحزم: `npm.cmd install`
2. إن لم يوجد `.env`، انسخ `.env.example` إليه.
3. أنشئ سرًا محليًا لـ `ADMIN_SESSION_SECRET` بطول 32 محرفًا على الأقل.
4. شغّل PostgreSQL باسم `aurabelle` وRedis: `docker compose up -d postgres redis`
5. طبّق الترحيلات: `npm.cmd exec prisma -- migrate dev --schema schema.prisma`
6. ولّد Prisma Client: `npm.cmd run prisma:generate`
7. ابدأ الموقع: `npm.cmd run dev`

اتصال قاعدة البيانات المحلية مضبوط في `.env` على `localhost:5432/aurabelle`. بيانات PostgreSQL محفوظة في volume مستقل اسمه `aurabelle_aurabelle_postgres_data`.

افتح `http://localhost:3000`؛ يحوّل المسار إلى اللغة العربية، ويمكن التبديل إلى `/fr`.

## الحالة الحالية

- تبويب العملاء في لوحة الإدارة يقرأ العملاء وسجل طلباتهم من Prisma عبر API محمية بتسجيل دخول.
- المنتجات تُحفظ في Prisma وتُنشر تلقائيًا على الرئيسية؛ الصور تُحفظ محليًا أثناء التطوير، وفي Vercel Blob عند النشر.
- صفحة الدفع ترسل الطلب إلى Prisma، وتنشئ/تحدّث العميل، وتحفظ عناصر الطلب وسجل الحالة وتحجز المخزون في معاملة واحدة.
- PostgreSQL وRedis يعملان عبر Docker، ومخطط Prisma مُطبّق على قاعدة `aurabelle`.
- `POST /api/orders` يتحقق من المتغير والمخزون، وينشئ الولاية والبلدية عند الحاجة. إذا لم توجد تعرفة مسجلة يستخدم `DEFAULT_HOME_DELIVERY_FEE` أو `DEFAULT_DESK_DELIVERY_FEE`.
- قبل النشر على Vercel، اربطي مخزن Vercel Blob بالمشروع لتهيئة `BLOB_READ_WRITE_TOKEN`؛ صور الرفع تحفظ هناك لتبقى متاحة بعد إعادة النشر.
- الطلبات والعملاء الجديدة تظهر في لوحة الإدارة بعد تسجيل الدخول.
- يلزم تهيئة بيانات شركات الشحن والتعرفة الدقيقة قبل استخدام أسعار توصيل إنتاجية.
- مصادقة الإدارة وWhatsApp وشركات التوصيل وMeta لم تُربط بخدمات فعلية.

شغّل `npm.cmd run lint` و`npm.cmd run build` للتحقق من المشروع.