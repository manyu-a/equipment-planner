const CHARACTER_STORAGE_KEY = "trickcal.characterEquipment.v1";
const FINISHED_EQUIPMENT_STORAGE_KEY = "trickcal.finishedEquipment.v1";
const EQUIPMENT_TYPES = ["hp", "pa", "ma", "pd", "md", "cd", "cr"];
const SLOT_NAMES = ["衣装", "武器", "物理防具", "魔法防具", "煌めく装飾品", "華麗な装飾品"];
const EQUIPMENT_CATEGORY_NAMES = ["衣装", "物理武器", "魔法武器", "物理防具", "魔法防具", "煌めく装飾品", "華麗な装飾品"];
const INVENTORY_CATEGORY_ORDER = ["pa", "ma", "hp", "pd", "md", "cd", "cr"];
const SPECIES_ORDER = ["妖精", "獣人", "エルフ", "精霊", "幽霊", "竜族", "魔女", "ミスティック"];
const JAPANESE_COLLATOR = new Intl.Collator("ja");
const characterList = document.querySelector("#characterList");
const characterCounter = document.querySelector("#characterCounter");
const characterSearch = document.querySelector("#characterSearch");
const trackedOnly = document.querySelector("#trackedOnly");
const characterSortMode = document.querySelector("#characterSortMode");
const characterSortDirection = document.querySelector("#characterSortDirection");
const registerAllButton = document.querySelector("#registerAllButton");
const unregisterAllButton = document.querySelector("#unregisterAllButton");
const characterTabButton = document.querySelector("#characterTabButton");
const inventoryTabButton = document.querySelector("#inventoryTabButton");
const characterTabPanel = document.querySelector("#characterTabPanel");
const inventoryTabPanel = document.querySelector("#inventoryTabPanel");
const gearRankFilter = document.querySelector("#gearRankFilter");
const gearSearch = document.querySelector("#gearSearch");
const gearInventoryCounter = document.querySelector("#gearInventoryCounter");
const gearInventoryList = document.querySelector("#gearInventoryList");

let characters = [];
let gearMap = {};
let savedCharacters = loadSavedCharacters();
let finishedEquipment = loadFinishedEquipment();

function loadSavedCharacters() {
  try {
    const stored = JSON.parse(localStorage.getItem(CHARACTER_STORAGE_KEY) || "{}");
    return stored.characters && typeof stored.characters === "object" ? stored.characters : {};
  } catch {
    return {};
  }
}

function saveCharacters() {
  localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify({ version: 1, characters: savedCharacters }));
}

function loadFinishedEquipment() {
  try {
    const stored = JSON.parse(localStorage.getItem(FINISHED_EQUIPMENT_STORAGE_KEY) || "{}");
    return stored.counts && typeof stored.counts === "object" && !Array.isArray(stored.counts) ? stored.counts : {};
  } catch {
    return {};
  }
}

function saveFinishedEquipment() {
  localStorage.setItem(FINISHED_EQUIPMENT_STORAGE_KEY, JSON.stringify({ version: 1, counts: finishedEquipment }));
}

function finishedCount(key) {
  return Math.max(0, Math.trunc(Number(finishedEquipment[key]) || 0));
}

function setFinishedCount(key, value) {
  const amount = Math.max(0, Math.trunc(Number(value) || 0));
  if (amount === 0) delete finishedEquipment[key];
  else finishedEquipment[key] = amount;
  saveFinishedEquipment();
  updateGearInventoryCounter();
  return amount;
}

function makeGearIcon(iconInfo, className) {
  const icon = document.createElement("span");
  icon.className = className;
  if (!iconInfo) {
    icon.textContent = "?";
    return icon;
  }
  const category = EQUIPMENT_TYPES.indexOf(iconInfo.type);
  icon.style.backgroundImage = 'url("../assets/equipment/rank' + iconInfo.rank + '.webp")';
  icon.style.backgroundPosition = (iconInfo.tier - 1) * 25 + "% " + (category / 6) * 100 + "%";
  return icon;
}

