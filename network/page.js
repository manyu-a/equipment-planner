document.querySelector('[data-equipment-tab="inventory"]').click();
document.querySelector('[data-summary-tab="network"]').click();
document.querySelector("#networkPlacementSelect").addEventListener("change", () => {
  document.querySelector('[data-summary-tab="network"]').click();
});
