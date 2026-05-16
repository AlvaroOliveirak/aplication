(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function buildTransition() {
    const transition = document.createElement("div");
    transition.className = "page-transition is-entering";
    transition.setAttribute("aria-hidden", "true");
    transition.innerHTML = `
      <svg class="page-transition__field" viewBox="0 0 760 420">
        <g class="page-transition__grid">
          <line x1="40" y1="80" x2="720" y2="80"></line>
          <line x1="40" y1="170" x2="720" y2="170"></line>
          <line x1="40" y1="260" x2="720" y2="260"></line>
          <line x1="40" y1="350" x2="720" y2="350"></line>
          <line x1="130" y1="40" x2="130" y2="380"></line>
          <line x1="300" y1="40" x2="300" y2="380"></line>
          <line x1="470" y1="40" x2="470" y2="380"></line>
          <line x1="640" y1="40" x2="640" y2="380"></line>
        </g>
        <rect class="page-transition__panel" x="78" y="92" width="248" height="128" rx="8"></rect>
        <rect class="page-transition__panel" x="390" y="190" width="292" height="138" rx="8"></rect>
        <path class="page-transition__wave" d="M58 280 C128 210 176 330 246 248 S376 148 464 220 586 312 704 190"></path>
        <path class="page-transition__wave" d="M52 172 C132 250 188 112 258 184 S392 286 482 158 604 96 708 142"></path>
        <rect class="page-transition__scan" x="0" y="40" width="120" height="340" rx="60"></rect>
      </svg>
    `;
    document.body.prepend(transition);
    return transition;
  }

  function isInternalLink(anchor) {
    if (!anchor.href || anchor.target || anchor.hasAttribute("download")) {
      return false;
    }

    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin && url.pathname !== window.location.pathname;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const transition = buildTransition();

    requestAnimationFrame(() => {
      transition.classList.add("is-ready");
      transition.classList.remove("is-entering");
    });

    if (prefersReducedMotion) {
      return;
    }

    document.addEventListener("click", event => {
      const anchor = event.target.closest("a");

      if (!anchor || !isInternalLink(anchor)) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("is-transitioning");
      transition.classList.remove("is-ready");
      transition.classList.add("is-leaving");

      window.setTimeout(() => {
        window.location.href = anchor.href;
      }, 520);
    });

    document.addEventListener("submit", event => {
      const form = event.target;

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      document.body.classList.add("is-transitioning");
      transition.classList.remove("is-ready");
      transition.classList.add("is-leaving");
    });
  });
})();
