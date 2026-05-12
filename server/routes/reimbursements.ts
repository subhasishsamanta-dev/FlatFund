import { Request, Response } from "express";
import {
    sendReimbursementRequestNotification,
    sendReimbursementApprovalNotification,
} from "../services/notificationService";

export const handleReimbursementRequest = async (req: Request, res: Response) => {
    try {
        const { userId, userName, amount } = req.body;

        // Here you would typically update the expense status in Firestore

        // Send notification to all admin users
        await sendReimbursementRequestNotification(userId, userName, amount);

        res.status(200).json({
            success: true,
            message: "Reimbursement request sent and admins notified"
        });
    } catch (error) {
        console.error("Error requesting reimbursement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to request reimbursement"
        });
    }
};

export const handleReimbursementApproval = async (req: Request, res: Response) => {
    try {
        const { userId, amount, approved, adminName } = req.body;

        // Here you would typically update the expense status in Firestore

        // Send notification to the user
        await sendReimbursementApprovalNotification(userId, amount, approved, adminName);

        res.status(200).json({
            success: true,
            message: `Reimbursement ${approved ? 'approved' : 'rejected'} and user notified`
        });
    } catch (error) {
        console.error("Error processing reimbursement:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process reimbursement"
        });
    }
};
