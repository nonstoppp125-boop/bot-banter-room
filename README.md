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

বর্তমান চ্যাট Groq-এর OpenAI-compatible API ব্যবহার করে; default model `openai/gpt-oss-20b`। চাইলে Worker environment-এ `GROQ_MODEL` দিয়ে model override করা যায়; single-agent ও multi-agent—দুই mode-এই একই model ব্যবহৃত হয়। AI চালাতে Cloudflare Worker-এর server-side environment-এ `GROQ_API_KEY` secret configure করুন। ঐচ্ছিকভাবে `DOOT_MULTI_AGENT=true` দিলে Problem Solver ও Quality Reviewer specialist চালু হবে; অন্য যেকোনো মানে single-agent mode থাকবে। `.env.example`-এ শুধু variable names আছে, কোনো secret নেই। বাস্তব key কখনো commit করবেন না, client-side code-এ রাখবেন না বা `VITE_` prefix দেবেন না। Groq account access, model availability ও provider limits প্রযোজ্য।

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

### Chat API rate limiting

Cloudflare Worker-এর `CHAT_RATE_LIMITER` binding বাধ্যতামূলক; binding অনুপস্থিত বা ব্যর্থ হলে API fail-closed হয়ে `503` দেয়। `wrangler.json`-এ প্রতি IP-তে প্রতি ৬০ সেকেন্ডে ৩০টি request-এর proposed configuration আছে। Deploy-এর আগে `namespace_id` নিজের Cloudflare account-এ unique কি না যাচাই করতে হবে এবং Worker-এ binding কার্যকর আছে কি না পরীক্ষা করতে হবে। Cloudflare-এর এই limit approximate এবং location-local; shared IP-তে একাধিক user একই limit ভাগ করতে পারে। API request body সর্বোচ্চ ১ MiB, প্রতি text part সর্বোচ্চ ২০,০০০ characters এবং পুরো conversation-এর text সর্বোচ্চ ১,০০,০০০ characters।\n\n

### Optional live web research

Set `TAVILY_API_KEY` as a server-side Cloudflare Worker secret to enable live
web search for research-routed requests. Without the key, chat continues using
the existing evidence-only research behavior. Search failures do not interrupt
chat. Retrieved pages are untrusted evidence; source URLs and publication dates
must be preserved, and factual claims should be cited. Never expose the key in
client-side variables or logs.
