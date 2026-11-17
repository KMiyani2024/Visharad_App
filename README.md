This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Visharad Games

The Games section includes a Visharad Wordle based on the study texts. Game answers 
stay on the server and are revealed after the player solves the puzzle or uses all
six guesses. The signed game-progress cookie uses the app's existing `AUTH_SECRET`.

### Daily BAPS/Hinduism Words

Starting today, each day features a unique 5-letter word related to BAPS, Hinduism,
or Swaminarayan theology. The word is:
- **Randomly selected** from a curated list of ~20 spiritual terms
- **Daily unique** - changes at UTC midnight each day
- **Persistent within a day** - the same word appears all day until UTC midnight

Word examples include: SHAKTI, SANSAR, PREMA, BHAKTI, AMRIT, JNANA, SATYA, GIRIJA, and more.
