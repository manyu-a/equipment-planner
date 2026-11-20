const CHARACTER_STORAGE_KEY = "trickcal.characterEquipment.v1";
const GEAR_SLOTS = [
  "鎧・衣装",
  "武器",
  "帽子・物理防具",
  "ブーツ・魔法防具",
  "煌めく装飾品",
  "華麗な装飾品",
];

const characterList = document.querySelector("#characterList");
const characterCounter = document.querySelector("#characterCounter");
const characterSearch = document.querySelector("#characterSearch");
const trackedOnly = document.querySelector("#trackedOnly");
const characterName = document.querySelector("#characterName");
const characterStatus = document.querySelector("#characterStatus");
const characterRank = document.querySelector("#characterRank");
const characterProgress = document.querySelector("#characterProgress");
const characterGear = document.querySelector("#characterGear");
const registrationButton = document.querySelector("#registrationButton");
const rankUpButton = document.querySelector("#rankUpButton");
const characterSource = document.querySelector("#characterSource");

let characters = [];
let selectedId = "";
let savedCharacters = loadSavedCharacters();

function loadSavedCharacters() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHARACTER_STORAGE_KEY) || "{}");
    return saved.characters && typeof saved.characters === "object" ? saved.characters : {};
  } catch {
    return {};
  }
}

function saveCharacters() {
  localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify({ version: 1, characters: savedCharacters }));
}

function currentCharacter() {
  return characters.find((character) => character.id === selectedId);
}

function currentProgress(character, rank) {
  const equipped = savedCharacters[character.id]?.equipped?.[String(rank)] || [];
  return equipped.filter(Boolean).length;
}

function makeElement(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

function renderList() {
  const query = characterSearch.value.trim().toLowerCase();
  const onlyRegistered = trackedOnly.checked;
  const visible = characters.filter((character) => {
    if (onlyRegistered && !savedCharacters[character.id]) return false;
    return character.name.toLowerCase().includes(query) || character.id.includes(query);
  });

  visible.sort((a, b) => Number(Boolean(savedCharacters[b.id])) - Number(Boolean(savedCharacters[a.id])));
  const registeredCount = characters.filter((character) => savedCharacters[character.id]).length;
  characterCounter.textContent = "登録 " + registeredCount + " / " + characters.length;
  characterList.replaceChildren();

  if (visible.length === 0) {
    characterList.append(makeElement("p", "character-empty", "該当するキャラはありません。"));
    return;
  }

  visible.forEach((character) => {
    const tracked = savedCharacters[character.id];
    const row = makeElement("button", "character-item");
    row.type = "button";
    row.classList.toggle("is-active", character.id === selectedId);
    row.append(makeElement("span", "character-avatar", character.name.slice(0, 1).toUpperCase()));
    row.append(makeElement("span", "character-item-name", character.name));
    row.append(makeElement("span", "character-item-rank", tracked ? "R" + tracked.rank + "・" + currentProgress(character, tracked.rank) + "/6" : "未登録"));
    row.addEventListener("click", () => {
      selectedId = character.id;
      renderList();
      renderEditor();
    });
    characterList.append(row);
  });
}

function renderEditor() {
  const character = currentCharacter();
  if (!character) return;

  const tracked = savedCharacters[character.id];
  const rank = tracked?.rank || 1;
  const pieces = character.ranks[rank - 1] || [];
  const equipped = tracked?.equipped?.[String(rank)] || [];

  characterName.textContent = character.name;
  characterStatus.textContent = tracked ? "管理中の使徒" : "未登録・装備情報のプレビュー";
  registrationButton.textContent = tracked ? "登録を解除" : "このキャラを登録";
  registrationButton.disabled = false;
  characterSource.href = "https://soshage.com/trickcal/unit/" + character.id;
  characterRank.replaceChildren();

  for (let i = 1; i <= character.ranks.length; i += 1) {
    const option = new Option("Rank " + i, String(i));
    characterRank.add(option);
  }

  characterRank.value = String(rank);
  characterRank.disabled = !tracked;
  characterProgress.textContent = "装着済み " + currentProgress(character, rank) + " / " + pieces.length;
  characterGear.replaceChildren();

  pieces.forEach((piece, index) => {
    const row = makeElement("label", "character-gear-item");
    const isEquipped = Boolean(equipped[index]);
    row.classList.toggle("is-equipped", isEquipped);
    row.classList.toggle("is-disabled", !tracked);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isEquipped;
    checkbox.disabled = !tracked;

    const info = makeElement("span", "character-gear-info");
    info.append(makeElement("strong", "", piece[1]));
    info.append(makeElement("small", "", GEAR_SLOTS[index]));
    row.append(checkbox, makeElement("span", "character-gear-index", String(index + 1)), info);

    checkbox.addEventListener("change", () => {
      const entry = savedCharacters[character.id];
      if (!entry) return;
      entry.equipped ||= {};
      const values = entry.equipped[String(rank)] || [false, false, false, false, false, false];
      values[index] = checkbox.checked;
      entry.equipped[String(rank)] = values;
      saveCharacters();
      renderList();
      renderEditor();
    });

    characterGear.append(row);
  });

  rankUpButton.disabled = !tracked || rank >= 10 || currentProgress(character, rank) !== pieces.length;
  rankUpButton.textContent = rank >= 10 ? "Rank 10（最大）" : "Rank " + (rank + 1) + "へ進める";
}

registrationButton.addEventListener("click", () => {
  const character = currentCharacter();
  if (!character) return;
  if (savedCharacters[character.id]) {
    delete savedCharacters[character.id];
  } else {
    savedCharacters[character.id] = { rank: 1, equipped: {} };
  }
  saveCharacters();
  renderList();
  renderEditor();
});

characterRank.addEventListener("change", () => {
  const character = currentCharacter();
  if (!character || !savedCharacters[character.id]) return;
  savedCharacters[character.id].rank = Number(characterRank.value);
  saveCharacters();
  renderList();
  renderEditor();
});

rankUpButton.addEventListener("click", () => {
  const character = currentCharacter();
  if (!character) return;
  const tracked = savedCharacters[character.id];
  if (!tracked || tracked.rank >= 10 || currentProgress(character, tracked.rank) !== 6) return;
  tracked.rank += 1;
  saveCharacters();
  renderList();
  renderEditor();
});

characterSearch.addEventListener("input", renderList);
trackedOnly.addEventListener("change", renderList);

fetch("../data/characters-equipment.json")
  .then((response) => {
    if (!response.ok) throw new Error("装備データを取得できませんでした。");
    return response.json();
  })
  .then((data) => {
    characters = data.characters || [];
    selectedId = characters.find((character) => savedCharacters[character.id])?.id || characters[0]?.id || "";
    renderList();
    renderEditor();
  })
  .catch((error) => {
    characterStatus.textContent = error.message;
    characterList.append(makeElement("p", "character-empty", error.message));
  });
