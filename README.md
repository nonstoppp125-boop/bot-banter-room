# Doot — সম্পাদনাযোগ্য ওয়েব অ্যাপ

এই ZIP-এ অ্যাপের সম্পূর্ণ সম্পাদনাযোগ্য সোর্স কোড, ছবি ও প্রয়োজনীয় সেটিংস আছে। এটি Android APK বা iPhone IPA নয়; ZIP সরাসরি ফোনে ইনস্টল হবে না।

## ফোনে অ্যাপ হিসেবে যোগ করা

প্রথমে Lovable থেকে অ্যাপটি Publish করতে হবে; এই প্যাকেজ তৈরি করার সময় অ্যাপ প্রকাশ করা হয়নি। প্রকাশিত HTTPS লিংক খুলুন:

- Android: Chrome মেনু → Add to Home screen / Install app (ব্রাউজারভেদে নাম আলাদা হতে পারে)।
- iPhone: Safari → Share → Add to Home Screen।

হোম স্ক্রিনে Doot আইকন থাকবে; সেখান থেকে আলাদা অ্যাপের মতো খুলতে পারবেন। ইন্টারনেট প্রয়োজন, অফলাইনে চ্যাট চলবে না। এটি App Store/Play Store প্যাকেজ নয়।

## নিজের কম্পিউটারে চালানো

বর্তমান সমর্থিত Node.js (22.12+ বা নতুন LTS) ও Bun ইনস্টল করুন। ZIP খুলে `doot-source` ফোল্ডারে টার্মিনাল খুলুন:

```sh
bun install
bun run dev
```

টার্মিনালে দেখানো লোকাল লিংক ব্রাউজারে খুলুন। যাচাই করতে `bun run test`, আর হোস্ট করার ফাইল তৈরি করতে `bun run build`।

## AI চালানোর গুরুত্বপূর্ণ শর্ত

বর্তমান চ্যাট Lovable AI Gateway ব্যবহার করে। এই ZIP-এ কোনো গোপন API key দেওয়া হয়নি। নিজের সার্ভারে AI চালাতে gateway access-সহ `LOVABLE_API_KEY` সার্ভারের environment-এ সেট করতে হবে। লোকাল ব্যবহারে `.env.example` থেকে `.env` বানিয়ে নিজের key দিন। কখনো key প্রকাশ করবেন না বা `VITE_` দিয়ে রাখবেন না। শুধু কোড ডাউনলোড করলেই gateway access পাওয়া যায় না।

Key না থাকলে পেজ খুলবে, কিন্তু AI উত্তর দেবে না। AI ব্যবহার ও হোস্টিং সম্পূর্ণ বিনামূল্যে থাকার নিশ্চয়তা নেই; সংশ্লিষ্ট সেবার নিয়ম ও খরচ প্রযোজ্য।

বর্তমানে এটি আলাদা AI চ্যাট; আপনার আগের Telegram বট এখনো যুক্ত নয়।

## ডিজাইন ও কাজ পরিবর্তন

- মূল চ্যাট পেজ, নাম, শুরুর প্রশ্ন: `src/routes/index.tsx`
- রং, ফন্ট ও ডিজাইন: `src/styles.css`
- মেসেজ দেখানো: `src/components/ai-elements/message.tsx`
- মেসেজ লেখার বক্স: `src/components/ai-elements/prompt-input.tsx`
- AI অনুরোধ ও নির্দেশনা: `src/routes/api/chat.ts`
- AI সেবা সংযোগ: `src/lib/ai/responses.ts`
- ফোনের অ্যাপ নাম: `public/manifest.webmanifest`
- অ্যাপ আইকন: `public/icons/`
- পেজের সাধারণ তথ্য: `src/routes/__root.tsx`

VS Code বা যেকোনো কোড এডিটরে পরিবর্তন করতে পারবেন। পরিবর্তন ফোনে পৌঁছাতে আবার প্রকাশ করতে হবে। Lovable-এ পরিবর্তন চালিয়ে যেতে মূল প্রজেক্ট ব্যবহার করুন; GitHub সংযোগ দিয়েও সোর্স সংরক্ষণ করা যায়।

## হোস্টিং

এটি React 19, TypeScript, Tailwind CSS ও TanStack Start অ্যাপ। AI উত্তর দেওয়ার অংশ সার্ভারে চলে; শুধু static HTML hosting যথেষ্ট নয়। বর্তমান configuration Cloudflare-compatible output ব্যবহার করে; অন্য হোস্টে দিলে configuration বদলানো লাগতে পারে।

`node_modules`, generated build output, repository metadata ও গোপন environment files বাদ দেওয়া হয়েছে। `package.json` ও `bun.lock` থেকে dependency আবার ইনস্টল করা যাবে।