function progressFor(characterId, rank) {
  return (savedCharacters[characterId]?.equipped?.[String(rank)] || []).filter(Boolean).length;
}

function compareCharacterNames(a, b) {
  return JAPANESE_COLLATOR.compare(a.nameJa || a.name, b.nameJa || b.name);
}

function compareCodepointNames(a, b) {
  const left = a.nameJa || a.name;
  const right = b.nameJa || b.name;
  return left < right ? -1 : left > right ? 1 : 0;
}

function renderList() {
  const query = characterSearch.value.trim().toLowerCase();
  const visible = characters.filter((character) => {
    if (trackedOnly.checked && !savedCharacters[character.id]) return false;
    return (character.nameJa || character.name).toLowerCase().includes(query)
      || character.name.toLowerCase().includes(query)
      || character.id.includes(query);
  });

  const direction = characterSortDirection.value === "desc" ? -1 : 1;
  visible.sort((a, b) => {
    let difference;
    if (characterSortMode.value === "species") {
      difference = SPECIES_ORDER.indexOf(a.species) - SPECIES_ORDER.indexOf(b.species);
      if (difference === 0) difference = compareCodepointNames(a, b);
    } else if (characterSortMode.value === "rank") {
      const rankA = savedCharacters[a.id]?.rank;
      const rankB = savedCharacters[b.id]?.rank;
      if (rankA == null && rankB != null) return 1;
      if (rankA != null && rankB == null) return -1;
      difference = rankA == null ? 0 : rankA - rankB;
      if (difference === 0) difference = compareCharacterNames(a, b);
    } else {
      difference = compareCharacterNames(a, b);
    }
    return difference * direction || Number(a.id) - Number(b.id);
  });

  const registeredCount = characters.filter((character) => savedCharacters[character.id]).length;
  characterCounter.textContent = "登録 " + registeredCount + " / " + characters.length;
  registerAllButton.disabled = characters.length === 0 || registeredCount === characters.length;
  unregisterAllButton.disabled = registeredCount === 0;
  characterList.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "character-empty";
    empty.textContent = "該当するキャラはありません。";
    characterList.append(empty);
    return;
  }

  visible.forEach((character) => {
    const tracked = savedCharacters[character.id];
    const rank = tracked?.rank || 1;
    const equipped = tracked?.equipped?.[String(rank)] || [];
    const name = character.nameJa || character.name;
    const row = document.createElement("div");
    row.className = "character-row";
    row.classList.toggle("is-tracked", Boolean(tracked));

    const identity = document.createElement("div");
    identity.className = "character-identity";
    const avatar = document.createElement("img");
    avatar.src = "../assets/characters/" + character.iconKey + ".webp";
    avatar.alt = "";
    avatar.loading = "lazy";
    const label = document.createElement("strong");
    label.textContent = name;
    const state = document.createElement("span");
    state.className = "character-state-label";
    state.textContent = tracked ? "登録済み" : "未登録";
    const titleBlock = document.createElement("span");
    titleBlock.className = "character-name-block";
    titleBlock.append(label, state);
    identity.append(avatar, titleBlock);

    const rankControls = document.createElement("div");
    rankControls.className = "character-rank";
    const rankSelect = document.createElement("select");
    rankSelect.setAttribute("aria-label", name + "の現在Rank");
    rankSelect.disabled = !tracked;
    for (let n = 1; n <= 10; n += 1) {
      rankSelect.add(new Option("R" + n, String(n)));
    }
    rankSelect.value = String(rank);
    rankSelect.addEventListener("change", () => {
      if (!savedCharacters[character.id]) return;
      savedCharacters[character.id].rank = Number(rankSelect.value);
      saveCharacters();
      renderList();
    });

    const rankUp = document.createElement("button");
    rankUp.type = "button";
    rankUp.className = "ghost-button";
    rankUp.textContent = "↑";
    rankUp.title = "装備6枠が揃ったら次のRankへ";
    rankUp.setAttribute("aria-label", name + "を次のRankへ");
    rankUp.disabled = !tracked || rank >= 10 || progressFor(character.id, rank) !== 6;
    rankUp.addEventListener("click", () => {
      const current = savedCharacters[character.id];
      if (!current || current.rank >= 10 || progressFor(character.id, current.rank) !== 6) return;
      current.rank += 1;
      saveCharacters();
      renderList();
    });
    rankControls.append(rankSelect, rankUp);

    const gears = document.createElement("div");
    gears.className = "character-gears";
    (character.ranks[rank - 1] || []).forEach((piece, index) => {
      const iconInfo = gearMap[piece[0]];
      const isEquipped = Boolean(equipped[index]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "character-gear-button";
      button.classList.toggle("is-equipped", isEquipped);
      button.disabled = !tracked;
      button.setAttribute("aria-pressed", String(isEquipped));
      const pieceName = iconInfo?.nameJa || piece[1];
      button.title = SLOT_NAMES[index] + "： " + pieceName + "（" + (isEquipped ? "装着済み" : "未装着") + "）";
      button.setAttribute("aria-label", name + " " + button.title);

      button.append(makeGearIcon(iconInfo, "character-gear-icon"));
      button.addEventListener("click", () => {
        const entry = savedCharacters[character.id];
        if (!entry) return;
        entry.equipped ||= {};
        const values = entry.equipped[String(rank)] || [false, false, false, false, false, false];
        values[index] = !values[index];
        entry.equipped[String(rank)] = values;
        saveCharacters();
        renderList();
      });
      gears.append(button);
    });

    const progress = document.createElement("span");
    progress.className = "character-progress";
    progress.textContent = tracked ? progressFor(character.id, rank) + "/6" : "―";

    const registration = document.createElement("button");
    registration.type = "button";
    registration.className = "ghost-button character-registration-button";
    registration.textContent = tracked ? "解除" : "登録";
    registration.setAttribute("aria-label", name + (tracked ? "の登録を解除" : "を登録"));
    registration.addEventListener("click", () => {
      if (savedCharacters[character.id]) {
        if (!confirm(name + "の装備記録を削除しますか？")) return;
        delete savedCharacters[character.id];
      } else {
        savedCharacters[character.id] = { rank: 1, equipped: {} };
      }
      saveCharacters();
      renderList();
    });

    row.append(identity, rankControls, gears, progress, registration);
    characterList.append(row);
  });
}


