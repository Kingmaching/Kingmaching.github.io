// Marco Ching portfolio interactions

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
