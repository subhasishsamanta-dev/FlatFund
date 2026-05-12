import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleSubscribe, handleSendPush, handleGetPushKey } from "./routes/push";

import { handleCreateDeposit, handleCreateExpense } from "./routes/transactions";
import { handleCreateBill } from "./routes/bills";
import { handleReimbursementRequest, handleReimbursementApproval } from "./routes/reimbursements";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Push notification routes
  app.get("/api/push/key", handleGetPushKey);
  app.post("/api/push/subscribe", handleSubscribe);
  app.post("/api/push/send", handleSendPush);

  // Transaction routes (deposits, expenses)
  app.post("/api/deposits", handleCreateDeposit);
  app.post("/api/expenses", handleCreateExpense);

  // Bill routes
  app.post("/api/bills", handleCreateBill);

  // Reimbursement routes
  app.post("/api/reimbursements/request", handleReimbursementRequest);
  app.post("/api/reimbursements/approve", handleReimbursementApproval);

  return app;
}
