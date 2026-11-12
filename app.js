(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const OPTS = {
    duration: ["5 seconds", "8 seconds", "10 seconds"],
    ratio: ["16:9", "9:16", "1:1"],
    quality: ["Standard", "High"],
    motion: ["Low", "Medium", "High"]
  };
  const EXAMPLES = ["Rain on a neon street, low tracking shot", "Aerial flyover of misty mountains at sunrise", "A paper boat drifting down a glowing river"];
  const KEY = "cineai.drafts";

  /* Segmented radio controls */
  $$("[data-seg]").forEach(el => {
    const k = el.dataset.seg;
    el.className = "seg";
    el.setAttribute("role", "radiogroup");
    el.setAttribute("aria-label", k);
    el.innerHTML = OPTS[k].map((v, i) =>
      `<label><input type="radio" name="${k}" value="${v}"${i === 0 ? " checked" : ""}><span>${v}</span></label>`).join("");
  });

  /* Mobile menu */
  const menu = $(".menu-btn"), nav = $("#nav");
  menu.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", e => { if (e.target.tagName === "A") { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); } });

  /* Mode tabs */
  const tabs = $$('[role="tab"]');
  function setMode(mode) {
    tabs.forEach(t => {
      const on = t.id === "tab-" + mode;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    });
    hideErr();
  }
  tabs.forEach(t => t.addEventListener("click", () => setMode(t.id.slice(4))));
  $(".tabs").addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const m = $('[aria-selected="true"]').id === "tab-text" ? "image" : "text"; setMode(m); $("#tab-" + m).focus(); }
  });
  $$("[data-open-mode]").forEach(a => a.addEventListener("click", () => setMode(a.dataset.openMode)));

  /* Example prompts */
  $("#examples").innerHTML = EXAMPLES.map(t => `<button type="button" class="chip">${t}</button>`).join("");
  $("#examples").addEventListener("click", e => { if (e.target.classList.contains("chip")) { $("#prompt").value = e.target.textContent; $("#prompt").focus(); } });

  /* Image upload */
  let image = null;
  const file = $("#file"), drop = $("#drop"), thumb = $("#thumb");
  function pick(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return showErr("Choose a PNG, JPG or WebP image.");
    if (f.size > 10 * 1024 * 1024) return showErr("That image is over 10 MB. Choose a smaller one.");
    hideErr();
    if (thumb.src) URL.revokeObjectURL(thumb.src);
    image = f; thumb.src = URL.createObjectURL(f); thumb.hidden = false;
    $("#drop-text").innerHTML = `${f.name.replace(/</g, "")}<br><small>Tap to change image</small>`;
  }
  file.addEventListener("change", () => pick(file.files[0]));
  ["dragenter", "dragover"].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => pick(e.dataTransfer.files[0]));

  /* Errors */
  const err = $("#err");
  function showErr(m) { err.textContent = m; err.hidden = false; }
  function hideErr() { err.hidden = true; }

  /* Generation */
  let last = null;
  const video = $("#video"), dl = $("#dl"), play = $("#play"), regen = $("#regen"), stage = $("#stage");
  const val = (form, name) => $(`input[name="${name}"]:checked`, form).value;

  function collect(mode) {
    const form = $("#form-" + mode);
    const req = { mode, duration: val(form, "duration"), ratio: val(form, "ratio") };
    if (mode === "text") {
      req.prompt = $("#prompt").value.trim();
      req.negative = $("#neg").value.trim();
      req.quality = val(form, "quality");
      req.motion = val(form, "motion");
      if (!req.prompt) { showErr("Write a prompt first."); return null; }
    } else {
      req.prompt = $("#motion-text").value.trim();
      if (!image) { showErr("Add an image first."); return null; }
      if (!req.prompt) { showErr("Describe how the image should move."); return null; }
      req.image = image;
    }
    hideErr();
    return req;
  }

  async function run(req) {
    last = req;
    stage.style.aspectRatio = req.ratio.replace(":", "/");
    stage.classList.toggle("tall", req.ratio === "9:16");
    $("#stage-msg").hidden = false; $("#stage-msg").textContent = "Working…";
    $("#info").textContent = "Generating…";
    try {
      const r = await CineGen.generate(req);
      show(r, req);
      save(req, r.status);
    } catch (e) {
      $("#stage-msg").textContent = "Generation failed.";
      $("#info").textContent = "";
      showErr(e.message + " Try again.");
    }
  }

  function show(r, req) {
    const info = `${req.mode === "text" ? "Text to Video" : "Image to Video"} · ${req.ratio} · ${req.duration}`;
    if (r.videoUrl) {
      video.src = r.videoUrl; video.hidden = false; $("#stage-msg").hidden = true;
      dl.href = r.videoUrl; dl.removeAttribute("aria-disabled"); dl.tabIndex = 0; play.disabled = false;
      $("#info").textContent = info;
    } else {
      video.hidden = true; video.removeAttribute("src");
      dl.removeAttribute("href"); dl.setAttribute("aria-disabled", "true"); dl.tabIndex = -1; play.disabled = true;
      $("#stage-msg").hidden = false;
      $("#stage-msg").textContent = "Demo mode: no video was created. Your settings were saved as a draft.";
      $("#info").textContent = info;
    }
    regen.disabled = false;
  }

  ["text", "image"].forEach(m => $("#form-" + m).addEventListener("submit", e => { e.preventDefault(); const r = collect(m); if (r) run(r); }));
  regen.addEventListener("click", () => last && run(last));
  dl.addEventListener("click", e => { if (dl.getAttribute("aria-disabled") === "true") e.preventDefault(); });
  play.addEventListener("click", () => { video.paused ? video.play() : video.pause(); });
  video.addEventListener("play", () => play.textContent = "Pause");
  video.addEventListener("pause", () => play.textContent = "Play");

  /* Drafts (this device only) */
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
  function save(req, status) {
    const a = read();
    a.unshift({ mode: req.mode, prompt: req.prompt, ratio: req.ratio, duration: req.duration, status, t: Date.now() });
    write(a.slice(0, 12)); renderRecent();
  }
  function renderRecent() {
    const a = read(), ul = $("#recent");
    ul.innerHTML = a.length ? "" : "<li class='empty'>Nothing here yet. Generate in demo mode to save a draft.</li>";
    a.forEach(d => {
      const li = document.createElement("li");
      const p = document.createElement("p"); p.textContent = d.prompt;
      const m = document.createElement("small");
      m.textContent = `${d.mode === "text" ? "Text" : "Image"} · ${d.ratio} · ${d.duration} · ${d.status === "demo" ? "Demo draft" : "Video"} · ${new Date(d.t).toLocaleDateString()}`;
      li.append(p, m); ul.append(li);
    });
  }
  $("#clear").addEventListener("click", () => { write([]); renderRecent(); });
  renderRecent();

  /* Gallery */
  const items = window.GALLERY || [];
  const cats = ["All", ...new Set(items.map(i => i.category))];
  let cat = "All";
  function renderGallery() {
    $("#filters").innerHTML = cats.map(c => `<button type="button" class="chip" aria-pressed="${c === cat}">${c}</button>`).join("");
    const g = $("#gallery"); g.innerHTML = "";
    items.filter(i => cat === "All" || i.category === cat).forEach((i, n) => {
      const c = document.createElement("article"); c.className = "card vid";
      const m = document.createElement("div"); m.className = "media"; m.style.setProperty("--h", 255 + n * 18);
      if (i.src) {
        const v = document.createElement("video"); v.src = i.src; v.controls = true; v.preload = "none"; v.playsInline = true;
        if (i.poster) v.poster = i.poster; v.setAttribute("aria-label", i.title); m.append(v);
      } else { m.innerHTML = "<span>Concept — video not added yet</span>"; }
      const h = document.createElement("h3"); h.textContent = i.title;
      const p = document.createElement("p"); p.textContent = i.desc;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn small"; b.textContent = "Use this prompt";
      b.addEventListener("click", () => { setMode("text"); $("#prompt").value = i.prompt; location.hash = "#creator"; $("#prompt").focus({ preventScroll: true }); });
      c.append(m, h, p, b); g.append(c);
    });
  }
  $("#filters").addEventListener("click", e => { if (e.target.classList.contains("chip")) { cat = e.target.textContent; renderGallery(); } });
  renderGallery();
})();
