const CHARACTER_SLOT_ORDER = ["armor", "weapon", "hat", "boots", "shinyAccessory", "fancyAccessory"];
const CHARACTER_DISPLAY_ORDER = [0, 2, 1, 4, 5, 3];
const CHARACTER_SLOT_NAMES = ["服", "武器", "帽子", "ブーツ", "煌めく", "華麗"];
const CHARACTER_GEAR_TYPES = ["hp", "pa", "ma", "pd", "md", "cd", "cr"];
const characterSelect = document.querySelector("#characterSelect");
const characterEquipmentPanel = document.querySelector("#networkCharacterEquipment");
const characterEquipmentSummary = document.querySelector("#networkCharacterEquipmentSummary");
const characterDataStatus = document.querySelector("#characterDataStatus");

let characterDefinitions = [];
let characterGearMap = {};
let trackedCharacters = {};
let finishedGearCounts = {};
let characterDataReady = false;

function readCharacterStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHARACTER_EQUIPMENT_STORAGE_KEY) || "{}");
    return saved.characters && typeof saved.characters === "object" ? saved.characters : {};
  } catch {
    return {};
  }
}

function readFinishedStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(FINISHED_EQUIPMENT_STORAGE_KEY) || "{}");
    return saved.counts && typeof saved.counts === "object" ? saved.counts : {};
  } catch {
    return {};
  }
}

function saveTrackedCharacters() {
  localStorage.setItem(CHARACTER_EQUIPMENT_STORAGE_KEY, JSON.stringify({ version: 1, characters: trackedCharacters }));
}

function saveFinishedGear() {
  localStorage.setItem(FINISHED_EQUIPMENT_STORAGE_KEY, JSON.stringify({ version: 1, counts: finishedGearCounts }));
}

function selectedCharacter() {
  if (!characterDataReady || !trackedCharacters[state.selectedCharacterId]) return null;
  return characterDefinitions.find((item) => item.id === state.selectedCharacterId) || null;
}

function slotStatus(slot) {
  const character = selectedCharacter();
  if (!character) return null;
  const normalizedSlot = slot === "physicalWeapon" || slot === "magicWeapon" ? "weapon" : slot;
  const index = CHARACTER_SLOT_ORDER.indexOf(normalizedSlot);
  if (index < 0) return null;
  const piece = character.ranks[state.targetRank - 1]?.[index];
  if (!piece) return null;
  const info = characterGearMap[piece[0]];
  if (normalizedSlot === "weapon" && info) {
    if (slot === "physicalWeapon" && info.type !== "pa") return null;
    if (slot === "magicWeapon" && info.type !== "ma") return null;
  }
  const equipped = Boolean(trackedCharacters[character.id]?.equipped?.[String(state.targetRank)]?.[index]);
  const stock = Math.max(0, Math.trunc(Number(finishedGearCounts[piece[0]]) || 0));
  return {
    index,
    key: piece[0],
    name: info?.nameJa || piece[1],
    info,
    equipped,
    stock,
    characterId: character.id,
  };
}

function activeCharacterBuild() {
  const character = selectedCharacter();
  const weapon = character?.ranks[state.targetRank - 1]?.[1];
  return characterGearMap[weapon?.[0]]?.type === "ma" ? "magic" : "physical";
}

function synchronizeCharacterBuild() {
  state.build = activeCharacterBuild();
}

function characterGearIcon(info) {
  const icon = document.createElement("span");
  icon.className = "network-character-gear-icon";
  if (!info) {
    icon.textContent = "?";
    return icon;
  }
  const index = CHARACTER_GEAR_TYPES.indexOf(info.type);
  icon.style.backgroundImage = 'url("./network/assets/equipment/rank' + info.rank + '.webp")';
  icon.style.backgroundPosition = (info.tier - 1) * 25 + "% " + (index / 6) * 100 + "%";
  return icon;
}

function setCharacterEquipped(index, checked, refresh = true) {
  const character = selectedCharacter();
  if (!character) return;
  const entry = trackedCharacters[character.id];
  entry.equipped ||= {};
  const equipped = entry.equipped[String(state.targetRank)] || [false, false, false, false, false, false];
  equipped[index] = checked;
  entry.equipped[String(state.targetRank)] = equipped;
  saveTrackedCharacters();
  renderCharacterEquipment();
  if (refresh) render();
}

function setGearStock(key, amount, refresh = true) {
  const normalized = Math.max(0, Math.trunc(Number(amount) || 0));
  if (normalized === 0) delete finishedGearCounts[key];
  else finishedGearCounts[key] = normalized;
  saveFinishedGear();
  if (refresh) {
    renderCharacterEquipment();
    render();
  }
  return normalized;
}

