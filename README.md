# Doot — ফ্রি-টিয়ার AI চ্যাট ও Android PWA

Doot হলো একটি installable web app। এটি APK নয়; HTTPS-এ publish করার পর Android Chrome থেকে **Install app / Add to Home screen** দিয়ে ইনস্টল করা যাবে। চ্যাট চালাতে ইন্টারনেট প্রয়োজন।

## সম্পূর্ণ ফ্রি রাখার সেটআপ

- **AI:** Google Gemini API Free Tier ব্যবহার করে। Free tier-এ নির্দিষ্ট মডেল ও usage quota আছে; quota শেষ হলে অপেক্ষা করতে হবে। Unlimited free AI-এর নিশ্চয়তা নেই।
- **Hosting:** Cloudflare-এর Free plan-এ deploy করা যাবে; hosting/worker limits প্রযোজ্য।
- **No paid fallback:** অ্যাপ নিজে থেকে কোনো paid provider-এ switch করবে না। Billing/payment method যোগ করবেন না।
- Gemini Free Tier-এর availability Google account/project অনুযায়ী বদলাতে পারে। Free tier না দেখালে paid billing চালু করবেন না; থামুন।

Google-এর free-tier request data product improvement-এর জন্য ব্যবহৃত হতে পারে। সংবেদনশীল বা গোপন তথ্য পাঠাবেন না।

## Gemini API key তৈরি

1. Google AI Studio খুলুন: https://aistudio.google.com/apikey
2. API key তৈরি করুন এবং নিশ্চিত করুন project-এ **Free Tier** access আছে।
3. key শুধু server-side environment secret হিসেবে দিন: `GEMINI_API_KEY`।
4. key কখনো frontend code, GitHub commit, chat message, বা `VITE_` variable-এ রাখবেন না।

লোকাল development-এর জন্য `.env.example` কপি করে `.env` বানান, তারপর নিজের key দিন। `.env` commit করবেন না।

## চালানো ও যাচাই

প্রয়োজন: Node.js 22.12+ এবং Bun।

```sh
bun install
bun run dev
```

পরীক্ষা ও production build:

```sh
bun run test
bun run build
```

Default mode-এ প্রতিটি user message-এর জন্য একটি model call হয়, যাতে free quota বাঁচে। `DOOT_MULTI_AGENT=true` দিলে দুইটি parallel reviewer/solver call ও একটি synthesis call হতে পারে—এতে quota দ্রুত শেষ হবে। সাধারণ ব্যবহারে এটি বন্ধ রাখুন।

## Android-এ install

Cloudflare-এ server-side app deploy করে HTTPS URL পাওয়ার পর Android Chrome-এ URL খুলুন → browser menu → **Install app** অথবা **Add to Home screen**। এখনো live deployment URL তৈরি হয়নি; শুধু repository branch থেকে app install করা যাবে না।

## Hosting

Cloudflare Free account ব্যবহার করে repository import ও server-side `GEMINI_API_KEY` secret configure করতে হবে। Static-only hosting যথেষ্ট নয়, কারণ `/api/chat` সার্ভারে চলে। Deployment config/build output যাচাই না করে deploy সফল হয়েছে বলা যাবে না।

## কোডের মূল ফাইল

- Chat UI: `src/routes/index.tsx`
- API route: `src/routes/api/chat.ts`
- Gemini provider: `src/lib/ai/gemini.ts`
- Multi-agent workflow: `src/lib/ai/orchestrator.ts`
- PWA manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`
