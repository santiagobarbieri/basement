// Each sidebar scrolls independently; controls retain their natural size.
for (const panel of document.querySelectorAll('aside')) {
  panel.style.removeProperty('--panel-fit');
  panel.tabIndex = 0;
  panel.setAttribute('aria-label', panel.classList.contains('left') ? 'Herramientas, colores y exportación' : 'Pinceles y ajustes');
}