function addStockControls(target, status, onChange) {
  const controls = document.createElement("div");
  controls.className = "network-gear-stock-controls";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "ghost-button";
  minus.textContent = "−";
  minus.setAttribute("aria-label", status.name + "の在庫を1減らす");

  const number = document.createElement("input");
  number.type = "number";
  number.min = "0";
  number.step = "1";
  number.inputMode = "numeric";
  number.value = String(status.stock);
  number.setAttribute("aria-label", status.name + "の完成済み在庫数");

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "ghost-button";
  plus.textContent = "＋";
  plus.setAttribute("aria-label", status.name + "の在庫を1増やす");

  const commit = (value) => {
    number.value = String(setGearStock(status.key, value, false));
    onChange();
    renderCharacterEquipment();
  };
  minus.addEventListener("click", () => commit(Math.max(0, Number(number.value) - 1)));
  plus.addEventListener("click", () => commit(Number(number.value) + 1));
  number.addEventListener("input", () => {
    if (number.value !== "") {
      setGearStock(status.key, number.value, false);
      onChange();
    }
  });
  number.addEventListener("change", () => commit(number.value));
  controls.append(minus, number, plus);
  target.append(controls);
}

function renderCharacterEquipment() {
  characterEquipmentPanel.replaceChildren();
  const character = selectedCharacter();
  if (!character) {
    consumeEquipmentButton.disabled = true;
    characterEquipmentSummary.textContent = "使徒を選択してください。";
    return;
  }
  const slots = CHARACTER_DISPLAY_ORDER.map((index) => ({
    index,
    status: slotStatus(CHARACTER_SLOT_ORDER[index]),
  }));
  const equippedCount = slots.filter((item) => item.status?.equipped).length;
  const availableCount = slots.filter((item) => !item.status?.equipped && item.status?.stock > 0).length;
  consumeEquipmentButton.disabled = state.targetRank >= 10 && equippedCount === 6;
  characterEquipmentSummary.textContent =
    "Rank " + state.targetRank
    + " ・装着済み " + equippedCount + "/6 ・未装着の在庫あり " + availableCount + "枠";

  slots.forEach(({ index, status }) => {
    if (!status) return;
    const tile = document.createElement("div");
    tile.className = "network-character-gear-tile";
    tile.classList.toggle("is-equipped", status.equipped);
    const equip = document.createElement("button");
    equip.type = "button";
    equip.className = "network-character-gear-toggle";
    equip.setAttribute("aria-pressed", String(status.equipped));
    equip.setAttribute("aria-label", status.name + "を" + (status.equipped ? "未装着にする" : "装着済みにする"));
    equip.title = status.name;
    equip.append(characterGearIcon(status.info));
    const label = document.createElement("span");
    label.className = "network-character-gear-slot-label";
    label.textContent = CHARACTER_SLOT_NAMES[index];
    const tag = document.createElement("span");
    tag.className = "network-character-gear-state";
    tag.textContent = status.equipped ? "装着済み" : status.stock > 0 ? "在庫あり" : "未所持";
    equip.append(label, tag);
    equip.addEventListener("click", () => setCharacterEquipped(index, !slotStatus(CHARACTER_SLOT_ORDER[index])?.equipped));
    const stockLabel = document.createElement("span");
    stockLabel.className = "network-character-gear-stock-label";
    stockLabel.textContent = "完成品";
    tile.append(equip, stockLabel);
    addStockControls(tile, status, () => render());
    characterEquipmentPanel.append(tile);
  });
}

function renderCharacterChoices() {
  const registered = characterDefinitions
    .filter((character) => trackedCharacters[character.id])
    .sort((a, b) => (a.nameJa || a.name).localeCompare(b.nameJa || b.name, "ja"));
  characterSelect.replaceChildren();
  if (registered.length === 0) {
    characterSelect.add(new Option("登録済みの使徒がいません", ""));
    characterSelect.disabled = true;
    rankSelect.disabled = true;
    state.selectedCharacterId = "";
    characterDataStatus.textContent = "使徒一覧から使徒を登録してください。";
  } else {
    characterSelect.disabled = false;
    rankSelect.disabled = false;
    registered.forEach((character) => {
      const rank = trackedCharacters[character.id]?.rank || 1;
      characterSelect.add(new Option((character.nameJa || character.name) + "（R" + rank + "）", character.id));
    });
    if (!registered.some((character) => character.id === state.selectedCharacterId)) {
      state.selectedCharacterId = registered[0].id;
    }
    characterSelect.value = state.selectedCharacterId;
    state.targetRank = Math.max(1, Math.min(10, Math.trunc(Number(trackedCharacters[state.selectedCharacterId]?.rank) || 1)));
    rankSelect.value = String(state.targetRank);
    characterDataStatus.textContent = "";
  }
  synchronizeCharacterBuild();
  persistState();
}

function refreshCharacterData() {
  if (!characterDataReady) return;
  trackedCharacters = readCharacterStorage();
  finishedGearCounts = readFinishedStorage();
  renderCharacterChoices();
  renderCharacterEquipment();
}