registerAllButton.addEventListener("click", () => {
  characters.forEach((character) => {
    if (!savedCharacters[character.id]) {
      savedCharacters[character.id] = { rank: 1, equipped: {} };
    }
  });
  saveCharacters();
  renderList();
});

unregisterAllButton.addEventListener("click", () => {
  const registeredCount = characters.filter((character) => savedCharacters[character.id]).length;
  if (!registeredCount) return;
  if (!confirm("登録済みの使徒" + registeredCount + "名を全解除し、Rank・装着記録も削除しますか？")) return;
  savedCharacters = {};
  saveCharacters();
  renderList();
});

function activateTab(tab) {
  const showCharacters = tab === "characters";
  characterTabButton.classList.toggle("is-active", showCharacters);
  inventoryTabButton.classList.toggle("is-active", !showCharacters);
  characterTabButton.setAttribute("aria-selected", String(showCharacters));
  inventoryTabButton.setAttribute("aria-selected", String(!showCharacters));
  characterTabPanel.hidden = !showCharacters;
  inventoryTabPanel.hidden = showCharacters;
  if (!showCharacters) renderGearInventory();
}

characterTabButton.addEventListener("click", () => activateTab("characters"));
inventoryTabButton.addEventListener("click", () => activateTab("inventory"));
gearRankFilter.addEventListener("change", renderGearInventory);
gearSearch.addEventListener("input", renderGearInventory);

function updateGearInventoryCounter() {
  const allKeys = Object.keys(gearMap);
  const ownedKinds = allKeys.filter((key) => finishedCount(key) > 0).length;
  const total = allKeys.reduce((sum, key) => sum + finishedCount(key), 0);
  gearInventoryCounter.textContent = "所持 " + ownedKinds + "種類・計" + total + "個 / 全" + allKeys.length + "種類";
}

