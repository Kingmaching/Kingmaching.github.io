// Marco Ching portfolio interactions

// Project tabs. Panels can be deep-linked as #design, #research or #ai.
const tabs = [...document.querySelectorAll(".tab")];
const panels = [...document.querySelectorAll(".panel")];

function showPanel(id, focus = false) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  panels.forEach(panel => { panel.hidden = panel.id !== id; });
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => showPanel(tab.dataset.tab));
  tab.addEventListener("keydown", event => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    showPanel(next.dataset.tab, true);
  });
});

function openFromHash() {
  const id = location.hash.slice(1);
  if (tabs.some(tab => tab.dataset.tab === id)) {
    showPanel(id);
    document.querySelector("#work")?.scrollIntoView();
  }
}
window.addEventListener("hashchange", openFromHash);
openFromHash();

// Copy email, falling back to selecting the address.
const copyButton = document.querySelector("#copy-email");
copyButton?.addEventListener("click", async () => {
  const email = copyButton.dataset.email;
  try {
    await navigator.clipboard.writeText(email);
    copyButton.textContent = "Copied";
  } catch {
    const target = document.querySelector(".contact-email");
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyButton.textContent = "Selected, press Ctrl+C";
  }
  setTimeout(() => { copyButton.textContent = "Copy email"; }, 2200);
});

document.querySelector("#year").textContent = new Date().getFullYear();
