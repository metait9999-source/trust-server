const cron = require("node-cron");
const subscriptionModel = require("../models/arbitrageSubscription.model");

// Validate expression
if (!cron.validate("0 0 * * *")) {
  console.error("[Arbitrage Cron] ❌ Invalid cron expression");
  process.exit(1);
}

console.log("[Arbitrage Cron] ✅ Registered — runs daily at 00:00");

// Runs every day at 00:00
cron.schedule("0 0 * * *", async () => {
  console.log(
    "[Arbitrage Cron] Starting daily payout:",
    new Date().toISOString(),
  );

  try {
    const dueSubs = await subscriptionModel.getActiveDue();
    console.log(
      `[Arbitrage Cron] ${dueSubs.length} subscription(s) to process`,
    );

    if (dueSubs.length === 0) {
      console.log("[Arbitrage Cron] Nothing to process. Exiting.");
      return;
    }

    for (const sub of dueSubs) {
      try {
        const { interest, principal, isComplete } =
          await subscriptionModel.processPayout(sub.id);

        if (isComplete) {
          console.log(
            `[Arbitrage Cron] Sub #${sub.id} COMPLETED\n` +
              `  User: ${sub.user_id} | Coin: ${sub.coin_id}\n` +
              `  Interest credited : +${interest}\n` +
              `  Principal returned: +${principal}`,
          );
        } else {
          console.log(
            `[Arbitrage Cron] Sub #${sub.id} → ` +
              `+${interest} ${sub.coin_id} credited to user #${sub.user_id}`,
          );
        }
      } catch (err) {
        console.error(`[Arbitrage Cron] Sub #${sub.id} FAILED:`, err.message);
      }
    }

    console.log("[Arbitrage Cron] Done:", new Date().toISOString());
  } catch (err) {
    console.error("[Arbitrage Cron] Fatal error:", err.message);
  }
});
