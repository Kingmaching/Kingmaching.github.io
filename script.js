// Marco Ching Portfolio interactions

const tabs = [...document.querySelectorAll(".category-tab")];
const panels = [...document.querySelectorAll(".category-panel")];
const navCategoryLinks = [...document.querySelectorAll("[data-category-link]")];

function showCategory(category) {
  tabs.forEach(tab => {
    const active = tab.dataset.category === category;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  panels.forEach(panel => {
    panel.classList.toggle("active", panel.dataset.panel === category);
  });
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => showCategory(tab.dataset.category));
});

// Desktop work dropdown
const dropdown = document.querySelector(".nav-dropdown");
const dropdownButton = document.querySelector(".nav-dropdown-button");

dropdownButton?.addEventListener("click", event => {
  event.stopPropagation();
  const isOpen = dropdown.classList.toggle("open");
  dropdownButton.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("click", event => {
  if (dropdown && !dropdown.contains(event.target)) {
    dropdown.classList.remove("open");
    dropdownButton?.setAttribute("aria-expanded", "false");
  }
});

navCategoryLinks.forEach(link => {
  link.addEventListener("click", () => {
    const category = link.dataset.categoryLink;
    showCategory(category);
    document.querySelector("#work")?.scrollIntoView({ behavior: "smooth" });
    dropdown?.classList.remove("open");
    dropdownButton?.setAttribute("aria-expanded", "false");
    closeMobileMenu();
  });
});

// Mobile menu
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");

function closeMobileMenu() {
  navLinks?.classList.remove("open");
  menuButton?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

menuButton?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("menu-open", isOpen);
});

document.querySelectorAll(".nav-links > a").forEach(link => {
  link.addEventListener("click", closeMobileMenu);
});

// Automatically close other "Other projects" drawers when one is opened.
document.querySelectorAll(".other-projects").forEach(details => {
  details.addEventListener("toggle", () => {
    if (details.open) {
      document.querySelectorAll(".other-projects").forEach(other => {
        if (other !== details) other.open = false;
      });
    }
  });
});

document.querySelector("#year").textContent = new Date().getFullYear();
