import { runDailyWalletRevalidation } from './pinkChat';

const DAY_MS = 24 * 60 * 60 * 1000;

export const startPinkChatDailyScheduler = () => {
  const intervalMs = Math.max(60 * 60 * 1000, Number(process.env.PINK_CHAT_REVALIDATE_INTERVAL_MS || DAY_MS));
  const timer = setInterval(() => {
    runDailyWalletRevalidation().catch((err) => {
      console.error('[PinkChat] Daily revalidation failed:', err);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
};

