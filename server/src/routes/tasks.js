const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Project = require("../models/Project");
const auth = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { getAccessibleProject } = require("../utils/projectAccess");

const router = express.Router();
router.use(auth);
const validStatuses = ["todo", "in_progress", "done"];
const validPriorities = ["low", "medium", "high"];

function validateTaskFields(body) {
  if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.trim().length > 120)) {
    return "Task title must be between 2 and 120 characters.";
  }
  if (body.description !== undefined && String(body.description).length > 2000) return "Description must be 2000 characters or fewer.";
  if (body.status !== undefined && !validStatuses.includes(body.status)) return "Invalid task status.";
  if (body.priority !== undefined && !validPriorities.includes(body.priority)) return "Invalid task priority.";
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "" && Number.isNaN(Date.parse(body.dueDate))) return "Invalid due date.";
  return null;
}

router.get("/projects/:projectId/tasks", asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.params.projectId, req.user._id);
  if (!project) return res.status(404).json({ success: false, message: "Project not found." });
  const tasks = await Task.find({ project: project._id })
    .populate("assignee", "name email")
    .populate("createdBy", "name email")
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: tasks });
}));

router.post("/projects/:projectId/tasks", asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.params.projectId, req.user._id);
  if (!project) return res.status(404).json({ success: false, message: "Project not found." });

  const error = validateTaskFields(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  let assignee = null;
  if (req.body.assignee) {
    if (!mongoose.isValidObjectId(req.body.assignee) || !project.members.some(id => String(id) === String(req.body.assignee))) {
      return res.status(400).json({ success: false, message: "Assignee must be a member of this project." });
    }
    assignee = req.body.assignee;
  }

  const task = await Task.create({
    project: project._id,
    title: req.body.title.trim(),
    description: String(req.body.description || "").trim(),
    status: req.body.status || "todo",
    priority: req.body.priority || "medium",
    dueDate: req.body.dueDate || null,
    assignee,
    createdBy: req.user._id
  });
  await task.populate("assignee", "name email");
  await task.populate("createdBy", "name email");
  res.status(201).json({ success: true, data: task });
}));

router.patch("/tasks/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid task ID." });
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found." });

  const project = await getAccessibleProject(task.project, req.user._id);
  if (!project) return res.status(404).json({ success: false, message: "Task not found." });

  const error = validateTaskFields(req.body);
  if (error) return res.status(400).json({ success: false, message: error });

  if (req.body.title !== undefined) task.title = req.body.title.trim();
  if (req.body.description !== undefined) task.description = String(req.body.description).trim();
  if (req.body.status !== undefined) task.status = req.body.status;
  if (req.body.priority !== undefined) task.priority = req.body.priority;
  if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate || null;

  if (req.body.assignee !== undefined) {
    if (req.body.assignee === null || req.body.assignee === "") {
      task.assignee = null;
    } else {
      if (!mongoose.isValidObjectId(req.body.assignee) || !project.members.some(id => String(id) === String(req.body.assignee))) {
        return res.status(400).json({ success: false, message: "Assignee must be a member of this project." });
      }
      task.assignee = req.body.assignee;
    }
  }

  await task.save();
  await task.populate("assignee", "name email");
  await task.populate("createdBy", "name email");
  res.json({ success: true, data: task });
}));

router.delete("/tasks/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid task ID." });
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found." });
  const project = await getAccessibleProject(task.project, req.user._id);
  if (!project) return res.status(404).json({ success: false, message: "Task not found." });
  await task.deleteOne();
  res.json({ success: true, message: "Task deleted." });
}));

router.get("/dashboard/summary", asyncHandler(async (req, res) => {
  const projects = await Project.find({ $or: [{ owner: req.user._id }, { members: req.user._id }] }).select("_id");
  const projectIds = projects.map(project => project._id);
  const [total, byStatus, overdue] = await Promise.all([
    Task.countDocuments({ project: { $in: projectIds } }),
    Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    Task.countDocuments({ project: { $in: projectIds }, dueDate: { $lt: new Date(), $ne: null }, status: { $ne: "done" } })
  ]);
  const statusCounts = { todo: 0, in_progress: 0, done: 0 };
  byStatus.forEach(item => { statusCounts[item._id] = item.count; });
  res.json({ success: true, data: { projectCount: projects.length, totalTasks: total, ...statusCounts, overdueTasks: overdue } });
}));

module.exports = router;