function makeStockCard(key, gear) {
  const card = document.createElement("article");
  card.className = "gear-stock-card";
  const name = gear.nameJa || key;
  card.title = "R" + gear.rank + " " + name;

  const icon = makeGearIcon(gear, "gear-stock-icon");
  icon.setAttribute("aria-hidden", "true");
  const nameLabel = document.createElement("span");
  nameLabel.className = "gear-stock-name";
  nameLabel.textContent = name;

  const stepper = document.createElement("div");
  stepper.className = "gear-stock-stepper";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.value = String(finishedCount(key));
  input.setAttribute("aria-label", "R" + gear.rank + " " + name + "の所持数");

  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.className = "ghost-button";
  decrease.textContent = "−";
  decrease.setAttribute("aria-label", name + "を1減らす");

  const increase = document.createElement("button");
  increase.type = "button";
  increase.className = "ghost-button";
  increase.textContent = "＋";
  increase.setAttribute("aria-label", name + "を1増やす");

  decrease.addEventListener("click", () => {
    input.value = String(setFinishedCount(key, finishedCount(key) - 1));
  });
  increase.addEventListener("click", () => {
    input.value = String(setFinishedCount(key, finishedCount(key) + 1));
  });
  input.addEventListener("input", () => {
    if (input.value !== "") setFinishedCount(key, input.value);
  });
  input.addEventListener("change", () => {
    input.value = String(setFinishedCount(key, input.value));
  });

  stepper.append(decrease, input, increase);
  card.append(icon, nameLabel, stepper);
  return card;
}

function renderGearInventory() {
  const selectedRank = gearRankFilter.value;
  const query = gearSearch.value.trim().toLowerCase();
  gearInventoryList.replaceChildren();
  updateGearInventoryCounter();

  const ranks = selectedRank === "all"
    ? [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    : [Number(selectedRank)];
  let visibleCount = 0;

  ranks.forEach((rank) => {
    const rankSection = document.createElement("section");
    rankSection.className = "gear-rank-group";
    const heading = document.createElement("h2");
    heading.textContent = "Rank " + rank;
    rankSection.append(heading);

    INVENTORY_CATEGORY_ORDER.forEach((type) => {
      const gears = Object.entries(gearMap)
        .filter(([key, gear]) => gear.rank === rank && gear.type === type
          && (gear.nameJa || "").toLowerCase().includes(query))
        .sort((a, b) => a[1].tier - b[1].tier);

      if (gears.length === 0) return;
      visibleCount += gears.length;
      const row = document.createElement("div");
      row.className = "gear-category";
      const categoryName = document.createElement("h3");
      categoryName.textContent = EQUIPMENT_CATEGORY_NAMES[EQUIPMENT_TYPES.indexOf(type)];
      const grid = document.createElement("div");
      grid.className = "gear-stock-grid";
      gears.forEach(([key, gear]) => grid.append(makeStockCard(key, gear)));
      row.append(categoryName, grid);
      rankSection.append(row);
    });

    if (rankSection.children.length > 1) gearInventoryList.append(rankSection);
  });

  if (visibleCount === 0) {
    const empty = document.createElement("p");
    empty.className = "character-empty";
    empty.textContent = "該当する装備はありません。";
    gearInventoryList.append(empty);
  }
}

characterSearch.addEventListener("input", renderList);
trackedOnly.addEventListener("change", renderList);
characterSortMode.addEventListener("change", renderList);
characterSortDirection.addEventListener("change", renderList);

Promise.all([
  fetch("../data/characters-equipment.json").then((response) => {
    if (!response.ok) throw new Error("キャラ情報を取得できませんでした。");
    return response.json();
  }),
  fetch("../data/wiki-equipment-map.json").then((response) => {
    if (!response.ok) throw new Error("装備画像情報を取得できませんでした。");
    return response.json();
  }),
]).then(([characterData, equipmentData]) => {
  characters = characterData.characters || [];
  gearMap = equipmentData.gear || {};
  renderList();
}).catch((error) => {
  characterList.textContent = error.message;
});
