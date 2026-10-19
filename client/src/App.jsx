import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, ClipboardList, Clock3, FolderKanban, LayoutDashboard,
  LogOut, Menu, Plus, Search, Settings2, Sparkles, Users, X, Eye, EyeOff
} from "lucide-react";
import { api } from "./api";

const emptyTask = { title: "", description: "", priority: "medium", status: "todo", dueDate: "", assignee: "" };

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "U";
}

function dateLabel(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function App() {
  const [user, setUser] = useState(null);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [authMode, setAuthMode] = useState(() => resetToken ? "reset" : "login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [modal, setModal] = useState("");
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [editingTask, setEditingTask] = useState(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const activeProject = projects.find(project => project._id === selectedProject) || null;

  async function loadProjects(chooseFirst = false) {
    const result = await api("/projects");
    setProjects(result.data);
    if (chooseFirst && result.data.length) setSelectedProject(result.data[0]._id);
    if (!result.data.length) setSelectedProject("");
    if (selectedProject && !result.data.some(project => project._id === selectedProject)) {
      setSelectedProject(result.data[0]?._id || "");
    }
  }

  async function loadTasks(projectId = selectedProject) {
    if (!projectId) { setTasks([]); return; }
    const result = await api(`/projects/${projectId}/tasks`);
    setTasks(result.data);
  }

  async function loadMe() {
    const result = await api("/auth/me");
    setUser(result.data);
    await loadProjects(true);
  }

  useEffect(() => {
    if (resetToken || !localStorage.getItem("taskflow_token")) return;
    loadMe().catch(() => {
      localStorage.removeItem("taskflow_token");
      setUser(null);
    });
  }, []);

  useEffect(() => {
    if (user && selectedProject) loadTasks(selectedProject).catch(error => setNotice(error.message));
    else setTasks([]);
  }, [user, selectedProject]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3800);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredTasks = useMemo(() => tasks.filter(task => {
    const matchesSearch = `${task.title} ${task.description || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }), [tasks, search, statusFilter, priorityFilter]);

  const counts = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(task => task.status === "todo").length,
    progress: tasks.filter(task => task.status === "in_progress").length,
    done: tasks.filter(task => task.status === "done").length,
    overdue: tasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done").length
  }), [tasks]);

  async function handleAuth(event) {
    event.preventDefault();
    setNotice("");

    if ((authMode === "register" || authMode === "reset") && authForm.password !== authForm.confirmPassword) {
      setNotice("Passwords do not match.");
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === "forgot") {
        await api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: authForm.email })
        });
        setNotice("If an account exists for that email, a password reset link has been sent.");
        return;
      }

      if (authMode === "reset") {
        await api("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: resetToken, password: authForm.password })
        });
        localStorage.removeItem("taskflow_token");
        window.history.replaceState({}, "", window.location.pathname);
        setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
        setAuthMode("login");
        setNotice("Password reset successfully. You can now sign in.");
        return;
      }

      if (authMode === "register") {
        await api("/auth/register", { method: "POST", body: JSON.stringify(authForm) });
        setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
        setShowPassword(false);
        setShowConfirmPassword(false);
        setAuthMode("login");
        setNotice("Account created successfully. Please sign in.");
        return;
      }

      const result = await api("/auth/login", { method: "POST", body: JSON.stringify(authForm) });
      localStorage.setItem("taskflow_token", result.token);
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setUser(result.data);
      await loadProjects(true);
      setNotice("Welcome back!");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("taskflow_token");
    sessionStorage.clear();
    window.location.replace(window.location.pathname);
  }

  async function createProject(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/projects", { method: "POST", body: JSON.stringify(projectForm) });
      setProjects(current => [result.data, ...current]);
      setSelectedProject(result.data._id);
      setProjectForm({ name: "", description: "" });
      setModal("");
      setView("Projects");
      setNotice("Project created successfully.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  function openTask(task = null) {
    setEditingTask(task?._id || null);
    setTaskForm(task ? {
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status || "todo",
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "",
      assignee: task.assignee?._id || task.assignee || ""
    } : emptyTask);
    setModal("task");
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!selectedProject) { setNotice("Create or select a project first."); return; }
    setBusy(true);
    const body = { ...taskForm, dueDate: taskForm.dueDate || null, assignee: taskForm.assignee || null };
    try {
      const result = editingTask
        ? await api(`/tasks/${editingTask}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api(`/projects/${selectedProject}/tasks`, { method: "POST", body: JSON.stringify(body) });
      setTasks(current => editingTask
        ? current.map(task => task._id === editingTask ? result.data : task)
        : [result.data, ...current]);
      setModal("");
      setNotice(editingTask ? "Task updated." : "Task created.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function changeStatus(task, status) {
    try {
      const result = await api(`/tasks/${task._id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks(current => current.map(item => item._id === task._id ? result.data : item));
    } catch (error) { setNotice(error.message); }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete \"${task.title}\"?`)) return;
    try {
      await api(`/tasks/${task._id}`, { method: "DELETE" });
      setTasks(current => current.filter(item => item._id !== task._id));
      setNotice("Task deleted.");
    } catch (error) { setNotice(error.message); }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete project \"${project.name}\" and its tasks?`)) return;
    try {
      await api(`/projects/${project._id}`, { method: "DELETE" });
      const remaining = projects.filter(item => item._id !== project._id);
      setProjects(remaining);
      setSelectedProject(remaining[0]?._id || "");
      setNotice("Project deleted.");
    } catch (error) { setNotice(error.message); }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!activeProject) return;
    setBusy(true);
    try {
      const result = await api(`/projects/${activeProject._id}/members`, {
        method: "POST", body: JSON.stringify({ email: memberEmail })
      });
      setProjects(current => current.map(project => project._id === activeProject._id ? result.data : project));
      setMemberEmail("");
      setModal("");
      setNotice("Project member added.");
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-art">
          <div className="brand brand-light"><span className="brand-mark"><Sparkles size={20} /></span> taskflow</div>
          <div className="auth-art-copy">
            <span className="eyebrow light-eyebrow">YOUR WORKSPACE, REIMAGINED</span>
            <h1>Make space for<br /><em>great work.</em></h1>
            <p>Bring your projects, people and priorities together in one calm, focused workspace.</p>
            <div className="auth-preview">
              <div className="preview-top"><span>Website redesign</span><span className="preview-dot" /></div>
              <div className="preview-bars"><span /><span /><span /></div>
              <div className="preview-foot"><span>Project progress</span><strong>72%</strong></div>
              <div className="progress-track"><span /></div>
            </div>
          </div>
          <div className="auth-art-foot">PLAN CLEARLY. BUILD CONFIDENTLY.</div>
        </div>
        <div className="auth-panel">
          <div className="auth-mobile-brand brand"><span className="brand-mark"><Sparkles size={20} /></span> taskflow</div>
          <div className="auth-card">
            <div className="auth-heading">
              <span className="eyebrow">{authMode === "login" ? "WELCOME BACK" : authMode === "register" ? "GET STARTED" : authMode === "forgot" ? "ACCOUNT RECOVERY" : "SECURE YOUR ACCOUNT"}</span>
              <h2>{authMode === "login" ? "Sign in to TaskFlow" : authMode === "register" ? "Create your account" : authMode === "forgot" ? "Forgot your password?" : "Set a new password"}</h2>
              <p>{authMode === "login" ? "Pick up where you left off." : authMode === "register" ? "A more organized workday starts here." : authMode === "forgot" ? "Enter your email and we’ll send a reset link if an account exists." : "Choose a new password for your TaskFlow account."}</p>
            </div>
            <form onSubmit={handleAuth} className="form-stack">
              {authMode === "register" && <label>Full name<input value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="e.g. Alex Morgan" required minLength="2" autoComplete="name" /></label>}
              {authMode !== "reset" && <label>Email address<input type="email" autoComplete="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" required /></label>}
              {(authMode === "login" || authMode === "register" || authMode === "reset") && <label>Password<div className="password-input-wrap"><input type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" minLength="8" maxLength="128" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
              {(authMode === "register" || authMode === "reset") && <label>Confirm password<div className="password-input-wrap"><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={authForm.confirmPassword} onChange={e => setAuthForm({ ...authForm, confirmPassword: e.target.value })} placeholder="Enter your password again" minLength="8" maxLength="128" required /><button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(current => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} title={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
              {authMode === "login" && <div className="auth-forgot-row"><button type="button" className="auth-forgot-link" onClick={() => { setAuthMode("forgot"); setNotice(""); }}>Forgot password?</button></div>}
              <button className="button button-primary button-wide" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "login" ? "Sign in" : authMode === "register" ? "Create account" : authMode === "forgot" ? "Send reset link" : "Reset password"} <ArrowUpRight size={17} /></button>
            </form>
            <p className="auth-switch">{authMode === "login" ? "New to TaskFlow?" : authMode === "register" ? "Already have an account?" : "Remembered your password?"} <button onClick={() => { setAuthMode(authMode === "login" || authMode === "register" ? (authMode === "login" ? "register" : "login") : "login"); setNotice(""); }}>{authMode === "login" ? "Create an account" : authMode === "register" ? "Sign in" : "Back to sign in"}</button></p>
            <div className="auth-security"><span><Check size={14} /> Secure authentication</span><span><Check size={14} /> Your workspace</span></div>
          </div>
          <p className="auth-legal">By continuing, you agree to use TaskFlow responsibly.</p>
        </div>
        {notice && <div className="toast">{notice}</div>}
      </div>
    );
  }

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Projects", icon: FolderKanban },
    { name: "My Tasks", icon: ClipboardList }
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={20} /></span> taskflow<span className="brand-period">.</span></div>
        <div className="workspace-switch"><span className="workspace-icon">T</span><span><strong>Team workspace</strong><small>Free plan</small></span><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.name} className={`nav-item ${view === item.name ? "active" : ""}`} onClick={() => { setView(item.name); setMobileNav(false); }}><Icon size={18} /><span>{item.name}</span>{item.name === "My Tasks" && <span className="nav-count">{tasks.length}</span>}</button>;
          })}
        </nav>
        <div className="sidebar-section-head"><span className="nav-label">YOUR PROJECTS</span><button title="Create project" onClick={() => setModal("project")}><Plus size={16} /></button></div>
        <div className="project-nav">
          {projects.map((project, index) => <button key={project._id} className={`project-nav-item ${selectedProject === project._id && view === "Projects" ? "selected" : ""}`} onClick={() => { setSelectedProject(project._id); setView("Projects"); setMobileNav(false); }}><span className={`project-color color-${index % 4}`} />{project.name}</button>)}
          {!projects.length && <p className="sidebar-empty">Your projects will appear here.</p>}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item muted-nav" onClick={() => setNotice("Help: create a project, then add tasks to it.")}><CircleHelp size={18} /><span>Help & support</span></button>
          <div className="sidebar-user"><div className="avatar">{initials(user.name)}</div><div className="user-info"><strong>{user.name}</strong><small>{user.email}</small></div><button title="Sign out" onClick={logout}><LogOut size={17} /></button></div>
        </div>
      </aside>
      {mobileNav && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{view}</strong></div>
          <div className="topbar-right">
            <label className="global-search"><Search size={16} /><input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌘ K</kbd></label>
            <button className="icon-button" title="Notifications" onClick={() => setNotice("You're all caught up.")}><Bell size={18} /><i /></button>
            <div className="top-avatar">{initials(user.name)}</div>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">{view === "Overview" ? "YOUR PRODUCTIVITY AT A GLANCE" : view === "Projects" ? "PLAN AND DELIVER" : "YOUR PERSONAL WORK QUEUE"}</span><h1>{view === "Overview" ? "Good to see you, " : view === "Projects" ? "Projects" : "My tasks"}{view === "Overview" && <em>{user.name.split(" ")[0]}.</em>}</h1><p>{view === "Overview" ? "Here's what's happening across your workspace." : view === "Projects" ? "Keep your team moving in the right direction." : "Everything assigned to your workspace, in one place."}</p></div>
            <button className="button button-primary" onClick={() => view === "Projects" && !activeProject ? setModal("project") : openTask()}><Plus size={17} /> {view === "Projects" && !activeProject ? "New project" : "New task"}</button>
          </div>

          {view === "Overview" && <>
            <div className="stat-grid">
              <StatCard label="Total tasks" value={counts.total} hint="Across selected project" icon={ClipboardList} tone="violet" />
              <StatCard label="In progress" value={counts.progress} hint="Currently being worked on" icon={Activity} tone="blue" />
              <StatCard label="Completed" value={counts.done} hint="Tasks marked as done" icon={Check} tone="green" />
              <StatCard label="Overdue" value={counts.overdue} hint="Needs your attention" icon={Clock3} tone="orange" />
            </div>
            <div className="content-grid">
              <section className="panel task-panel">
                <div className="panel-heading"><div><h2>Recent tasks</h2><p>Keep an eye on your latest work</p></div><button className="text-button" onClick={() => setView("My Tasks")}>View all <ArrowUpRight size={15} /></button></div>
                {tasks.slice(0, 5).length ? <TaskTable tasks={tasks.slice(0, 5)} onEdit={openTask} onDelete={deleteTask} onStatus={changeStatus} /> : <EmptyState title="No tasks yet" text="Create a task to start tracking your work." action="Create task" onClick={() => openTask()} />}
              </section>
              <section className="panel progress-panel">
                <div className="panel-heading"><div><h2>Project progress</h2><p>{activeProject?.name || "Select a project"}</p></div><span className="tiny-icon"><Activity size={17} /></span></div>
                {activeProject ? <><div className="progress-big"><strong>{counts.total ? Math.round(counts.done / counts.total * 100) : 0}<small>%</small></strong><span>completed</span></div><div className="progress-track large"><span style={{ width: `${counts.total ? counts.done / counts.total * 100 : 0}%` }} /></div><div className="progress-legend"><span><i className="legend-dot done-dot" />Done <strong>{counts.done}</strong></span><span><i className="legend-dot progress-dot" />In progress <strong>{counts.progress}</strong></span><span><i className="legend-dot todo-dot" />To do <strong>{counts.todo}</strong></span></div><div className="project-mini"><span className="project-color color-0" /><div><strong>{activeProject.name}</strong><small>{activeProject.members?.length || 1} workspace member(s)</small></div><button title="Manage members" onClick={() => setModal("member")}><Users size={17} /></button></div></> : <EmptyState title="Create your first project" text="Projects give your tasks a home." action="New project" onClick={() => setModal("project")} />}
              </section>
            </div>
          </>}

          {view === "Projects" && <div className="projects-layout">
            <div className="projects-toolbar"><div><h2>All projects <span className="soft-count">{projects.length}</span></h2><p>Select a project to view its tasks.</p></div><button className="button button-secondary" onClick={() => setModal("project")}><Plus size={16} /> New project</button></div>
            {projects.length ? <div className="project-card-grid">{projects.map((project, index) => {
              const projectTasks = project._id === selectedProject ? tasks : [];
              return <button key={project._id} className={`project-card ${selectedProject === project._id ? "project-card-selected" : ""}`} onClick={() => setSelectedProject(project._id)}>
                <div className="project-card-top"><span className={`project-color color-${index % 4}`} /><span className="project-card-menu" onClick={e => { e.stopPropagation(); deleteProject(project); }} title="Delete project"><X size={17} /></span></div>
                <h3>{project.name}</h3><p>{project.description || "No description added yet."}</p>
                <div className="project-card-progress"><div className="progress-track"><span style={{ width: `${projectTasks.length ? projectTasks.filter(t => t.status === "done").length / projectTasks.length * 100 : 0}%` }} /></div><small>{projectTasks.length} tasks</small></div>
                <div className="project-card-bottom"><div className="avatar-stack"><span className="mini-avatar">{initials(user.name)}</span>{(project.members || []).slice(0, 2).map(member => <span className="mini-avatar alt" key={member._id || member}>{initials(member.name || "")}</span>)}</div><span className="open-project">Open project <ArrowUpRight size={14} /></span></div>
              </button>;
            })}</div> : <EmptyState title="Your workspace is ready" text="Create your first project and start organizing tasks." action="Create project" onClick={() => setModal("project")} />}
            {activeProject && <section className="panel selected-project-panel"><div className="panel-heading"><div><h2>{activeProject.name}</h2><p>{activeProject.description || "Project task board"}</p></div><div className="panel-actions"><button className="button button-secondary button-small" onClick={() => setModal("member")}><Users size={15} /> Members</button><button className="button button-primary button-small" onClick={() => openTask()}><Plus size={15} /> Add task</button></div></div><Kanban tasks={filteredTasks} onEdit={openTask} onDelete={deleteTask} onStatus={changeStatus} /></section>}
          </div>}

          {view === "My Tasks" && <section className="panel all-tasks-panel">
            <div className="panel-heading"><div><h2>Task list</h2><p>{filteredTasks.length} task(s) match your filters</p></div><button className="button button-primary button-small" onClick={() => openTask()}><Plus size={15} /> New task</button></div>
            <div className="filter-row"><label>Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label><label>Priority<select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><button className="text-button clear-filters" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); }}>Clear filters</button></div>
            {filteredTasks.length ? <TaskTable tasks={filteredTasks} onEdit={openTask} onDelete={deleteTask} onStatus={changeStatus} /> : <EmptyState title="Nothing to show" text="Try another filter or create a task." action="Create task" onClick={() => openTask()} />}
          </section>}
          <footer className="page-footer"><span>© 2026 TaskFlow</span><span><span className="status-pip" /> All changes saved to your workspace</span><button onClick={() => setNotice("TaskFlow MVP · Built with React, Express and MongoDB.")}>About TaskFlow</button></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(""); }}><div className="modal">
        <div className="modal-heading"><div><span className="eyebrow">{modal === "project" ? "WORKSPACE" : modal === "member" ? "COLLABORATION" : editingTask ? "UPDATE WORK" : "NEW WORK ITEM"}</span><h2>{modal === "project" ? "Create a project" : modal === "member" ? "Add a project member" : editingTask ? "Edit task" : "Create a task"}</h2></div><button className="icon-button" onClick={() => setModal("")}><X size={18} /></button></div>
        {modal === "project" && <form className="form-stack" onSubmit={createProject}><label>Project name<input value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="e.g. Website redesign" minLength="2" maxLength="80" required /></label><label>Description<textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="What are you building?" rows="3" maxLength="500" /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Creating..." : "Create project"}</button></div></form>}
        {modal === "task" && <form className="form-stack" onSubmit={saveTask}><label>Task title<input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="What needs to get done?" minLength="2" maxLength="120" required /></label><label>Description<textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Add details..." rows="3" maxLength="2000" /></label><div className="form-two"><label>Status<select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label><label>Priority<select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><div className="form-two"><label>Due date<input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></label><label>Assignee<select value={taskForm.assignee} onChange={e => setTaskForm({ ...taskForm, assignee: e.target.value })}><option value="">Unassigned</option>{(activeProject?.members || []).map(member => <option key={member._id} value={member._id}>{member.name}</option>)}<option value={user._id}>{user.name} (you)</option></select></label></div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? "Saving..." : editingTask ? "Save changes" : "Create task"}</button></div></form>}
        {modal === "member" && <form className="form-stack" onSubmit={addMember}><p className="modal-description">Add an existing TaskFlow account by email. The person must register first.</p><label>Member email<input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="teammate@example.com" required /></label><div className="member-list"><div className="member-row"><div className="avatar">{initials(user.name)}</div><div><strong>{user.name} (you)</strong><small>Project owner</small></div><span className="owner-pill">Owner</span></div>{(activeProject?.members || []).map(member => <div className="member-row" key={member._id}><div className="avatar">{initials(member.name)}</div><div><strong>{member.name}</strong><small>{member.email}</small></div></div>)}</div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Close</button><button disabled={busy} className="button button-primary">{busy ? "Adding..." : "Add member"}</button></div></form>}
      </div></div>}
      {notice && <div className="toast"><span className="toast-check"><Check size={15} /></span>{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
    </div>
  );
}

function StatCard({ label, value, hint, icon: Icon, tone }) {
  return <div className="stat-card"><div className="stat-card-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}</div><div className="stat-hint"><span className="hint-mark"><ArrowDownRight size={13} /></span>{hint}</div></div>;
}

function EmptyState({ title, text, action, onClick }) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={23} /></div><h3>{title}</h3><p>{text}</p>{action && <button className="button button-secondary button-small" onClick={onClick}><Plus size={15} />{action}</button>}</div>;
}

