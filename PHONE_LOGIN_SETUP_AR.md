# تسجيل الدخول برقم الهاتف وكلمة المرور بدون SMS أو Twilio

## الفكرة
المستخدم يكتب رقم هاتفه المصري وكلمة المرور في شاشة MASTER PRINT. داخليًا يحوّل الموقع الرقم إلى بريد دخول اصطناعي ثابت على النطاق المحجوز `.invalid`، ثم يسجل الدخول عبر Supabase Email/Password. لا يتم إرسال رسائل SMS ولا نحتاج Twilio.

مثال حساب المدير:
- رقم الدخول في الموقع: `01094548787`
- البريد الداخلي الذي تنشئ به مستخدم Auth: `201094548787@login.masterprint.invalid`
- كلمة المرور: اختر كلمة مرور قوية بنفسك، ولا ترسلها في المحادثة.

## خطوات الإعداد

1. ارفع `index.html` ومجلد `cloud/` إلى GitHub مع الحفاظ على المسار `cloud/supabase-sync.js`.
2. تأكد أن `supabase-config.js` موجود بجانب `index.html` ويحتوي Project URL وPublishable key الصحيحين. لا تضع أبدًا `sb_secret` أو `service_role` في الموقع.
3. في Supabase افتح Authentication → Sign In / Providers. لا تحتاج إلى تفعيل Phone أو إعداد Twilio. اترك Email مفعّلًا، ويمكنك إيقاف Phone provider إذا لم تستخدم OTP لأي غرض آخر.
4. افتح Authentication → Users → Add user، وأنشئ مستخدمًا بالبريد الداخلي أعلاه وكلمة مرور قوية. اجعل Email Confirmed / Auto Confirm مفعّلًا إن ظهر الخيار؛ لأن البريد `.invalid` مخصص لتسجيل الدخول وليس لاستقبال الرسائل.
5. انسخ UUID للمستخدم من Authentication → Users.
6. إذا لم تشغّل مخطط قاعدة البيانات من قبل، افتح SQL Editor وشغّل كامل محتوى `supabase/schema.sql` أولًا.
7. استبدل `PUT_AUTH_USER_UUID_HERE` في الاستعلام التالي بالـ UUID الحقيقي، ثم شغّله في SQL Editor:

```sql
with new_company as (
  insert into public.companies(name)
  values ('MASTER PRINT')
  returning id
)
insert into public.profiles(id, company_id, full_name, role, is_active)
select
  'PUT_AUTH_USER_UUID_HERE'::uuid,
  id,
  'المهندس حسام عبد السلام محمد',
  'owner',
  true
from new_company
on conflict (id) do update
set full_name = excluded.full_name,
    role = 'owner',
    is_active = true;
```

8. قبل أول دخول سحابي، خذ نسخة احتياطية من بيانات الموقع من نفس المتصفح الذي يحتوي أحدث بياناتك. أول دخول ينشئ لقطة سحابية من بيانات هذا المتصفح إذا لم تكن هناك لقطة للشركة بعد.
9. افتح MASTER PRINT وسجّل الدخول بالرقم `01094548787` وكلمة المرور التي أنشأتها. لا تكتب البريد الاصطناعي في شاشة الموقع.

## إضافة الموظفين
لكل موظف أنشئ Auth user ببريد داخلي على نفس النمط: احذف الصفر الأول من رقم `01xxxxxxxxx` ثم أضف `20` في البداية، وبعدها `@login.masterprint.invalid`. مثال: `01012345678` يصبح `201012345678@login.masterprint.invalid`. بعد ذلك اربط UUID الموظف بصف في `profiles` مع نفس `company_id` ودوره المناسب.

إنشاء حسابات الموظفين من داخل الموقع بأمان يحتاج وظيفة خادمية (Edge Function) تستخدم Supabase Admin API. لا تضع Service Role Key في المتصفح.

## تنبيه
النسخة الحالية تحفظ بيانات ERP كملف JSON واحد في `app_state`، وهي مرحلة انتقالية. عند تعدد المستخدمين المتزامن، قد يكتب مستخدم فوق تحديث مستخدم آخر. قبل التشغيل الفعلي، يجب نقل الفواتير والمشتريات والمخزون والعملاء وأوامر التشغيل إلى جداول منفصلة بسياسات RLS لكل سجل.
