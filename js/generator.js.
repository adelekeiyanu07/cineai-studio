/* Generation layer. The interface only calls CineGen.generate(request).
   To go live later (e.g. a HunyuanVideo service you host), set endpoint to your own
   backend URL. Never put secret API keys in this file: keep them on the server. */
window.CineGen = {
  endpoint: null,
  async generate(req) {
    if (!this.endpoint) {
      await new Promise(r => setTimeout(r, 800));
      return { status: "demo", videoUrl: null, message: "Demo mode: no video was created." };
    }
    let init;
    if (req.image) {
      const fd = new FormData();
      Object.entries(req).forEach(([k, v]) => fd.append(k, v));
      init = { method: "POST", body: fd };
    } else {
      init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) };
    }
    const res = await fetch(this.endpoint, init);
    if (!res.ok) throw new Error("The generation service returned " + res.status + ".");
    const data = await res.json();
    if (!data.videoUrl) throw new Error("The service did not return a video file.");
    return { status: "done", videoUrl: data.videoUrl, message: data.message || "Video ready." };
  }
};
