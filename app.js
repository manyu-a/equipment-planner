const DATA = window.TRICKCAL_EQUIPMENT_DATA;
const STORAGE_KEY = "trickcal-equipment-planner:v1";

const SLOT_LABELS = {
  armor: "鎧",
  hat: "帽子",
  shinyAccessory: "煌めく装飾品",
  boots: "ブーツ",
  fancyAccessory: "華麗な装飾品",
  physicalWeapon: "物理武器",
  magicWeapon: "魔法武器",
};

const KIND_LABELS = {
  blueprint: "設計図",
  fragment: "設計図",
};

const TOME_COSTS = {
  "9:blueprint": 30,
  "8:blueprint": 24,
  "7:fragment": 22,
  "6:blueprint": 14,
  "5:blueprint": 12,
  "4:fragment": 10,
  "3:blueprint": 6,
  "2:blueprint": 5,
};

const EQUIPMENT_ORDER = [
  "armor",
  "hat",
  "weapon",
  "shinyAccessory",
  "fancyAccessory",
  "boots",
];

const byMaterial = new Map(DATA.materials.map((item) => [item.id, item]));
const byStage = new Map(DATA.stages.map((stage) => [stage.id, stage]));
const materialByParts = new Map(
  DATA.materials.map((item) => [`${item.rank}:${item.slot}:${item.kind}`, item])
);

const state = loadState();

const rankSelect = document.querySelector("#rankSelect");
const buildSelect = document.querySelector("#buildSelect");
const inputModeSelect = document.querySelector("#inputModeSelect");
const autoCalculateSelect = document.querySelector("#autoCalculateSelect");
const settingsButton = document.querySelector("#settingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const networkDialog = document.querySelector("#networkDialog");
const networkOpenButton = document.querySelector("#networkOpenButton");
const networkCloseButton = document.querySelector("#networkCloseButton");
const calculateButton = document.querySelector("#calculateButton");
const consumeEquipmentButton = document.querySelector("#consumeEquipmentButton");
const equipmentGrid = document.querySelector("#equipmentGrid");
const materialInventory = document.querySelector("#materialInventory");
const tomeSummary = document.querySelector("#tomeSummary");
const shortageSummary = document.querySelector("#shortageSummary");
const recommendations = document.querySelector("#recommendations");
const equipmentTabs = document.querySelectorAll("[data-equipment-tab]");
const equipmentSlotsPanel = document.querySelector("#equipmentSlotsPanel");
const materialInventoryPanel = document.querySelector("#materialInventoryPanel");
const summaryTabs = document.querySelectorAll("[data-summary-tab]");
const recommendationsPanel = document.querySelector("#recommendationsPanel");
const shortagesPanel = document.querySelector("#shortagesPanel");
const networkGroupSelect = document.querySelector("#networkGroupSelect");
const networkGraph = document.querySelector("#networkGraph");
const networkDetails = document.querySelector("#networkDetails");
const networkStoneSummary = document.querySelector("#networkStoneSummary");
const networkZoomOutButton = document.querySelector("#networkZoomOutButton");
const networkZoomInButton = document.querySelector("#networkZoomInButton");
const networkResetViewButton = document.querySelector("#networkResetViewButton");
const networkResetLayoutButton = document.querySelector("#networkResetLayoutButton");
const networkUseAdoptedButton = document.querySelector("#networkUseAdoptedButton");
const networkRestoreSelectionButton = document.querySelector("#networkRestoreSelectionButton");
const networkSaveSelectionButton = document.querySelector("#networkSaveSelectionButton");
const networkMaterialEditor = document.querySelector("#networkMaterialEditor");
const networkMaterialEditorImage = document.querySelector("#networkMaterialEditorImage");
const networkMaterialEditorTitle = document.querySelector("#networkMaterialEditorTitle");
const networkMaterialEditorCurrent = document.querySelector("#networkMaterialEditorCurrent");
const networkMaterialEditorControl = document.querySelector("#networkMaterialEditorControl");
const networkMaterialEditorCancel = document.querySelector("#networkMaterialEditorCancel");
const networkMaterialEditorMax = document.querySelector("#networkMaterialEditorMax");
const networkMaterialEditorSave = document.querySelector("#networkMaterialEditorSave");
let recommendationTimer = 0;
let networkGroupKey = "";
let activeNetworkController = null;
const networkViewStates = new Map();
const networkSelectionDrafts = new Map();
let suppressNetworkEdgeClickUntil = 0;
let suppressNetworkNodeClickUntil = 0;
let editingNetworkMaterialId = "";

init();

function init() {
  [9, 8, 7, 6, 5, 4, 3, 2].forEach((rank) => {
    const option = document.createElement("option");
    option.value = String(rank);
    option.textContent = `Rank ${rank}`;
    rankSelect.append(option);
  });

  rankSelect.value = String(state.targetRank);
  buildSelect.value = state.build;
  inputModeSelect.value = state.inputMode;
  autoCalculateSelect.value = state.autoCalculate ? "on" : "off";
  updateCalculationControls();

  rankSelect.addEventListener("change", () => {
    state.targetRank = Number(rankSelect.value);
    persistAndRender();
  });

  buildSelect.addEventListener("change", () => {
    state.build = buildSelect.value;
    persistAndRender();
  });

  inputModeSelect.addEventListener("change", () => {
    state.inputMode = inputModeSelect.value;
    persistAndRender();
  });

  autoCalculateSelect.addEventListener("change", () => {
    state.autoCalculate = autoCalculateSelect.value === "on";
    persistAndRender();
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    if (!confirm("入力を初期化しますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, createDefaultState());
    rankSelect.value = String(state.targetRank);
    buildSelect.value = state.build;
    inputModeSelect.value = state.inputMode;
    autoCalculateSelect.value = state.autoCalculate ? "on" : "off";
    persistAndRender();
  });

  calculateButton.addEventListener("click", calculateRecommendationsNow);
  consumeEquipmentButton.addEventListener("click", consumeCompletedEquipment);
  document.querySelector("#exportButton").addEventListener("click", exportState);
  document.querySelector("#importInput").addEventListener("change", importState);
  settingsButton.addEventListener("click", () => settingsDialog.showModal());
  settingsDialog.addEventListener("click", (event) => {
    if (event.target === settingsDialog) settingsDialog.close();
  });
  networkOpenButton.addEventListener("click", () => {
    networkDialog.showModal();
    requestAnimationFrame(() => renderExplorationNetwork(calculateNeeds().shortages));
  });
  networkCloseButton.addEventListener("click", () => networkDialog.close());
  networkDialog.addEventListener("click", (event) => {
    if (event.target === networkDialog) networkDialog.close();
  });
  equipmentTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateEquipmentTab(tab.dataset.equipmentTab));
  });
  summaryTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateSummaryTab(tab.dataset.summaryTab));
  });
  networkGroupSelect.addEventListener("change", () => {
    networkGroupKey = networkGroupSelect.value;
    renderExplorationNetwork(calculateNeeds().shortages);
  });
  networkZoomOutButton.addEventListener("click", () => activeNetworkController?.zoom(1.25));
  networkZoomInButton.addEventListener("click", () => activeNetworkController?.zoom(0.8));
  networkResetViewButton.addEventListener("click", () => activeNetworkController?.resetView());
  networkResetLayoutButton.addEventListener("click", () => activeNetworkController?.resetLayout());
  networkUseAdoptedButton.addEventListener("click", useAdoptedNetworkSelection);
  networkRestoreSelectionButton.addEventListener("click", restoreSavedNetworkSelection);
  networkSaveSelectionButton.addEventListener("click", saveManualNetworkSelection);
  networkMaterialEditorCancel.addEventListener("click", closeNetworkMaterialEditor);
  networkMaterialEditorMax.addEventListener("click", setNetworkMaterialEditorMax);
  networkMaterialEditorSave.addEventListener("click", saveNetworkMaterialEditor);
  networkMaterialEditor.addEventListener("click", (event) => event.stopPropagation());
  networkMaterialEditor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveNetworkMaterialEditor();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeNetworkMaterialEditor();
    }
  });

  render();
}

function activateEquipmentTab(tabName) {
  equipmentTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.equipmentTab === tabName));
  equipmentSlotsPanel.classList.toggle("is-hidden", tabName !== "slots");
  materialInventoryPanel.classList.toggle("is-hidden", tabName !== "inventory");

  if (tabName === "slots") {
    render();
  } else {
    renderMaterialInventory();
  }
}

function activateSummaryTab(tabName) {
  summaryTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.summaryTab === tabName));
  recommendationsPanel.classList.toggle("is-hidden", tabName !== "recommendations");
  shortagesPanel.classList.toggle("is-hidden", tabName !== "shortages");
}

function createDefaultState() {
  return {
    targetRank: 8,
    build: "physical",
    inputMode: "direct",
    autoCalculate: true,
    completed: {},
    materials: {},
    recommendationPlans: {},
    customNetworkSelections: {},
  };
}

