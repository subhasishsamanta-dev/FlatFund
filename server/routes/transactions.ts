import { Request, Response } from "express";
import {
    sendDepositNotification,
    sendExpenseNotification,
} from "../services/notificationService";

export const handleCreateDeposit = async (req: Request, res: Response) => {
    try {
        const { userId, userName, amount } = req.body;

        // Here you would typically save the deposit to Firestore
        // For now, we'll just send the notification

        // Send notification to all users
        await sendDepositNotification(userId, userName, amount);

        res.status(201).json({
            success: true,
            message: "Deposit created and notifications sent"
        });
    } catch (error) {
        console.error("Error creating deposit:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create deposit"
        });
    }
};

export const handleCreateExpense = async (req: Request, res: Response) => {
    try {
        const { userId, userName, amount, category, type } = req.body;

        // Here you would typically save the expense to Firestore

        // Send notification to all users
        await sendExpenseNotification(userId, userName, amount, category, type);

        res.status(201).json({
            success: true,
            message: "Expense created and notifications sent"
        });
    } catch (error) {
        console.error("Error creating expense:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create expense"
        });
    }
};
