require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ success: true, message: "TaskFlow API is running." });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "API route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with that unique value already exists." });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: "Some submitted data is invalid." });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid resource ID." });
  }
  res.status(500).json({ success: false, message: "An unexpected server error occurred." });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`TaskFlow API running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start TaskFlow:", error.message);
    process.exit(1);
  }
}

startServer();
