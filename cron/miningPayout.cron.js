const cron = require("node-cron");
const subscriptionModel = require("../models/miningSubscription.model");

if (!cron.validate("0 0 * * *")) {
  console.error("[Mining Cron] Invalid cron expression");
  process.exit(1);
}

console.log("[Mining Cron] ✅ Registered — runs daily at 00:00");

cron.schedule("0 0 * * *", async () => {
  console.log("[Mining Cron] Starting daily payout:", new Date().toISOString());
  try {
    const dueSubs = await subscriptionModel.getActiveDue();
    console.log(`[Mining Cron] ${dueSubs.length} subscription(s) to process`);

    if (dueSubs.length === 0) {
      console.log("[Mining Cron] Nothing to process.");
      return;
    }

    for (const sub of dueSubs) {
      try {
        const { interest, principal, isComplete } =
          await subscriptionModel.processPayout(sub.id);
        if (isComplete) {
          console.log(
            `[Mining Cron] Sub #${sub.id} COMPLETED → interest: +${interest}, principal: +${principal}`,
          );
        } else {
          console.log(
            `[Mining Cron] Sub #${sub.id} → interest: +${interest} USDT`,
          );
        }
      } catch (err) {
        console.error(`[Mining Cron] Sub #${sub.id} FAILED:`, err.message);
      }
    }
    console.log("[Mining Cron] Done:", new Date().toISOString());
  } catch (err) {
    console.error("[Mining Cron] Fatal error:", err.message);
  }
});