function TaskTable({ tasks, onEdit, onDelete, onStatus }) {
  return <div className="table-wrap"><table className="task-table"><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Due date</th><th></th></tr></thead><tbody>{tasks.map(task => <tr key={task._id}><td><button className="task-title-button" onClick={() => onEdit(task)}><span className={`task-check ${task.status === "done" ? "checked" : ""}`} onClick={e => { e.stopPropagation(); onStatus(task, task.status === "done" ? "todo" : "done"); }}>{task.status === "done" && <Check size={12} />}</span><span><strong>{task.title}</strong><small>{task.description || "No description"}</small></span></button></td><td><select className={`status-select status-${task.status}`} value={task.status} onChange={e => onStatus(task, e.target.value)} aria-label={`Status for ${task.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></td><td><span className={`priority-pill priority-${task.priority}`}><i />{task.priority}</span></td><td><span className="due-date"><Clock3 size={13} />{dateLabel(task.dueDate)}</span></td><td><div className="row-actions"><button title="Edit task" onClick={() => onEdit(task)}><Settings2 size={15} /></button><button title="Delete task" onClick={() => onDelete(task)}><X size={15} /></button></div></td></tr>)}</tbody></table></div>;
}

function Kanban({ tasks, onEdit, onDelete, onStatus }) {
  const columns = [{ id: "todo", title: "To do", className: "todo-column" }, { id: "in_progress", title: "In progress", className: "progress-column" }, { id: "done", title: "Done", className: "done-column" }];
  return <div className="kanban">{columns.map(column => {
    const columnTasks = tasks.filter(task => task.status === column.id);
    return <div className="kanban-column" key={column.id}><div className="kanban-column-head"><span className={`column-dot ${column.className}`} /><strong>{column.title}</strong><span className="column-count">{columnTasks.length}</span></div><div className="kanban-cards">{columnTasks.map(task => <article className="kanban-card" key={task._id}><div className="kanban-card-top"><span className={`priority-pill priority-${task.priority}`}><i />{task.priority}</span><button onClick={() => onEdit(task)} title="Edit task"><Settings2 size={15} /></button></div><button className="kanban-card-title" onClick={() => onEdit(task)}>{task.title}</button>{task.description && <p>{task.description}</p>}<div className="kanban-card-foot"><span><Clock3 size={13} />{dateLabel(task.dueDate)}</span><select value={task.status} onChange={e => onStatus(task, e.target.value)} aria-label={`Move ${task.title}`}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div><button className="kanban-delete" onClick={() => onDelete(task)}>Delete task</button></article>)}{!columnTasks.length && <div className="kanban-empty">No tasks here yet</div>}</div></div>;
  })}</div>;
}

export default App;