function loadState() {
  try {
    const saved = { ...createDefaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    migrateCompletedStock(saved);
    return saved;
  } catch {
    return createDefaultState();
  }
}

function migrateCompletedStock(saved) {
  Object.entries(saved.completed || {}).forEach(([slot, value]) => {
    if (typeof value === "number") {
      saved.completed[slot] = { stock: toInt(value) };
      return;
    }

    const stock = toInt(value?.stock) + toInt(value?.equipped);
    saved.completed[slot] = { stock };
  });
}

function persistAndRender() {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  persistState();
  render();
  window.scrollTo(scrollX, scrollY);
  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toInt(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function selectedSlots() {
  return DATA.buildSlots[state.build];
}

function displaySlots() {
  return EQUIPMENT_ORDER.map((slot) =>
    slot === "weapon" ? (state.build === "physical" ? "physicalWeapon" : "magicWeapon") : slot
  );
}

function requirementsForRank() {
  return DATA.requirements.filter((req) => req.targetRank === state.targetRank);
}

function completedFor(slot) {
  return toInt(state.completed[slot]?.stock);
}

function materialCount(id) {
  return toInt(state.materials[id]);
}

function setCompleted(slot, value) {
  state.completed[slot] = { stock: toInt(value) };
  persistAndRender();
}

function consumeCompletedEquipment() {
  const slots = displaySlots();
  const missingSlots = slots.filter((slot) => completedFor(slot) < 1);
  if (missingSlots.length > 0) {
    alert(`在庫が足りない装備があります: ${missingSlots.map((slot) => SLOT_LABELS[slot]).join(" / ")}`);
    return;
  }

  slots.forEach((slot) => {
    state.completed[slot] = { stock: Math.max(0, completedFor(slot) - 1) };
  });
  persistAndRender();
}

function setMaterial(id, value, options = {}) {
  state.materials[id] = toInt(value);
  if (options.render === false) {
    persistState();
    return;
  }
  persistAndRender();
}

function equipSlotFromMaterials(slot) {
  requirementsForRank().forEach((req) => {
    const material = materialForRequirement(req, slot);
    if (!material) return;
    const nextValue = Math.max(0, materialCount(material.id) - getRequirementAmount(req));
    state.materials[material.id] = nextValue;
  });

  state.completed[slot] = { stock: completedFor(slot) + 1 };
  persistAndRender();
}

function materialForRequirement(req, slot) {
  return materialByParts.get(`${req.materialRank}:${slot}:${req.kind}`);
}

function materialName(item) {
  return `R${item.rank} ${SLOT_LABELS[item.slot]} ${KIND_LABELS[item.kind]}`;
}

function materialSlotName(item) {
  return `R${item.rank} ${SLOT_LABELS[item.slot]}`;
}

function calculateNeeds() {
  const needs = [];
  const shortages = new Map();
  const reqs = requirementsForRank();

  selectedSlots().forEach((slot) => {
    const remainingUnits = Math.max(0, 1 - completedFor(slot));

    reqs.forEach((req) => {
      const material = materialForRequirement(req, slot);
      if (!material) return;

      const required = remainingUnits * getRequirementAmount(req);
      const owned = materialCount(material.id);
      const shortage = Math.max(0, required - owned);

      needs.push({
        slot,
        material,
        required,
        owned,
        shortage,
        perSlot: getRequirementAmount(req),
      });

      if (shortage > 0) {
        shortages.set(material.id, (shortages.get(material.id) || 0) + shortage);
      }
    });
  });

  return { needs, shortages };
}

function getRequirementAmount(req) {
  return toInt(req.required ?? req.perSlot);
}

function render() {
  const needs = calculateNeeds();
  renderEquipmentGrid(needs.needs);
  renderMaterialInventory();
  renderTomeSummary(needs.needs);
  renderShortages(needs.needs);
  updateCalculationControls();
  restoreRecommendationPlan(needs.shortages);
  if (state.autoCalculate) {
    scheduleRecommendations(needs.shortages);
  } else {
    updateRecommendationDynamicValues(needs.shortages);
  }
  renderExplorationNetwork(needs.shortages);
}

function updateCalculationControls() {
  calculateButton.hidden = state.autoCalculate;
}

function calculateRecommendationsNow() {
  clearTimeout(recommendationTimer);
  const needs = calculateNeeds();
  renderRecommendations(needs.shortages);
  recommendations.removeAttribute("aria-busy");
  flashRecommendations();
}

function scheduleRecommendations(shortages) {
  clearTimeout(recommendationTimer);
  recommendations.setAttribute("aria-busy", "true");
  const snapshot = new Map(shortages);
  recommendationTimer = setTimeout(() => {
    renderRecommendations(snapshot);
    recommendations.removeAttribute("aria-busy");
    flashRecommendations();
  }, 150);
}

function flashRecommendations() {
  recommendations.classList.remove("is-updated");
  void recommendations.offsetWidth;
  recommendations.classList.add("is-updated");
}

function updateRecommendationDynamicValues(shortages) {
  recommendations.querySelectorAll("[data-drop-owned-id]").forEach((element) => {
    element.textContent = `所持 ${materialCount(element.dataset.dropOwnedId)}`;
  });

  const groupsByKey = new Map(planningGroups(shortages).map((group) => [group.key, group]));
  recommendations.querySelectorAll(".recommendation-group").forEach((groupElement) => {
    const planningGroup = groupsByKey.get(groupElement.dataset.groupKey);
    const remainingTargets = new Map(planningGroup?.shortages || shortages);
    const remainingActual = new Map(shortages);

    groupElement.querySelectorAll("[data-main-stage-id]").forEach((row) => {
      const stage = byStage.get(row.dataset.mainStageId);
      if (!stage) return;

      const dynamic = dynamicStageProgress(stage, remainingTargets, remainingActual);
      if (!dynamic) return;

      row.querySelector("[data-focus-runs]").textContent = `${dynamic.focusRuns}周相当`;
      row.querySelector("[data-cycle-coverage]").textContent = dynamic.coverageText;
      row.querySelector("[data-stone-progress]").textContent =
        `定石 ${dynamic.beforeStoneCost} → ${dynamic.afterStoneCost}（-${dynamic.stoneSaved}）`;
    });

    const ratio = groupElement.querySelector("[data-plan-stones]");
    if (ratio) ratio.textContent = `残り定石 ${calculateRequiredStones(remainingActual)}`;
  });
}

function dynamicStageProgress(stage, remainingTargets, remainingActual) {
  const dropCounts = countDrops(stage.drops);
  const activeDrops = [...dropCounts.keys()].filter((id) => (remainingTargets.get(id) || 0) > 0);
  if (activeDrops.length === 0) {
    return {
      focusRuns: 0,
      coverageText: "不足素材なし",
      beforeStoneCost: calculateRequiredStones(remainingActual),
      afterStoneCost: calculateRequiredStones(remainingActual),
      stoneSaved: 0,
    };
  }

  const focusRuns = Math.min(...activeDrops.map((id) => Math.ceil(remainingTargets.get(id) / dropCounts.get(id))));
  const beforeStoneCost = calculateRequiredStones(remainingActual);
  dropCounts.forEach((count, id) => {
    if (remainingTargets.has(id)) {
      remainingTargets.set(id, Math.max(0, remainingTargets.get(id) - focusRuns * count));
    }
    if (remainingActual.has(id)) {
      remainingActual.set(id, Math.max(0, remainingActual.get(id) - focusRuns * count));
    }
  });
  const afterStoneCost = calculateRequiredStones(remainingActual);

  return {
    focusRuns,
    coverageText: activeDrops
      .map((id) => `${cycleMaterialLabel(byMaterial.get(id))} +${focusRuns * dropCounts.get(id)}`)
      .join(" / "),
    beforeStoneCost,
    afterStoneCost,
    stoneSaved: beforeStoneCost - afterStoneCost,
  };
}

function renderEquipmentGrid(needs) {
  equipmentGrid.replaceChildren();

  displaySlots().forEach((slot) => {
    const slotNeeds = needs.filter((need) => need.slot === slot);
    const stock = completedFor(slot);
    const isComplete = stock >= 1;
    const image = representativeImage(slot);

    const card = document.createElement("article");
    card.className = `equipment-card${isComplete ? " is-complete" : ""}`;
    card.innerHTML = `
      <div class="equipment-card-head">
        <div class="equipment-title">
          <div class="equipment-icon">${image ? `<img src="${image}" alt="">` : ""}</div>
          <h3>${SLOT_LABELS[slot]}</h3>
        </div>
        <label class="stock-inline">
          <span>在庫</span>
          ${renderNumberControl({
            value: stock,
            max: Math.max(9, stock, 1),
            ariaLabel: `${SLOT_LABELS[slot]} 在庫`,
            attributes: `data-completed-slot="${slot}"`,
          })}
        </label>
      </div>

      ${
        isComplete
          ? `<div class="complete-note compact-note">完成済み：素材計算から除外中</div>`
          : `<div class="material-list">${slotNeeds.map((need) => renderMaterialLine(need, slotNeeds)).join("")}</div>`
      }
    `;

    card.querySelectorAll("[data-completed-slot]").forEach((element) => {
      if (element.tagName === "INPUT" || element.tagName === "SELECT") {
        element.addEventListener("change", () => setCompleted(element.dataset.completedSlot, element.value));
      } else {
        element.addEventListener("click", () => setCompleted(element.dataset.completedSlot, element.dataset.value));
      }
    });

    card.querySelectorAll("[data-material-id]").forEach((element) => {
      if (element.tagName === "INPUT" || element.tagName === "SELECT") {
        element.addEventListener("change", () => setMaterial(element.dataset.materialId, element.value));
      } else {
        element.addEventListener("click", () => setMaterial(element.dataset.materialId, element.dataset.value));
      }
    });

    card.querySelectorAll("[data-equip-slot]").forEach((button) => {
      button.addEventListener("click", () => equipSlotFromMaterials(button.dataset.equipSlot));
    });

    equipmentGrid.append(card);
  });
}

function renderMaterialInventory() {
  materialInventory.replaceChildren();

  ranksForInventory().forEach((rank) => {
    const materials = materialsForInventoryRank(rank);
    if (materials.length === 0) return;

    const section = document.createElement("section");
    section.className = "inventory-rank";
    section.innerHTML = `
      <div class="inventory-rank-head">
        <h3>Rank ${rank}</h3>
        <span>${KIND_LABELS[materials[0].kind]}</span>
      </div>
      <div class="inventory-grid">
        ${materials.map(renderInventoryItem).join("")}
      </div>
    `;

    section.querySelectorAll("[data-inventory-material-id]").forEach((input) => {
      input.addEventListener("change", () => setMaterial(input.dataset.inventoryMaterialId, input.value, { render: false }));
    });

    materialInventory.append(section);
  });
}

function ranksForInventory() {
  return [...new Set(DATA.materials.map((material) => material.rank))].sort((a, b) => b - a);
}

function materialsForInventoryRank(rank) {
  const inventoryOrder = [
    "physicalWeapon",
    "magicWeapon",
    "armor",
    "hat",
    "boots",
    "shinyAccessory",
    "fancyAccessory",
  ];
  const order = new Map(inventoryOrder.map((slot, index) => [slot, index]));
  return DATA.materials
    .filter((material) => material.rank === rank)
    .sort((a, b) => (order.get(a.slot) ?? 99) - (order.get(b.slot) ?? 99));
}

function renderInventoryItem(material) {
  return `
    <label class="inventory-item">
      <span class="inventory-item-main">
        <img src="${material.image}" alt="">
        <span>${SLOT_LABELS[material.slot]}</span>
      </span>
      ${renderNumberControl({
        value: materialCount(material.id),
        max: materialInventoryMax(material),
        ariaLabel: `${materialName(material)} 所持数`,
        attributes: `data-inventory-material-id="${material.id}"`,
      })}
    </label>
  `;
}

function materialInventoryMax(material) {
  const maxRequirement = DATA.requirements
    .filter((req) => req.materialRank === material.rank && req.kind === material.kind)
    .reduce((max, req) => Math.max(max, getRequirementAmount(req)), 0);
  return Math.max(maxRequirement, materialCount(material.id));
}

function renderTomeSummary(needs) {
  const shortages = shortagesFromNeeds(needs);
  const rows = tomeRowsFromShortages(shortages);
  const total = calculateRequiredStones(shortages);

  if (total === 0) {
    tomeSummary.innerHTML = `
      <div class="tome-total">
        <span>必要定石</span>
        <strong>0</strong>
      </div>
    `;
    return;
  }

  const breakdown = groupTomeRows(rows)
    .map((row) => `${row.label} ${row.total}`)
    .join(" / ");

  tomeSummary.innerHTML = `
    <div class="tome-total">
      <span>必要定石</span>
      <strong>${total}</strong>
    </div>
    <div class="tome-breakdown">${breakdown}</div>
  `;
}

function renderNetworkStoneSummary(shortages) {
  if (!networkStoneSummary) return;

  const rows = tomeRowsFromShortages(shortages);
  const total = calculateRequiredStones(shortages);
  const breakdown = groupTomeRows(rows)
    .map((row) => `${row.label} ${row.total}`)
    .join(" / ");

  networkStoneSummary.innerHTML = `
    <span>定石消費量</span>
    <strong>${total}</strong>
    <small>${breakdown || "不足なし"}</small>
  `;
}

function tomeCostForMaterial(material) {
  return TOME_COSTS[`${material.rank}:${material.kind}`] || 0;
}

function calculateRequiredStones(shortages) {
  let total = 0;
  shortages.forEach((shortage, id) => {
    total += calculateRequiredStonesForMaterial(id, shortage);
  });
  return total;
}

function calculateRequiredStonesForMaterial(materialId, shortageAmount) {
  const material = byMaterial.get(materialId);
  if (!material) return 0;
  return Math.max(0, shortageAmount) * tomeCostForMaterial(material);
}

function shortagesFromNeeds(needs) {
  const shortages = new Map();
  uniqueNeeds(needs).forEach((need) => {
    const shortage = Math.max(0, need.required - materialCount(need.material.id));
    if (shortage > 0) shortages.set(need.material.id, shortage);
  });
  return shortages;
}

function tomeRowsFromShortages(shortages) {
  return [...shortages.entries()]
    .map(([id, shortage]) => {
      const material = byMaterial.get(id);
      const tomeCost = material ? tomeCostForMaterial(material) : 0;
      return { material, shortage, tomeCost, total: shortage * tomeCost };
    })
    .filter((row) => row.material && row.shortage > 0 && row.tomeCost > 0);
}

function groupTomeRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = `${row.material.rank}:${row.material.kind}`;
    const current = grouped.get(key) || {
      label: `R${row.material.rank}${KIND_LABELS[row.material.kind]}`,
      total: 0,
    };
    current.total += row.total;
    grouped.set(key, current);
  });

  return [...grouped.values()];
}

