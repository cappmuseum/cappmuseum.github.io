// The guest site without a server. A code derives both a file name and a key, so only the right code can find and
// open its record (see src/site/static.ts, which must use the same salt and iteration count). No code ever leaves the phone.
(() => {
  const SALT = "capp-museum-ii-static-1";
  const ITERATIONS = 200000;
  const STORE = "capp_case";
  const ALPHABET = /^[0-9A-HJKMNP-TV-Z]{12}$/;
  const utf8 = new TextEncoder();
  const $ = (id) => document.getElementById(id);

  function normalise(input) {
    return input.toUpperCase().replace(/[\s\-_.]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  }

  function remember(code) {
    try {
      if (code) localStorage.setItem(STORE, code);
      else localStorage.removeItem(STORE);
    } catch {
      // Storage switched off: the guest types the code again next time.
    }
  }

  function remembered() {
    try {
      return localStorage.getItem(STORE);
    } catch {
      return null;
    }
  }

  /** The guest's record, null for a code that opens nothing. Throws if the site can't be reached. */
  async function openCase(code) {
    const base = await crypto.subtle.importKey("raw", utf8.encode(code), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: utf8.encode(SALT), iterations: ITERATIONS }, base, 384));
    const name = [...bits.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const res = await fetch(`/c/${name}.bin`, { cache: "no-cache" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const box = new Uint8Array(await res.arrayBuffer());
    const key = await crypto.subtle.importKey("raw", bits.slice(16), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: box.slice(0, 12) }, key, box.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function homePage(form) {
    if (remembered()) {
      $("case-open").hidden = false;
      $("case-none").hidden = true;
    }
    const input = $("code");
    const error = $("code-error");
    const invalid = $("code-error-text").textContent;
    const fail = (text) => {
      $("code-error-text").textContent = text;
      error.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "code-error");
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = normalise(input.value);
      const go = form.querySelector("button");
      error.hidden = true;
      if (!ALPHABET.test(code)) return fail(invalid);
      go.disabled = true;
      try {
        const record = await openCase(code);
        if (!record) return fail(invalid);
        remember(code);
        location.href = "/episode/";
      } catch {
        fail("The museum can't be reached right now. Check your connection and try again.");
      } finally {
        go.disabled = false;
      }
    });
  }

  function showVideo(id, label) {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`;
    frame.title = `Episode: ${label}`;
    frame.allow = "accelerometer; encrypted-media; fullscreen; gyroscope; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin"; // YouTube refuses to play for a page that hides where it is
    $("ep-tv").append(frame);
  }

  function showStages(stage) {
    $("ep-progress").className = `xp-progress p${stage}`;
    [...$("ep-stages").children].forEach((li, i) => {
      li.className = i < stage ? "done" : i === stage ? "now" : "";
      li.querySelector(".sr").textContent = i < stage ? " (done)" : i === stage ? " (current)" : "";
    });
  }

  function showCredits(credits) {
    const list = $("ep-credits");
    for (const c of credits) {
      const li = document.createElement("li");
      const role = document.createElement("span");
      role.className = "role";
      role.textContent = c.role;
      const who = document.createElement("b");
      who.textContent = c.guest ?? c.character ?? "";
      li.append(role, " ", who);
      if (c.guest && c.character) li.append(` as ${c.character}`);
      list.append(li);
    }
  }

  /** No video yet: the whole page is the "still developing" notice. */
  function showDeveloping(r, label) {
    $("dev-case").textContent = label;
    if (r.episodeTitle) {
      $("dev-title").textContent = r.episodeTitle;
      $("dev-title").hidden = false;
      document.title = `${r.episodeTitle} · ${document.title}`;
    }
    showStages(r.episodeTitle ? 2 : 0);
    if (r.drive) {
      $("dev-drive").href = r.drive;
      $("dev-drive").hidden = false;
    }
    $("ep-developing").hidden = false;
  }

  function showEpisode(r, label) {
    if (r.case) $("ep-stamp").textContent = `Case file No. ${r.case}`;
    if (r.episodeTitle) {
      $("ep-title").textContent = r.episodeTitle;
      document.title = `${r.episodeTitle} · ${document.title}`;
    }
    $("ep-tagline").textContent = r.tagline ?? "";
    $("ep-synopsis").textContent = r.synopsis ?? "";
    $("ep-player-title").textContent = `Now playing: ${label}`;
    if (r.poster) {
      $("ep-poster").src = r.poster;
      $("ep-poster").hidden = false;
      $("ep-noposter").hidden = true;
    }
    showVideo(r.youtube, label);
    showCredits(r.credits ?? []);
    if (r.drive) {
      $("ep-drive").href = r.drive;
      $("ep-drive").hidden = false;
      $("ep-drive-note").hidden = false;
      $("ep-no-drive").hidden = true;
    }
    $("ep-body").hidden = false;
  }

  function showCase(r) {
    const label = r.case ? `Case No. ${r.case}` : "Your case file";
    if (r.youtube) showEpisode(r, label);
    else showDeveloping(r, label);
    $("ep-loading").hidden = true;
    $("ep-lockup").hidden = false;
  }

  async function episodePage() {
    const code = remembered();
    if (!code) return location.replace("/#code");
    $("ep-lock").addEventListener("click", () => {
      remember(null);
      location.href = "/";
    });
    try {
      const record = await openCase(code);
      if (!record) {
        remember(null);
        return location.replace("/#code");
      }
      showCase(record);
    } catch {
      $("ep-loading-text").textContent = "The museum can't be reached right now. Check your connection, then reload this page.";
    }
  }

  const form = document.querySelector(".code-form");
  if (form) homePage(form);
  else if ($("ep-body")) episodePage();
})();
