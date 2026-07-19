# بوت تثبيت الروم الصوتي في Discord

> هذا المشروع يستخدم حساب Bot رسمي، وليس حساب Discord شخصي.

## 1) المتطلبات

- Node.js 24.17.0 أو أحدث.
- بوت منشأ من Discord Developer Portal.
- صلاحيتا View Channel و Connect داخل الروم الصوتي.

## 2) إعداد البوت

1. أنشئ Application من Discord Developer Portal.
2. افتح تبويب Bot ثم أنشئ Bot وانسخ Token.
3. من OAuth2 > URL Generator اختر:
   - Scope: bot
   - Permissions: View Channels و Connect
4. افتح الرابط الناتج وأضف البوت إلى السيرفر.

## 3) استخراج الأرقام

في Discord:
1. Settings > Advanced > فعّل Developer Mode.
2. اضغط بزر الفأرة الأيمن على السيرفر ثم Copy Server ID.
3. اضغط بزر الفأرة الأيمن على الروم الصوتي ثم Copy Channel ID.

## 4) تجهيز المشروع

1. غيّر اسم الملف `.env.example` إلى `.env`.
2. ضع التوكن وServer ID وVoice Channel ID داخل `.env`.
3. افتح Terminal في VS Code ونفّذ:

```bash
npm install
npm start
```

## التشغيل والإيقاف

- تشغيل: `npm start`
- إيقاف: اضغط `Ctrl + C`
- عند تشغيله يدخل البوت الروم تلقائيًا.
- إذا انفصل أو نُقل إلى روم آخر، يحاول الرجوع إلى الروم المحدد.
- إذا حُذف البوت من السيرفر، حُذف الروم، أو مُنعت عنه صلاحية Connect فلن يستطيع الرجوع حتى تُعاد الصلاحية أو الإضافة.

## حماية مهمة

لا ترسل ملف `.env` أو Bot Token لأي شخص. إذا انكشف التوكن، اعمل Reset Token فورًا من Developer Portal.