function renderMaterialLine(need, slotNeeds) {
  const owned = materialCount(need.material.id);
  const shortage = Math.max(0, need.required - owned);
  const shortageClass = shortage > 0 ? " is-short" : "";
  const shouldShowEquipButton = isPrimaryMaterialLine(need, slotNeeds);
  const equipButton = shouldShowEquipButton
    ? `<button class="mini-button" type="button" data-equip-slot="${need.slot}">装着</button>`
    : "";

  return `
    <div class="material-line${shortageClass}">
      <div class="material-title-row">
        <img class="material-icon" src="${need.material.image}" alt="">
        <div class="material-line-title">${materialSlotName(need.material)}</div>
      </div>
      <div class="material-line-stats">
        <span>必要 ${need.required}</span>
        <span>所持 ${owned}</span>
        <span class="shortage-text">不足 ${shortage}</span>
      </div>
      <div class="material-number-line">
        ${renderNumberControl({
          value: owned,
          max: Math.max(need.required, owned),
          ariaLabel: "所持数",
          attributes: `data-material-id="${need.material.id}"`,
        })}
        <div class="step-actions">
          ${equipButton}
          <button class="mini-button" type="button" data-material-id="${need.material.id}" data-value="${need.required}">Max</button>
        </div>
      </div>
    </div>
  `;
}

function isPrimaryMaterialLine(need, slotNeeds) {
  if (slotNeeds.length <= 1) return true;
  const maxRank = Math.max(...slotNeeds.map((slotNeed) => slotNeed.material.rank));
  return need.material.rank === maxRank;
}

function renderNumberControl({ value, max, ariaLabel, attributes }) {
  if (state.inputMode === "roll") {
    return `
      <select class="compact-number" aria-label="${ariaLabel}" ${attributes}>
        ${numberOptions(value, max)}
      </select>
    `;
  }

  return `
    <input
      class="compact-number"
      type="number"
      min="0"
      step="1"
      value="${value}"
      aria-label="${ariaLabel}"
      ${attributes}
    >
  `;
}

function numberOptions(value, max) {
  const base = Math.max(0, toInt(max));
  const upper = Math.max(base + 20, base * 2, toInt(value));
  return Array.from({ length: upper + 1 }, (_, index) => {
    const selected = index === toInt(value) ? " selected" : "";
    return `<option value="${index}"${selected}>${index}</option>`;
  }).join("");
}

function representativeImage(slot) {
  const req = requirementsForRank()[0];
  if (!req) return "";
  return materialForRequirement(req, slot)?.image || "";
}

function uniqueNeeds(needs) {
  const seen = new Map();
  needs.forEach((need) => {
    const current = seen.get(need.material.id);
    if (current) {
      current.required += need.required;
      current.shortage += Math.max(0, need.required - materialCount(need.material.id));
    } else {
      seen.set(need.material.id, {
        ...need,
        shortage: Math.max(0, need.required - materialCount(need.material.id)),
      });
    }
  });

  return [...seen.values()].sort((a, b) =>
    a.material.rank - b.material.rank || String(a.material.code).localeCompare(String(b.material.code))
  );
}

function renderShortages(needs) {
  shortageSummary.replaceChildren();
  const rows = uniqueNeeds(needs).filter((need) => Math.max(0, need.required - materialCount(need.material.id)) > 0);

  if (rows.length === 0) {
    shortageSummary.innerHTML = `<div class="complete-note">不足はありません。</div>`;
    return;
  }

  rows.forEach((need) => {
    const shortage = Math.max(0, need.required - materialCount(need.material.id));
    const row = document.createElement("div");
    row.className = "shortage-row";
    row.innerHTML = `
      <img src="${need.material.image}" alt="">
      <div>
        <div class="row-title">${materialName(need.material)}</div>
        <div class="mini-label">必要 ${need.required} / 所持 ${materialCount(need.material.id)}</div>
      </div>
      <div class="shortage-amount">-${shortage}</div>
    `;
    shortageSummary.append(row);
  });
}

function renderRecommendations(shortages) {
  recommendations.replaceChildren();
  recommendations.dataset.planKey = recommendationPlanKey();
  if (shortages.size === 0) {
    recommendations.innerHTML = `<div class="complete-note">周回候補はありません。</div>`;
    rememberRecommendationPlans([]);
    renderExplorationNetwork(shortages);
    return;
  }

  const groups = planningGroups(shortages);
  const groupPlans = groups
    .map((group) => ({
      group,
      plan: planGroupByGraphMatching(group, shortages),
    }))
    .filter((entry) => entry.plan);

  if (groupPlans.length === 0) {
    renderFallbackStages(shortages);
    rememberRecommendationPlans([]);
    renderExplorationNetwork(shortages);
    return;
  }

  rememberRecommendationPlans(groupPlans);
  groupPlans.forEach((entry) => renderPlanBlock(entry.group, entry.plan, shortages, groups));
  renderExplorationNetwork(shortages);
}

function planningGroups(shortages) {
  const groups = groupShortages(shortages);
  const primary = groups.find((group) => group.rank === state.targetRank);

  if (!primary) return groups;

  if (state.targetRank === 9) {
    const lower = groups.find((group) => group.rank === state.targetRank - 1);
    if (!lower) return groups;

    const combined = {
      ...primary,
      key: `${primary.key}+${lower.key}`,
      label: `${primary.label} + ${lower.label}`,
      shortages: new Map([...primary.shortages, ...lower.shortages]),
      primaryMaterialIds: new Set(primary.shortages.keys()),
    };
    return groups
      .filter((group) => group !== lower)
      .map((group) => (group === primary ? combined : group));
  }

  if (state.targetRank !== 8) return groups;

  const upperRank = state.targetRank + 1;
  const upperMaterials = selectedSlots()
    .map((slot) => DATA.materials.find((material) => material.rank === upperRank && material.slot === slot))
    .filter(Boolean);
  if (upperMaterials.length === 0) return groups;

  const collectionBatch = Math.max(1, ...primary.shortages.values());
  const upperMaxOwned = Math.max(0, ...upperMaterials.map((material) => materialCount(material.id)));
  const combinedShortages = new Map(primary.shortages);
  upperMaterials.forEach((material) => {
    combinedShortages.set(material.id, Math.max(1, upperMaxOwned + collectionBatch - materialCount(material.id)));
  });

  const combined = {
    ...primary,
    key: `${primary.key}+R${upperRank}`,
    label: `${primary.label} + R${upperRank}均等収集`,
    shortages: combinedShortages,
    upperRank,
    primaryMaterialIds: new Set(primary.shortages.keys()),
    upperMaterialIds: new Set(upperMaterials.map((material) => material.id)),
  };

  return groups.map((group) => (group === primary ? combined : group));
}

