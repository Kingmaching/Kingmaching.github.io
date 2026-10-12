// Marco Ching portfolio interactions

// Project filter chips. Everything shows by default.
const chips = [...document.querySelectorAll(".chip")];
const filterables = [...document.querySelectorAll("#work [data-cat]")];
const minor = document.querySelector(".minor");

function applyFilter(cat) {
  chips.forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.filter === cat)));
  filterables.forEach(el => { el.hidden = cat !== "all" && el.dataset.cat !== cat; });
  if (minor) minor.hidden = !minor.querySelector("li:not([hidden])");
}

chips.forEach(chip => chip.addEventListener("click", () => applyFilter(chip.dataset.filter)));

// Deep links: #design, #research, #ai open the projects with that filter.
function filterFromHash() {
  const cat = location.hash.slice(1);
  if (chips.some(chip => chip.dataset.filter === cat)) {
    applyFilter(cat);
    document.querySelector("#work")?.scrollIntoView();
  }
}
window.addEventListener("hashchange", filterFromHash);
filterFromHash();

// Copy email, falling back to selecting the address.
const copyButton = document.querySelector("#copy-email");
copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copyButton.dataset.email);
    copyButton.textContent = "Copied";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(".contact-email"));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyButton.textContent = "Selected, press Ctrl+C";
  }
  setTimeout(() => { copyButton.textContent = "Copy email"; }, 2200);
});

document.querySelector("#year").textContent = new Date().getFullYear();
