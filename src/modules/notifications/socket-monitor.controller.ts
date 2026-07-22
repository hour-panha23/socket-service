import { Controller, Get, Header } from '@nestjs/common';

@Controller('socket-monitor')
export class SocketMonitorController {
  @Get()
  @Header('Content-Type', 'text/html')
  getMonitorPage(): string {
    return `
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Socket Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <style>
    /* Custom Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
    ::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 0.8); }
  </style>
</head>
<body class="h-full bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden selection:bg-indigo-500 selection:text-white">
  <div class="flex h-screen overflow-hidden">

    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-slate-900/80 backdrop-blur-md border-r border-slate-800/80 flex flex-col justify-between p-4 z-10">
      <div class="space-y-6">
        <!-- Logo / Title -->
        <div class="flex items-center gap-3 px-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
            ⚡
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight text-white">Socket Center</h1>
            <p class="text-[10px] text-slate-400 font-mono">v1.2.0 • Gateway</p>
          </div>
        </div>

        <!-- Navigation Menu -->
        <nav class="space-y-1">
          <button onclick="switchView('monitoring')" id="nav-monitoring" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 transition-all duration-150">
            <span class="text-base">📡</span> Realtime Monitor
          </button>
          <button onclick="switchView('apps')" id="nav-apps" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-150">
            <span class="text-base">🔑</span> App Management
          </button>
        </nav>
      </div>

      <!-- Footer / Dynamic Status Badge -->
      <div class="pt-4 border-t border-slate-800/60">
        <div class="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 flex items-center justify-between">
          <span class="text-[11px] font-medium text-slate-400">Socket Status</span>
          <span id="statusBadge" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disconnected
          </span>
        </div>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="flex-1 overflow-y-auto bg-slate-950 p-6">
      <div class="max-w-7xl mx-auto space-y-6">

        <!-- ===================== MONITORING VIEW ===================== -->
        <div id="view-monitoring" class="space-y-6">
          <div class="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div>
              <h2 class="text-xl font-bold tracking-tight text-white">Realtime Gateway Monitor</h2>
              <p class="text-xs text-slate-400 mt-0.5">Namespace active: <code class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono text-[11px]">/notifications</code></p>
            </div>
            <span id="adminBadge" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
              <span class="w-2 h-2 rounded-full bg-slate-500"></span> Admin Feed Inactive
            </span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Card 1: Socket Authentication -->
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Client Authentication</h3>
                  <span class="text-[10px] text-slate-500 font-mono">IO Auth</span>
                </div>
                <div class="space-y-3">
                  <div>
                    <label class="text-[11px] font-medium text-slate-300">App ID</label>
                    <input id="appIdInput" type="text" placeholder="app_xxxxxxxx" class="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition" />
                  </div>
                  <div>
                    <label class="text-[11px] font-medium text-slate-300">Secret Key</label>
                    <input id="secretKeyInput" type="password" placeholder="Paste secret key" class="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition" />
                  </div>
                </div>
              </div>

              <div class="space-y-2 pt-2">
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="connectSocket()" class="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition">Connect</button>
                  <button onclick="disconnectSocket()" class="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/50 transition">Disconnect</button>
                </div>
                <button onclick="toggleAdmin()" id="adminToggleBtn" class="w-full py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-lg transition">Subscribe Admin Feed</button>
              </div>
            </div>

            <!-- Card 2: Room Subscriptions -->
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">2. Room Manager</h3>
                  <span class="text-[10px] text-slate-500 font-mono">Channel Scope</span>
                </div>
                <div class="space-y-2.5">
                  <div>
                    <label class="text-[10px] text-slate-400">Project Key</label>
                    <input id="projectId" type="text" value="proj_siksara" placeholder="Project ID" class="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-400">App Identifier</label>
                    <input id="appIdRoom" type="text" value="learning_hub" placeholder="App ID (room)" class="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label class="text-[10px] text-slate-400">Target Channel/Room ID</label>
                    <input id="roomId" type="text" value="course_101" placeholder="Room ID" class="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-2">
                <button onclick="joinRoom()" class="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition">Join Channel</button>
                <button onclick="leaveRoom()" class="py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg transition">Leave Channel</button>
              </div>
            </div>

            <!-- Card 3: Active Rooms Display -->
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscribed Channels</h3>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Active</span>
                </div>
                <ul id="roomsList" class="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <li class="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-center">No active room subscriptions</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Rest Dispatcher Section -->
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">3. Rest Broadcaster Dispatch</h3>
              <span class="text-[10px] text-indigo-400 font-mono">POST /notifications/emit/:scope</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div class="md:col-span-1">
                <label class="text-[10px] text-slate-400 block mb-1">Target Scope</label>
                <select id="emitScope" onchange="onScopeChange()" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-200">
                  <option value="project">Project Scope</option>
                  <option value="app">App Scope</option>
                  <option value="room" selected>Room Scope</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">Project ID</label>
                <input id="emitProjectId" type="text" value="proj_siksara" placeholder="Project ID" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200" />
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">App ID</label>
                <input id="emitAppId" type="text" value="learning_hub" placeholder="App ID" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200" />
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">Room ID</label>
                <input id="emitRoomId" type="text" value="course_101" placeholder="Room ID" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200" />
              </div>
              <div>
                <label class="text-[10px] text-slate-400 block mb-1">Event Name</label>
                <input id="emitEventName" type="text" value="notification" placeholder="event name" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300" />
              </div>
              <div class="flex items-end">
                <button onclick="triggerEmit()" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition">Dispatch Payload</button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] text-slate-400">JSON Data Payload</label>
              <textarea id="emitPayload" rows="2" placeholder='{"message":"hello"}' class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 placeholder-slate-700"></textarea>
            </div>
            <div id="emitResult" class="text-xs font-mono text-slate-400 min-h-[1rem]"></div>
          </div>

          <!-- Real-time Feeds Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-80">
              <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">Live Telemetry Feed</h3>
                </div>
                <span id="emitCountBadge" class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">0 events</span>
              </div>
              <div id="emitLogFeed" class="flex-1 overflow-y-auto space-y-2 pr-1">
                <p class="text-xs text-slate-500 italic p-4 text-center">Subscribe to admin feed to capture broadcast events...</p>
              </div>
            </div>

            <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-80">
              <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/80">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-300">Client Lifetime Monitor</h3>
                </div>
                <span id="clientCountBadge" class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">? connected</span>
              </div>
              <div id="clientEventFeed" class="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                <p class="text-xs text-slate-500 italic font-sans p-4 text-center">Subscribe to admin feed to view connect/disconnect actions...</p>
              </div>
            </div>
          </div>

          <!-- Developer Console -->
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col h-64 shadow-2xl">
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-800/80">
              <div class="flex items-center gap-2">
                <span class="text-xs">💻</span>
                <h3 class="text-xs font-mono uppercase text-slate-400">Client Log Terminal</h3>
              </div>
              <button onclick="clearConsole()" class="text-[10px] px-2 py-0.5 text-slate-500 hover:text-slate-300 rounded transition">Clear Console</button>
            </div>
            <div id="consoleLogs" class="flex-1 overflow-y-auto font-mono text-xs space-y-1 text-emerald-400"></div>
          </div>
        </div>

        <!-- ===================== APP MANAGEMENT VIEW ===================== -->
        <div id="view-apps" class="space-y-6 hidden">
          <div class="flex items-center justify-between pb-4 border-b border-slate-800/60">
            <div>
              <h2 class="text-xl font-bold tracking-tight text-white">App Management</h2>
              <p class="text-xs text-slate-400 mt-0.5">Manage credentials, App IDs, and Secret Keys for registered apps.</p>
            </div>
            <button onclick="openCreateModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5">
              <span>+</span> Register App
            </button>
          </div>

          <div class="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900/90 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th class="p-4">Application</th>
                  <th class="p-4">App ID</th>
                  <th class="p-4">Secret Key</th>
                  <th class="p-4">Status</th>
                  <th class="p-4">Created</th>
                  <th class="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="appsTableBody" class="divide-y divide-slate-800/60">
                <tr><td colspan="6" class="p-8 text-center text-slate-500 italic">Loading registered apps...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  </div>

  <!-- Modal: Create App -->
  <div id="createModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center z-50">
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 w-96 space-y-4 shadow-2xl">
      <h3 class="text-sm font-bold text-white">Register New Application</h3>
      <div class="space-y-3">
        <div>
          <label class="text-[11px] font-medium text-slate-300">App Name</label>
          <input id="newAppName" type="text" placeholder="e.g. Learning Hub" class="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label class="text-[11px] font-medium text-slate-300">Description (Optional)</label>
          <textarea id="newAppDescription" rows="2" placeholder="Brief description..." class="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"></textarea>
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="submitCreateApp()" class="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition">Create Application</button>
        <button onclick="closeCreateModal()" class="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Modal: Secret Key Reveal -->
  <div id="secretModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center z-50">
    <div class="bg-slate-900 border border-amber-500/30 rounded-xl p-6 w-[28rem] space-y-4 shadow-2xl">
      <div class="flex items-center gap-2 text-amber-400">
        <span>⚠️</span>
        <h3 class="text-sm font-bold">Secret Key Issued — Save Immediately</h3>
      </div>
      <p class="text-xs text-slate-400 leading-relaxed">This secret key is generated once and cannot be retrieved again after closing this dialog.</p>
      
      <div class="space-y-2">
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
          <div>
            <p class="text-[10px] uppercase font-semibold text-slate-500">App Identifier</p>
            <p id="revealAppId" class="text-xs font-mono text-indigo-300 break-all select-all mt-0.5"></p>
          </div>
          <button onclick="copyToClipboard(document.getElementById('revealAppId').innerText, this)" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono rounded border border-slate-700 transition">Copy</button>
        </div>

        <div class="bg-slate-950 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
          <div>
            <p class="text-[10px] uppercase font-semibold text-slate-500">Secret Key</p>
            <p id="revealSecretKey" class="text-xs font-mono text-emerald-400 break-all select-all mt-0.5"></p>
          </div>
          <button onclick="copyToClipboard(document.getElementById('revealSecretKey').innerText, this)" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono rounded border border-slate-700 transition">Copy</button>
        </div>
      </div>

      <button onclick="closeSecretModal()" class="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition">I have saved my secret key</button>
    </div>
  </div>

  <script>
    // Utility: Formats secret string showing first 4 and last 4 chars
    function maskSecret(key) {
      if (!key) return '••••••••';
      if (key.length <= 8) return key;
      return \`\${key.slice(0, 4)}... \${key.slice(-4)}\`;
    }

    // Utility: Copy text to clipboard with instant button feedback
    async function copyToClipboard(text, btnElement) {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const originalText = btnElement.innerText;
        btnElement.innerText = 'Copied!';
        btnElement.classList.add('text-emerald-400', 'border-emerald-500/40');
        setTimeout(() => {
          btnElement.innerText = originalText;
          btnElement.classList.remove('text-emerald-400', 'border-emerald-500/40');
        }, 1500);
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    }

    // ===================== NAVIGATION =====================
    function switchView(view) {
      document.getElementById('view-monitoring').classList.toggle('hidden', view !== 'monitoring');
      document.getElementById('view-apps').classList.toggle('hidden', view !== 'apps');

      const activeClass = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 transition-all duration-150';
      const inactiveClass = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-150';

      document.getElementById('nav-monitoring').className = view === 'monitoring' ? activeClass : inactiveClass;
      document.getElementById('nav-apps').className = view === 'apps' ? activeClass : inactiveClass;

      if (view === 'apps') loadApps();
    }

    // ===================== MONITORING LOGIC =====================
    let socket = null;
    let adminSubscribed = false;
    let emitCount = 0;

    function log(msg, type = 'info') {
      const logs = document.getElementById('consoleLogs');
      const time = new Date().toLocaleTimeString();
      const color = type === 'error' ? 'text-rose-400' : type === 'warn' ? 'text-amber-400' : 'text-emerald-400';
      logs.innerHTML = \`<p class="\${color}">[\${time}] \${msg}</p>\` + logs.innerHTML;
    }

    function clearConsole() { document.getElementById('consoleLogs').innerHTML = ''; }

    function updateBadge(connected) {
      const badge = document.getElementById('statusBadge');
      badge.className = connected
        ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20';
      badge.innerHTML = connected 
        ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected' 
        : '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disconnected';
      if (!connected) { adminSubscribed = false; updateAdminBadge(); }
    }

    function updateAdminBadge() {
      const badge = document.getElementById('adminBadge');
      badge.className = adminSubscribed
        ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20'
        : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700';
      badge.innerHTML = adminSubscribed
        ? '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Admin Feed Live'
        : '<span class="w-2 h-2 rounded-full bg-slate-500"></span> Admin Feed Inactive';
      document.getElementById('adminToggleBtn').innerText = adminSubscribed ? 'Unsubscribe Admin Feed' : 'Subscribe Admin Feed';
    }

    function connectSocket() {
      const appId = document.getElementById('appIdInput').value.trim();
      const secretKey = document.getElementById('secretKeyInput').value.trim();
      if (!appId || !secretKey) return alert('Enter App ID and Secret Key');
      if (socket) socket.disconnect();

      socket = io('/notifications', { auth: { appId, secretKey }, transports: ['websocket'] });

      socket.on('connect', () => { updateBadge(true); log(\`Connected! Socket ID: \${socket.id}\`); });
      socket.on('disconnect', (reason) => { updateBadge(false); log(\`Disconnected: \${reason}\`, 'warn'); });
      socket.on('connect_error', (err) => { updateBadge(false); log(\`Connection Error: \${err.message}\`, 'error'); });

      socket.on('room_joined', (data) => { log(\`Room Joined: \${JSON.stringify(data)}\`); addRoomToList(data.data); });
      socket.on('room_left', (data) => log(\`Room Left: \${JSON.stringify(data)}\`, 'warn'));
      socket.on('notification_received', (payload) => log(\`NOTIFICATION: \${JSON.stringify(payload)}\`));

      socket.on('admin:subscribed', () => { adminSubscribed = true; updateAdminBadge(); log('Subscribed to admin monitor feed'); refreshClientCount(); });
      socket.on('admin:unsubscribed', () => { adminSubscribed = false; updateAdminBadge(); log('Unsubscribed from admin monitor feed', 'warn'); });

      socket.on('admin:emit_log', (entry) => {
        emitCount++;
        document.getElementById('emitCountBadge').innerText = \`\${emitCount} events\`;
        const feed = document.getElementById('emitLogFeed');
        if (feed.querySelector('p.italic')) feed.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 shadow-sm';
        card.innerHTML = \`
          <div class="flex justify-between items-center">
            <span class="font-semibold text-indigo-300 font-mono">\${entry.event}</span>
            <span class="text-emerald-400 font-mono text-[11px] px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">\${entry.recipientCount} client(s)</span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono">scope: \${entry.scope} → \${entry.target}</p>
          <p class="text-[10px] text-slate-500 font-mono">\${new Date(entry.timestamp).toLocaleTimeString()}</p>
        \`;
        feed.prepend(card);
      });

      socket.on('admin:client_event', (evt) => {
        const feed = document.getElementById('clientEventFeed');
        if (feed.querySelector('p.italic')) feed.innerHTML = '';
        const isConnect = evt.type === 'connect';
        const color = isConnect ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        const line = document.createElement('div');
        line.className = \`p-2 rounded border text-[11px] flex justify-between \${color}\`;
        line.innerHTML = \`
          <span>[\${new Date(evt.timestamp).toLocaleTimeString()}] <strong>\${evt.type.toUpperCase()}</strong> \${evt.clientId}</span>
          \${evt.userId ? '<span class="text-slate-400">(user: ' + evt.userId + ')</span>' : ''}
        \`;
        feed.prepend(line);
        refreshClientCount();
      });
    }

    function disconnectSocket() { if (socket) socket.disconnect(); }

    function toggleAdmin() {
      if (!socket || !socket.connected) return alert('Connect socket first!');
      socket.emit(adminSubscribed ? 'admin:unsubscribe' : 'admin:subscribe');
    }

    function getRoomData() {
      return {
        projectId: document.getElementById('projectId').value,
        appId: document.getElementById('appIdRoom').value,
        roomId: document.getElementById('roomId').value,
      };
    }

    function joinRoom() {
      if (!socket || !socket.connected) return alert('Connect socket first!');
      socket.emit('join_room', getRoomData());
    }

    function leaveRoom() {
      if (!socket || !socket.connected) return alert('Connect socket first!');
      socket.emit('leave_room', getRoomData());
    }

    function addRoomToList(room) {
      const list = document.getElementById('roomsList');
      if (list.querySelector('li.italic')) list.innerHTML = '';
      const item = document.createElement('li');
      item.className = 'p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 flex justify-between items-center';
      item.innerText = \`\${room.projectId} / \${room.appId} / \${room.roomId}\`;
      list.appendChild(item);
    }

    function onScopeChange() {
      const scope = document.getElementById('emitScope').value;
      document.getElementById('emitAppId').parentElement.style.display = scope === 'project' ? 'none' : 'block';
      document.getElementById('emitRoomId').parentElement.style.display = scope === 'room' ? 'block' : 'none';
    }

    async function triggerEmit() {
      const scope = document.getElementById('emitScope').value;
      const projectId = document.getElementById('emitProjectId').value;
      const appId = document.getElementById('emitAppId').value;
      const roomId = document.getElementById('emitRoomId').value;
      const event = document.getElementById('emitEventName').value || 'notification';
      let payload = {};
      try {
        const raw = document.getElementById('emitPayload').value.trim();
        payload = raw ? JSON.parse(raw) : {};
      } catch (e) { return alert('Payload must be valid JSON'); }

      const bodyMap = {
        project: { projectId, event, payload },
        app: { projectId, appId, event, payload },
        room: { projectId, appId, roomId, event, payload },
      };

      try {
        const res = await fetch(\`/notifications/emit/\${scope}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyMap[scope]),
        });
        const data = await res.json();
        document.getElementById('emitResult').innerHTML = \`<span class="text-emerald-400">✓ Dispatched</span> → \${data.recipientCount} client(s) in "\${data.target}" received "\${data.event}"\`;
        log(\`REST emit sent: \${JSON.stringify(data)}\`);
      } catch (e) {
        document.getElementById('emitResult').innerHTML = '<span class="text-rose-400">✗ Failed to send</span>';
        log(\`Emit failed: \${e.message}\`, 'error');
      }
    }

    async function refreshClientCount() {
      try {
        const res = await fetch('/notifications/stats/clients');
        const data = await res.json();
        document.getElementById('clientCountBadge').innerText = \`\${data.connectedClients} connected\`;
      } catch (e) { log('Failed to fetch client stats', 'error'); }
    }

    // ===================== APP MANAGEMENT LOGIC =====================
    let appsCache = [];

    async function loadApps() {
      try {
        const res = await fetch('/apps');
        appsCache = await res.json();
        renderAppsTable();
      } catch (e) {
        document.getElementById('appsTableBody').innerHTML = '<tr><td colspan="6" class="p-4 text-center text-rose-400">Failed to load apps</td></tr>';
      }
    }

    function renderAppsTable() {
      const body = document.getElementById('appsTableBody');
      if (!appsCache.length) {
        body.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">No apps registered yet</td></tr>';
        return;
      }

      body.innerHTML = appsCache.map(app => {
        const rawSecret = app.secret_key || app.secretKey || '';

        return \`
          <tr class="hover:bg-slate-800/20 transition border-b border-slate-800/60">
            <td class="p-4">
              <p class="font-semibold text-slate-100">\${app.name}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">\${app.description || 'No description'}</p>
            </td>

            <!-- App ID Column with Copy Button -->
            <td class="p-4">
              <div class="flex items-center gap-1.5 font-mono text-xs text-indigo-300">
                <span>\${app.app_id}</span>
                <button onclick="copyToClipboard('\${app.app_id}', this)" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] rounded border border-slate-700 transition">Copy</button>
              </div>
            </td>

            <!-- Secret Key Column (First 4 & Last 4 + Copy Button) -->
            <td class="p-4">
              <div class="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <span>\${maskSecret(rawSecret)}</span>
                \${rawSecret ? \`
                  <button onclick="copyToClipboard('\${rawSecret}', this)" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] rounded border border-slate-700 transition">Copy</button>
                \` : ''}
              </div>
            </td>

            <td class="p-4">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold \${app.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}">\${app.is_active ? 'Active' : 'Disabled'}</span>
            </td>
            <td class="p-4 text-xs text-slate-400 font-mono">\${new Date(app.created_at).toLocaleDateString()}</td>
            <td class="p-4 text-right space-x-2">
              <button onclick="toggleAppActive('\${app.id}', \${!app.is_active})" class="px-2.5 py-1 text-xs font-medium rounded-md border transition \${app.is_active ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'}">\${app.is_active ? 'Disable' : 'Enable'}</button>
              <button onclick="regenerateSecret('\${app.id}')" class="px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition">Regenerate</button>
              <button onclick="deleteApp('\${app.id}')" class="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition">Delete</button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function openCreateModal() {
      document.getElementById('newAppName').value = '';
      document.getElementById('newAppDescription').value = '';
      document.getElementById('createModal').classList.remove('hidden');
      document.getElementById('createModal').classList.add('flex');
    }

    function closeCreateModal() {
      document.getElementById('createModal').classList.add('hidden');
      document.getElementById('createModal').classList.remove('flex');
    }

    async function submitCreateApp() {
      const name = document.getElementById('newAppName').value.trim();
      const description = document.getElementById('newAppDescription').value.trim();
      if (!name) return alert('Name is required');

      try {
        const res = await fetch('/apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: description || undefined }),
        });
        const data = await res.json();
        closeCreateModal();
        showSecretModal(data.app.app_id, data.secretKey);
        loadApps();
      } catch (e) { alert('Failed to create app'); }
    }

    function showSecretModal(appId, secretKey) {
      document.getElementById('revealAppId').innerText = appId;
      document.getElementById('revealSecretKey').innerText = secretKey;
      document.getElementById('secretModal').classList.remove('hidden');
      document.getElementById('secretModal').classList.add('flex');
    }

    function closeSecretModal() {
      document.getElementById('secretModal').classList.add('hidden');
      document.getElementById('secretModal').classList.remove('flex');
    }

    async function toggleAppActive(id, activate) {
      try {
        await fetch(\`/apps/\${id}/\${activate ? 'enable' : 'disable'}\`, { method: 'PATCH' });
        loadApps();
      } catch (e) { alert('Failed to update app status'); }
    }

    async function regenerateSecret(id) {
      if (!confirm('This invalidates the current secret key immediately. Continue?')) return;
      try {
        const res = await fetch(\`/apps/\${id}/regenerate-secret\`, { method: 'POST' });
        const data = await res.json();
        showSecretModal(data.app.app_id, data.secretKey);
      } catch (e) { alert('Failed to regenerate secret'); }
    }

    async function deleteApp(id) {
      if (!confirm('Delete this app permanently? This cannot be undone.')) return;
      try {
        await fetch(\`/apps/\${id}\`, { method: 'DELETE' });
        loadApps();
      } catch (e) { alert('Failed to delete app'); }
    }

    onScopeChange();
  </script>
</body>
</html>
    `;
  }
}