function groupShortages(shortages) {
  const groups = new Map();

  shortages.forEach((amount, id) => {
    const material = byMaterial.get(id);
    if (!material) return;

    const key = `${material.rank}:${material.kind}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        rank: material.rank,
        kind: material.kind,
        label: `R${material.rank}${KIND_LABELS[material.kind]}`,
        priority: groupPriority(material.rank, material.kind),
        shortages: new Map(),
      });
    }

    groups.get(key).shortages.set(id, amount);
  });

  return [...groups.values()].sort((a, b) => b.priority - a.priority);
}

function groupPriority(rank, kind) {
  return rank * 10 + (kind === "blueprint" ? 2 : 1);
}

function recommendationPlanKey() {
  return `${state.targetRank}:${state.build}`;
}

function rememberRecommendationPlans(groupPlans) {
  state.recommendationPlans ||= {};
  state.recommendationPlans[recommendationPlanKey()] = {
    groups: groupPlans.map(({ group, plan }) => ({
      key: group.key,
      stageIds: plan.steps.map((step) => step.stage.id),
      sideStageIds: plan.sideCandidates.map((candidate) => candidate.stage.id),
    })),
  };
  persistState();
}

function restoreRecommendationPlan(shortages) {
  const key = recommendationPlanKey();
  if (recommendations.dataset.planKey === key && recommendations.children.length > 0) return;

  recommendations.replaceChildren();
  recommendations.dataset.planKey = key;
  const saved = state.recommendationPlans?.[key];
  if (!saved?.groups?.length || shortages.size === 0) return;

  const groups = planningGroups(shortages);
  const groupsByKey = new Map(groups.map((group) => [group.key, group]));
  saved.groups.forEach((savedGroup) => {
    const group = groupsByKey.get(savedGroup.key);
    if (!group) return;

    const graph = buildStageEdges(group, shortages);
    const candidates = new Map(
      [...graph.edges, ...graph.doubleEdges, ...graph.singles].map((candidate) => [candidate.stage.id, candidate])
    );
    const steps = savedGroup.stageIds.map((stageId) => candidates.get(stageId)).filter(Boolean);
    const sideCandidates = savedGroup.sideStageIds.map((stageId) => candidates.get(stageId)).filter(Boolean);
    if (steps.length === 0 && sideCandidates.length === 0) return;

    const plan = buildPlanFromSelectedEdges(group, shortages, steps, sideCandidates);
    renderPlanBlock(group, plan, shortages, groups);
  });
}

function planGroupByGraphMatching(group, allShortages) {
  const graph = buildStageEdges(group, allShortages);
  const mainEdges = [...graph.edges, ...graph.doubleEdges];
  const sideCandidates = graph.singles.sort(compareStageCandidates).slice(0, 4);
  const matching = solveSmallWeightedMatching(
    graph.nodes,
    graph.edges,
    graph.doubleEdges,
    group.primaryMaterialIds || new Set(graph.nodes)
  );
  const steps = matching.edges.sort(compareStageCandidates);
  if (steps.length === 0 && sideCandidates.length === 0 && mainEdges.length === 0) return null;
  return buildPlanFromSelectedEdges(group, allShortages, steps, sideCandidates);
}

function buildPlanFromSelectedEdges(group, allShortages, steps, sideCandidates) {
  const remainingAll = new Map(allShortages);

  steps.forEach((step) => applyFocusRuns(remainingAll, step));

  const covered = new Set();
  steps.forEach((step) => step.activeDrops.forEach((id) => covered.add(id)));
  const leftovers = [...group.shortages.keys()].filter((id) => !covered.has(id));

  return {
    steps,
    sideCandidates,
    leftovers,
    beforeStoneCost: calculateRequiredStones(allShortages),
    afterStoneCost: calculateRequiredStones(remainingAll),
  };
}

function buildStageEdges(group, allShortages) {
  const nodes = [...group.shortages.keys()];
  const bySignature = new Map();
  const singlesBySignature = new Map();
  const beforeStoneCost = calculateRequiredStones(allShortages);

  DATA.stages.forEach((stage) => {
    if (!isStageWithinExplorationRank(stage)) return;

    const dropCounts = countDrops(stage.drops);
    const activeDrops = [...dropCounts.keys()].filter((id) => (group.shortages.get(id) || 0) > 0);
    if (activeDrops.length === 0) return;

    const activeDropUnits = activeDrops.reduce((sum, id) => sum + dropCounts.get(id), 0);
    const type = classifyGraphCandidate(activeDrops, activeDropUnits, group);
    const focusRuns = Math.min(...activeDrops.map((id) => Math.ceil(group.shortages.get(id) / dropCounts.get(id))));
    const afterShortages = cloneShortages(allShortages);
    dropCounts.forEach((count, id) => {
      if (afterShortages.has(id)) afterShortages.set(id, Math.max(0, afterShortages.get(id) - focusRuns * count));
    });

    const uniqueDrops = [...dropCounts.keys()];
    const offBuildDrops = uniqueDrops.filter((id) => isOffBuildWeapon(byMaterial.get(id)));
    const requiredWeaponDrops = activeDrops.filter((id) => isRequiredBuildWeapon(byMaterial.get(id)));
    const secondaryDrops = uniqueDrops.filter((id) => !group.shortages.has(id) && (allShortages.get(id) || 0) > 0);
    const usefulIds = new Set([...activeDrops, ...secondaryDrops]);
    const wasteDrops = uniqueDrops.filter((id) => !usefulIds.has(id) && !offBuildDrops.includes(id));
    const afterStoneCost = calculateRequiredStones(afterShortages);
    const candidate = {
      stage,
      type,
      isOffBuild: offBuildDrops.length > 0,
      hasRequiredWeapon: requiredWeaponDrops.length > 0,
      dropCounts,
      activeDrops,
      activeDropUnits,
      secondaryDrops,
      wasteDrops,
      offBuildDrops,
      requiredWeaponDrops,
      focusRuns,
      beforeStoneCost,
      afterStoneCost,
      stoneSaved: beforeStoneCost - afterStoneCost,
      weight: 0,
    };
    candidate.weight = graphEdgeWeight(candidate);

    const signature = graphCandidateSignature(candidate);
    const targetMap = type === "single" ? singlesBySignature : bySignature;
    const current = targetMap.get(signature);
    if (!current || compareGraphCandidates(candidate, current) < 0) {
      targetMap.set(signature, candidate);
    }
  });

  const edges = [];
  const doubleEdges = [];
  bySignature.forEach((candidate) => {
    if (candidate.type === "double") {
      doubleEdges.push(candidate);
    } else {
      edges.push(candidate);
    }
  });
  applyGraphEdgeBonuses(group, [...edges, ...doubleEdges]);

  return {
    nodes,
    edges,
    doubleEdges,
    singles: [...singlesBySignature.values()],
  };
}

function renderExplorationNetwork(shortages) {
  closeNetworkMaterialEditor();
  renderNetworkStoneSummary(shortages);
  const groups = networkGroups(shortages);
  networkGroupSelect.replaceChildren();
  networkGraph.replaceChildren();
  networkDetails.replaceChildren();

  if (groups.length === 0) {
    networkGroupKey = "";
    networkGraph.innerHTML = `<div class="complete-note">不足素材がないため、探索ネットワークはありません。</div>`;
    return;
  }

  if (!groups.some((group) => group.key === networkGroupKey)) {
    networkGroupKey = groups[0].key;
  }

  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.key;
    option.textContent = `${group.label}（${group.shortages.size}素材）`;
    networkGroupSelect.append(option);
  });
  networkGroupSelect.value = networkGroupKey;

  const group = groups.find((item) => item.key === networkGroupKey);
  const graph = visibleNetworkGraph(buildStageEdges(group, shortages));
  const adoptedStageIds = selectedNetworkStageIds(group);
  const selectionKey = manualNetworkSelectionKey(group);
  const validStageIds = new Set(
    [...graph.edges, ...graph.doubleEdges, ...graph.singles].map((candidate) => candidate.stage.id)
  );
  if (!networkSelectionDrafts.has(selectionKey)) {
    networkSelectionDrafts.set(selectionKey, new Set(savedManualNetworkSelection(group)));
  }
  const manualStageIds = new Set(
    [...networkSelectionDrafts.get(selectionKey)].filter((stageId) => validStageIds.has(stageId))
  );
  networkSelectionDrafts.set(selectionKey, manualStageIds);
  const selection = { group, adoptedStageIds, manualStageIds, selectionKey };
  renderNetworkSvg(group, graph, selection);
  renderNetworkCandidateDetails(graph, selection);
}

function networkGroups(shortages) {
  const actualGroups = groupShortages(shortages).map(completeNetworkGroupWeapons);
  const actualByRank = new Map(actualGroups.map((group) => [group.rank, group]));
  const requiredRanks = [...new Set(requirementsForRank().map((requirement) => requirement.materialRank))]
    .sort((a, b) => a - b);
  if (requiredRanks.length === 0) return [];
  const comparisonBatch = Math.max(
    1,
    ...actualGroups.flatMap((group) => [...group.shortages.values()])
  );
  const rankGroups = new Map(actualByRank);
  const minimumRank = requiredRanks[0];
  const maximumRank = requiredRanks[requiredRanks.length - 1];

  for (let rank = minimumRank - 1; rank <= maximumRank + 1; rank += 1) {
    if (!rankGroups.has(rank)) {
      const comparisonGroup = buildComparisonNetworkGroup(rank, comparisonBatch);
      if (comparisonGroup) rankGroups.set(rank, comparisonGroup);
    }
  }

  const singles = requiredRanks.map((rank) => rankGroups.get(rank)).filter(Boolean);
  const pairs = [];
  for (let lowerRank = minimumRank - 1; lowerRank <= maximumRank; lowerRank += 1) {
    const lower = rankGroups.get(lowerRank);
    const upper = rankGroups.get(lowerRank + 1);
    if (!lower || !upper) continue;
    pairs.push(combineNetworkGroups(
      [lower, upper],
      `${lower.label} + ${upper.label}`
    ));
  }
  return [...singles, ...pairs];
}

function buildComparisonNetworkGroup(rank, comparisonBatch) {
  const materials = DATA.materials.filter((material) => material.rank === rank);
  if (materials.length === 0) return null;

  const activeMaterials = materials.filter((material) => !isOffBuildWeapon(material));
  const maxOwned = Math.max(0, ...activeMaterials.map((material) => materialCount(material.id)));
  const shortages = new Map(materials.map((material) => [
    material.id,
    Math.max(1, maxOwned + comparisonBatch - materialCount(material.id)),
  ]));
  const offBuildMaterialIds = new Set(materials.filter(isOffBuildWeapon).map((material) => material.id));
  const kind = materials[0].kind;
  return {
    key: `network-rank:${rank}:${kind}:${state.build}`,
    rank,
    kind,
    label: `R${rank}${KIND_LABELS[kind]}`,
    priority: groupPriority(rank, kind),
    shortages,
    displayAmounts: new Map(shortages),
    primaryMaterialIds: new Set([...shortages.keys()].filter((id) => !offBuildMaterialIds.has(id))),
    offBuildMaterialIds,
  };
}

function completeNetworkGroupWeapons(group) {
  const materials = DATA.materials.filter((material) => (
    material.rank === group.rank && material.kind === group.kind
  ));
  const comparisonAmount = Math.max(1, ...group.shortages.values());
  const shortages = new Map(materials.map((material) => [
    material.id,
    Math.max(1, group.shortages.get(material.id) || comparisonAmount),
  ]));
  const displayAmounts = new Map(materials.map((material) => [
    material.id,
    group.shortages.get(material.id) || 0,
  ]));
  const offBuildMaterialIds = new Set(materials.filter(isOffBuildWeapon).map((material) => material.id));
  return {
    ...group,
    shortages,
    displayAmounts,
    primaryMaterialIds: new Set([...shortages.keys()].filter((id) => !offBuildMaterialIds.has(id))),
    offBuildMaterialIds,
  };
}

function combineNetworkGroups(groups, label) {
  const primary = groups.find((group) => group.rank === state.targetRank) || groups[0];
  const offBuildMaterialIds = new Set(groups.flatMap((group) => [...(group.offBuildMaterialIds || [])]));
  return {
    key: `network-combined:${groups.map((group) => group.key).join("+")}`,
    label,
    rank: state.targetRank,
    kind: "integrated",
    shortages: new Map(groups.flatMap((group) => [...group.shortages])),
    displayAmounts: new Map(groups.flatMap((group) => [...(group.displayAmounts || group.shortages)])),
    primaryMaterialIds: new Set([...primary.shortages.keys()].filter((id) => !offBuildMaterialIds.has(id))),
    offBuildMaterialIds,
    usesCombinedSavedPlans: true,
    isMultiRankNetwork: true,
  };
}

function visibleNetworkGraph(graph) {
  const nodeIds = new Set(graph.nodes);
  const isFullyVisible = (candidate) => candidate.stage.drops.every((id) => nodeIds.has(id));
  return {
    ...graph,
    edges: graph.edges.filter(isFullyVisible),
    doubleEdges: graph.doubleEdges.filter(isFullyVisible),
    singles: graph.singles.filter(isFullyVisible),
  };
}

function selectedNetworkStageIds(group) {
  const saved = state.recommendationPlans?.[recommendationPlanKey()];
  if (group.usesCombinedSavedPlans) {
    return new Set((saved?.groups || []).flatMap((savedGroup) => savedGroup.stageIds || []));
  }
  const savedGroup = saved?.groups?.find((savedGroup) => (
    savedGroup.key === group.key ||
    savedGroup.key.startsWith(`${group.key}+`) ||
    savedGroup.key.endsWith(`+${group.key}`)
  ));
  return new Set(savedGroup?.stageIds || []);
}

function manualNetworkSelectionKey(group) {
  return `${recommendationPlanKey()}:${group.key}`;
}

function savedManualNetworkSelection(group) {
  return state.customNetworkSelections?.[manualNetworkSelectionKey(group)] || [];
}

function currentNetworkGroup() {
  return networkGroups(calculateNeeds().shortages).find((group) => group.key === networkGroupKey);
}

function toggleManualNetworkStage(group, stageId) {
  const key = manualNetworkSelectionKey(group);
  const draft = new Set(networkSelectionDrafts.get(key) || savedManualNetworkSelection(group));
  if (draft.has(stageId)) {
    draft.delete(stageId);
  } else {
    draft.add(stageId);
  }
  networkSelectionDrafts.set(key, draft);
  renderExplorationNetwork(calculateNeeds().shortages);
}

function useAdoptedNetworkSelection() {
  const group = currentNetworkGroup();
  if (!group) return;
  networkSelectionDrafts.set(manualNetworkSelectionKey(group), new Set(selectedNetworkStageIds(group)));
  renderExplorationNetwork(calculateNeeds().shortages);
}

function restoreSavedNetworkSelection() {
  const group = currentNetworkGroup();
  if (!group) return;
  networkSelectionDrafts.set(manualNetworkSelectionKey(group), new Set(savedManualNetworkSelection(group)));
  renderExplorationNetwork(calculateNeeds().shortages);
}

function saveManualNetworkSelection() {
  const group = currentNetworkGroup();
  if (!group) return;
  const key = manualNetworkSelectionKey(group);
  state.customNetworkSelections ||= {};
  state.customNetworkSelections[key] = [...(networkSelectionDrafts.get(key) || [])];
  persistState();
  networkSaveSelectionButton.classList.remove("is-saved");
  void networkSaveSelectionButton.offsetWidth;
  networkSaveSelectionButton.classList.add("is-saved");
}

function renderNetworkSvg(group, graph, selection) {
  const { adoptedStageIds, manualStageIds } = selection;
  const layout = networkNodeLayout(group, graph.nodes);
  const { width, height } = layout;
  const stateKey = `${recommendationPlanKey()}:${group.key}`;
  const savedView = networkViewStates.get(stateKey);
  const positions = new Map(layout.positions);
  savedView?.positions?.forEach((position, id) => {
    if (positions.has(id)) positions.set(id, { ...position });
  });
  const svg = createSvgElement("svg", {
    role: "img",
    "aria-label": `${group.label}の探索ネットワーク`,
  });
  setNetworkViewBox(svg, savedView?.viewBox || { x: 0, y: 0, width, height });
  const edgeLayer = createSvgElement("g", { class: "network-edge-layer" });
  const nodeLayer = createSvgElement("g", { class: "network-node-layer" });
  svg.append(edgeLayer, nodeLayer);

  const edges = [...graph.edges, ...graph.doubleEdges].sort((a, b) => {
    return (
      Number(manualStageIds.has(a.stage.id)) - Number(manualStageIds.has(b.stage.id)) ||
      Number(adoptedStageIds.has(a.stage.id)) - Number(adoptedStageIds.has(b.stage.id))
    );
  });
  const edgeElements = [];
  edges.forEach((edge) => {
    const rendered = renderNetworkEdge(
      edgeLayer,
      edge,
      positions,
      adoptedStageIds.has(edge.stage.id),
      manualStageIds.has(edge.stage.id),
      () => toggleManualNetworkStage(group, edge.stage.id)
    );
    if (rendered) edgeElements.push(rendered);
  });

  const primaryIds = group.primaryMaterialIds || new Set(group.shortages.keys());
  const offBuildIds = group.offBuildMaterialIds || new Set();
  const nodeElements = new Map();
  graph.nodes.forEach((id) => {
    const material = byMaterial.get(id);
    const position = positions.get(id);
    if (!material || !position) return;

    const node = createSvgElement("g", {
      class: [
        "network-node",
        primaryIds.has(id) ? "is-primary" : "",
        offBuildIds.has(id) ? "is-off-build" : "",
      ].filter(Boolean).join(" "),
      transform: `translate(${position.x} ${position.y})`,
    });
    const displayedAmount = group.displayAmounts?.get(id) ?? group.shortages.get(id) ?? 0;
    const amountLabel = offBuildIds.has(id) ? "現在の型では対象外" : `不足 ${displayedAmount}`;
    node.append(createSvgElement("title", {}, `${materialName(material)} / ${amountLabel}`));
    node.append(createSvgElement("rect", {
      class: "network-node-frame",
      x: -40,
      y: -36,
      width: 80,
      height: 72,
      rx: 8,
    }));
    node.append(createSvgElement("image", {
      href: material.image,
      x: -15,
      y: -32,
      width: 30,
      height: 30,
    }));
    node.append(createSvgElement("text", {
      class: "network-node-title",
      x: 0,
      y: 12,
    }, networkNodeLabel(material)));
    node.append(createSvgElement("text", {
      class: "network-node-amount",
      x: 0,
      y: 29,
    }, offBuildIds.has(id) ? "対象外" : `不足 ${displayedAmount}`));
    node.dataset.materialId = id;
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (performance.now() < suppressNetworkNodeClickUntil) return;
      openNetworkMaterialEditor(id, node);
    });
    nodeLayer.append(node);
    nodeElements.set(id, node);
  });

  networkGraph.append(svg);
  const defaultViewBox = fitNetworkViewBox(svg, networkGraph);
  setNetworkViewBox(svg, savedView?.viewBox || defaultViewBox);
  activeNetworkController = setupNetworkInteraction({
    svg,
    stateKey,
    width,
    height,
    defaultViewBox,
    positions,
    defaultPositions: new Map([...layout.positions].map(([id, point]) => [id, { ...point }])),
    nodeElements,
    edgeElements,
  });
}

function networkNodeLayout(group, nodes) {
  const width = nodes.length > 12 ? 900 : 720;
  const height = nodes.length > 12 ? 620 : 480;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = nodes.length > 12 ? 250 : nodes.length > 8 ? 190 : 165;
  const positions = new Map();
  const offBuildIds = group.offBuildMaterialIds || new Set();
  const activeNodes = nodes.filter((id) => !offBuildIds.has(id));
  const offBuildNodes = nodes.filter((id) => offBuildIds.has(id));
  const slotOrder = new Map(DATA.slots.map((slot, index) => [slot, index]));
  const startAngle = group.isMultiRankNetwork ? -Math.PI / 2 : -Math.PI * 2 / 3;
  const orderedNodes = [...activeNodes].sort((a, b) => {
    const materialA = byMaterial.get(a);
    const materialB = byMaterial.get(b);
    if (group.isMultiRankNetwork && materialA?.rank !== materialB?.rank) {
      return (materialB?.rank || 0) - (materialA?.rank || 0);
    }
    return (slotOrder.get(materialA?.slot) || 0) - (slotOrder.get(materialB?.slot) || 0);
  });
  orderedNodes.forEach((id, index) => {
    const angle = startAngle + (Math.PI * 2 * index) / activeNodes.length;
    positions.set(id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  });
  offBuildNodes.forEach((id, index) => {
    const material = byMaterial.get(id);
    const sameRankIndexes = orderedNodes
      .map((nodeId, nodeIndex) => ({ nodeId, nodeIndex }))
      .filter(({ nodeId }) => byMaterial.get(nodeId)?.rank === material?.rank)
      .map(({ nodeIndex }) => nodeIndex);
    const averageIndex = sameRankIndexes.length
      ? sameRankIndexes.reduce((sum, nodeIndex) => sum + nodeIndex, 0) / sameRankIndexes.length
      : index;
    const angle = startAngle + (Math.PI * 2 * averageIndex) / activeNodes.length;
    const outerRadius = radius + 105;
    positions.set(id, {
      x: centerX + Math.cos(angle) * outerRadius,
      y: centerY + Math.sin(angle) * outerRadius,
    });
  });
  return { width, height, positions };
}

function renderNetworkEdge(svg, edge, positions, isSelected, isManual, onToggle) {
  const nodeIds = edgeNodesForMatching(edge);
  const edgeClass = [
    "network-edge",
    edge.type === "double" ? "is-double" : "",
    isSelected ? "is-selected" : "",
    isManual ? "is-manual" : "",
  ].filter(Boolean).join(" ");
  let labelX;
  let labelY;
  let shape;

  if (nodeIds.length === 1) {
    const point = positions.get(nodeIds[0]);
    if (!point) return;
    shape = createSvgElement("path", {
      class: edgeClass,
      d: `M ${point.x - 20} ${point.y - 25} C ${point.x - 68} ${point.y - 84}, ${point.x + 68} ${point.y - 84}, ${point.x + 20} ${point.y - 25}`,
    });
    labelX = point.x;
    labelY = point.y - 75;
  } else {
    const start = positions.get(nodeIds[0]);
    const end = positions.get(nodeIds[1]);
    if (!start || !end) return;
    shape = createSvgElement("line", {
      class: edgeClass,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    });
    labelX = (start.x + end.x) / 2;
    labelY = (start.y + end.y) / 2 - 6;
  }

  shape.append(createSvgElement("title", {}, networkEdgeDescription(edge)));
  shape.addEventListener("click", (event) => {
    event.stopPropagation();
    if (performance.now() < suppressNetworkEdgeClickUntil) return;
    onToggle();
  });
  svg.append(shape);
  const label = createSvgElement("text", {
    class: [
      "network-edge-label",
      isSelected ? "is-selected" : "",
      isManual ? "is-manual" : "",
    ].filter(Boolean).join(" "),
    x: labelX,
    y: labelY,
    "text-anchor": "middle",
  }, edge.stage.id);
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    if (performance.now() < suppressNetworkEdgeClickUntil) return;
    onToggle();
  });
  svg.append(label);
  return { edge, nodeIds, shape, label };
}

function fitNetworkViewBox(svg) {
  const layerBounds = [...svg.children]
    .filter((element) => typeof element.getBBox === "function")
    .map((element) => element.getBBox())
    .filter((bounds) => bounds.width > 0 || bounds.height > 0);
  if (layerBounds.length === 0) return parseNetworkViewBox(svg);

  const minX = Math.min(...layerBounds.map((bounds) => bounds.x));
  const minY = Math.min(...layerBounds.map((bounds) => bounds.y));
  const maxX = Math.max(...layerBounds.map((bounds) => bounds.x + bounds.width));
  const maxY = Math.max(...layerBounds.map((bounds) => bounds.y + bounds.height));
  const padding = 22;
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  };
}

function setupNetworkInteraction(context) {
  const {
    svg,
    stateKey,
    width,
    height,
    defaultViewBox,
    positions,
    defaultPositions,
    nodeElements,
    edgeElements,
  } = context;
  const workspace = svg.closest(".network-workspace");
  let viewBox = parseNetworkViewBox(svg);
  let drag = null;
  let pinch = null;
  const activePointers = new Map();

  function saveState() {
    networkViewStates.set(stateKey, {
      viewBox: { ...viewBox },
      positions: new Map([...positions].map(([id, point]) => [id, { ...point }])),
    });
  }

  function applyViewBox() {
    setNetworkViewBox(svg, viewBox);
    saveState();
  }

  function zoom(factor, center = null) {
    const minWidth = defaultViewBox.width * 0.28;
    const maxWidth = defaultViewBox.width * 2.5;
    const nextWidth = Math.min(maxWidth, Math.max(minWidth, viewBox.width * factor));
    const nextHeight = nextWidth * (defaultViewBox.height / defaultViewBox.width);
    const focus = center || {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    const ratioX = (focus.x - viewBox.x) / viewBox.width;
    const ratioY = (focus.y - viewBox.y) / viewBox.height;
    viewBox = {
      x: focus.x - nextWidth * ratioX,
      y: focus.y - nextHeight * ratioY,
      width: nextWidth,
      height: nextHeight,
    };
    applyViewBox();
  }

  function resetView() {
    viewBox = { ...defaultViewBox };
    applyViewBox();
  }

  function resetLayout() {
    defaultPositions.forEach((position, id) => positions.set(id, { ...position }));
    nodeElements.forEach((node, id) => {
      const position = positions.get(id);
      node.setAttribute("transform", `translate(${position.x} ${position.y})`);
    });
    edgeElements.forEach((rendered) => updateNetworkEdgeElement(rendered, positions));
    resetView();
  }

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.88 : 1.14, networkPointerToSvg(svg, event.clientX, event.clientY));
  }, { passive: false });

  svg.addEventListener("pointerdown", (event) => {
    const node = event.target.closest?.(".network-node");
    const selectableEdge = event.target.closest?.(".network-edge, .network-edge-label");
    if (selectableEdge && event.pointerType === "mouse") return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    svg.setPointerCapture(event.pointerId);

    if (activePointers.size === 2) {
      if (drag?.type === "node") nodeElements.get(drag.id)?.classList.remove("is-dragging");
      drag = null;
      svg.classList.remove("is-panning");
      const points = [...activePointers.values()];
      const midpoint = networkPointerMidpoint(points[0], points[1]);
      pinch = {
        distance: networkPointerDistance(points[0], points[1]),
        focus: networkPointerToSvg(svg, midpoint.x, midpoint.y),
        viewBox: { ...viewBox },
      };
      return;
    }

    if (node) {
      event.stopPropagation();
      const id = node.dataset.materialId;
      const point = networkPointerToSvg(svg, event.clientX, event.clientY);
      const position = positions.get(id);
      drag = {
        type: "node",
        id,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: false,
        offsetX: point.x - position.x,
        offsetY: point.y - position.y,
      };
      node.classList.add("is-dragging");
      return;
    }

    const useWorkspaceScroll = event.pointerType !== "mouse" && workspace?.scrollWidth > workspace?.clientWidth;
    drag = {
      type: useWorkspaceScroll ? "workspace-scroll" : "pan",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox: { ...viewBox },
      scrollLeft: workspace?.scrollLeft || 0,
      scrollTop: workspace?.scrollTop || 0,
      moved: false,
    };
    svg.classList.add(useWorkspaceScroll ? "is-workspace-scrolling" : "is-panning");
  });

  svg.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch && activePointers.size >= 2) {
      const points = [...activePointers.values()].slice(0, 2);
      const distance = Math.max(1, networkPointerDistance(points[0], points[1]));
      const midpoint = networkPointerMidpoint(points[0], points[1]);
      const rect = svg.getBoundingClientRect();
      const minWidth = defaultViewBox.width * 0.28;
      const maxWidth = defaultViewBox.width * 2.5;
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, pinch.viewBox.width * pinch.distance / distance)
      );
      const nextHeight = nextWidth * (defaultViewBox.height / defaultViewBox.width);
      const ratioX = (midpoint.x - rect.left) / rect.width;
      const ratioY = (midpoint.y - rect.top) / rect.height;
      viewBox = {
        x: pinch.focus.x - nextWidth * ratioX,
        y: pinch.focus.y - nextHeight * ratioY,
        width: nextWidth,
        height: nextHeight,
      };
      setNetworkViewBox(svg, viewBox);
      return;
    }

    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "node") {
      if (Math.abs(event.clientX - drag.clientX) > 6 || Math.abs(event.clientY - drag.clientY) > 6) {
        drag.moved = true;
        suppressNetworkNodeClickUntil = performance.now() + 350;
      }
      const point = networkPointerToSvg(svg, event.clientX, event.clientY);
      const position = {
        x: point.x - drag.offsetX,
        y: point.y - drag.offsetY,
      };
      positions.set(drag.id, position);
      nodeElements.get(drag.id)?.setAttribute("transform", `translate(${position.x} ${position.y})`);
      edgeElements
        .filter((rendered) => rendered.nodeIds.includes(drag.id))
        .forEach((rendered) => updateNetworkEdgeElement(rendered, positions));
      return;
    }

    if (drag.type === "workspace-scroll") {
      const deltaX = event.clientX - drag.clientX;
      const deltaY = event.clientY - drag.clientY;
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        drag.moved = true;
        suppressNetworkEdgeClickUntil = performance.now() + 350;
      }
      workspace.scrollLeft = drag.scrollLeft - deltaX;
      workspace.scrollTop = drag.scrollTop - deltaY;
      return;
    }

    const rect = svg.getBoundingClientRect();
    viewBox = {
      ...drag.viewBox,
      x: drag.viewBox.x - (event.clientX - drag.clientX) * drag.viewBox.width / rect.width,
      y: drag.viewBox.y - (event.clientY - drag.clientY) * drag.viewBox.height / rect.height,
    };
    setNetworkViewBox(svg, viewBox);
  });

  const finishDrag = (event) => {
    activePointers.delete(event.pointerId);
    if (pinch) {
      if (activePointers.size < 2) {
        pinch = null;
        drag = null;
        svg.classList.remove("is-panning", "is-workspace-scrolling");
        saveState();
      }
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "node") nodeElements.get(drag.id)?.classList.remove("is-dragging");
    svg.classList.remove("is-panning", "is-workspace-scrolling");
    drag = null;
    saveState();
  };
  svg.addEventListener("pointerup", finishDrag);
  svg.addEventListener("pointercancel", finishDrag);

  return { zoom, resetView, resetLayout };
}

function openNetworkMaterialEditor(materialId, node) {
  const material = byMaterial.get(materialId);
  if (!material) return;

  editingNetworkMaterialId = materialId;
  const current = materialCount(materialId);
  const maxRequired = Math.max(current, networkMaterialMax(materialId), 1);
  networkMaterialEditorImage.src = material.image;
  networkMaterialEditorImage.alt = materialName(material);
  networkMaterialEditorTitle.textContent = materialName(material);
  networkMaterialEditorCurrent.textContent = `現在 ${current}`;
  networkMaterialEditorControl.innerHTML = renderNumberControl({
    value: current,
    max: maxRequired,
    ariaLabel: `${materialName(material)} 所持数`,
    attributes: `data-network-material-input="${materialId}"`,
  });
  networkMaterialEditor.hidden = false;

  const contentRect = networkMaterialEditor.parentElement.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const editorWidth = networkMaterialEditor.offsetWidth;
  const editorHeight = networkMaterialEditor.offsetHeight;
  const left = Math.min(
    contentRect.width - editorWidth - 10,
    Math.max(10, nodeRect.left - contentRect.left + nodeRect.width / 2 - editorWidth / 2)
  );
  const preferredTop = nodeRect.bottom - contentRect.top + 8;
  const top = preferredTop + editorHeight <= contentRect.height - 10
    ? preferredTop
    : Math.max(10, nodeRect.top - contentRect.top - editorHeight - 8);
  networkMaterialEditor.style.left = `${left}px`;
  networkMaterialEditor.style.top = `${top}px`;

  const control = networkMaterialEditorControl.querySelector("input, select");
  requestAnimationFrame(() => {
    control?.focus();
    if (control?.tagName === "INPUT") control.select();
  });
}

function closeNetworkMaterialEditor() {
  editingNetworkMaterialId = "";
  networkMaterialEditor.hidden = true;
}

function saveNetworkMaterialEditor() {
  if (!editingNetworkMaterialId) return;
  const control = networkMaterialEditorControl.querySelector("input, select");
  const materialId = editingNetworkMaterialId;
  closeNetworkMaterialEditor();
  setMaterial(materialId, control?.value ?? 0);
}

function setNetworkMaterialEditorMax() {
  if (!editingNetworkMaterialId) return;
  const materialId = editingNetworkMaterialId;
  const maxValue = networkMaterialMax(materialId);
  closeNetworkMaterialEditor();
  setMaterial(materialId, maxValue);
}

function networkMaterialMax(materialId) {
  const currentNeed = calculateNeeds().needs.find((need) => need.material.id === materialId);
  if (currentNeed) return currentNeed.required;

  const material = byMaterial.get(materialId);
  if (!material) return 0;
  return Math.max(
    0,
    ...DATA.requirements
      .filter((requirement) => (
        requirement.materialRank === material.rank &&
        requirement.kind === material.kind
      ))
      .map(getRequirementAmount)
  );
}

function updateNetworkEdgeElement(rendered, positions) {
  const { nodeIds, shape, label } = rendered;
  if (nodeIds.length === 1) {
    const point = positions.get(nodeIds[0]);
    shape.setAttribute(
      "d",
      `M ${point.x - 20} ${point.y - 25} C ${point.x - 68} ${point.y - 84}, ${point.x + 68} ${point.y - 84}, ${point.x + 20} ${point.y - 25}`
    );
    label.setAttribute("x", point.x);
    label.setAttribute("y", point.y - 75);
    return;
  }

  const start = positions.get(nodeIds[0]);
  const end = positions.get(nodeIds[1]);
  shape.setAttribute("x1", start.x);
  shape.setAttribute("y1", start.y);
  shape.setAttribute("x2", end.x);
  shape.setAttribute("y2", end.y);
  label.setAttribute("x", (start.x + end.x) / 2);
  label.setAttribute("y", (start.y + end.y) / 2 - 6);
}

function networkPointerToSvg(svg, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function networkPointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function networkPointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function parseNetworkViewBox(svg) {
  const values = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function setNetworkViewBox(svg, viewBox) {
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
}

function renderNetworkCandidateDetails(graph, selection) {
  const { group, adoptedStageIds, manualStageIds } = selection;
  const mainEdges = [...graph.edges, ...graph.doubleEdges];
  const candidates = [...mainEdges, ...graph.singles].sort((a, b) => {
    return (
      Number(manualStageIds.has(b.stage.id)) - Number(manualStageIds.has(a.stage.id)) ||
      Number(adoptedStageIds.has(b.stage.id)) - Number(adoptedStageIds.has(a.stage.id)) ||
      compareStageCandidates(a, b)
    );
  });

  if (candidates.length === 0) {
    networkDetails.innerHTML = `<div class="complete-note">このグループを含むステージ候補はありません。</div>`;
    return;
  }

  candidates.forEach((candidate) => {
    const isSelected = adoptedStageIds.has(candidate.stage.id);
    const isManual = manualStageIds.has(candidate.stage.id);
    const isSingle = candidate.type === "single";
    const row = document.createElement("div");
    row.className = [
      "network-detail",
      isSelected ? "is-selected" : "",
      isManual ? "is-manual" : "",
      isSingle ? "is-single" : "",
    ].filter(Boolean).join(" ");

    const dropLabel = candidate.activeDrops
      .map((id) => byMaterial.get(id))
      .filter(Boolean)
      .map(materialSlotName)
      .join(" + ");
    const meta = [
      networkTypeLabel(candidate.type),
      `定石削減 ${candidate.stoneSaved}`,
      `均等度 +${candidate.balanceBonus || 0}`,
      `代替希少 +${candidate.scarcityBonus || 0}`,
      `副産物 ${candidate.secondaryDrops.length}`,
      `不要 ${candidate.wasteDrops.length}`,
      `逆武器 ${candidate.offBuildDrops.length}`,
    ].join(" / ");

    row.innerHTML = `
      <div class="network-detail-stage">${candidate.stage.id}</div>
      <div class="network-detail-main">
        <div class="network-detail-title">${dropLabel || "片側不足候補"}</div>
        <div class="network-detail-meta">${meta}</div>
      </div>
      <div class="network-detail-weight">重み ${Math.round(candidate.weight || 0)}</div>
    `;
    row.addEventListener("click", () => toggleManualNetworkStage(group, candidate.stage.id));
    networkDetails.append(row);
  });
}

function networkEdgeDescription(edge) {
  const drops = edge.activeDrops
    .map((id) => byMaterial.get(id))
    .filter(Boolean)
    .map(materialName)
    .join(" + ");
  return `${edge.stage.id}: ${drops} / 重み ${Math.round(edge.weight || 0)}`;
}

function networkNodeLabel(material) {
  const labels = {
    armor: "鎧",
    hat: "帽子",
    shinyAccessory: "煌めく",
    boots: "ブーツ",
    fancyAccessory: "華麗",
    physicalWeapon: "物理武器",
    magicWeapon: "魔法武器",
  };
  return `R${material.rank} ${labels[material.slot]}`;
}

function networkTypeLabel(type) {
  return {
    pair: "ペア",
    double: "同素材2枠",
    "primary-single": "対象単独",
    "upper-single": "上位単独",
    single: "片側不足",
  }[type] || type;
}

function createSvgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function applyGraphEdgeBonuses(group, edges) {
  const degree = new Map([...group.shortages.keys()].map((id) => [id, 0]));
  edges.filter((edge) => edge.type === "pair" || edge.type === "double").forEach((edge) => {
    edgeNodesForMatching(edge).forEach((id) => {
      if (degree.has(id)) degree.set(id, degree.get(id) + 1);
    });
  });

  const maxDegree = Math.max(0, ...degree.values());
  edges.forEach((edge) => {
    edge.balanceBonus = graphBalanceBonus(edge, group);
    edge.scarcityBonus = graphScarcityBonus(edge, degree, maxDegree);
    edge.weight = graphEdgeWeight(edge);
  });
}

function graphBalanceBonus(edge, group) {
  if (edge.type === "double" || edge.type === "primary-single" || edge.type === "upper-single") return 120;

  const normalizedNeeds = edgeNodesForMatching(edge).map((id) => {
    const perDrop = edge.dropCounts.get(id) || 1;
    return (group.shortages.get(id) || 0) / perDrop;
  });
  const maxNeed = Math.max(1, ...normalizedNeeds);
  const minNeed = Math.min(...normalizedNeeds);
  return Math.round(160 * (1 - (maxNeed - minNeed) / maxNeed));
}

function graphScarcityBonus(edge, degree, maxDegree) {
  return edgeNodesForMatching(edge).reduce((sum, id) => {
    return sum + Math.max(0, maxDegree - (degree.get(id) || 0)) * 55;
  }, 0);
}

function solveSmallWeightedMatching(nodes, edges, doubleEdges, primaryMaterialIds) {
  const allEdges = [...edges, ...doubleEdges].filter((edge) => edge.weight > 0);
  const nodeSet = new Set(nodes);
  let best = { primaryCoveredCount: 0, score: 0, coveredCount: 0, stageScore: 0, edges: [] };

  function search(remaining, selected, score) {
    if (remaining.size === 0) {
      updateBest(selected, score);
      return;
    }

    const node = [...remaining][0];
    const withoutNode = new Set(remaining);
    withoutNode.delete(node);
    search(withoutNode, selected, score);

    allEdges.forEach((edge) => {
      const edgeNodes = edgeNodesForMatching(edge).filter((id) => nodeSet.has(id));
      if (!edgeNodes.includes(node)) return;
      if (!edgeNodes.every((id) => remaining.has(id))) return;

      const nextRemaining = new Set(remaining);
      edgeNodes.forEach((id) => nextRemaining.delete(id));
      search(nextRemaining, [...selected, edge], score + edge.weight);
    });
  }

  function updateBest(selected, score) {
    const covered = new Set();
    selected.forEach((edge) => edgeNodesForMatching(edge).forEach((id) => covered.add(id)));
    const primaryCoveredCount = [...covered].filter((id) => primaryMaterialIds.has(id)).length;
    const stageScore = selected.reduce((sum, edge) => sum + stageProgressScore(edge.stage.id), 0);
    const candidate = { primaryCoveredCount, score, coveredCount: covered.size, stageScore, edges: selected };
    if (
      candidate.primaryCoveredCount > best.primaryCoveredCount ||
      (candidate.primaryCoveredCount === best.primaryCoveredCount && candidate.score > best.score) ||
      (candidate.primaryCoveredCount === best.primaryCoveredCount &&
        candidate.score === best.score &&
        candidate.coveredCount > best.coveredCount) ||
      (candidate.primaryCoveredCount === best.primaryCoveredCount &&
        candidate.score === best.score &&
        candidate.coveredCount === best.coveredCount &&
        candidate.stageScore > best.stageScore)
    ) {
      best = candidate;
    }
  }

  search(new Set(nodes), [], 0);
  return best;
}

function graphEdgeWeight(candidate) {
  const activeKinds = candidate.type === "double" ? 2 : candidate.activeDrops.length;
  return (
    1000 * activeKinds +
    700 * candidate.requiredWeaponDrops.length +
    30 * candidate.stoneSaved -
    800 * candidate.offBuildDrops.length -
    200 * candidate.wasteDrops.length +
    60 * candidate.secondaryDrops.length +
    (candidate.balanceBonus || 0) +
    (candidate.scarcityBonus || 0) +
    stageProgressScore(candidate.stage.id)
  );
}

function classifyGraphCandidate(activeDrops, activeDropUnits, group) {
  if (activeDrops.length >= 2) return "pair";
  if (activeDrops.length === 1 && activeDropUnits >= 2) return "double";
  if (activeDrops.length === 1 && group.primaryMaterialIds?.has(activeDrops[0])) return "primary-single";
  if (activeDrops.length === 1 && group.upperMaterialIds?.has(activeDrops[0])) return "upper-single";
  return "single";
}

function graphCandidateSignature(candidate) {
  if (candidate.type === "double") return `${candidate.activeDrops[0]}:2`;
  if (candidate.type === "primary-single") return `${candidate.activeDrops[0]}:primary`;
  if (candidate.type === "upper-single") return `${candidate.activeDrops[0]}:upper`;
  if (candidate.type === "single") return `${candidate.activeDrops[0]}:1`;
  return [...candidate.activeDrops].sort().join("|");
}

function edgeNodesForMatching(edge) {
  return edge.type === "double" ? [edge.activeDrops[0]] : [...edge.activeDrops].slice(0, 2);
}

function compareGraphCandidates(a, b) {
  return (
    b.weight - a.weight ||
    Number(b.hasRequiredWeapon) - Number(a.hasRequiredWeapon) ||
    b.stoneSaved - a.stoneSaved ||
    a.offBuildDrops.length - b.offBuildDrops.length ||
    a.wasteDrops.length - b.wasteDrops.length ||
    b.secondaryDrops.length - a.secondaryDrops.length ||
    compareStage(b.stage.id, a.stage.id)
  );
}

function buildFastGroupPlan(group, allShortages) {
  const remainingGroup = new Map(group.shortages);
  const remainingAll = new Map(allShortages);
  const steps = [];
  const maxSteps = 4;

  while ([...remainingGroup.values()].some((amount) => amount > 0) && steps.length < maxSteps) {
    const candidates = stageCandidates(group, remainingGroup, remainingAll);
    const mainCandidates = candidates;
    if (mainCandidates.length === 0) break;

    const best = mainCandidates.sort(compareStageCandidates)[0];
    steps.push(best);
    applyFocusRuns(remainingGroup, best);
    applyFocusRuns(remainingAll, best);
  }

  const coverage = new Map();
  steps.forEach((step) => {
    step.stage.drops.forEach((id) => {
      if (allShortages.has(id)) coverage.set(id, (coverage.get(id) || 0) + step.focusRuns);
    });
  });

  const sideCandidates = stageCandidates(group, remainingGroup, remainingAll)
    .filter((candidate) => candidate.activeDropUnits === 1)
    .sort(compareStageCandidates)
    .slice(0, 4);

  if (steps.length === 0 && sideCandidates.length === 0) return null;

  return {
    steps,
    sideCandidates,
    coverage,
    beforeStoneCost: calculateRequiredStones(allShortages),
    afterStoneCost: calculateRequiredStones(remainingAll),
  };
}

function stageCandidates(group, groupShortages, allShortages) {
  const byPrimarySignature = new Map();
  const beforeStoneCost = calculateRequiredStones(allShortages);

  DATA.stages.forEach((stage) => {
    if (!isStageWithinExplorationRank(stage)) return;

    const dropCounts = countDrops(stage.drops);
    const activeDrops = [...dropCounts.keys()].filter((id) => (groupShortages.get(id) || 0) > 0);
    if (activeDrops.length === 0) return;

    const activeDropUnits = activeDrops.reduce((sum, id) => sum + dropCounts.get(id), 0);
    const focusRuns = Math.min(...activeDrops.map((id) => Math.ceil(groupShortages.get(id) / dropCounts.get(id))));
    const afterShortages = cloneShortages(allShortages);
    dropCounts.forEach((count, id) => {
      if (afterShortages.has(id)) afterShortages.set(id, Math.max(0, afterShortages.get(id) - focusRuns * count));
    });

    const uniqueDrops = [...dropCounts.keys()];
    const offBuildDrops = uniqueDrops.filter((id) => isOffBuildWeapon(byMaterial.get(id)));
    const requiredWeaponDrops = activeDrops.filter((id) => isRequiredBuildWeapon(byMaterial.get(id)));
    const secondaryDrops = uniqueDrops.filter((id) => !groupShortages.has(id) && (allShortages.get(id) || 0) > 0);
    const usefulIds = new Set([...activeDrops, ...secondaryDrops]);
    const wasteDrops = uniqueDrops.filter((id) => !usefulIds.has(id) && !offBuildDrops.includes(id));
    const afterStoneCost = calculateRequiredStones(afterShortages);
    const type = classifyStageCandidate(activeDrops, activeDropUnits, secondaryDrops);
    const candidate = {
      stage,
      type,
      isOffBuild: offBuildDrops.length > 0,
      hasRequiredWeapon: requiredWeaponDrops.length > 0,
      dropCounts,
      activeDrops,
      activeDropUnits,
      secondaryDrops,
      wasteDrops,
      offBuildDrops,
      requiredWeaponDrops,
      focusRuns,
      beforeStoneCost,
      afterStoneCost,
      stoneSaved: beforeStoneCost - afterStoneCost,
    };
    const signature = activeDropSignature(activeDrops, dropCounts);
    const current = byPrimarySignature.get(signature);

    if (!current || compareDuplicateStageCandidates(candidate, current) < 0) {
      byPrimarySignature.set(signature, candidate);
    }
  });

  return [...byPrimarySignature.values()];
}

function compareDuplicateStageCandidates(a, b) {
  return (
    typePriority(b.type) - typePriority(a.type) ||
    Number(b.hasRequiredWeapon) - Number(a.hasRequiredWeapon) ||
    b.stoneSaved - a.stoneSaved ||
    a.offBuildDrops.length - b.offBuildDrops.length ||
    a.wasteDrops.length - b.wasteDrops.length ||
    b.secondaryDrops.length - a.secondaryDrops.length ||
    compareStage(b.stage.id, a.stage.id)
  );
}

function compareStageCandidates(a, b) {
  return (
    typePriority(b.type) - typePriority(a.type) ||
    (b.weight || 0) - (a.weight || 0) ||
    Number(b.hasRequiredWeapon) - Number(a.hasRequiredWeapon) ||
    b.stoneSaved - a.stoneSaved ||
    b.activeDropUnits - a.activeDropUnits ||
    a.offBuildDrops.length - b.offBuildDrops.length ||
    a.wasteDrops.length - b.wasteDrops.length ||
    b.secondaryDrops.length - a.secondaryDrops.length ||
    b.focusRuns - a.focusRuns ||
    compareStage(b.stage.id, a.stage.id)
  );
}

function classifyStageCandidate(activeDrops, activeDropUnits, secondaryDrops) {
  if (activeDrops.length >= 2) return "primary-pair";
  if (activeDrops.length === 1 && activeDropUnits >= 2) return "primary-double";
  if (activeDrops.length === 1 && secondaryDrops.length > 0) return "mixed-secondary";
  return "single-waste";
}

function typePriority(type) {
  return {
    pair: 4,
    double: 3,
    "primary-single": 2,
    "upper-single": 2,
    single: 1,
    "primary-pair": 4,
    "primary-double": 3,
    "mixed-secondary": 2,
    "single-waste": 1,
  }[type] || 0;
}

function activeDropSignature(activeDrops, dropCounts) {
  return [...activeDrops]
    .sort()
    .map((id) => `${id}:${dropCounts.get(id) || 0}`)
    .join("|");
}

function cloneShortages(shortages) {
  return new Map(shortages);
}

function countDrops(drops) {
  const counts = new Map();
  drops.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  return counts;
}

function applyFocusRuns(shortages, candidate) {
  candidate.dropCounts.forEach((count, id) => {
    if (shortages.has(id)) shortages.set(id, Math.max(0, shortages.get(id) - candidate.focusRuns * count));
  });
}

function isOffBuildWeapon(material) {
  if (!material) return false;
  return (
    (state.build === "physical" && material.slot === "magicWeapon") ||
    (state.build === "magic" && material.slot === "physicalWeapon")
  );
}

function isRequiredBuildWeapon(material) {
  if (!material) return false;
  return (
    (state.build === "physical" && material.slot === "physicalWeapon") ||
    (state.build === "magic" && material.slot === "magicWeapon")
  );
}

function isStageWithinExplorationRank(stage) {
  const maxRank = state.targetRank + 1;
  return stage.drops.every((id) => {
    const material = byMaterial.get(id);
    return !material || material.rank <= maxRank;
  });
}

function renderPlanBlock(group, plan, allShortages, groups) {
  const block = document.createElement("section");
  block.className = "recommendation-group";
  block.dataset.groupKey = group.key;
  block.innerHTML = `
    <div class="recommendation">
      <div class="group-title">【${group.label}】</div>
      <div class="recommendation-top">
        <div class="stage-label">推奨</div>
        <div class="ratio" data-plan-stones>残り定石 ${plan.afterStoneCost}</div>
      </div>
    </div>
  `;

  plan.steps.forEach((step) => block.append(renderFocusStep(step, allShortages)));
  block.append(renderLeftovers(plan.leftovers));
  if (plan.sideCandidates.length > 0) {
    const sideTitle = document.createElement("div");
    sideTitle.className = "side-title";
    sideTitle.textContent = "補助候補";
    block.append(sideTitle);
    plan.sideCandidates.forEach((candidate) => block.append(renderSideCandidate(candidate, allShortages)));
  }
  recommendations.append(block);
}

function renderLeftovers(leftovers) {
  const row = document.createElement("div");
  row.className = "side-title";
  const labels = leftovers.map((id) => cycleMaterialLabel(byMaterial.get(id))).join(" / ");
  row.textContent = `残り: ${labels || "なし"}`;
  return row;
}

function renderFocusStep(candidate, shortages) {
  const row = document.createElement("div");
  row.className = "recommendation";
  row.dataset.mainStageId = candidate.stage.id;
  row.innerHTML = `
    <div class="recommendation-top">
      <div class="stage-label">${candidate.stage.label}</div>
      <div class="ratio" data-focus-runs>${candidate.focusRuns}周相当</div>
    </div>
    <div class="cycle-coverage" data-cycle-coverage>
      ${candidate.activeDrops.map((id) => `${cycleMaterialLabel(byMaterial.get(id))} +${candidate.focusRuns * candidate.dropCounts.get(id)}`).join(" / ")}
    </div>
    <div class="cycle-coverage" data-stone-progress>
      定石 ${candidate.beforeStoneCost} → ${candidate.afterStoneCost}（-${candidate.stoneSaved}）
    </div>
    <div class="drop-list">
      ${candidate.stage.drops.map((id) => dropItem(id, candidate.activeDrops.includes(id) || shortages.has(id))).join("")}
    </div>
  `;
  return row;
}

function renderSideCandidate(candidate, shortages) {
  const activeLabel = candidate.activeDrops
    .map((id) => `${cycleMaterialLabel(byMaterial.get(id))} +${candidate.dropCounts.get(id)}`)
    .join(" / ");
  const row = document.createElement("div");
  row.className = "recommendation side-candidate";
  row.innerHTML = `
    <div class="recommendation-top">
      <div class="stage-label">${candidate.stage.label}</div>
      <div class="ratio">定石 -${candidate.stoneSaved}</div>
    </div>
    <div class="cycle-coverage">
      ${activeLabel}
    </div>
    <div class="drop-list">
      ${candidate.stage.drops.map((id) => dropItem(id, candidate.activeDrops.includes(id) || shortages.has(id))).join("")}
    </div>
  `;
  return row;
}

function renderStageCard(stage, shortages) {
  const row = document.createElement("div");
  const usefulCount = stage.drops.filter((id) => shortages.has(id)).length;
  row.className = "recommendation";
  row.innerHTML = `
    <div class="recommendation-top">
      <div class="stage-label">${stage.label}</div>
      <div class="ratio">有効 ${usefulCount}</div>
    </div>
    <div class="drop-list">
      ${stage.drops.map((id) => dropItem(id, shortages.has(id))).join("")}
    </div>
  `;
  return row;
}

function renderFallbackStages(shortages) {
  const fallbackStages = DATA.stages
    .filter(isStageWithinExplorationRank)
    .map((stage) => {
      const usefulDrops = stage.drops.filter((id) => shortages.has(id));
      const score = usefulDrops.reduce((sum, id) => sum + shortages.get(id), 0);
      return { ...stage, usefulDrops, score };
    })
    .filter((stage) => stage.score > 0)
    .sort((a, b) => b.usefulDrops.length - a.usefulDrops.length || b.score - a.score || compareStage(b.id, a.id))
    .slice(0, 8);

  if (fallbackStages.length === 0) {
    recommendations.innerHTML = `<div class="complete-note">このRankの周回候補はデータ内にありません。必要定石数を目安にしてください。</div>`;
    return;
  }

  const title = document.createElement("div");
  title.className = "recommendation";
  title.innerHTML = `<div class="group-title">その他の候補</div>`;
  recommendations.append(title);
  fallbackStages.forEach((stage) => recommendations.append(renderStageCard(stage, shortages)));
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cycleMaterialLabel(item, includeMaterialRank = false) {
  if (!item) return "";
  if (includeMaterialRank) return materialName(item);
  return SLOT_LABELS[item.slot] || item.slotLabel || item.id;
}

function dropItem(id, isUseful) {
  const item = byMaterial.get(id);
  if (!item) return "";
  const title = materialName(item);
  const opacity = isUseful ? "1" : ".38";
  return `
    <div class="drop-item" title="${title}" style="opacity:${opacity}">
      <img src="${item.image}" alt="${title}">
      <span data-drop-owned-id="${id}">所持 ${materialCount(id)}</span>
    </div>
  `;
}

function gcd(values) {
  const nums = values.filter((value) => value > 0);
  if (nums.length === 0) return 1;
  const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
  return nums.reduce((acc, value) => gcd2(acc, value));
}

function compareStage(a, b) {
  const [aa, ab] = a.split("-").map(Number);
  const [ba, bb] = b.split("-").map(Number);
  return aa - ba || ab - bb;
}

function stageProgressScore(stageId) {
  const [chapter, stage] = stageId.split("-").map(Number);
  return chapter * 100 + stage;
}

function exportState() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "trickcal-equipment-planner.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result));
      const importedState = imported.state || imported;
      Object.assign(state, createDefaultState(), importedState);
      migrateCompletedStock(state);
      rankSelect.value = String(state.targetRank);
      buildSelect.value = state.build;
      inputModeSelect.value = state.inputMode;
      autoCalculateSelect.value = state.autoCalculate ? "on" : "off";
      persistAndRender();
    } catch {
      alert("インポートできませんでした。JSONの内容を確認してください。");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}
