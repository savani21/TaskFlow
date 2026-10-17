const mongoose = require("mongoose");
const Project = require("../models/Project");

async function getAccessibleProject(projectId, userId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({
    _id: projectId,
    $or: [{ owner: userId }, { members: userId }]
  });
}

module.exports = { getAccessibleProject };
