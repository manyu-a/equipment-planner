const CHARACTER_STORAGE_KEY = "trickcal.characterEquipment.v1";
const EQUIPMENT_TYPES = ["hp", "pa", "ma", "pd", "md", "cd", "cr"];
const SLOT_NAMES = ["衣装", "武器", "物理防具", "魔法防具", "煌めく装飾品", "華麗な装飾品"];
const characterList = document.querySelector("#characterList");
const characterCounter = document.querySelector("#characterCounter");
const characterSearch = document.querySelector("#characterSearch");
const trackedOnly = document.querySelector("#trackedOnly");

let characters = [];
let gearMap = {};
let savedCharacters = loadSavedCharacters();

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

function progressFor(characterId, rank) {
  return (savedCharacters[characterId]?.equipped?.[String(rank)] || []).filter(Boolean).length;
}

function renderList() {
  const query = characterSearch.value.trim().toLowerCase();
  const visible = characters.filter((character) => {
    if (trackedOnly.checked && !savedCharacters[character.id]) return false;
    return (character.nameJa || character.name).toLowerCase().includes(query)
      || character.name.toLowerCase().includes(query)
      || character.id.includes(query);
  });

  characterCounter.textContent = "登録 " + characters.filter((character) => savedCharacters[character.id]).length + " / " + characters.length;
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
    identity.append(avatar, label);

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

      const icon = document.createElement("span");
      icon.className = "character-gear-icon";
      if (iconInfo) {
        const category = EQUIPMENT_TYPES.indexOf(iconInfo.type);
        icon.style.backgroundImage = 'url("../assets/equipment/rank' + iconInfo.rank + '.webp")';
        icon.style.backgroundPosition = (iconInfo.tier - 1) * 25 + "% " + (category / 6) * 100 + "%";
      } else {
        icon.textContent = "?";
      }
      button.append(icon);
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

characterSearch.addEventListener("input", renderList);
trackedOnly.addEventListener("change", renderList);

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
