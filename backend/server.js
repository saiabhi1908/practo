import express from "express";
import cors from "cors";
import chatRoutes from './routes/chatRoutes.js';
import "dotenv/config";
import startReminderScheduler from "./utils/reminderScheduler.js"; // ✅ NEW LINE

import connectDB from "./config/mongodb.js";
import connectCloudinary from "./config/cloudinary.js";

import userRouter from "./routes/userRoute.js";
import doctorRouter from "./routes/doctorRoute.js";
import adminRouter from "./routes/adminRoute.js";
import placesRouter from "./routes/places.js";
import medicalReportRoutes from './routes/medicalReportRoutes.js';
import videoRouter from "./routes/videoRoute.js";
import insuranceRoutes from './routes/insuranceRoutes.js';

import sendEmail from "./utils/emailService.js";

const app = express();
const port = process.env.PORT || 4000;

// Connect to DB and Cloudinary
connectDB();
connectCloudinary();

// Middleware
app.use(cors());
app.use(express.json());

// Debug environment variables on startup (remove in production)
console.log("HMS_APP_ACCESS_KEY:", process.env.HMS_APP_ACCESS_KEY ? "*****" : "Not Set");
console.log("HMS_APP_SECRET:", process.env.HMS_APP_SECRET ? "*****" : "Not Set");
console.log("HMS_ROOM_ID:", process.env.HMS_ROOM_ID || "Not Set");

// Routes
app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/doctor", doctorRouter);
app.use("/api/places", placesRouter);
app.use('/api/insurance', insuranceRoutes);
app.use("/api/100ms", videoRouter);
app.use('/api/reports', medicalReportRoutes);
app.use('/api/chat', chatRoutes);

// Test email route
app.get("/test-email", async (req, res) => {
  try {
    await sendEmail(
      process.env.EMAIL_USER,
      "⏰ Appointment Reminder (Test)",
      `This is a test reminder email.`
    );
    res.send("✅ Test email sent!");
  } catch (error) {
    console.error("Failed to send test email:", error);
    res.status(500).send("❌ Failed to send test email");
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("API Working");
});

// ✅ Start Reminder Scheduler
startReminderScheduler();  // ← This triggers your hourly reminder task

app.listen(port, () => console.log(`🚀 Server started on PORT: ${port}`));