function consumeCharacterEquipment() {
  if (editingNetworkMaterialId) finishNetworkMaterialEditor();
  const character = selectedCharacter();
  if (!character) return;

  const rank = state.targetRank;
  const gearSlots = selectedSlots().map((slot) => ({ slot, gear: slotStatus(slot) }));
  if (gearSlots.length !== 6 || gearSlots.some(({ gear }) => !gear || !gear.info)) {
    alert("使徒の装備データが不足しているため、消費できません。");
    return;
  }

  const pending = gearSlots.filter(({ gear }) => !gear.equipped);
  if (pending.length === 0 && rank >= 10) return;
  const stockChanges = new Map();
  const materialChanges = new Map();
  const requirements = requirementsForRank();
  const unknown = [];

  for (const { slot, gear } of pending) {
    const reserved = stockChanges.get(gear.key) || 0;
    if (gear.stock > reserved) {
      stockChanges.set(gear.key, reserved + 1);
      continue;
    }

    const recipe = requirements.map((req) => ({
      material: materialForRequirement(req, slot),
      amount: getRequirementAmount(req),
    }));
    if (!recipe.length || recipe.some(({ material, amount }) => !material || amount <= 0)) {
      unknown.push(gear.name);
      continue;
    }

    recipe.forEach(({ material, amount }) => {
      materialChanges.set(material.id, (materialChanges.get(material.id) || 0) + amount);
    });
  }

  if (unknown.length > 0) {
    alert("製作に必要な設計図データがありません。完成品を登録するか、装着状態を手動で更新してください。\n" + unknown.join("\n"));
    return;
  }

  const missing = [...materialChanges]
    .filter(([id, amount]) => materialCount(id) < amount)
    .map(([id, amount]) => materialSlotName(byMaterial.get(id)) + " " + (amount - materialCount(id)) + "個");

  const name = character.nameJa || character.name;
  const result = rank < 10
    ? "全6枠の装着を完了し、Rank " + (rank + 1) + "へ進めます。"
    : "Rank 10の全6枠の装着を完了します。";
  let message = name + "（Rank " + rank + "）の未装着 " + pending.length + "枠を装着します。\n"
    + "完成品在庫を優先して消費し、不足する完成品は設計図から製作します。\n"
    + result;
  if (missing.length > 0) {
    message += "\n\n不足している設計図：\n" + missing.join("\n")
      + "\n\n通常ページと同様に、不足分は0未満にせず、所持数を0まで消費して装着扱いにします。";
  }
  if (!confirm(message + "\n\n実行しますか？")) return;

  stockChanges.forEach((amount, key) => {
    const next = Math.max(0, (Number(finishedGearCounts[key]) || 0) - amount);
    if (next === 0) delete finishedGearCounts[key];
    else finishedGearCounts[key] = next;
  });
  materialChanges.forEach((amount, id) => {
    state.materials[id] = Math.max(0, materialCount(id) - amount);
  });

  const entry = trackedCharacters[character.id];
  entry.equipped ||= {};
  entry.equipped[String(rank)] = [true, true, true, true, true, true];
  if (rank < 10) entry.rank = rank + 1;
  saveFinishedGear();
  saveTrackedCharacters();
  renderCharacterChoices();
  renderCharacterEquipment();
  persistAndRender();
}

characterSelect.addEventListener("change", () => {
  if (editingNetworkMaterialId) finishNetworkMaterialEditor();
  const selectedId = characterSelect.value;
  if (!trackedCharacters[selectedId]) return;
  state.selectedCharacterId = selectedId;
  renderCharacterChoices();
  renderCharacterEquipment();
  render();
});

document.querySelector('[data-equipment-tab="inventory"]').click();
document.querySelector('[data-summary-tab="network"]').click();
document.querySelector("#networkPlacementSelect").addEventListener("change", () => {
  document.querySelector('[data-summary-tab="network"]').click();
});

window.TRICKCAL_NETWORK = {
  selected: selectedCharacter,
  slotStatus,
  onTargetRankChange(rank) {
    if (editingNetworkMaterialId) finishNetworkMaterialEditor();
    const character = selectedCharacter();
    if (!character || !Number.isInteger(rank) || rank < 1 || rank > 10) return;
    trackedCharacters[character.id].rank = rank;
    saveTrackedCharacters();
    renderCharacterChoices();
    renderCharacterEquipment();
    persistAndRender();
  },
  consumeCharacterEquipment,
  refreshFromStorage: refreshCharacterData,
};

window.addEventListener("storage", (event) => {
  if (event.key !== CHARACTER_EQUIPMENT_STORAGE_KEY && event.key !== FINISHED_EQUIPMENT_STORAGE_KEY) return;
  refreshCharacterData();
  render();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    refreshCharacterData();
    render();
  }
});

Promise.all([
  fetch("./network/data/characters-equipment.json").then((response) => {
    if (!response.ok) throw new Error("使徒データを取得できませんでした。");
    return response.json();
  }),
  fetch("./network/data/wiki-equipment-map.json").then((response) => {
    if (!response.ok) throw new Error("装備データを取得できませんでした。");
    return response.json();
  }),
]).then(([characterData, equipmentData]) => {
  characterDefinitions = characterData.characters || [];
  characterGearMap = equipmentData.gear || {};
  characterDataReady = true;
  refreshCharacterData();
  render();
}).catch((error) => {
  characterDataStatus.textContent = error.message;
  characterSelect.disabled = true;
  characterEquipmentPanel.replaceChildren();
});
