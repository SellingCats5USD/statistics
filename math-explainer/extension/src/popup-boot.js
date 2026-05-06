(function bootPopupWidth() {
  try {
    const rawWidth = localStorage.getItem("equationExplainer.popupWidth");
    const number = Number(rawWidth);
    if (Number.isFinite(number) && number >= 300) {
      const width = Math.min(1000, Math.max(300, Math.round(number / 20) * 20));
      document.documentElement.style.setProperty("--popup-width", `${width}px`);
    }
  } catch (_error) {
    // The CSS default remains stable if localStorage is unavailable.
  }
})();
