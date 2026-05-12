import { Request, Response } from "express";
import {
    sendSharedBillNotification,
} from "../services/notificationService";

export const handleCreateBill = async (req: Request, res: Response) => {
    try {
        const { userId, userName, billTitle, amount, perMemberShare } = req.body;

        // Here you would typically save the bill to Firestore

        // Send notification to all members
        await sendSharedBillNotification(userId, userName, billTitle, amount, perMemberShare);

        res.status(201).json({
            success: true,
            message: "Bill created and notifications sent"
        });
    } catch (error) {
        console.error("Error creating bill:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create bill"
        });
    }
};
