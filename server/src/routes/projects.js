const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const auth = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { getAccessibleProject } = require("../utils/projectAccess");

const router = express.Router();
router.use(auth);

router.get("/", asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user._id }, { members: req.user._id }]
  }).populate("owner", "name email").populate("members", "name email").sort({ updatedAt: -1 });
  res.json({ success: true, data: projects });
}));

router.post("/", asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ success: false, message: "Project name must be between 2 and 80 characters." });
  }
  if (description.length > 500) {
    return res.status(400).json({ success: false, message: "Description must be 500 characters or fewer." });
  }
  const project = await Project.create({ name, description, owner: req.user._id, members: [req.user._id] });
  const populated = await Project.findById(project._id).populate("owner", "name email").populate("members", "name email");
  res.status(201).json({ success: true, data: populated });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const project = await getAccessibleProject(req.params.id, req.user._id);
  if (!project) return res.status(404).json({ success: false, message: "Project not found." });
  await project.populate("owner", "name email");
  await project.populate("members", "name email");
  res.json({ success: true, data: project });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid project ID." });
  const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
  if (!project) return res.status(404).json({ success: false, message: "Project not found or you are not the owner." });

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ success: false, message: "Project name must be between 2 and 80 characters." });
    project.name = name;
  }
  if (req.body.description !== undefined) {
    const description = String(req.body.description).trim();
    if (description.length > 500) return res.status(400).json({ success: false, message: "Description must be 500 characters or fewer." });
    project.description = description;
  }

  await project.save();
  await project.populate("owner", "name email");
  await project.populate("members", "name email");
  res.json({ success: true, data: project });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
  if (!project) return res.status(404).json({ success: false, message: "Project not found or you are not the owner." });
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();
  res.json({ success: true, message: "Project and its tasks deleted." });
}));

router.post("/:id/members", asyncHandler(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
  if (!project) return res.status(404).json({ success: false, message: "Project not found or you are not the owner." });

  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });

  const member = await User.findOne({ email }).select("_id name email");
  if (!member) return res.status(404).json({ success: false, message: "No account found for that email. Ask them to register first." });
  if (String(member._id) === String(project.owner)) return res.status(400).json({ success: false, message: "The project owner is already a member." });
  if (project.members.some(id => String(id) === String(member._id))) return res.status(409).json({ success: false, message: "That user is already a project member." });

  project.members.push(member._id);
  await project.save();
  await project.populate("owner", "name email");
  await project.populate("members", "name email");
  res.json({ success: true, data: project });
}));

module.exports = router;
