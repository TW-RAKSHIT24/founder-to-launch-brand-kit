# Founder-to-Launch AI Brand Kit

Founder ke short interview se ek usable brand direction tak. App Next.js App Router mein hai; browser workflow progress ko versioned `localStorage` mein save karta hai. Koi login, database, ya Azure-managed service required nahi hai.

## Run locally

Node.js 20.9+ required hai. Sample mode bina credentials ke chalta hai.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Production build ke liye `npm run build`, checks ke liye `npm run typecheck`, `npm run lint`, aur `npm test` chalayein.

## Provider mode

Default mode `mock` hai. Generated content UI mein sample output ke roop mein mark hota hai; mock mode deterministic hai aur kisi API key ki zaroorat nahi.

Live brand generation aur consistency checks ke liye `.env.example` ko `.env.local` mein copy karke values set karein:

```dotenv
BRAND_KIT_MODE=live
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com
OPENAI_MODEL=gpt-4.1-mini
PROVIDER_TIMEOUT_MS=20000
```

Credentials sirf server environment mein rakhein. Live provider failure, timeout, refusal, ya incomplete output error return karta hai; silent mock fallback nahi hota. Anti-Generic phrase matching dono modes mein deterministic rehta hai.

## API examples

`POST /api/generate-brands`:

```json
{
	"founderData": {
		"startupName": "Lecture Loop",
		"customer": "college students revisiting class notes",
		"problem": "turning fast lectures into useful notes",
		"personality": "curious, calm, and playful",
		"inspirations": ["field guides"]
	}
}
```

Agla request generation response ke kisi ek `brands` item ko `selectedBrand` mein use karta hai:

- `POST /api/refine-brand`: `{ "founderData": ..., "selectedBrand": ... }`
- `POST /api/check-consistency`: `{ "founderData": ..., "selectedBrand": ..., "messaging": ... }`

Har request aur response shared Zod contracts se validate hota hai. Invalid requests aur provider errors stable `{ "error": { "code", "message" } }` shape mein aate hain.

## Current scope

Ek deployable Next.js app mein UI aur teen route handlers hain. Database migrations, seed data, authentication, payments, logo generation, aur Azure resources is approved scope ka hissa nahi hain.


live demo link:https://brand-kit-neon-two.vercel.app