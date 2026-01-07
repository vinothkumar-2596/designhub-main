import Task from "../models/Task.js";
import { sendMessage } from "./notifications.js";

const formatDeadline = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

export const checkAndSendReminders = async () => {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find tasks that are pending or in_progress and have a deadline in the next 24 hours
        // and haven't been reminded yet (we might want a reminderSent flag)
        const tasks = await Task.find({
            status: { $in: ["pending", "in_progress"] },
            deadline: { $gt: now, $lt: tomorrow },
            reminderSent: { $ne: true } // Need to add this field to Task model
        });

        for (const task of tasks) {
            const remainingMs = new Date(task.deadline).getTime() - now.getTime();
            const remainingHours = Math.round(remainingMs / (1000 * 60 * 60));

            const recipients = [
                task.requesterPhone,
                ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
            ].filter((p) => p && p.trim() !== "");

            if (recipients.length === 0) continue;

            const body = `Reminder: Your DesignDesk task "${task.title}" is due in ${remainingHours} hours (${formatDeadline(task.deadline)}).`;

            console.log(`Sending reminder for task: ${task.title} to ${recipients.join(", ")}`);

            await Promise.all(recipients.map(to =>
                sendMessage({ to, body })
            ));

            // Mark as reminded so we don't spam
            task.reminderSent = true;
            await task.save();
        }
    } catch (error) {
        console.error("Reminder check failed:", error);
    }
};

export const startReminderService = (intervalMs = 3600000) => { // Default 1 hour
    console.log("Starting reminder service...");
    setInterval(checkAndSendReminders, intervalMs);
};
